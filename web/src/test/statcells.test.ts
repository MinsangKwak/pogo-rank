'use strict';
// 운영 통계의 글자 관문 — 새는 값이 대시로 접힌다 (lib/cell.ts count · percent)
import { describe, it, expect } from 'vitest';
import { count, percent, DASH, LEAK } from '../lib/cell';
import { niceMax, dayLabel } from '../components/StatChart';

describe('count', () => {
  it('천 단위를 끊고 정수로 편다', () => {
    expect(count(1284)).toBe('1,284');
    expect(count('12')).toBe('12');
    expect(count(2.6)).toBe('3');
    expect(count(0)).toBe('0');
  });
  it('새는 값은 대시', () => {
    for (const bad of [undefined, null, Number.NaN, Infinity, '', '  ', {}, [], true]) expect(count(bad)).toBe(DASH);
  });
});

describe('percent', () => {
  it('비율', () => { expect(percent(1, 4)).toBe('25%'); });
  it('분모 0 · 새는 값은 대시 — Infinity% 가 안 나간다', () => {
    expect(percent(3, 0)).toBe(DASH);
    expect(percent(undefined, 5)).toBe(DASH);
    expect(percent(Number.NaN, 5)).not.toMatch(LEAK);
  });
});

describe('그래프 눈금 · 날짜', () => {
  it('축 끝은 1 · 2 · 5 × 10ⁿ', () => {
    expect([0, 1, 3, 7, 12, 480, 1001].map(niceMax)).toEqual([1, 1, 5, 10, 20, 500, 2000]);
    expect(niceMax(Number.NaN)).toBe(1);
  });
  it('요일을 붙인 한국식 날짜 — 깨진 값은 대시', () => {
    expect(dayLabel('2026-09-24')).toBe('9.24 (목)');
    expect(dayLabel('oops')).toBe(DASH);
  });
});

describe('9/14부터 — 한국 날짜로 오늘까지 센다', () => {
  it('오늘을 넣어 세고, 한국 자정에 하루가 는다', async () => {
    const { daysSinceOpened } = await import('../screens/AdminStats');
    expect(daysSinceOpened(Date.parse('2026-09-14T00:00:00+09:00'))).toBe(1);
    expect(daysSinceOpened(Date.parse('2026-09-24T23:59:00+09:00'))).toBe(11);
    // UTC 로는 아직 9/24 지만 한국은 9/25
    expect(daysSinceOpened(Date.parse('2026-09-24T15:30:00Z'))).toBe(12);
  });
});
