'use strict';
// 운영 통계의 글자 관문 — 새는 값이 대시로 접힌다 (lib/cell.ts count · percent)
import { describe, it, expect } from 'vitest';
import { count, percent, DASH, LEAK } from '../lib/cell';
import { niceMax, dayLabel, weekTrend, trendLabel } from '../components/StatChart';

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
  it('축 끝은 1 · 2 · 2.5 · 5 × 10ⁿ — 21 은 25, 210 은 250 (기둥이 판의 절반 아래로 안 눌린다)', () => {
    expect([0, 1, 3, 7, 12, 480, 1001].map(niceMax)).toEqual([1, 1, 5, 10, 20, 500, 2000]);
    expect([21, 210, 24, 25, 26].map(niceMax)).toEqual([25, 250, 25, 25, 50]);
    expect(niceMax(Number.NaN)).toBe(1);
  });
  it('최근 7일 vs 앞 7일 — 14일이 안 차면 앞 7일을 안 준다, 앞이 0 이면 비율을 안 적는다', () => {
    const days = (values: number[]) => values.map((value, i) => ({ day: `2026-09-${String(i + 1).padStart(2, '0')}`, value }));
    expect(weekTrend(days([1, 2, 3, 4, 5, 6, 7]))).toEqual({ recent: 28 });
    expect(weekTrend(days([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]))).toEqual({ recent: 14, previous: 7 });
    expect(weekTrend(days([9, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]))).toEqual({ recent: 14, previous: 7 });
    expect(trendLabel({ recent: 14, previous: 7 })).toEqual({ text: '▲7 (100%)', tone: 'up' });
    expect(trendLabel({ recent: 3, previous: 4 })).toEqual({ text: '▼1 (25%)', tone: 'down' });
    expect(trendLabel({ recent: 4, previous: 4 })).toEqual({ text: '±0', tone: 'flat' });
    expect(trendLabel({ recent: 4, previous: 0 })).toEqual({ text: '▲4', tone: 'up' });
    expect(trendLabel({ recent: 4 })).toEqual({ text: '', tone: 'none' });
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

  it('서버가 받는 7~400일 밖으로 안 나간다 — 2027-10 에도 화면이 안 선다', async () => {
    const { sinceDays } = await import('../screens/AdminStats');
    expect(sinceDays(Date.parse('2026-09-15T12:00:00+09:00'))).toBe(7);
    expect(sinceDays(Date.parse('2027-10-19T12:00:00+09:00'))).toBe(400);
    expect(sinceDays(Date.parse('2030-01-01T12:00:00+09:00'))).toBe(400);
  });

  it('앞이 잘리면 이름도 바꾼다 — 잘린 기간을 9/14부터라 부르지 않는다', async () => {
    const { sinceLabel } = await import('../screens/AdminStats');
    expect(sinceLabel(Date.parse('2027-10-18T12:00:00+09:00'))).toBe('9/14부터');
    expect(sinceLabel(Date.parse('2027-10-19T12:00:00+09:00'))).toBe('최근 400일');
  });

  it('화면의 끝이 서버의 끝과 같다 — 한쪽만 바꾸면 화면이 400 을 받는다', async () => {
    const { readFileSync } = await import('node:fs');
    const server = readFileSync(new URL('../../../server/src/lib/stats.ts', import.meta.url), 'utf8');
    const screen = readFileSync(new URL('../screens/AdminStats.tsx', import.meta.url), 'utf8');
    const [, min, max] = /minDays: (\d+), maxDays: (\d+)/.exec(server) ?? [];
    expect(screen).toContain(`const DAYS_MIN = ${min};`);
    expect(screen).toContain(`const DAYS_MAX = ${max};`);
  });
});

describe('검색 순위 준비도 — 문턱은 서버(lib/hot.ts)와 같은 값이다', () => {
  it('화면의 문턱이 서버의 문턱과 같다 — 한쪽만 바꾸면 화면이 거짓 준비도를 적는다', async () => {
    const { readFileSync } = await import('node:fs');
    const server = readFileSync(new URL('../../../server/src/lib/hot.ts', import.meta.url), 'utf8');
    const screen = readFileSync(new URL('../screens/AdminStats.tsx', import.meta.url), 'utf8');
    for (const [name, mine] of [['MIN_HITS', 'HOT_MIN_HITS'], ['MIN_VISITORS', 'HOT_MIN_VISITORS'], ['MIN_ROWS', 'HOT_MIN_ROWS'], ['PERSON_CAP', 'HOT_PERSON_CAP']]) {
      const [, value] = new RegExp(`export const ${name} = (\\d+);`).exec(server) ?? [];
      expect(value, name).toBeDefined();
      expect(screen).toContain(`const ${mine} = ${value};`);
    }
  });
  it('문턱을 넘은 이름 수 · 하루 평균 · 판정', async () => {
    const { hotReadiness, clearsHot } = await import('../screens/AdminStats');
    const top = [{ key: 'a', hits: 14, visitors: 6 }, { key: 'b', hits: 3, visitors: 1 }, { key: 'c', hits: 2, visitors: 2 }, { key: 'd', hits: 3, visitors: 2 }];
    expect(top.map(clearsHot)).toEqual([true, false, false, true]);
    const ready = hotReadiness({ hits: 118, visitors: 23, top }, 15);
    expect(ready.passing).toBe(2);
    expect(ready.dailyNeed).toBe(9);
    expect(ready.ready).toBe(false);
    expect(ready.dailyReady).toBe(false);
    expect(hotReadiness({ hits: 300, visitors: 40, top: [...top, { key: 'e', hits: 5, visitors: 3 }] }, 15)).toMatchObject({ passing: 3, ready: true, dailyReady: true });
    expect(hotReadiness({ hits: 0, visitors: 0, top: [] }, 0).perDay).toBe(0);
  });
});
