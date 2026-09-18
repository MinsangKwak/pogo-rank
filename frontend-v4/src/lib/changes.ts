// ─────────────────────────────────────────────────────────────────────────────
// lib/changes.ts — 기술 변경까지 며칠 남았나 (v3 components/changes.js)
//
// **오늘 0시 기준으로 센다.** 시각까지 비교하면 '오늘 적용' 인 날에 남은 일수가 0.4일처럼 나와
// 판정이 흔들린다.
// 'YYYY-MM-DD' 는 조각으로 갈라 읽는다 — new Date('2026-09-08') 은 UTC 로 해석돼 하루 밀릴 수 있다.
// ─────────────────────────────────────────────────────────────────────────────

function daysBetween(from: Date, to: Date): number {
  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86400000);
}

/** 적용일까지 남은 일수. 0이면 오늘 적용, 음수면 이미 지난 것. 날짜가 없으면 null */
export function moveChangeDaysLeft(date?: string): number | null {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return daysBetween(new Date(), new Date(year, month - 1, day));
}
