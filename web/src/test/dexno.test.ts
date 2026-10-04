'use strict';
// 2026-10-04 스프라이트 → 도감 번호 (lib/mon.ts dexNoOf) — 팝업 조회 수집 · 운영 통계 이름이 이것에 기댄다
import { describe, it, expect } from 'vitest';
import { dexNoOf } from '../lib/mon';

const table = { '10210': 815, '10196': 6, '10034': 6, '10008': 479 };

describe('dexNoOf', () => {
  it('원종 번호는 그대로, 폼 번호는 표에서 원종으로', () => {
    expect(dexNoOf(25, table)).toBe(25);
    expect(dexNoOf(840, table)).toBe(840);
    expect(dexNoOf(10210, table)).toBe(815);
    expect(dexNoOf(10034, table)).toBe(6);
  });
  it('표에 없는 폼 번호는 null — 지어내지 않는다', () => {
    expect(dexNoOf(99999, table)).toBeNull();
    expect(dexNoOf(10001, {})).toBeNull();
  });
});
