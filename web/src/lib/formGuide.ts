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

export type FormKey = 'base' | 'dmax' | 'gmax';

export const FORM_KO: Record<FormKey, string> = { base: '일반', dmax: '다이맥스', gmax: '거다이맥스' };

const MAX_PREFIX = /^(거다이맥스|다이맥스)\s+/;

type Places = Readonly<Record<string, readonly (readonly [string, number])[]>>;

export interface FormPlace { group: string; where: string; label: string; rank: number }

export interface FormRow {
  key: FormKey;
  /** 상세를 열 이름 — '거다이맥스 인텔리레온' */
  name: string;
  sprite: number;
  en: string;
  types: readonly string[];
  /** 활용처 — 순위 오름차순 */
  places: FormPlace[];
  /** 데이터만 있고 아직 게임에 없는 폼 */
  unrel: boolean;
}

/** '다이맥스 울머기' → '울머기' */
export const stemOf = (name: string): string => name.replace(MAX_PREFIX, '');

export function formKeyOf(name: string): FormKey {
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

/** 한 이름의 활용처 — 'max:fire' 는 '맥스 · 불꽃' */
export function placesOf(places: Places, name: string, typeKo: Readonly<Record<string, string>>): FormPlace[] {
  return (places[name] ?? [])
    .filter(([, rank]) => Number.isFinite(rank) && rank > 0)
    .map(([place, rank]) => {
      const { group, where } = placeParts(place, typeKo);
      return { group, where, label: `${group} · ${where}`, rank };
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
}

/**
 * 세 폼 줄. **맥스 폼이 하나도 없으면 빈 배열** — 일반 한 줄만 있는 카드는 머리줄과 같은 말이다.
 * 일반 폼 그림은 다이맥스 줄의 스프라이트가 곧 원종 그림이다 (거다이맥스만 10195~ 전용 번호).
 */
export function formRows(src: FormSource, index: ReadonlyMap<string, DmaxRow>, places: Places, typeKo: Readonly<Record<string, string>>): FormRow[] {
  const stem = stemOf(src.name);
  const now = formKeyOf(src.name);
  const dmax = index.get(`다이맥스 ${stem}`);
  const gmax = index.get(`거다이맥스 ${stem}`);
  if (!dmax && !gmax) return [];
  const baseSprite = now === 'base' ? src.sprite : (dmax?.sprite ?? src.dexNo ?? src.sprite);
  const rows: FormRow[] = [{
    key: 'base', name: stem, sprite: baseSprite, en: src.en || dmax?.en || gmax?.en || '',
    types: src.types.length ? src.types : (dmax?.types ?? gmax?.types ?? []),
    places: placesOf(places, stem, typeKo), unrel: false,
  }];
  for (const [key, row] of [['dmax', dmax], ['gmax', gmax]] as const) {
    if (!row) continue;
    rows.push({
      key, name: row.name, sprite: row.sprite, en: row.en, types: row.types,
      places: placesOf(places, row.name, typeKo), unrel: !!row.unrel,
    });
  }
  return rows;
}

export interface EvoBest { name: string; sprite: number; en: string; types: readonly string[]; place: FormPlace }

/**
 * 진화 계열에서 지금 보는 종보다 순위가 높은 폼 하나 — 울머기를 찾은 사람이 실제로 쓸 것은 거다이맥스 인텔리레온이다.
 * 지금 종의 가장 좋은 순위보다 **엄격히** 높을 때만 준다 — 같으면 굳이 옮겨 가라고 할 이유가 없다.
 */
export function evoBest(
  family: readonly (readonly number[])[] | undefined,
  names: Readonly<Record<string, string>>,
  current: string,
  index: ReadonlyMap<string, DmaxRow>,
  places: Places,
  typeKo: Readonly<Record<string, string>>,
  forms: Readonly<Record<string, { types?: readonly string[] }>>,
): EvoBest | null {
  if (!family || family.length < 2) return null;
  const stem = stemOf(current);
  const bestOf = (name: string) => placesOf(places, name, typeKo)[0];
  const own = [stem, `다이맥스 ${stem}`, `거다이맥스 ${stem}`].map(bestOf).filter(Boolean) as FormPlace[];
  let limit = own.length ? Math.min(...own.map((one) => one.rank)) : Infinity;
  let found: EvoBest | null = null;
  for (const id of family.flat()) {
    const base = names[String(id)];
    if (!base || base === stem) continue;
    for (const name of [base, `다이맥스 ${base}`, `거다이맥스 ${base}`]) {
      const place = bestOf(name);
      if (!place || place.rank >= limit) continue;
      const row = index.get(name);
      if (name !== base && !row) continue;
      limit = place.rank;
      found = {
        name, place,
        sprite: row?.sprite ?? id,
        en: row?.en ?? '',
        types: row?.types ?? forms[String(id)]?.types ?? [],
      };
    }
  }
  return found;
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
