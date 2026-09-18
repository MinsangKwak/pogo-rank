// ─────────────────────────────────────────────────────────────────────────────
// lib/favnews.ts — 📣 담아 둔 포켓몬에 잡힌 일정 (v3 components/favnews.js 이식)
//
// 담아 두면 그 포켓몬의 커뮤니티 데이·스포트라이트 아워·레이드 일정을 챙겨 준다.
// ★ 를 누를 이유가 여기서 생긴다 — 담기만 하고 아무 일도 안 일어나면 그 버튼은 장식이다.
// ─────────────────────────────────────────────────────────────────────────────
import type { FavEvent } from '../types/data';

export const FAV_NEWS_LABEL: Record<string, string> = {
  'community-day': '커뮤니티 데이',
  'pokemon-spotlight-hour': '스포트라이트 아워',
  'raid-battles': '레이드 보스',
};

// 이보다 먼 일정은 아직 챙길 일이 아니다 — 지금 할 수 있는 일만 남긴다
const WINDOW_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FavNewsRow { event: FavEvent; dex: number[]; start: number; days: number }

/** 남은 날. **오늘 0시 기준**이라 '오늘 저녁 스포트라이트' 가 D-0 으로 잡힌다 */
function daysUntil(start: number): number {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return Math.round((new Date(start).setHours(0, 0, 0, 0) - midnight.getTime()) / DAY_MS);
}

function rows(events: readonly FavEvent[], match: (dex: number) => boolean): FavNewsRow[] {
  const now = Date.now();
  const until = now + WINDOW_DAYS * DAY_MS;
  const out: FavNewsRow[] = [];
  for (const event of events) {
    const mine = (event.dex ?? []).filter(match);
    if (!mine.length) continue;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end || event.start);
    if (Number.isFinite(end) && end < now) continue;       // 이미 끝난 것
    if (Number.isFinite(start) && start > until) continue;  // 아직 먼 것
    const at = Number.isFinite(start) ? start : now;
    out.push({ event, dex: mine, start: at, days: daysUntil(at) });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** 이 종에 잡힌 일정 (상세 팝업의 배지) */
export function favNewsFor(events: readonly FavEvent[], dex: number): FavNewsRow[] {
  const number = Number(dex);
  if (!Number.isFinite(number)) return [];
  return rows(events, (one) => Number(one) === number);
}

/** 담아 둔 전부 (내 포켓몬 화면) */
export function favNewsList(events: readonly FavEvent[], favs: readonly number[]): FavNewsRow[] {
  if (!favs.length) return [];
  const set = new Set(favs.map(Number));
  return rows(events, (one) => set.has(Number(one)));
}

/** 사람이 읽는 한 줄 — '진행 중' · '오늘' · '내일' · 'D-23' */
export function favNewsWhen(row: FavNewsRow): string {
  if (row.days <= 0) return row.start <= Date.now() ? '진행 중' : '오늘';
  if (row.days === 1) return '내일';
  return `D-${row.days}`;
}
