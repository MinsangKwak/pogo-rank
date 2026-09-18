// ─────────────────────────────────────────────────────────────────────────────
// lib/ivrank.ts — PvP 개체값 순위 계산 (v3 components/ivrank.js 이식)
//
// PvE 와 PvP 는 "좋은 개체" 의 기준이 정반대다.
//   PvE  공격이 높을수록 좋다 — 15/15/15 가 늘 1위라 볼 것이 없다.
//   PvP  리그마다 CP 상한이 있어, 공격이 **낮을수록** 같은 CP 안에서 레벨을 더 올릴 수 있다.
//        그래서 0/15/15 같은 조합이 1위가 되는 일이 흔하다.
//
// 순위 기준은 **스탯 곱** — CP 상한 안에서 가장 높은 레벨까지 올렸을 때의 공격 × 방어 × 체력.
//   체력에만 내림(floor)을 쓴다. 게임이 체력을 정수로 끊기 때문에 순위가 계단처럼 갈라진다.
//   이걸 빼면 순위가 미세하게 어긋난다.
// ─────────────────────────────────────────────────────────────────────────────
import { calcCp, cpmAt } from './cp';
import type { DexForm, LeagueKey } from '../types/data';

export const IVRANK_LEAGUES: readonly (readonly [LeagueKey, number | null])[] = [
  ['little', 500], ['great', 1500], ['ultra', 2500], ['master', null],
];
export const LEAGUE_KO: Record<LeagueKey, string> = { little: '리틀', great: '슈퍼', ultra: '하이퍼', master: '마스터' };

export const IVRANK_MAX_LEVEL = 50;   // 베스트 버디(+1)는 뺀다 — 모두가 가질 수 있는 조건이 아니다
export const IVRANK_STORE = 'pogo_ivrank';   // v3 와 같은 키

/**
 * 획득 경로마다 개체값 하한이 다르다 — 야생만 0부터 나온다.
 * 하한이 올라가면 '0/15/15 가 1위' 같은 답이 아예 불가능해져 순위 자체가 달라진다.
 */
export const IVRANK_FLOORS: readonly (readonly [string, number, string])[] = [
  ['야생 · 교환', 0, '야생에서 잡거나 교환으로 받은 개체'],
  ['알 · 레이드 · 리서치', 10, '세 경로는 개체값이 10 아래로 내려가지 않아요'],
  ['섀도우 (교환 전)', 6, '섀도우는 6 아래가 나오지 않아요'],
];

export interface IvRow {
  ivs: [number, number, number];
  level: number;
  cp: number;
  product: number;
}

/** 한 조합의 스탯 곱. 체력에만 floor 를 쓴다 (게임이 체력만 정수로 끊는다) */
export function ivStatProduct(form: DexForm, cpms: readonly number[], level: number, a: number, d: number, h: number): number {
  const m = cpmAt(cpms, level);
  const hp = Math.floor((form.hp + h) * m);
  return (form.atk + a) * m * ((form.def + d) * m) * hp;
}

/**
 * CP 상한을 넘지 않는 가장 높은 레벨. 상한이 없으면 만렙.
 * CP 는 레벨에 단조 증가하므로 반씩 좁혀 찾는다 — 조합이 4,096개라 선형 탐색은 느리다.
 */
export function ivBestLevel(form: DexForm, cpms: readonly number[], cap: number | null, a: number, d: number, h: number): number | null {
  if (cap == null) return IVRANK_MAX_LEVEL;
  let low = 1, high = IVRANK_MAX_LEVEL;
  let best: number | null = null;
  while (low <= high) {
    // 0.5 단위 레벨이라 중간값도 0.5 로 맞춘다
    const level = Math.round(low + high) / 2;
    if (calcCp(form, cpms, level, a, d, h) <= cap) { best = level; low = level + 0.5; }
    else high = level - 0.5;
  }
  return best;
}

// 같은 종·같은 리그를 다시 볼 때를 위해 한 번 낸 표를 들고 있는다 (새로고침하면 사라진다).
// 4,096 조합 × 이진 탐색이라 한 번 세는 데 제법 든다
const TABLE_CACHE = new Map<string, IvRow[]>();

/** 한 종·한 리그의 개체값 순위표 — 스탯 곱 내림차순. floorIv 아래 조합은 아예 빼고 센다 */
export function ivRankTable(form: DexForm, cpms: readonly number[], cap: number | null, floorIv: number): IvRow[] {
  const key = `${form.atk}/${form.def}/${form.hp}/${cap}/${floorIv}`;
  const cached = TABLE_CACHE.get(key);
  if (cached) return cached;
  const rows: IvRow[] = [];
  for (let a = floorIv; a <= 15; a += 1) {
    for (let d = floorIv; d <= 15; d += 1) {
      for (let h = floorIv; h <= 15; h += 1) {
        const level = ivBestLevel(form, cpms, cap, a, d, h);
        if (level == null) continue;   // Lv1 CP 가 이미 상한을 넘는다 (리틀리그의 전설 등)
        rows.push({ ivs: [a, d, h], level, cp: calcCp(form, cpms, level, a, d, h), product: ivStatProduct(form, cpms, level, a, d, h) });
      }
    }
  }
  rows.sort((left, right) => right.product - left.product);
  TABLE_CACHE.set(key, rows);
  return rows;
}

export interface IvRankResult {
  rank: number;
  total: number;
  percent: number;
  level: number;
  cp: number;
  best: IvRow;
}

/**
 * 내 조합이 그 표에서 몇 번째인가.
 * percent 는 1위 대비 스탯 곱 백분율 — '4위' 보다 '1위의 99.4%' 가 실제 차이를 말한다.
 */
export function ivRankOf(form: DexForm, cpms: readonly number[], cap: number | null, floorIv: number, ivs: readonly number[]): IvRankResult | null {
  const rows = ivRankTable(form, cpms, cap, floorIv);
  const top = rows[0];
  if (!top) return null;
  const index = rows.findIndex((row) => row.ivs[0] === ivs[0] && row.ivs[1] === ivs[1] && row.ivs[2] === ivs[2]);
  const mine = rows[index];
  if (!mine) return null;   // 하한 아래 조합을 물어본 경우
  return {
    rank: index + 1,
    total: rows.length,
    percent: Math.round((mine.product / top.product) * 1000) / 10,
    level: mine.level,
    cp: mine.cp,
    best: top,
  };
}
