// ─────────────────────────────────────────────────────────────────────────────
// lib/trainPlan.ts — 팝업의 '육성 추천' (2026-09-30 주인 결정: 서비스의 목표는 다이맥스 · 거다이맥스 우선 육성)
//
// **검색한 포켓몬의 쓰임새가 1번이다.** 어디서 쓰이는지로 갈라 추천한다.
//   · 맥스 배틀 · 레이드에서 쓰이면 → ① 다이맥스 · 거다이맥스 (맥스 순위로) ② 일반 · 전설 (레이드 순위로)
//     두 판은 순위가 다르다 — 레이드에서는 물짱이가 인텔리레온보다 월등하지만 맥스 배틀에서는 인텔리레온이 낫다 (주인 예시).
//     그래서 판마다 **그 판의 보스 타입과 그 판의 순위표**로 따로 고른다
//   · PvP 에서**만** 쓰이면 → 일반 · 전설만. PvP 에도 쓰이지만 레이드 · 맥스에서도 쓰이면 레이드 · 맥스가 먼저다
// **계열 전체로 본다** — 울머기는 어디에도 순위가 없지만 진화하면 거다이맥스 인텔리레온이 맥스 불꽃 1위다.
// 검색한 종만 보면 '쓸 곳이 없다' 로 끝나고, 서비스가 권해야 할 육성 대상을 놓친다.
// 보스 타입은 계열의 가장 높은 레이드 · 맥스 순위가 난 자리다 — 그 판에서 같이 겨루는 포켓몬을 권한다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { DmaxRow } from '../types/data';

export type Role = 'pve' | 'pvp';

export interface PlanPick { name: string; sprite: number; en: string; types: readonly string[]; note: string; own: boolean }

export interface TrainPlan {
  roles: Role[];
  /** 레이드 · 맥스 — 판마다 보스 타입이 따로다 (맥스 배틀의 최고 판 ≠ 레이드의 최고 판) */
  pve: { maxType: string; max: PlanPick[]; raidType: string; base: PlanPick[] } | null;
  /** PvP — 리그 · 일반 추천 */
  pvp: { league: string; base: PlanPick[] } | null;
}

interface Row { sprite: number; name: string; en?: string; types: readonly string[]; unrel?: boolean }

export interface PlanSource {
  /** 계열의 종 이름들 (검색한 폼 이름 포함) */
  stems: readonly string[];
  /** 검색한 종의 첫 타입 — 활용처가 하나도 없을 때 보스 타입을 고르는 데 쓴다 */
  types: readonly string[];
  places: Readonly<Record<string, readonly (readonly [string, number])[]>>;
  meter: Readonly<Record<string, readonly [number, number]>>;
  dmax: Readonly<Record<string, readonly DmaxRow[]>>;
  pve: Readonly<Record<string, readonly Row[]>>;
  pvp: Readonly<Record<string, readonly (Row & { rank?: number })[]>>;
  chart: Record<string, Record<string, number>>;
  typeKo: Readonly<Record<string, string>>;
  /** 스프라이트 → 도감 번호 (폼 번호 10000~ 를 종으로 묶는다) */
  dexOf: (sprite: number) => number | null;
  /** 다이맥스 · 거다이맥스 폼으로 연 팝업 — 쓰임새는 맥스 배틀이다 (아직 순위가 없어도, 예: 곧 나올 다이맥스 태우지네) */
  maxForm?: boolean;
}

export const PLAN_MAX = 3;

const MAX_PREFIX = /^(거다이맥스|다이맥스) /;
// '일반 · 전설' 만 — 메가 · 원시 · 섀도우는 이 칸의 뜻(오래 두고 키울 개체)과 다르다
const NOT_BASE = /^(메가X?Y?|원시|섀도우|다이맥스|거다이맥스) /;

const pick = (row: Row, note: string, own: boolean): PlanPick =>
  ({ name: row.name, sprite: row.sprite, en: row.en ?? '', types: row.types, note, own });

/** 계열 각 이름의 세 변형(일반 · 다이맥스 · 거다이맥스)이 선 자리 전부 */
function familyPlaces(src: PlanSource): { name: string; place: string; rank: number }[] {
  const out: { name: string; place: string; rank: number }[] = [];
  for (const stem of src.stems) {
    for (const name of [stem, `다이맥스 ${stem}`, `거다이맥스 ${stem}`]) {
      for (const [place, rank] of src.places[name] ?? []) {
        if (Number.isFinite(rank) && rank > 0) out.push({ name, place, rank });
      }
    }
  }
  return out.sort((left, right) => left.rank - right.rank);
}

/** 한 판에서 종이 겹치지 않게 앞에서부터 n마리 */
function takeUnique(rows: readonly Row[], n: number, skip: Set<number | string>, dexOf: PlanSource['dexOf'], test: (row: Row) => boolean) {
  const out: { row: Row; rank: number }[] = [];
  rows.forEach((row, index) => {
    if (out.length >= n || !test(row)) return;
    const key = dexOf(row.sprite) ?? row.name;
    if (skip.has(key)) return;
    skip.add(key);
    out.push({ row, rank: index + 1 });
  });
  return out;
}

export function trainPlan(src: PlanSource): TrainPlan {
  const hits = familyPlaces(src);
  const pveHits = hits.filter((one) => one.place.startsWith('pve:') || one.place.startsWith('max:'));
  const pvpHits = hits.filter((one) => one.place.startsWith('pvp:'));
  const roles: Role[] = [];
  if (pveHits.length || src.maxForm) roles.push('pve');
  // PvP 는 레이드 · 맥스 쓰임새가 없을 때만 — 둘 다 있으면 레이드 · 맥스가 먼저다 (주인 결정)
  if (pvpHits.length && !pveHits.length) roles.push('pvp');
  if (!roles.length) {
    // 순위가 하나도 없으면 전 종 점수로 가른다 — 둘 다 없으면 서비스의 기본인 레이드 · 맥스로
    const scores = src.stems.map((stem) => src.meter[stem]).filter(Boolean) as (readonly [number, number])[];
    const pve = Math.max(0, ...scores.map((one) => one[0]));
    const pvp = Math.max(0, ...scores.map((one) => one[1]));
    roles.push(pvp > pve ? 'pvp' : 'pve');
  }
  const stems = new Set(src.stems);
  const isOwn = (name: string) => stems.has(name.replace(MAX_PREFIX, ''));

  let pve: TrainPlan['pve'] = null;
  if (roles.includes('pve')) {
    // 보스 타입 — 판마다 계열이 가장 높게 선 자리. '전체' 는 타입이 아니라 건너뛴다.
    // 한 판에 자리가 없으면 다른 판의 타입, 그것도 없으면 첫 타입 기술이 효과가 굉장한 보스 타입
    const typeOf = (prefix: string) => pveHits.find((one) => one.place.startsWith(prefix) && !one.place.endsWith(':overall'))?.place.split(':')[1];
    const fallback = Object.keys(src.typeKo).find((boss) => (src.chart[src.types[0] ?? '']?.[boss] ?? 1) >= 1.5) ?? 'overall';
    const maxType = typeOf('max:') ?? typeOf('pve:') ?? fallback;
    const raidType = typeOf('pve:') ?? typeOf('max:') ?? fallback;

    // ① 맥스 배틀 순위표 — 계열의 맥스 폼이 그 판에 서 있으면 먼저 (검색한 것을 키우는 길이 있으면 그것부터)
    const skip = new Set<number | string>();
    const dmaxRows = (src.dmax[maxType] ?? []).filter((row) => !row.unrel);
    const own = takeUnique(dmaxRows, PLAN_MAX, skip, src.dexOf, (row) => isOwn(row.name));
    const others = takeUnique(dmaxRows, PLAN_MAX - own.length, skip, src.dexOf, (row) => !isOwn(row.name));
    // 줄 글자는 순위만 — 어느 판의 순위인지는 묶음 제목('물 타입 보스에 강한 순')이 한 번 말한다 (2026-09-30 주인 제보: '물 보스 상대 · 물 보스 맥스 3위' 를 못 알아본다)
    const max = [...own, ...others].map(({ row, rank }) => pick(row, `딜러 ${rank}위`, isOwn(row.name)));

    // ② 레이드 순위표 — 일반 · 전설만. 여기서는 계열을 앞세우지 않는다: 레이드에서 더 나은 것을 그대로 권한다
    const baseRows = src.pve[raidType] ?? [];
    const base = takeUnique(baseRows, PLAN_MAX, new Set(), src.dexOf, (row) => !NOT_BASE.test(row.name))
      .map(({ row, rank }) => pick(row, `딜러 ${rank}위`, isOwn(row.name)));
    pve = { maxType, max, raidType, base };
  }

  let pvp: TrainPlan['pvp'] = null;
  if (roles.includes('pvp')) {
    const league = pvpHits[0]?.place.split(':')[1] ?? 'great';
    const rows = src.pvp[league] ?? [];
    const skip = new Set<number | string>();
    const test = (row: Row) => !NOT_BASE.test(row.name);
    const own = takeUnique(rows, 1, skip, src.dexOf, (row) => test(row) && isOwn(row.name));
    const others = takeUnique(rows, PLAN_MAX - own.length, skip, src.dexOf, (row) => test(row) && !isOwn(row.name));
    pvp = { league, base: [...own, ...others].map(({ row, rank }) => pick(row, `${rank}위`, isOwn(row.name))) };
  }
  return { roles, pve, pvp };
}
