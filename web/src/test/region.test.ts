'use strict';
// 2026-10-01 일정 지역 토글 — 오늘 날짜 · 표 고르기 · 저장 값
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { region, regionMonths, regionToday, setRegion } from '../lib/region';
import type { ScheduleBundle } from '../types/data';

const month = (y: number, m: number, label: string) => ({ ym: { y, m }, note: '', items: [{ s: 1, e: 1, cat: 'event', label }] });

describe('지역 일정', () => {
  // 테스트는 node 환경이라 저장소가 없다 — 메모리 한 칸으로 대신한다
  beforeEach(() => {
    const box = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (key: string) => box.get(key) ?? null, setItem: (key: string, value: string) => { box.set(key, value); } },
    });
  });
  afterEach(() => { setRegion('kr'); });

  it('같은 순간이라도 지역마다 오늘이 다르다', () => {
    // UTC 16시 — 서울은 다음 날 01시, 베를린(서머타임 끝난 11월)은 같은 날 17시
    const now = new Date('2026-11-06T16:00:00Z');
    const kr = regionToday('kr', now);
    const eu = regionToday('eu', now);
    expect([kr.getFullYear(), kr.getMonth() + 1, kr.getDate()]).toEqual([2026, 11, 7]);
    expect([eu.getFullYear(), eu.getMonth() + 1, eu.getDate()]).toEqual([2026, 11, 6]);
  });

  it('서머타임 기간에는 UTC+2 로 날짜를 넘긴다', () => {
    // 7월 22:30 UTC = 베를린 다음 날 00:30 (CEST). CET 로 셈하면 같은 날 23:30 이라 틀린다
    const eu = regionToday('eu', new Date('2026-07-10T22:30:00Z'));
    expect(eu.getDate()).toBe(11);
  });

  it('유럽 표가 있으면 그 표, 없으면 한국 표', () => {
    const bundle = {
      SCHEDULE_MONTHS: { '2026-10': month(2026, 10, '한국') },
      SCHEDULE_MONTHS_EU: { '2026-10': month(2026, 10, 'Europe') },
      SCHEDULE_CATS: {},
    } as unknown as ScheduleBundle;
    expect(regionMonths(bundle, 'eu')['2026-10']?.items[0]?.label).toBe('Europe');
    expect(regionMonths(bundle, 'kr')['2026-10']?.items[0]?.label).toBe('한국');
    const old = { ...bundle, SCHEDULE_MONTHS_EU: undefined } as ScheduleBundle;
    expect(regionMonths(old, 'eu')['2026-10']?.items[0]?.label).toBe('한국');
  });

  it('고른 지역은 pogo_region 에 남는다', () => {
    expect(region()).toBe('kr');
    setRegion('eu');
    expect(region()).toBe('eu');
    expect(localStorage.getItem('pogo_region')).toBe('eu');
  });
});
