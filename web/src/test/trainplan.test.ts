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
const joinNames = new Set((Object.values(max.DMAX_DATA) as { name: string; join?: boolean }[][]).flat().filter((row) => row.join).map((row) => row.name));

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
    expect(plan.pve?.max[0]).toMatchObject({ note: '1위', rank: 1 });
    // 첫 문장이 쓰는 때리는 타입 — 인텔리레온의 거다이맥스 기술은 물
    expect(plan.pve?.atkType).toBe('water');
  });
  it('맥스 추천은 계열을 꼭 넣되 순위 순 — 이상해꽃(3위)이 고릴타(1위) 위에 서지 않는다 (Codex, PR #272)', () => {
    const plan = planFor('이상해꽃');
    const ranks = plan.pve!.max.map((one) => one.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(plan.pve!.max.some((one) => one.own)).toBe(true);
    expect(plan.pve?.atkType).toBe('grass');
  });
  it('판마다 순위표가 따로 — 레이드 추천은 레이드 순위, 계열을 앞세우지 않는다', () => {
    const plan = planFor('울머기');
    const ranks = plan.pve!.base.map((one) => one.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // 줄 글자는 순위만 — 어느 판인지는 묶음 제목(raidType)이 말한다
    expect(plan.pve!.base.every((one) => one.note === `${one.rank}위`)).toBe(true);
  });
  it('레이드 단추의 칸은 그 판을 만든 계열 포켓몬이 때리는 타입 — 연 폼 타입이 아니다 (Codex, PR #284)', () => {
    // 울머기(물)를 열면 레이드 땅 보스 판에 선 인텔리레온의 물 칸
    expect(planFor('울머기').pve?.raidAtk).toBe('water');
    // 계열 전체에서 — 레이드 판에 선 계열 포켓몬이 있으면 그 줄이 레이드 표에 있는 타입 칸을 고른다
    let checked = 0;
    for (const name of new Set(Object.values(names))) {
      const plan = planFor(name);
      if (!plan.pve || plan.pve.raidType === 'overall') continue;
      expect(plan.pve.raidAtk).toMatch(/^[a-z]+$/);
      expect(plan.pve.raidAtk).not.toBe('overall');
      checked += 1;
    }
    expect(checked).toBeGreaterThan(100);
  });
  it('레이드 단추의 칸은 판을 만든 포켓몬 자신의 타입이다 — 타입 밖 기술이면 그 포켓몬이 없는 칸으로 간다 (Codex, PR #289)', () => {
    // 레이드 순위 칸(PVE_BY_TYPE)은 종 타입으로 묶인다 — 칸 타입이 그 포켓몬 타입 중 하나여야 목록에 선다
    const typesByName = new Map<string, string[]>();
    for (const rows of Object.values(pve.PVE_DATA) as { name: string; types: string[] }[][]) {
      for (const row of rows) typesByName.set(row.name, row.types);
    }
    const off: string[] = [];
    for (const name of new Set(Object.values(names))) {
      const plan = planFor(name);
      if (!plan.pve || plan.pve.raidAtk === 'overall') continue;
      const hit = [...plan.pve.base, ...plan.pve.max].find((one) => one.own);
      const types = hit ? typesByName.get(hit.name.replace(/^(다이맥스|거다이맥스) /, '')) : undefined;
      if (types && !types.includes(plan.pve.raidAtk)) off.push(`${name}: ${hit!.name} ${types.join('/')} → ${plan.pve.raidAtk}`);
    }
    expect(off).toEqual([]);
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
      // 다이맥스 없이 참가하는 종(검왕 자시안 등)은 접두어 없이 맥스 표에 선다 — 그 이름만 예외
      for (const one of plan.pve?.max ?? []) if (!joinNames.has(one.name)) expect(one.name).toMatch(/^(다이맥스|거다이맥스) /);
      for (const one of [...(plan.pve?.base ?? []), ...(plan.pvp?.base ?? [])]) {
        expect(one.name).not.toMatch(/^(메가|원시|섀도우|다이맥스|거다이맥스)/);
      }
    }
  });
  it('PvP 에서만 쓰이는 종 — 일반 · 전설 추천만, 검색한 종을 꼭 넣는다', () => {
    const plan = planFor('따라큐');
    expect(plan.roles).toEqual(['pvp']);
    expect(plan.pve).toBeNull();
    expect(plan.pvp?.base.find((one) => one.own)?.name).toBe('따라큐');
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
