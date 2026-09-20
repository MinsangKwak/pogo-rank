// ─────────────────────────────────────────────────────────────────────────────
// test/hotsearch.test.ts — 인기 검색어 줄이 어떤 값에도 새지 않는다
//
// 이 표는 **다른 표와 달리 빌드가 모든 칸을 못 채운다.** GA 에서 온 이름이라
// 우리 이름표에 없으면 sprite 가 없고, 집계 전이면 asOf 가 null 이다.
// 화면 훑기(check_screens.mjs)도 이 구역을 못 본다 — 미리보기에는 표가 비어 있어
// 구역 자체가 안 그려지기 때문이다. 그래서 그물을 여기에 둔다 (CLAUDE.md §1).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { num } from '../lib/cell';
import { asOfLabel, barWidth } from '../components/HotSearch';

const LEAK = /NaN|undefined|null|Infinity|\[object Object\]/;

describe('인기 검색어 — 기준 시각', () => {
  it('낮 집계는 12시로 읽힌다', () => {
    expect(asOfLabel('2026-09-20T12:00:00+09:00')).toBe('9월 20일 12시');
  });

  // 자정 집계를 '0시' 로 적으면 그 전날 마감인데 오늘 새벽처럼 읽힌다
  it('자정 집계는 0시가 아니라 24시다', () => {
    expect(asOfLabel('2026-09-21T00:00:00+09:00')).toBe('9월 21일 24시');
  });

  // 보는 사람의 시간대로 옮기면 한국 기준 12시가 11시나 13시로 어긋난다
  it('시간대를 옮기지 않는다 — 글자를 그대로 읽는다', () => {
    expect(asOfLabel('2026-09-20T12:00:00+09:00')).not.toContain('11시');
    expect(asOfLabel('2026-09-20T12:00:00+09:00')).not.toContain('13시');
  });

  it('모양이 깨진 값에는 빈 글자를 준다 — 새지 않는다', () => {
    for (const bad of ['', 'nope', '2026-09', 'null']) {
      expect(asOfLabel(bad)).toBe('');
    }
  });
});

describe('인기 검색어 — 막대 너비', () => {
  it('1위는 100%, 절반은 50%', () => {
    expect(barWidth(412, 412)).toBe(100);
    expect(barWidth(206, 412)).toBe(50);
  });

  // 꼴찌가 1회여도 막대가 아예 사라지면 줄이 비어 보인다
  it('아주 작아도 최소 굵기를 남긴다', () => {
    expect(barWidth(1, 9999)).toBeGreaterThanOrEqual(6);
  });

  it('1위가 0이거나 값이 이상해도 0~100 을 벗어나지 않는다', () => {
    for (const [count, top] of [[5, 0], [0, 0], [-3, 10], [999, 10]] as const) {
      const width = barWidth(count, top);
      expect(Number.isFinite(width)).toBe(true);
      expect(width).toBeGreaterThanOrEqual(0);
      expect(width).toBeLessThanOrEqual(100);
    }
  });
});

describe('인기 검색어 — 횟수 칸', () => {
  it('관문을 지난 값에는 새는 글자가 없다', () => {
    for (const value of [131, 0, undefined, null, NaN, Infinity, '412']) {
      expect(LEAK.test(`${num(value)}회`)).toBe(false);
    }
  });
});
