// ─────────────────────────────────────────────────────────────────────────────
// lib/recentSearch.ts — 이 브라우저에서 최근에 찾은 포켓몬 (2026-09-28)
//
// **밖으로 안 나간다.** 검색 팔레트가 빈 칸일 때 "다시 찾을 것" 을 먼저 내밀려는 용도라 이 브라우저에만 둔다.
// 통계 수집(lib/collect.ts)과는 별개다 — 동의를 꺼도 이 목록은 남고, 켜도 이 목록이 나가지 않는다.
// 키는 pogo_ 접두사에 용도(search_recent)를 붙였다 (CLAUDE.md §4 — 새 이름은 용도 접두사)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export interface RecentPick { sprite: number; name: string }

export const RECENT_KEY = 'pogo_search_recent';
/** 이보다 많이 쌓이지 않는다 — 칩 두 줄이면 충분하고, 오래된 것은 '최근' 이 아니다 */
export const RECENT_MAX = 8;

const isPick = (value: unknown): value is RecentPick =>
  !!value && typeof value === 'object'
  && Number.isFinite((value as RecentPick).sprite)
  && typeof (value as RecentPick).name === 'string' && (value as RecentPick).name.trim() !== '';

/** 저장소에서 읽는다. 깨진 값 · 막힌 저장소는 빈 목록이다 — 이 목록 때문에 검색이 서면 안 된다 */
export function readRecent(storage: Pick<Storage, 'getItem'> | null = safeStorage()): RecentPick[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isPick).slice(0, RECENT_MAX) : [];
  } catch { return []; }
}

/** 맨 앞에 넣고, 같은 이름은 하나만, 한도를 넘는 꼬리는 버린다. 새 목록을 돌려준다 */
export function withRecent(list: readonly RecentPick[], pick: RecentPick): RecentPick[] {
  return [pick, ...list.filter((one) => one.name !== pick.name)].slice(0, RECENT_MAX);
}

export function pushRecent(pick: RecentPick, storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): RecentPick[] {
  const next = withRecent(readRecent(storage), pick);
  try { storage?.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* 저장소를 막은 브라우저 — 이번 세션만 산다 */ }
  return next;
}

export function clearRecent(storage: Pick<Storage, 'removeItem'> | null = safeStorage()): void {
  try { storage?.removeItem(RECENT_KEY); } catch { /* 위와 같다 */ }
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
