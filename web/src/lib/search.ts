// ─────────────────────────────────────────────────────────────────────────────
// lib/search.ts — 이름으로 포켓몬을 찾는 공용 자리 (v3 components/search.js 이식)
//
// 세 화면이 같은 색인을 쓴다 — 개체값 순위(종 고르기) · 솔플 계산기(보스 고르기) ·
// PvP 덱 짜기(상대 고르기). v3 가 **검색 필터를 함수 하나로 묶어 둔 이유**가 그대로다:
// 화면마다 따로 거르면 같은 글자를 쳤는데 결과 순서가 화면마다 달라진다.
//
// 색인은 두 가지다.
//   searchIndex   도감 · 순위표 · 시트 · 활용처를 전부 훑은 것 (v3 buildSearchIndex)
//   bossIndex     레이드 보스가 될 수 있는 것 + 종족값 (v3 bossIndex)
//
// **미구현 폼은 뺀다** (v3.61.2 긴급 수정의 규칙) — 순위표 행이 '아직' 이라고 말한 폼만.
// 종 단위 미출시(오거폰 등)는 딱지를 달아 보여 주는 것이 규칙이라 여기서 안 거른다.
// ─────────────────────────────────────────────────────────────────────────────
import type { DexBundle, MaxBundle, PveBundle, PvpBundle } from '../types/data';

export interface SearchEntry {
  sprite: number;
  name: string;
  en: string;
  types: string[];
  unrel: boolean;
}

/** 보스 후보 한 줄 — 종족값(ba·bd·bs)은 BOSS_LIST 에만 있다 */
export interface BossEntry {
  sprite: number;
  name: string;
  types: string[];
  ba?: number;
  bd?: number;
  bs?: number;
}

/** 검색용 정규화 — 공백을 지우고 소문자로 (v3 monNorm) */
export function monNorm(text: string): string {
  return text.replace(/\s/g, '').toLowerCase();
}

/**
 * 후보에서 검색어에 맞는 것만 정확도순으로 (v3 monSearch).
 * 정확도 = 검색어가 이름의 얼마나 앞쪽에서 시작하는지. 같으면 이름이 짧은 쪽이 위다.
 */
export function monSearch<T extends { name: string; en?: string }>(candidates: readonly T[], query: string, limit = 8): T[] {
  const needle = monNorm(query);
  if (!needle) return [];
  const hits = candidates.filter((mon) => monNorm(mon.name).includes(needle)
    || (!!mon.en && monNorm(mon.en).includes(needle)));
  hits.sort((left, right) => monNorm(left.name).indexOf(needle) - monNorm(right.name).indexOf(needle)
    || left.name.length - right.name.length);
  return hits.slice(0, limit);
}

/** 미구현 폼을 걷어낸다 — v3 searchVisible (관리자 문은 v4 에 아직 없다) */
export function searchVisible(list: readonly SearchEntry[]): SearchEntry[] {
  return list.filter((mon) => !mon.unrel);
}

interface MonLike { sprite?: unknown; name?: unknown; en?: unknown; types?: unknown; unrel?: unknown; released?: unknown; ba?: unknown; bd?: unknown; bs?: unknown }

const unreleased = (mon: MonLike) => mon.unrel === true || mon.released === false;

/**
 * 검색 대상 목록. 빌드 데이터의 모양이 리그별·보스별·티어별로 제각각이라
 * 구조를 따라가는 대신 전체를 재귀로 훑으며 "sprite 와 name 을 가진 객체" 를 모은다 (v3 와 같다).
 */
function makeSearchIndex(dex: DexBundle, max: MaxBundle, pve: PveBundle, pvp: PvpBundle): SearchEntry[] {
  const byName = new Map<string, SearchEntry>();
  const add = (mon: MonLike) => {
    if (typeof mon.name !== 'string' || !mon.name || typeof mon.sprite !== 'number') return;
    const found = byName.get(mon.name);
    if (found) {
      // 같은 이름이 여러 표에 나온다 — 한 곳에서라도 '출시됨' 이면 그쪽을 믿는다
      if (found.unrel && !unreleased(mon)) found.unrel = false;
      return;
    }
    byName.set(mon.name, {
      sprite: mon.sprite,
      name: mon.name,
      en: typeof mon.en === 'string' ? mon.en : '',
      types: Array.isArray(mon.types) ? (mon.types as string[]) : [],
      unrel: unreleased(mon),
    });
  };
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const mon = value as MonLike;
      if ('sprite' in mon && 'name' in mon) add(mon);
      Object.values(value).forEach(walk);
    }
  };
  for (const table of [pvp.PVP_DATA, pve.PVE_DATA, pve.PVE_EASY, max.DMAX_DATA, max.DMAX_TIER,
    pvp.SHEET_DATA, pvp.VALUE_DATA, pve.BOSS_LIST]) walk(table);
  // 순위에 한 번도 안 나온 종도 검색되게 도감 이름표를 덧붙인다
  for (const [dexNo, name] of Object.entries(dex.DEX_DATA.names ?? {})) {
    if (byName.has(name)) continue;
    byName.set(name, { sprite: +dexNo, name, en: '', types: dex.DEX_DATA.forms[dexNo]?.types ?? [], unrel: false });
  }
  return [...byName.values()];
}

/**
 * 보스 후보 목록 (v3 bossIndex).
 * 차례가 곧 우선순위다 — 먼저 들어온 이름이 이긴다. BOSS_LIST 가 맨 앞인 이유는
 * 거기에만 종족값(ba·bd·bs)이 실려 있어서다.
 */
function makeBossIndex(dex: DexBundle, max: MaxBundle, pve: PveBundle, pvp: PvpBundle): BossEntry[] {
  const byName = new Map<string, BossEntry>();
  const add = (mon: MonLike) => {
    const name = typeof mon.name === 'string' ? mon.name : '';
    // 맥스 배틀 행은 레이드 보스가 아니다 — 같은 종이 BOSS_LIST 에 이미 있다
    if (/^(거다이맥스|다이맥스) /.test(name)) return;
    const types = Array.isArray(mon.types) ? (mon.types as string[]) : [];
    if (!name || !types.length || byName.has(name)) return;
    byName.set(name, {
      name,
      types,
      sprite: typeof mon.sprite === 'number' ? mon.sprite : 0,
      ...(typeof mon.ba === 'number' ? { ba: mon.ba } : {}),
      ...(typeof mon.bd === 'number' ? { bd: mon.bd } : {}),
      ...(typeof mon.bs === 'number' ? { bs: mon.bs } : {}),
    });
  };
  (pve.BOSS_LIST as MonLike[]).forEach(add);
  Object.values(pve.PVE_DATA).forEach((rows) => rows.forEach(add));
  // 미구현 줄은 넣지 않는다 — 여기서 고른 개체로 덱을 짜는 화면이다 (v3.36.0)
  Object.values(max.DMAX_DATA).forEach((rows) => rows.forEach((row) => { if (!row.unrel) add(row); }));
  Object.values(max.DMAX_TIER).forEach((rows) => rows.forEach((row) => { if (!row.unrel) add(row); }));
  // 활용처·가성비 목록 — 어태커 순위에 없는 메가까지 덮는다
  for (const key of ['usage', 'pvp', 'pve', 'both']) {
    const rows = pvp.VALUE_DATA[key];
    if (Array.isArray(rows)) (rows as MonLike[]).forEach(add);
  }
  // 마지막으로 도감 전체 — 어떤 종이든 검색은 되게
  for (const [dexNo, name] of Object.entries(dex.DEX_DATA.names ?? {})) {
    const form = dex.DEX_DATA.forms[dexNo];
    if (form?.types?.length && !byName.has(name)) byName.set(name, { name, types: form.types, sprite: +dexNo });
  }
  return [...byName.values()];
}

// 색인 하나를 만드는 데 데이터 전체를 훑어야 한다 — 묶음이 그대로면 다시 만들지 않는다.
// 묶음은 해시가 키라 내용이 바뀌면 객체 자체가 새것이 된다(lib/data.ts), 그래서 신원 비교로 충분하다
function memo<T>(make: (dex: DexBundle, max: MaxBundle, pve: PveBundle, pvp: PvpBundle) => T) {
  let keys: [DexBundle, MaxBundle, PveBundle, PvpBundle] | null = null;
  let value: T | null = null;
  return (dex: DexBundle, max: MaxBundle, pve: PveBundle, pvp: PvpBundle): T => {
    if (!keys || keys[0] !== dex || keys[1] !== max || keys[2] !== pve || keys[3] !== pvp) {
      keys = [dex, max, pve, pvp];
      value = make(dex, max, pve, pvp);
    }
    return value as T;
  };
}

export const buildSearchIndex = memo(makeSearchIndex);
export const buildBossIndex = memo(makeBossIndex);
