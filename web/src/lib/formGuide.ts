// ─────────────────────────────────────────────────────────────────────────────
// lib/formGuide.ts — 한 종의 일반 · 다이맥스 · 거다이맥스를 한 카드에 (2026-09-30)
//
// 데이터는 폼마다 따로 쌓인다 — max.json 은 '다이맥스 울머기', 도감·레이드는 '울머기'.
// 그래서 팝업은 연 쪽이 넘긴 폼 하나만 보여 줬고, 다른 폼이 있다는 것도 알 수 없었다 (주인 제보: 팝업이 제 역할을 못 한다).
// 여기서 이름 앞 맥스 접두어를 떼고 세 변형을 한 줄씩 모은다 — 활용처(usage.json)도 폼 이름 단위라 그대로 붙는다.
// 폼 존재 여부는 맥스 순위표에 그 이름이 있는지로 가린다 — MAX_POOL 은 거다이맥스 폼 번호(10195~)만 들고 있어 이름을 못 준다.
// 화면에 나갈 글자는 여기서 다 만든다 — 값이 없으면 줄을 안 세운다 (CLAUDE.md §1)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { DmaxRow, MaxBundle } from '../types/data';
import type { MaxSlide } from './maxSlides';
import { placeParts } from './usage';

export type FormKey = 'base' | 'mega' | 'dmax' | 'gmax';

export const FORM_KO: Record<FormKey, string> = { base: '일반', mega: '메가', dmax: '다이맥스', gmax: '거다이맥스' };

const MAX_PREFIX = /^(거다이맥스|다이맥스)\s+/;
// 메가 · 원시도 한 종의 폼이다 — 메가 리자몽을 보고 있어도 일반 · 다이맥스 · 거다이맥스 줄이 함께 서야 한다 (2026-09-30 리자몽 점검)
const MEGA_PREFIX = /^(메가X|메가Y|메가|원시)\s+/;

/** 도감의 메가 폼 하나 — 라벨('메가X') · 그림 번호 · 타입 · 출시 여부 */
export interface MegaForm { label: string; sprite: number; types: readonly string[]; rel?: boolean }

type Places = Readonly<Record<string, readonly (readonly [string, number])[]>>;

/** key 는 원래 자리 글자('max:fire') — 더보기가 어느 판을 열지 정한다 */
export interface FormPlace { key: string; group: string; where: string; label: string; rank: number }

export interface FormRow {
  key: FormKey;
  /** 줄의 이름표 — '일반' · '메가X' · '다이맥스' … */
  label: string;
  /** 상세를 열 이름 — '거다이맥스 인텔리레온' */
  name: string;
  sprite: number;
  en: string;
  types: readonly string[];
  /** 활용처 — 순위 오름차순 */
  places: FormPlace[];
  /** 데이터만 있고 아직 게임에 없는 폼 */
  unrel: boolean;
  /** D-MAX 티어 글자 (전 종 순위표에 선 맥스 폼만) */
  tier: string;
  /** 맥스 기술 타입 ('water') — 맥스 폼만, 일반은 빈 글자 */
  moveType: string;
}

/** '다이맥스 울머기' → '울머기' */
export const stemOf = (name: string): string => name.replace(MAX_PREFIX, '');

/** 종 이름 — 맥스 · 메가 접두어를 뗀다. '메가X 리자몽' → '리자몽', '섀도우 리자몽' 은 그대로 */
export const speciesOf = (name: string): string => stemOf(name).replace(MEGA_PREFIX, '');

export function formKeyOf(name: string): FormKey {
  if (MEGA_PREFIX.test(name)) return 'mega';
  if (name.startsWith('거다이맥스 ')) return 'gmax';
  if (name.startsWith('다이맥스 ')) return 'dmax';
  return 'base';
}

/** 맥스 표 셋(딜러 · 탱커 · 티어)에서 이름 → 첫 줄. 같은 이름은 표마다 스프라이트 · 타입이 같다 */
export function maxIndex(max: Pick<MaxBundle, 'DMAX_DATA' | 'DMAX_TANK' | 'DMAX_TIER'>): Map<string, DmaxRow> {
  const out = new Map<string, DmaxRow>();
  for (const table of [max.DMAX_DATA, max.DMAX_TANK, max.DMAX_TIER]) {
    for (const rows of Object.values(table)) {
      for (const row of rows) if (!out.has(row.name)) out.set(row.name, row);
    }
  }
  return out;
}

/** D-MAX 전 종 티어표 — 이름 → 'S' · 'A' … (상위 줄만 실린다) */
export function tierIndex(max: Pick<MaxBundle, 'DMAX_TIER'>): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of max.DMAX_TIER['overall'] ?? []) {
    const tier = (row as DmaxRow & { tier?: string }).tier;
    if (tier && !out.has(row.name)) out.set(row.name, tier);
  }
  return out;
}

/** 한 이름의 활용처 — 'max:fire' 는 '맥스 · 불꽃' */
export function placesOf(places: Places, name: string, typeKo: Readonly<Record<string, string>>): FormPlace[] {
  return (places[name] ?? [])
    .filter(([, rank]) => Number.isFinite(rank) && rank > 0)
    .map(([place, rank]) => {
      const { group, where } = placeParts(place, typeKo);
      return { key: place, group, where, label: `${group} · ${where}`, rank };
    })
    .sort((left, right) => left.rank - right.rank);
}

export interface FormSource {
  /** 지금 보는 이름 · 스프라이트 · 영문 · 타입 */
  name: string;
  sprite: number;
  en: string;
  types: readonly string[];
  /** 원종 도감 번호 — 일반 폼 그림을 못 찾을 때 쓴다 */
  dexNo: number | null;
  /** 일반 폼의 타입 (도감) — 메가를 보고 있을 때 일반 줄에 메가 타입을 물려주지 않게 (Codex, PR #267) */
  baseTypes?: readonly string[];
}

/**
 * 폼 줄 — 일반은 늘 서고, 맥스 폼은 맥스 순위표에 이름이 있을 때만 선다.
 * 줄마다 **그 폼 이름의 활용처만** 싣는다 — 일반 줄에 거다이맥스 순위를 섞으면 어느 폼이 쓸 만한지 가릴 수 없다 (2026-09-30 주인 제보).
 * 일반 폼 그림은 다이맥스 줄의 스프라이트가 곧 원종 그림이다 (거다이맥스만 10195~ 전용 번호).
 */
export function formRows(
  src: FormSource, index: ReadonlyMap<string, DmaxRow>, places: Places, typeKo: Readonly<Record<string, string>>,
  tiers: ReadonlyMap<string, string> = new Map(),
  megas: readonly MegaForm[] = [],
): FormRow[] {
  const stem = speciesOf(src.name);
  const now = formKeyOf(src.name);
  const dmax = index.get(`다이맥스 ${stem}`);
  const gmax = index.get(`거다이맥스 ${stem}`);
  // 일반 줄의 그림 · 타입 — 일반을 보고 있으면 그대로, 아니면 다이맥스 줄(원종 그림) · 도감 번호
  const baseSprite = now === 'base' ? src.sprite : (dmax?.sprite ?? src.dexNo ?? src.sprite);
  const baseTypes = now === 'base' && src.types.length ? src.types
    : (src.baseTypes?.length ? src.baseTypes : (dmax?.types ?? gmax?.types ?? src.types));
  const rows: FormRow[] = [{
    key: 'base', label: FORM_KO.base, name: stem, sprite: baseSprite, en: src.en || dmax?.en || gmax?.en || '',
    types: baseTypes, places: placesOf(places, stem, typeKo), unrel: false, tier: '', moveType: '',
  }];
  for (const mega of megas) {
    const name = `${mega.label} ${stem}`;
    rows.push({
      key: 'mega', label: mega.label, name, sprite: mega.sprite, en: src.en, types: mega.types,
      places: placesOf(places, name, typeKo), unrel: mega.rel === false, tier: '', moveType: '',
    });
  }
  for (const [key, row] of [['dmax', dmax], ['gmax', gmax]] as const) {
    if (!row) continue;
    rows.push({
      key, label: FORM_KO[key], name: row.name, sprite: row.sprite, en: row.en, types: row.types,
      places: placesOf(places, row.name, typeKo), unrel: !!row.unrel, tier: tiers.get(row.name) ?? '', moveType: row.charged ?? '',
    });
  }
  return rows;
}

/** 활용처 몇 곳을 한 줄로 — 같은 무리가 이어지면 무리 이름을 한 번만 ('맥스 · 불꽃 1위 · 땅 2위 외 13곳') */
export function placeLine(places: readonly FormPlace[], shown = 2): string {
  if (!places.length) return '순위표 상위 30위 밖';
  const head = places.slice(0, shown)
    .map((one, index) => `${index > 0 && places[index - 1]!.group === one.group ? '' : `${one.group} · `}${one.where} ${one.rank}위`)
    .join(' · ');
  const rest = places.length - shown;
  return rest > 0 ? `${head} 외 ${rest}곳` : head;
}

/** 접힌 줄 한 줄 — D-MAX 티어가 있으면 앞에, 활용처는 가장 높은 한 곳 (좁은 화면에서 한 줄에 들어가게) */
export function formSummary(row: Pick<FormRow, 'tier' | 'places'>): string {
  const tier = row.tier ? `D-MAX ${row.tier}티어` : '';
  if (!row.places.length) return tier || placeLine([]);
  return [tier, placeLine(row.places, 1)].filter(Boolean).join(' · ');
}

/**
 * 맥스 폼의 '더보기' 가 열 D-MAX 판 — 가장 높게 선 보스 타입의 딜러 표, 없으면 맥스 기술 타입의 티어표.
 * 거기서 그 줄을 찾아 밝힌다 (stores/rank.ts focus)
 */
export function maxBoardOf(row: Pick<FormRow, 'places' | 'moveType'>): { axis: 'all' | 'dealer'; boss: string } {
  const typed = row.places.find((one) => one.key.startsWith('max:') && !one.key.endsWith(':overall'));
  if (typed) return { axis: 'dealer', boss: typed.key.slice(4) };
  return { axis: 'all', boss: row.moveType || 'overall' };
}

export interface BossNow { slide: MaxSlide; name: string; dex: number }

/** 이 계열이 보스로 서는 가장 이른 맥스 일정 — 진행 중이면 그것 (슬라이드는 이른 것부터 온다) */
export function bossNow(slides: readonly MaxSlide[], dexNos: ReadonlySet<number>): BossNow | null {
  const ordered = [...slides.filter((one) => one.live), ...slides.filter((one) => !one.live)];
  for (const slide of ordered) {
    const boss = slide.bosses.find((one) => dexNos.has(one.dex) && one.name);
    if (boss) return { slide, name: `${slide.gmax ? '거다이맥스' : '다이맥스'} ${boss.name}`, dex: boss.dex };
  }
  return null;
}
