// ─────────────────────────────────────────────────────────────────────────────
// lib/matchup.ts — 타입 상성 (v3 detail.js typeMultAgainst · matchupCols)
//
// 표시 기준: 배율 1.5 이상이면 약점(큰 순), 0.7 이하면 내성(작은 순).
// 1.6 / 0.625 같은 값만 나오므로 그 사이(≈1)는 어느 쪽에도 넣지 않는다.
// 이중약점(×2.56)·이중내성/무효(×0.39)는 '이중' 을 붙여 따로 표시한다 —
// 복합 타입 포켓몬에서 "뭘 들고 가야 하나" 의 답이 거기 있다.
// ─────────────────────────────────────────────────────────────────────────────
type Chart = Record<string, Record<string, number>>;

export function multAgainst(chart: Chart, atk: string, defTypes: readonly string[]): number {
  return defTypes.reduce((acc, def) => acc * (chart[atk]?.[def] ?? 1), 1);
}

export interface MatchRow { type: string; mult: number }

export function matchups(chart: Chart, typeKo: Record<string, string>, defTypes: readonly string[]) {
  const rows: MatchRow[] = Object.keys(typeKo).map((type) => ({ type, mult: multAgainst(chart, type, defTypes) }));
  return {
    weak: rows.filter((row) => row.mult >= 1.5).sort((a, b) => b.mult - a.mult),
    resist: rows.filter((row) => row.mult <= 0.7).sort((a, b) => a.mult - b.mult),
  };
}

/** 이 보스 타입 조합에 효과가 굉장한(×1.5 이상) 공격 타입을 배율 내림차순으로 최대 count개 */
export function counterTypes(chart: Chart, typeKo: Record<string, string>, bossTypes: readonly string[], count = 2): string[] {
  return Object.keys(typeKo)
    .map((type) => [type, multAgainst(chart, type, bossTypes)] as const)
    .filter(([, mult]) => mult >= 1.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([type]) => type);
}
