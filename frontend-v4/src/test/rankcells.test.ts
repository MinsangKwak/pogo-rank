// ─────────────────────────────────────────────────────────────────────────────
// test/rankcells.test.ts — 순위표 한 줄의 점수·보조 칸에 NaN·undefined 가 새지 않는다
//
// 제보(2026-09-19): D-MAX [탱커] 가 `NaN 맥스 피해 · 내구 undefined` 로 나왔다.
// 탱커 표의 행은 ehp·hp·def·mult 를 갖는데 화면이 딜러 표의 dmg·bulk 를 읽었다.
// 표마다 행 모양이 다르므로 **실데이터 첫 줄과 같은 모양**으로 세 축을 다 넣어 본다.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { dmaxCells } from '../screens/Ranks';
import type { DmaxRow } from '../types/data';

const TYPE_KO: Record<string, string> = { normal: '노말', steel: '강철', fairy: '페어리' };

// data/dynamax_tank.json · dynamax.json · dynamax_tier.json 의 첫 줄 그대로
const TANK = { sprite: 242, name: '다이맥스 해피너스', en: 'Blissey', types: ['normal'], fast: '', charged: '', ehp: 59, mult: 1.0, hp: 403, def: 145, gmax: false } as unknown as DmaxRow;
const DEALER = { sprite: 888, name: '거다이맥스 검왕 자시안', en: '검왕 Zacian', types: ['fairy', 'steel'], fast: '거다이맥스', charged: 'steel', dmg: 371, bulk: 33, score: 2126, gmax: true } as unknown as DmaxRow;
const TIER = { sprite: 888, name: '거다이맥스 검왕 자시안', en: '검왕 Zacian', types: ['fairy', 'steel'], fast: '거다이맥스', charged: 'steel', atk: 254, power: 450, stab: true, bulk: 33, bulkMul: 1, pct: 100, score: 2126, tier: 'S', gmax: true } as unknown as DmaxRow;

function leaks(cells: { score: string; sub: string; lines: string[] }) {
  const text = [cells.score, cells.sub, ...cells.lines].join(' | ');
  return /NaN|undefined|null/.test(text) ? text : '';
}

describe('D-MAX 순위표 칸', () => {
  it('탱커 — EHP 와 체력·방어가 숫자로 선다', () => {
    const cells = dmaxCells('tank', 'overall', TANK, TYPE_KO);
    expect(leaks(cells)).toBe('');
    expect(cells.score).toBe('59');
    expect(cells.sub).toContain('403');
    expect(cells.sub).toContain('145');
  });

  it('탱커 — 보스 속성을 고르면 받는 배율까지 선다', () => {
    const cells = dmaxCells('tank', 'fighting', { ...TANK, mult: 2.0, ehp: 30 } as DmaxRow, TYPE_KO);
    expect(leaks(cells)).toBe('');
    expect(cells.sub).toContain('×2');
  });

  it('탱커 줄에는 기술 줄이 없다 — 표에 기술이 비어 있어 "타입" 만 남던 줄', () => {
    expect(dmaxCells('tank', 'overall', TANK, TYPE_KO).lines.filter(Boolean)).toEqual([]);
  });

  it('딜러 — 맥스 피해와 내구', () => {
    const cells = dmaxCells('dealer', 'overall', DEALER, TYPE_KO);
    expect(leaks(cells)).toBe('');
    expect(cells.score).toBe('371');
  });

  it('티어표 — 퍼센트와 공격·위력·내구', () => {
    const cells = dmaxCells('all', 'overall', TIER, TYPE_KO);
    expect(leaks(cells)).toBe('');
    expect(cells.score).toBe('100%');
  });
});
