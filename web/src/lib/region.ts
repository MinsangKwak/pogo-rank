// ─────────────────────────────────────────────────────────────────────────────
// lib/region.ts — 일정을 어느 지역 기준으로 볼지 (2026-10-01)
//
// 언어(KO/EN)와 따로 돈다 — 한국어로 읽으면서 유럽 일정을 보는 사람도 있다 (주인 결정).
// 바뀌는 것은 이벤트 일정 화면 하나다. D-MAX 주간 보스는 두 지역이 같은 현지 시각에 바뀌어
// 홈 배너 · 이번 주 보스 · 덱 짜기는 지역과 상관없이 같은 답을 낸다.
// 저장 키는 새로 만든 `pogo_region` 이다 — 값이 없으면 지금까지처럼 한국 기준이다
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import type { ScheduleBundle, ScheduleMonth } from '../types/data';

export type Region = 'kr' | 'eu';

const REGION_KEY = 'pogo_region';
// 유럽은 중부 유럽 시간(CET/CEST) — 서머타임은 시간대 이름이 알아서 따른다
export const REGION_TZ: Record<Region, string> = { kr: 'Asia/Seoul', eu: 'Europe/Berlin' };

let current: Region | null = null;
const listeners = new Set<() => void>();

function readRegion(): Region {
  try {
    if (localStorage.getItem(REGION_KEY) === 'eu') return 'eu';
  } catch { /* 저장 불가 환경 — 한국 기준으로 간다 */ }
  return 'kr';
}

export function region(): Region {
  if (current === null) current = readRegion();
  return current;
}

export function setRegion(next: Region): void {
  current = next;
  try { localStorage.setItem(REGION_KEY, next); } catch { /* 위와 같다 */ }
  listeners.forEach((listener) => listener());
}

function onRegionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// 서버 그림은 늘 한국 기준이다 — 저장 값은 브라우저에서만 읽힌다
export function useRegion(): Region {
  return useSyncExternalStore(onRegionChange, region, () => 'kr' as Region);
}

/**
 * 그 지역의 오늘 — 연·월·일만 맞춘 Date 를 돌려준다.
 * 브라우저 시계가 어느 나라에 있든 달력의 '오늘' 은 고른 지역의 날짜여야 한다
 */
export function regionToday(which: Region, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REGION_TZ[which], year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((one) => one.type === type)?.value);
  // 정오로 둔다 — 자정이면 브라우저의 서머타임 경계에서 하루가 밀릴 수 있다
  return new Date(part('year'), part('month') - 1, part('day'), 12);
}

/** 지역의 월 일정표. 유럽 표가 빠진 묶음(옛 빌드)이면 한국 표로 돌아간다 */
export function regionMonths(bundle: ScheduleBundle, which: Region): Record<string, ScheduleMonth> {
  const eu = bundle.SCHEDULE_MONTHS_EU;
  return which === 'eu' && eu && Object.keys(eu).length ? eu : bundle.SCHEDULE_MONTHS;
}
