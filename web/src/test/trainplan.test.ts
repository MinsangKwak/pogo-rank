'use strict';
// 육성 추천 — 레이드 · 맥스는 다이맥스 · 거다이맥스 먼저, PvP 는 일반 · 전설만 (lib/trainPlan.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { trainPlan, PLAN_MAX, type PlanSource } from '../lib/trainPlan';
import { LEAK } from '../lib/cell';

const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const dex = read('dex');
const max = read('max');
const usage = read('usage');
const pve = read('pve');
const pvp = read('pvp');
const names: Record<string, string> = dex.DEX_DATA.names;
const idOf = (name: string) => Number(Object.keys(names).find((id) => names[id] === name));

// 팝업과 같게 — 계열 이름들 + 검색한 이름
const planFor = (name: string) => {
  const dexNo = idOf(name);
  const family: number[][] | undefined = dex.DEX_DATA.evo[String(dexNo)];
  const stems = [...new Set([name, ...(family?.flat().map((id) => names[String(id)]).filter(Boolean) ?? [])])] as string[];
  const src: PlanSource = {
    stems, types: dex.DEX_DATA.forms[String(dexNo)]?.types ?? [],
    places: usage.USAGE_PLACES, meter: usage.METER, dmax: max.DMAX_DATA, pve: pve.PVE_DATA, pvp: pvp.PVP_DATA,
    chart: dex.DEX_DATA.chart, typeKo: dex.TYPE_KO,
    dexOf: (sprite) => dex.DEX_DATA.dex[String(sprite)] ?? (sprite < 10000 ? sprite : null),
  };
  return trainPlan(src);
};

describe('trainPlan', () => {
  it('울머기 — 계열로 보면 레이드 · 맥스용, 첫 추천은 거다이맥스 인텔리레온', () => {
    const plan = planFor('울머기');
    expect(plan.roles[0]).toBe('pve');
    expect(plan.pve?.maxType).toBe('fire');
    expect(plan.pve?.raidType).toBe('ground');
    expect(plan.pve?.max[0]).toMatchObject({ name: '거다이맥스 인텔리레온', own: true });
    expect(plan.pve?.max[0]?.note).toBe('불꽃 보스 맥스 1위');
  });
  it('판마다 순위표가 따로 — 레이드 추천은 레이드 순위, 계열을 앞세우지 않는다', () => {
    const plan = planFor('울머기');
    const ranks = plan.pve!.base.map((one) => Number(/(\d+)위$/.exec(one.note)?.[1]));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(plan.pve!.base.every((one) => one.note.startsWith('땅 보스 레이드'))).toBe(true);
  });
  it('맥스 폼으로 열면 순위가 없어도 맥스 배틀 · 레이드 추천이 먼저 (다이맥스 태우지네)', () => {
    const dexNo = idOf('태우지네');
    const family: number[][] | undefined = dex.DEX_DATA.evo[String(dexNo)];
    const plan = trainPlan({
      stems: [...new Set(['태우지네', ...(family?.flat().map((id) => names[String(id)]).filter(Boolean) ?? [])])] as string[],
      types: dex.DEX_DATA.forms[String(dexNo)]?.types ?? [],
      places: usage.USAGE_PLACES, meter: usage.METER, dmax: max.DMAX_DATA, pve: pve.PVE_DATA, pvp: pvp.PVP_DATA,
      chart: dex.DEX_DATA.chart, typeKo: dex.TYPE_KO,
      dexOf: (sprite) => dex.DEX_DATA.dex[String(sprite)] ?? (sprite < 10000 ? sprite : null),
      maxForm: true,
    });
    expect(plan.roles).toEqual(['pve']);
    expect(plan.pve?.max.length).toBeGreaterThan(0);
    expect(plan.pvp).toBeNull();
  });
  it('레이드 · 맥스에도 쓰이면 PvP 추천은 없다', () => {
    const plan = planFor('리자몽');
    expect(plan.roles).toEqual(['pve']);
    expect(plan.pvp).toBeNull();
  });
  it('맥스 추천은 맥스 폼만, 일반 추천에는 메가 · 원시 · 섀도우 · 맥스가 없다', () => {
    for (const name of ['울머기', '리자몽', '이상해씨', '뮤츠', '고릴타']) {
      const plan = planFor(name);
      for (const one of plan.pve?.max ?? []) expect(one.name).toMatch(/^(다이맥스|거다이맥스) /);
      for (const one of [...(plan.pve?.base ?? []), ...(plan.pvp?.base ?? [])]) {
        expect(one.name).not.toMatch(/^(메가|원시|섀도우|다이맥스|거다이맥스)/);
      }
    }
  });
  it('PvP 에서만 쓰이는 종 — 일반 · 전설 추천만, 검색한 종이 먼저', () => {
    const plan = planFor('따라큐');
    expect(plan.roles).toEqual(['pvp']);
    expect(plan.pve).toBeNull();
    expect(plan.pvp?.base[0]).toMatchObject({ name: '따라큐', own: true });
    expect(plan.pvp!.base.length).toBeLessThanOrEqual(PLAN_MAX);
  });
  it('실제 도감 전체 — 추천 글자에 새는 값이 없고 한 칸에 같은 종이 두 번 서지 않는다', () => {
    let seen = 0;
    for (const name of new Set(Object.values(names))) {
      const plan = planFor(name);
      expect(plan.roles.length).toBeGreaterThan(0);
      for (const list of [plan.pve?.max, plan.pve?.base, plan.pvp?.base]) {
        if (!list) continue;
        expect(new Set(list.map((one) => one.name)).size).toBe(list.length);
        for (const one of list) {
          seen += 1;
          expect(`${one.name} ${one.note}`).not.toMatch(LEAK);
          expect(Number.isFinite(one.sprite)).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(1000);
  });
});
