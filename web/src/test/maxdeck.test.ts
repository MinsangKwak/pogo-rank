'use strict';
// 덱 짜기 — 후보 · 자동 채우기 · 주소로 받은 덱은 '지금 데려갈 수 있는 것' 만 (lib/maxdeck.ts)
import { describe, expect, it } from 'vitest';
import { maxDeckAutoFill, maxDeckCandidates, maxDeckRowOf } from '../lib/maxdeck';
import type { DmaxRow, MaxBundle } from '../types/data';

// 표 모양만 흉내 낸 작은 묶음 — 실데이터는 출시일이 지나면 soon 이 사라져 검사가 흔들린다
const row = (sprite: number, name: string, extra: Partial<DmaxRow> = {}): DmaxRow =>
  ({ sprite, name, en: '', types: ['dragon'], fast: '', charged: 'dragon', dmg: 100, ehp: 30, ...extra }) as DmaxRow;
const dealers = [row(10225, '거다이맥스 두랄루돈', { soon: '2026-11-14', gmax: true }), row(10210, '거다이맥스 에이스번', { gmax: true }), row(888, '맥스 참가 검왕 자시안', { join: true }), row(999, '거다이맥스 미구현', { unrel: true })];
const tanks = [row(10225, '거다이맥스 두랄루돈', { soon: '2026-11-14', gmax: true }), row(10213, '거다이맥스 고릴타', { gmax: true })];
const max: MaxBundle = { DMAX_DATA: { overall: dealers }, DMAX_TANK: { overall: tanks }, DMAX_TIER: { overall: [] }, MAX_POOL: {} };

describe('maxdeck', () => {
  it('후보 · 자동 채우기에 출시 예정 · 미구현 줄은 없다', () => {
    expect(maxDeckCandidates(max, 0, 'overall', [null, null, null], false).map((one) => one.sprite)).toEqual([10210]);
    expect(maxDeckCandidates(max, 0, 'overall', [null, null, null], false, true).map((one) => one.sprite)).toEqual([10210, 888]);
    expect(maxDeckAutoFill(max, 'overall', false)).toEqual([10210, null, 10213]);
  });
  it('주소로 받은 덱(usable)은 출시 예정 · 미구현 줄을 받지 않고, 그리기(표 전체)는 찾는다', () => {
    expect(maxDeckRowOf(max, 0, 'overall', 10225, true)).toBeNull();
    expect(maxDeckRowOf(max, 0, 'overall', 999, true)).toBeNull();
    expect(maxDeckRowOf(max, 0, 'overall', 888, true)?.name).toBe('맥스 참가 검왕 자시안');
    expect(maxDeckRowOf(max, 2, 'overall', 10225, true)).toBeNull();
    expect(maxDeckRowOf(max, 0, 'overall', 10225)?.name).toBe('거다이맥스 두랄루돈');
  });
});
