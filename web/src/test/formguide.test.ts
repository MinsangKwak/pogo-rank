'use strict';
// 폼별 쓰임새 — 세 폼 줄 · 진화 계열 추천 · 맥스 일정, 실제 데이터 전체에서 새는 글자 없이 (lib/formGuide.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bossNow, formKeyOf, formRows, formSummary, maxBoardOf, maxIndex, speciesOf, placeLine, placesOf, stemOf, tierIndex, tierLine } from '../lib/formGuide';
import { LEAK } from '../lib/cell';
import type { MaxSlide } from '../lib/maxSlides';

const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const dex = read('dex');
const max = read('max');
const usage = read('usage');
const index = maxIndex(max);
const tiers = tierIndex(max);
const places = usage.USAGE_PLACES;
const typeKo = dex.TYPE_KO;
const names: Record<string, string> = dex.DEX_DATA.names;
const idOf = (name: string) => Number(Object.keys(names).find((id) => names[id] === name));

// 팝업이 넘기는 값과 같게 — 맥스 폼은 그 줄의 그림 번호, 도감 이름표에 없는 폼(검왕 자시안 등)은 도감 번호 없이
const rowsFor = (name: string) => {
  const dexNo = idOf(stemOf(name));
  const sprite = index.get(name)?.sprite ?? dexNo;
  return formRows({ name, sprite: Number.isFinite(sprite) ? sprite : 0, en: '', types: [], dexNo: Number.isFinite(dexNo) ? dexNo : null }, index, places, typeKo, tiers);
};

describe('이름 → 폼', () => {
  it('맥스 접두어만 뗀다', () => {
    expect(stemOf('거다이맥스 인텔리레온')).toBe('인텔리레온');
    expect(stemOf('섀도우 리자몽')).toBe('섀도우 리자몽');
    expect(['울머기', '다이맥스 울머기', '거다이맥스 리자몽'].map(formKeyOf)).toEqual(['base', 'dmax', 'gmax']);
  });
});

describe('formRows', () => {
  it('울머기 — 일반 · 다이맥스 두 줄', () => {
    expect(rowsFor('울머기').map((row) => row.key)).toEqual(['base', 'dmax']);
  });
  it('인텔리레온 — 세 줄, 거다이맥스는 전용 그림 번호', () => {
    const rows = rowsFor('다이맥스 인텔리레온');
    expect(rows.map((row) => row.key)).toEqual(['base', 'dmax', 'gmax']);
    expect(rows[0]!.sprite).toBe(818);
    expect(rows[2]!.sprite).toBeGreaterThan(10000);
    expect(rows[2]!.places[0]).toMatchObject({ key: expect.stringMatching(/^max:/), group: '맥스', label: expect.stringMatching(/^맥스 · /), rank: expect.any(Number) });
  });
  it('맥스 · 메가 폼이 없으면 일반 한 줄 — 그 줄은 제 이름의 활용처만', () => {
    const rows = rowsFor('따라큐');
    expect(rows.map((row) => row.key)).toEqual(['base']);
    expect(rows[0]!.places).toEqual(placesOf(places, '따라큐', typeKo));
  });
  it('리자몽 — 메가X 를 보고 있어도 일반 · 메가X · 메가Y · 다이맥스 · 거다이맥스가 모두 선다', () => {
    const megas = dex.DEX_DATA.megas['6'].map((one: { sprite: number; label: string }) => ({ ...one, types: [] }));
    const rows = formRows({ name: '메가X 리자몽', sprite: megas[0].sprite, en: '', types: [], dexNo: 6 }, index, places, typeKo, tiers, megas);
    expect(rows.map((row) => row.label)).toEqual(['일반', '메가X', '메가Y', '다이맥스', '거다이맥스']);
    expect(rows[0]!.sprite).toBe(6);
    expect(formKeyOf('메가X 리자몽')).toBe('mega');
    expect(speciesOf('거다이맥스 리자몽')).toBe('리자몽');
  });
  it('메가를 보고 있어도 일반 줄은 도감의 일반 타입 — 메가 보스로라(강철)에서 보스로라(강철 · 바위) (Codex, PR #267)', () => {
    const megas = dex.DEX_DATA.megas['306'].map((one: { sprite: number; label: string }) => ({ ...one, types: dex.DEX_DATA.forms[String(one.sprite)]?.types ?? [] }));
    const rows = formRows({ name: '메가 보스로라', sprite: megas[0].sprite, en: '', types: megas[0].types, dexNo: 306, baseTypes: dex.DEX_DATA.forms['306'].types },
      index, places, typeKo, tiers, megas);
    expect(rows[0]!.types).toEqual(dex.DEX_DATA.forms['306'].types);
    expect(rows[0]!.types).not.toEqual(megas[0].types);
  });
  it('폼마다 제 이름의 활용처만 — 일반 줄에 거다이맥스 순위가 섞이지 않는다', () => {
    const [base, , gmax] = rowsFor('인텔리레온');
    expect(base!.places).toEqual(placesOf(places, '인텔리레온', typeKo));
    expect(gmax!.places).toEqual(placesOf(places, '거다이맥스 인텔리레온', typeKo));
    expect(base!.places.some((one) => one.group === '맥스')).toBe(false);
  });
  it('맥스 폼의 티어는 기술 타입 칸의 티어 · 순위 — 다이맥스 이상해꽃은 딜러 표 밖이어도 풀 칸에 있다 (2026-09-30 제보)', () => {
    const rows = rowsFor('이상해꽃');
    expect(rows[0]!.tier).toBeNull();
    const dmax = rows.find((row) => row.key === 'dmax')!;
    const gmax = rows.find((row) => row.key === 'gmax')!;
    expect(dmax.tier).toMatchObject({ type: 'grass', tier: expect.stringMatching(/^[SABC]$/) });
    expect(gmax.tier?.type).toBe('grass');
    expect(gmax.tier!.rank).toBeLessThan(dmax.tier!.rank);
    expect(formSummary(dmax, typeKo)).toMatch(/^풀 [SABC]티어 · \d+위$/);
  });
  it('티어표 순위는 D-MAX 화면처럼 미구현을 빼고 센다', () => {
    const released = tierIndex(max);
    const all = tierIndex(max, true);
    for (const [name, spot] of released) expect(all.get(name)!.rank).toBeGreaterThanOrEqual(spot.rank);
  });
  it('활용처는 순위 오름차순', () => {
    const ranks = rowsFor('리자몽').flatMap((row) => row.places.map((one) => one.rank));
    for (const row of rowsFor('리자몽')) {
      expect(row.places.map((one) => one.rank)).toEqual([...row.places.map((one) => one.rank)].sort((a, b) => a - b));
    }
    expect(ranks.length).toBeGreaterThan(0);
  });
});

describe('placeLine', () => {
  const at = (group: string, where: string, rank: number) => ({ key: `${group}:${where}`, group, where, label: `${group} · ${where}`, rank });
  it('같은 무리가 이어지면 무리 이름은 한 번', () => {
    expect(placeLine([at('맥스', '불꽃', 1), at('맥스', '땅', 2), at('레이드', '땅', 27)])).toBe('맥스 · 불꽃 1위 · 땅 2위 외 1곳');
    expect(placeLine([at('레이드', '땅', 27), at('맥스', '땅', 30)])).toBe('레이드 · 땅 27위 · 맥스 · 땅 30위');
  });
  it('없으면 상위 30위 밖', () => { expect(placeLine([])).toBe('순위표 상위 30위 밖'); });
});

describe('formSummary', () => {
  const at = (group: string, where: string, rank: number) => ({ key: `${group}:${where}`, group, where, label: `${group} · ${where}`, rank });
  it('맥스 폼은 기술 타입 칸의 티어 · 순위가 먼저', () => {
    expect(formSummary({ tier: { type: 'fire', tier: 'S', rank: 2 }, places: [at('맥스', '풀', 3)], unrel: false }, typeKo)).toBe('불꽃 S티어 · 2위');
    expect(tierLine({ type: 'grass', tier: '', rank: 6 }, typeKo)).toBe('풀 맥스 6위');
  });
  it('티어표에 없으면 활용처 한 곳, 없으면 상위 30위 밖, 미출시면 그렇게', () => {
    expect(formSummary({ tier: null, places: [at('레이드', '땅', 27)], unrel: false })).toBe('레이드 · 땅 27위');
    expect(formSummary({ tier: null, places: [], unrel: false })).toBe('순위표 상위 30위 밖');
    expect(formSummary({ tier: null, places: [], unrel: true })).toBe('아직 게임에 나오지 않았어요');
  });
});

describe('maxBoardOf', () => {
  it('티어표 칸 → 딜러 표 → 기술 타입 티어표 순', () => {
    // 티어표의 기술 타입 칸이 먼저 — 요약이 말한 그 줄로 간다
    const gmax = rowsFor('거다이맥스 인텔리레온').find((row) => row.key === 'gmax')!;
    expect(maxBoardOf(gmax)).toEqual({ axis: 'all', boss: gmax.tier!.type });
    // 티어표에 없고 딜러 표 자리만 있으면 딜러 표
    expect(maxBoardOf({ ...gmax, tier: null })).toEqual({ axis: 'dealer', boss: 'fire' });
    const dmax = rowsFor('울머기').find((row) => row.key === 'dmax')!;
    expect(maxBoardOf({ ...dmax, tier: null, places: [] })).toEqual({ axis: 'all', boss: 'water' });
  });
});

describe('bossNow', () => {
  const slide = (live: boolean, dexNo: number, gmax = false): MaxSlide => ({
    id: String(dexNo), kind: 'monday', gmax, label: '', when: '', short: '9.28–10.4', hours: '',
    bosses: [{ dex: dexNo, sprite: dexNo, name: names[String(dexNo)] ?? '', types: [] }], live, days: live ? 0 : 3,
  });
  it('진행 중인 장을 먼저 — 폼 접두어를 붙인 이름', () => {
    const found = bossNow([slide(false, 818, true), slide(true, 816)], new Set([816, 817, 818]));
    expect(found?.name).toBe('다이맥스 울머기');
  });
  it('계열이 없으면 null', () => {
    expect(bossNow([slide(true, 816)], new Set([6]))).toBeNull();
  });
});

describe('실제 데이터 전체', () => {
  it('모든 종 · 맥스 폼의 줄과 추천에 새는 글자가 없다', () => {
    let seen = 0;
    const all = [...Object.values(names), ...index.keys()];
    for (const name of all) {
      const rows = rowsFor(name);
      seen += rows.length;
      for (const row of rows) {
        expect(row.name).not.toMatch(LEAK);
        expect(Number.isFinite(row.sprite)).toBe(true);
        expect(placeLine(row.places)).not.toMatch(LEAK);
        expect(formSummary(row, typeKo)).not.toMatch(LEAK);
      }
    }
    expect(seen).toBeGreaterThan(1000);
  });
  it('활용처 글자는 표에 있는 이름만', () => {
    for (const name of Object.keys(places)) {
      for (const one of placesOf(places, name, typeKo)) expect(one.label).toMatch(/^(PvP|레이드|맥스) · \S/);
    }
  });
});
