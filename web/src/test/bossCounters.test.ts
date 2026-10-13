'use strict';
// 보스 추천 후보 — 맥스는 보스 타입의 딜러 표, 레이드는 잘 때리는 타입의 성능표, 실제 데이터 전체에서 새는 글자 없이 (lib/bossCounters.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bossCounters, bossKindOf, type CounterSource } from '../lib/bossCounters';
import { LEAK } from '../lib/cell';

const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const dex = read('dex');
const max = read('max');
const pve = read('pve');
const pvp = read('pvp');
const src = (showJoin = false): CounterSource => ({
  chart: dex.DEX_DATA.chart, typeKo: dex.TYPE_KO, dexTable: dex.DEX_DATA.dex,
  dmax: max.DMAX_DATA, pve: pve.PVE_DATA, sheet: pvp.SHEET_DATA.pve, showJoin,
});

describe('bossKindOf', () => {
  it('다이맥스 · 거다이맥스 접두어만 맥스', () => {
    expect(bossKindOf('거다이맥스 인텔리레온')).toBe('max');
    expect(bossKindOf('다이맥스 파라꼬')).toBe('max');
    expect(bossKindOf('메가 리자몽')).toBe('raid');
    expect(bossKindOf('인텔리레온')).toBe('raid');
  });
});

describe('bossCounters — 맥스', () => {
  it('보스 첫 타입의 딜러 표에서 세 마리, 미구현 · 출시 예정 · (체크 꺼짐) 맥스 참가는 없다', () => {
    const got = bossCounters('max', ['water'], src(), 3);
    expect(got).not.toBeNull();
    expect(got!.rows).toHaveLength(3);
    expect(got!.types).toEqual(['water']);
    expect(got!.sub).toContain('맥스 배틀');
    expect(got!.foot).toContain('물 속성');
    for (const row of got!.rows) {
      expect(row.name).toMatch(/^(다이맥스|거다이맥스) /);
      const table = max.DMAX_DATA.water.find((one: { name: string }) => one.name === row.name);
      expect(table?.unrel).toBeFalsy();
      expect(table?.soon).toBeFalsy();
    }
  });
  it('두 타입 보스는 두 표를 합쳐 다른 타입의 상성을 곱한다 — 불·비행 보스에 땅 기술은 내려가고 바위 기술은 올라간다 (Codex, PR #361)', () => {
    const fireOnly = bossCounters('max', ['fire'], src(), 10)!.rows.map((row) => row.name);
    const got = bossCounters('max', ['fire', 'flying'], src(), 10)!;
    expect(got.types).toEqual(['fire', 'flying']);
    expect(got.foot).toContain('불꽃·비행 속성');
    const tables = max.DMAX_DATA as Record<string, { name: string; charged: string }[]>;
    const chart = dex.DEX_DATA.chart as Record<string, Record<string, number>>;
    // 표마다 보스에 맞춘 기술이 다르다 — 어느 표에서든 다른 타입에 반감(×0.39)되지 않는 기술이 있어야 상위에 남는다
    const okVsBoth = (name: string) => [['fire', 'flying'], ['flying', 'fire']].some(([table, other]) => {
      const row = tables[table!]!.find((one) => one.name === name);
      return row ? (chart[row.charged]?.[other!] ?? 1) >= 1 : false;
    });
    for (const row of got.rows) expect(okVsBoth(row.name), row.name).toBe(true);
    // 불 표 상위 열에 든 땅 기술 딜러(비행 표에는 없는 것)는 두 타입 기준에서 열 자리 밖으로
    const groundOnly = fireOnly.filter((name) => tables['fire']!.find((one) => one.name === name)?.charged === 'ground' && !tables['flying']!.some((one) => one.name === name));
    expect(groundOnly.length).toBeGreaterThan(0);
    for (const name of groundOnly) expect(got.rows.map((row) => row.name)).not.toContain(name);
  });
  it('체크를 켜면 맥스 참가 줄도 후보다', () => {
    const rows = bossCounters('max', ['rock'], src(true), 5)!.rows;
    expect(rows.some((row) => row.name.startsWith('맥스 참가 '))).toBe(true);
  });
  it('타입을 모르면 null', () => {
    expect(bossCounters('max', [], src(), 3)).toBeNull();
  });
});

describe('bossCounters — 레이드', () => {
  it('잘 때리는 타입 둘의 성능표 상위, 같은 종은 한 번', () => {
    const got = bossCounters('raid', ['steel', 'dragon'], src(), 3);
    expect(got).not.toBeNull();
    expect(got!.rows).toHaveLength(3);
    expect(got!.types.length).toBeGreaterThan(0);
    const keys = got!.rows.map((row) => dex.DEX_DATA.dex[String(row.sprite)] ?? row.sprite);
    expect(new Set(keys).size).toBe(keys.length);
    expect(got!.sub).toMatch(/^레이드 추천 후보 — /);
  });
  it('실제 데이터 — 모든 타입 보스의 후보 글에 새는 글자가 없다', () => {
    for (const type of Object.keys(dex.TYPE_KO)) {
      for (const kind of ['max', 'raid'] as const) {
        const got = bossCounters(kind, [type], src(), 3);
        if (!got) continue;
        for (const text of [got.sub, got.foot, ...got.rows.map((row) => row.name)]) expect(text).not.toMatch(LEAK);
      }
    }
  });
});
