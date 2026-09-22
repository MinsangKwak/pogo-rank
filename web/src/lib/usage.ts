// ─────────────────────────────────────────────────────────────────────────────
// lib/usage.ts — 이 포켓몬이 어디서 몇 위인가 (v3 detail.js usagePlacesFor · usageMeterOf)
//
// **이름 하나로 찾으면 안 된다.** 활용처는 이름 단위로 쌓이는데, 맥스 배틀 행의 이름이
// '다이맥스 X' · '거다이맥스 X' 로 갈리면서 일반 X 의 활용처에서 맥스 순위가 빠졌다 (v2.10.0 QA-44).
// 그래서 접두어를 뗀 뒤 **세 변형**을 합치고, 맥스 칩에는 어느 쪽 순위인지 D/G 를 남긴다.
// 순위표 줄의 '활용 N곳' 배지와 이 목록의 길이가 늘 같아야 한다.
// ─────────────────────────────────────────────────────────────────────────────
export interface Placement { place: string; rank: number; mark: '' | 'D' | 'G' }

type Places = Record<string, [string, number][]>;

export function usagePlacesFor(places: Places, name: string): Placement[] {
  const base = name.replace(/^(거다이맥스|다이맥스)\s+/, '');
  const variants: [string, Placement['mark']][] = [[base, ''], [`다이맥스 ${base}`, 'D'], [`거다이맥스 ${base}`, 'G']];
  const out: Placement[] = [];
  for (const [variant, mark] of variants) {
    for (const [place, rank] of places[variant] ?? []) out.push({ place, rank, mark });
  }
  return out;
}

export function usageCountFor(places: Places, name: string): number {
  return usagePlacesFor(places, name).length;
}

/**
 * 전 종 PvE·PvP 점수 — METER[이름] = [PvE, PvP] (0~100, backend/value_build.py).
 * 가성비 화면과 같은 산식이라 'PvP 89' 가 거기서도 여기서도 같은 뜻이다.
 */
export function usageMeterOf(meter: Record<string, [number, number]>, name: string): { pve: number; pvp: number } | null {
  const found = meter[name];
  if (!found) return null;
  const [pve, pvp] = found;
  return pve || pvp ? { pve, pvp } : null;
}
