'use strict';
// 정화 — 세 개체값이 2씩, 15 를 넘지 않는다 (lib/ivrank.ts purifyIvs · 2026-09-29 제보)
import { describe, it, expect } from 'vitest';
import { purifyIvs, PURIFY_BONUS } from '../lib/ivrank';

describe('purifyIvs', () => {
  it('공 · 방 · 체 세 칸이 2씩 오른다 — 공격만 6 이 되던 것은 하한 칩의 일이었다', () => {
    expect(PURIFY_BONUS).toBe(2);
    expect(purifyIvs([0, 15, 15])).toEqual([2, 15, 15]);
    expect(purifyIvs([6, 7, 8])).toEqual([8, 9, 10]);
  });

  it('15 를 넘지 않고 원본을 바꾸지 않는다', () => {
    const ivs: [number, number, number] = [14, 15, 13];
    expect(purifyIvs(ivs)).toEqual([15, 15, 15]);
    expect(ivs).toEqual([14, 15, 13]);
  });
});
