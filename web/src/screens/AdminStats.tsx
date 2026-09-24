// ─────────────────────────────────────────────────────────────────────────────
// screens/AdminStats.tsx — 운영 통계 (루트만, 2026-09-24)
//
// **한 화면에 세 원본.** 원본마다 세는 법이 달라 숫자를 섞지 않는다 — 칸마다 어디서 왔는지 적는다.
//   우리 DB   가입 · 로그인 · ★ · 검색(v4.7.0~) · 페이지뷰(2026-09-24~)   — Neon, 서버가 모아 센 값
//   GA4       방문자 · 페이지뷰                                             — 서버가 Data API 로 받아 준다
// 방문자 수는 두 원본이 다를 수밖에 없다 — GA4 는 쿠키 기준이고 '통계 끄기' 면 둘 다 안 센다.
//
// **기간 하나가 전부를 정한다.** 9/14부터 · 7 · 30 · 90일 — 위 한 줄의 고름이 아래 모든 칸에 같이 걸려야 숫자끼리 맞는다.
// 기본은 '9/14부터' — 서비스를 연 날부터 오늘까지 한 번에 본다 (2026-09-24 주인 요청).
// 다시 받는 동안은 앞 숫자를 흐리게 둔다 — 빈 틀로 깜빡이지 않는다.
//
// 루트 판정은 화면(lib/useLocked 'root')과 서버(/v1/admin/stats) 둘 다 한다. 화면 쪽은 막힌 요청을 안 보내려는 것이다.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { serverApi, ApiError, type AdminStats as Stats, type StatRanked } from '../lib/serverApi';
import { useDexSoft } from '../lib/data';
import { routeById } from '../routes';
import { count, percent, DASH } from '../lib/cell';
import { Segmented, Callout } from '../ds';
import { DayColumns, RankTable, type RankRow } from '../components/StatChart';

// 서비스를 연 날 (한국 날짜) — '9/14부터' 는 그날부터 오늘까지의 일수로 바꿔 부른다
const OPENED = '2026-09-14';

/** 한국 날짜로 OPENED 부터 오늘까지 — 오늘을 넣어 센다 */
export function daysSinceOpened(now: number = Date.now()): number {
  const today = new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return Math.round((Date.parse(today) - Date.parse(OPENED)) / 86_400_000) + 1;
}

// 서버가 받는 기간 끝 (server/src/lib/stats.ts STATS_LIMITS) — 밖의 값은 스키마가 400 으로 돌려보내 화면이 통째로 선다
const DAYS_MIN = 7;
const DAYS_MAX = 400;

/** '9/14부터' 로 부를 일수 — 연 지 7일 전이거나 400일이 넘으면 끝에 붙인다 (2027-10 부터는 최근 400일) */
export function sinceDays(now: number = Date.now()): number {
  return Math.min(DAYS_MAX, Math.max(DAYS_MIN, daysSinceOpened(now)));
}

const PERIODS = [
  { id: 'since', label: '9/14부터' },
  { id: '7', label: '7일' },
  { id: '30', label: '30일' },
  { id: '90', label: '90일' },
];

// 검색창 구분 — lib/track.ts trackSearchPick 을 부르는 자리의 이름
const SURFACE_KO: Record<string, string> = {
  dex: '도감 검색창',
  solo_boss: '솔플 계산기 · 보스',
  solo_deck: '솔플 계산기 · 덱',
  pvp_deck: 'PvP 덱 짜기',
  iv_rank: 'PvP 개체값 순위',
};

function countryName(code: string): string {
  if (code === 'ZZ') return '알 수 없음';
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) ?? code;
  } catch { return code; }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <b className="stat-tile__value">{value}</b>
      {sub ? <span className="stat-tile__sub">{sub}</span> : null}
    </div>
  );
}

const ranked = (rows: readonly StatRanked[], label: (key: string) => string): RankRow[] =>
  rows.map((row) => ({ key: row.key, label: label(row.key), value: row.hits, sub: row.visitors }));

export default function AdminStats() {
  const [days, setDays] = useState('since');
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dex = useDexSoft();

  const load = useCallback(async (period: string) => {
    setBusy(true);
    setError('');
    try {
      setStats(await serverApi.adminStats(period === 'since' ? sinceDays() : Number(period)));
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 403 ? '루트 관리자만 볼 수 있어요' : '통계를 받지 못했어요. 잠시 뒤 다시 눌러 주세요');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  const monName = useCallback((id: number) => dex?.DEX_DATA.names[String(id)] ?? `#${id}`, [dex]);
  const routeName = (id: string) => {
    const route = routeById(id);
    return route ? (route.title ?? route.nav ?? id) : id;
  };

  if (!stats) {
    return (
      <div className="stat-page">
        {error ? <Callout tone="warn" title={error} /> : <p className="stat-page__wait" aria-busy="true">통계를 받는 중이에요…</p>}
      </div>
    );
  }

  const { users, favorites, search, views, ga4 } = stats;
  return (
    <div className={`stat-page${busy ? ' is-busy' : ''}`}>
      {/* 고름은 한 줄, 맨 위 — 아래 모든 칸에 같이 걸린다 */}
      <div className="stat-page__filters">
        <Segmented label="기간" items={PERIODS} value={days} onPick={setDays} />
        <button type="button" className="tool-btn" onClick={() => void load(days)} disabled={busy}>새로 받기</button>
        <span className="stat-page__stamp">{`${stats.generatedAt.slice(0, 16).replace('T', ' ')} UTC 기준 · 운영 채널만`}</span>
      </div>
      {error ? <Callout tone="warn" title={error} /> : null}

      <section className="stat-sec">
        <h2 className="stat-sec__title">한눈에 <small>{days === 'since' ? `9/14부터 ${stats.days}일` : `최근 ${stats.days}일`}</small></h2>
        <div className="stat-tiles">
          <Tile label="가입한 사람" value={count(users.total)} sub={`승인 대기 ${count(users.pending)} · 실험 기능 ${count(users.beta)}`} />
          <Tile label="7일 안에 로그인" value={count(users.active7d)} sub={`오늘 ${count(users.active1d)} · 30일 ${count(users.active30d)}`} />
          <Tile label="살아 있는 로그인" value={count(stats.sessions.active)} sub="만료 · 로그아웃 안 된 기기" />
          <Tile label="★ 담긴 수" value={count(favorites.total)} sub={`담은 사람 ${count(favorites.people)}`} />
          <Tile label="검색에서 고른 수" value={count(search.hits)} sub={`찾은 사람 ${count(search.visitors)}`} />
          <Tile label="방문자 (GA4)" value={ga4.status === 'ok' ? count(ga4.users) : DASH}
            sub={ga4.status === 'ok' ? `처음 온 사람 ${count(ga4.newUsers)} (${percent(ga4.newUsers, ga4.users)})` : '아래 GA4 칸 참고'} />
          <Tile label="페이지뷰 (GA4)" value={ga4.status === 'ok' ? count(ga4.views) : DASH}
            sub={ga4.status === 'ok' ? `방문 ${count(ga4.sessions)}회` : '아래 GA4 칸 참고'} />
        </div>
      </section>

      <section className="stat-sec">
        <h2 className="stat-sec__title">방문 <small>GA4</small></h2>
        {ga4.status === 'ok' ? (
          <>
            <div className="stat-grid">
              <DayColumns title="방문자" unit="명" summable={false} rows={ga4.perDay.map((row) => ({ day: row.day, value: row.users }))} />
              <DayColumns title="페이지뷰" unit="회" rows={ga4.perDay.map((row) => ({ day: row.day, value: row.views }))} />
            </div>
            <div className="stat-grid">
              <RankTable title="많이 본 주소" valueHead="페이지뷰" subHead="방문자" empty="아직 없어요"
                rows={ga4.pages.map((row) => ({ key: row.key, label: row.key, value: row.views, sub: row.users }))} />
              <RankTable title="나라" valueHead="방문자" subHead="페이지뷰" empty="아직 없어요"
                rows={ga4.countries.map((row) => ({ key: row.key, label: countryName(row.key), value: row.users, sub: row.views }))} />
            </div>
          </>
        ) : (
          <Callout tone={ga4.status === 'off' ? 'info' : 'warn'} title={ga4.status === 'off' ? 'GA4 칸이 꺼져 있어요' : 'GA4 숫자를 못 받았어요'}>
            <p>{ga4.reason}</p>
            <p>켜는 법 — ① GA4 관리 → 속성 액세스 관리에 서버 서비스 계정을 뷰어로 추가 ② moncamp api 프로젝트에서 Google Analytics Data API 사용 ③ 저장소 변수 GA4_PROPERTY_ID 에 속성 ID(숫자) — docs/OPERATIONS.md 운영 통계 절</p>
          </Callout>
        )}
      </section>

      <section className="stat-sec">
        <h2 className="stat-sec__title">화면별 페이지뷰 <small>moncamp 수집</small></h2>
        <DayColumns title="페이지뷰" unit="회" rows={views.perDay.map((row) => ({ day: row.day, value: row.hits }))}
          note="9월 24일부터 셉니다 · 화면 id 만 — 주소 · 검색어 · 상세의 포켓몬 번호는 안 받아요" />
        <div className="stat-grid">
          <RankTable title="많이 연 화면" valueHead="페이지뷰" subHead="방문자" empty="아직 없어요"
            rows={ranked(views.top, routeName)} />
          <RankTable title="나라" valueHead="페이지뷰" subHead="방문자" empty="아직 없어요"
            rows={ranked(views.countries, countryName)} />
        </div>
      </section>

      <section className="stat-sec">
        <h2 className="stat-sec__title">검색 <small>moncamp 수집</small></h2>
        <DayColumns title="검색에서 고른 수" unit="회" rows={search.perDay.map((row) => ({ day: row.day, value: row.hits }))} />
        <div className="stat-grid">
          <RankTable title="많이 고른 포켓몬" valueHead="고른 수" subHead="사람" empty="아직 없어요"
            rows={ranked(search.top, (key) => key)} />
          <RankTable title="검색창" valueHead="고른 수" subHead="사람" empty="아직 없어요"
            rows={ranked(search.surfaces, (key) => SURFACE_KO[key] ?? key)} />
          <RankTable title="나라" valueHead="고른 수" subHead="사람" empty="아직 없어요"
            rows={ranked(search.countries, countryName)} />
        </div>
      </section>

      <section className="stat-sec">
        <h2 className="stat-sec__title">가입 · ★</h2>
        <div className="stat-grid">
          <DayColumns title="새로 가입" unit="명" rows={users.newPerDay.map((row) => ({ day: row.day, value: row.count }))} />
          <RankTable title="많이 담긴 포켓몬 ★" valueHead="담은 사람" empty="아직 없어요"
            rows={favorites.top.map((row) => ({ key: String(row.dex), label: monName(row.dex), value: row.users }))} />
        </div>
        <p className="stat-page__note">{`역할 — 루트 ${count(users.root)} · 관리자 ${count(users.admin)} · 승인 ${count(users.approved)} · 대기 ${count(users.pending)}`}</p>
      </section>
    </div>
  );
}
