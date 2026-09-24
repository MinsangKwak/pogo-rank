// ─────────────────────────────────────────────────────────────────────────────
// lib/ga4.ts — GA4 의 방문자 · 페이지뷰를 관리자 통계 화면에 (2026-09-24)
//
// **열쇠 파일이 없다.** Cloud Run 이 돌리는 서비스 계정의 토큰을 메타데이터 서버에서 받아 부른다 —
// 저장소에도 시크릿에도 GA 열쇠가 안 생긴다 (Workload Identity 와 같은 생각). 대신 GA4 속성의
// '속성 액세스 관리' 에 그 서비스 계정을 뷰어로 넣어 줘야 한다 (docs/OPERATIONS.md 통계 화면 절).
//
// **실패는 화면을 안 세운다.** GA 가 안 되면 우리 DB 숫자만이라도 보여야 한다 — 그래서 던지지 않고
// 상태(off · error)를 돌려주고, 화면이 그 말을 그대로 적는다. 권한이 빠졌는지 API 가 꺼졌는지가
// 화면에서 보여야 콘솔을 뒤지지 않는다.
//
// GA 할당량을 아끼려고 같은 기간은 10분 동안 기억한다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export interface Ga4Day { day: string; users: number; views: number; sessions: number }
export interface Ga4Row { key: string; views: number; users: number }

export type Ga4Stats =
  | { status: 'off'; reason: string }
  | { status: 'error'; reason: string }
  | {
    status: 'ok';
    users: number;
    newUsers: number;
    views: number;
    sessions: number;
    perDay: Ga4Day[];
    pages: Ga4Row[];
    countries: Ga4Row[];
  };

const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const CACHE_MS = 10 * 60 * 1000;
// 실패는 짧게 기억한다 — 콘솔에서 권한을 고친 뒤 10분을 기다리게 하지 않는다
const ERROR_CACHE_MS = 60 * 1000;
const TIMEOUT_MS = 8000;

type Fetch = typeof fetch;

interface Report {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
  totals?: { metricValues?: { value?: string }[] }[];
}

const cache = new Map<string, { at: number; value: Ga4Stats }>();

/** 검사가 기억을 비운다 */
export function clearGa4Cache(): void { cache.clear(); }

function n(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// '20260923' → '2026-09-23'
function isoDay(value: string | undefined): string {
  const raw = value ?? '';
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
}

// GA 는 방문이 없는 날의 줄을 안 준다 — 빈 날을 0 으로 채워야 그래프가 그날을 건너뛰지 않는다.
// 날짜는 GA4 속성의 시간대(한국)로 온다 — 우리도 한국 날짜로 센다
export function fillDays(days: number, rows: Ga4Day[], now: Date = new Date()): Ga4Day[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const out: Ga4Day[] = [];
  const kstToday = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(Date.UTC(kstToday.getUTCFullYear(), kstToday.getUTCMonth(), kstToday.getUTCDate() - back)).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, users: 0, views: 0, sessions: 0 });
  }
  return out;
}

async function token(fetchImpl: Fetch): Promise<string> {
  const res = await fetchImpl(`${METADATA_TOKEN}?scopes=${encodeURIComponent(SCOPE)}`, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`메타데이터 토큰 ${res.status}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('메타데이터 토큰이 비었습니다');
  return body.access_token;
}

async function report(fetchImpl: Fetch, access: string, property: string, body: object): Promise<Report> {
  const res = await fetchImpl(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string } };
    // 흔한 둘은 사람 말로 — 무엇을 눌러야 하는지가 보이게
    if (res.status === 403 && /has not been used|is disabled/i.test(detail.error?.message ?? '')) {
      throw new Error('moncamp api 프로젝트에서 Google Analytics Data API 가 꺼져 있습니다');
    }
    if (res.status === 403) throw new Error('GA4 속성에 서버 서비스 계정 권한(뷰어)이 없습니다');
    throw new Error(`GA4 ${res.status} ${detail.error?.status ?? ''}`.trim());
  }
  return (await res.json()) as Report;
}

export async function ga4Stats(property: string, days: number, fetchImpl: Fetch = fetch): Promise<Ga4Stats> {
  if (!property) return { status: 'off', reason: 'GA4_PROPERTY_ID 가 설정되지 않았습니다' };
  if (!/^\d{5,15}$/.test(property)) return { status: 'error', reason: 'GA4_PROPERTY_ID 는 숫자여야 합니다 (측정 ID G-… 가 아니라 속성 ID)' };
  const key = `${property}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value.status === 'ok' ? CACHE_MS : ERROR_CACHE_MS)) return hit.value;
  let value: Ga4Stats;
  try {
    const access = await token(fetchImpl);
    const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
    const [daily, pages, countries] = await Promise.all([
      report(fetchImpl, access, property, {
        dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }, { name: 'newUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        metricAggregations: ['TOTAL'],
      }),
      report(fetchImpl, access, property, {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      }),
      report(fetchImpl, access, property, {
        dateRanges,
        dimensions: [{ name: 'countryId' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      }),
    ]);
    const totals = daily.totals?.[0]?.metricValues ?? [];
    const rows = (one: Report): Ga4Row[] => (one.rows ?? []).map((row) => ({
      key: row.dimensionValues?.[0]?.value ?? '',
      views: n(row.metricValues?.[0]?.value),
      users: n(row.metricValues?.[1]?.value),
    })).filter((row) => row.key);
    value = {
      status: 'ok',
      users: n(totals[0]?.value),
      views: n(totals[1]?.value),
      sessions: n(totals[2]?.value),
      newUsers: n(totals[3]?.value),
      perDay: fillDays(days, (daily.rows ?? []).map((row) => ({
        day: isoDay(row.dimensionValues?.[0]?.value),
        users: n(row.metricValues?.[0]?.value),
        views: n(row.metricValues?.[1]?.value),
        sessions: n(row.metricValues?.[2]?.value),
      }))),
      pages: rows(pages),
      countries: rows(countries),
    };
  } catch (error) {
    value = { status: 'error', reason: error instanceof Error ? error.message : String(error) };
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}
