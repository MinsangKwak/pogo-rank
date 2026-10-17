// ─────────────────────────────────────────────────────────────────────────────
// lib/statRange.ts — 관리자 통계의 기간 규칙 (2026-09-24 AdminStats 에서 2026-10-16 에 떼어 냈다)
//
// **기간 하나가 전부를 정한다.** 오늘 · 9/14부터 · 7 · 14 · 21 · 30일 · 달력으로 직접 — 운영 대시보드(AdminHome)와
// 상세 통계(AdminStats)가 같은 규칙을 써야 두 화면의 숫자가 맞는다. 그래서 화면이 아니라 여기 한 벌이다.
// '오늘' 은 한국 날짜 오늘 하루만 서버에 from = to 로 묻는다 (2026-10-02 주인 요청).
// 기본은 '9/14부터' — 서비스를 연 날부터 오늘까지 한 번에 본다 (2026-09-24 주인 요청).
// '직접 고르기' 는 시작 · 끝 날짜를 달력(input type=date)으로 받아 서버에 from · to 로 묻는다 (2026-09-30 주인 요청).
// ─────────────────────────────────────────────────────────────────────────────
import { count, DASH } from './cell';

// 서비스를 연 날 (한국 날짜) — '9/14부터' 는 그날부터 오늘까지의 일수로 바꿔 부른다
export const OPENED = '2026-09-14';

/** 지금의 한국 날짜 'YYYY-MM-DD' — 달력의 끝(max)이자 '오늘' */
export function kstToday(now: number = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 두 날짜 사이의 날 수 — 양끝을 넣는다. 꼴이 틀리면 NaN */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** 한국 날짜로 OPENED 부터 오늘까지 — 오늘을 넣어 센다 */
export function daysSinceOpened(now: number = Date.now()): number {
  return daysBetween(OPENED, kstToday(now));
}

// 서버가 받는 기간 끝 (server/src/lib/stats.ts STATS_LIMITS) — 밖의 값은 스키마가 400 으로 돌려보내 화면이 통째로 선다.
// 검사(statcells.test.ts)가 두 쪽을 맞춘다
export const DAYS_MIN = 7;
export const DAYS_MAX = 400;

/** '9/14부터' 로 부를 일수 — 연 지 7일 전이거나 400일이 넘으면 끝에 붙인다 (2027-10 부터는 최근 400일) */
export function sinceDays(now: number = Date.now()): number {
  return Math.min(DAYS_MAX, Math.max(DAYS_MIN, daysSinceOpened(now)));
}

/** '9/14부터' 의 이름 — 400일이 넘으면 앞이 잘리므로 '최근 400일' 로 바꿔 부른다. 잘린 기간을 전 기간이라 적지 않는다 */
export function sinceLabel(now: number = Date.now()): string {
  return daysSinceOpened(now) > DAYS_MAX ? `최근 ${DAYS_MAX}일` : '9/14부터';
}

// '9/14부터' 의 이름은 그릴 때 정한다 (periodItems) — 모듈에서 정하면 탭을 켜 둔 채 경계를 넘을 때 옛 이름이 남는다
export const PERIODS = [
  { id: 'today', label: '오늘' },
  { id: 'since', label: '9/14부터' },
  { id: '7', label: '7일' },
  { id: '14', label: '14일' },
  { id: '21', label: '21일' },
  { id: '30', label: '30일' },
  { id: 'custom', label: '직접 고르기' },
];

/** 받은 숫자의 시각으로 이름을 정한다 — 버튼과 요약이 같은 때를 본다 */
export const periodItems = (label: string) => PERIODS.map((one) => (one.id === 'since' ? { ...one, label } : one));

/** 달력으로 고른 시작 · 끝이 서버가 받는 기간인지 — 틀리면 그 까닭. 서버(resolveRange)와 같은 규칙 */
export function customIssue(draft: { from: string; to: string }, today: string = kstToday()): string {
  const days = daysBetween(draft.from, draft.to);
  if (!draft.from || !draft.to || !Number.isFinite(days)) return '시작과 끝 날짜를 골라 주세요';
  if (draft.from > draft.to) return '시작이 끝보다 늦어요';
  if (draft.to > today) return '끝은 오늘까지예요';
  if (days > DAYS_MAX) return `기간은 ${DAYS_MAX}일까지예요`;
  return '';
}

/** 고른 기간의 이름 — '오늘 10/2' · '9/14부터 17일' · '최근 7일' · '9/14 ~ 9/30 17일' */
export function periodName(period: string, stats: { days: number; from?: string | undefined; to?: string | undefined }, since: string): string {
  if (period === 'today' && stats.to) return `오늘 ${shortDay(stats.to)}`;
  if (period === 'custom' && stats.from && stats.to) return `${shortDay(stats.from)} ~ ${shortDay(stats.to)} ${count(stats.days)}일`;
  return period === 'since' && since === '9/14부터' ? `9/14부터 ${count(stats.days)}일` : `최근 ${count(stats.days)}일`;
}

// '2026-09-30' → '9/30'
function shortDay(day: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  return match ? `${Number(match[1])}/${Number(match[2])}` : DASH;
}

/** 기간 양끝 한 줄 — '2026.10.10 – 10.16' (피그마 A01). 양끝이 없으면(옛 서버) 대시 */
export function rangeLabel(from?: string, to?: string): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from ?? '');
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to ?? '');
  if (!a || !b) return DASH;
  const tail = a[1] === b[1] ? `${b[2]}.${b[3]}` : `${b[1]}.${b[2]}.${b[3]}`;
  return from === to ? `${a[1]}.${a[2]}.${a[3]}` : `${a[1]}.${a[2]}.${a[3]} – ${tail}`;
}
