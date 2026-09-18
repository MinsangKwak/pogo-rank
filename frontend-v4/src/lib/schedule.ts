// ─────────────────────────────────────────────────────────────────────────────
// lib/schedule.ts — 월 일정표에서 '지금 달' 을 고르는 한 가지 규칙
//
// v3 는 이 판단을 components/schedule.js 한 곳에서 하고 그 결과(SCHEDULE_ITEMS · SCHEDULE_YM)를
// 전역으로 뒀다. v4 도 한 곳에 둔다 — '이번 주 보스'(BossAcc)와 'D-MAX 덱 짜기' 가 같은 답을 봐야 한다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ScheduleMonth } from '../types/data';

/** 오늘이 든 달. 없으면 지난 달 중 가장 최근, 그것도 없으면 표의 첫 달 */
export function pickMonth(months: Record<string, ScheduleMonth>, today: Date): ScheduleMonth | undefined {
  const keys = Object.keys(months).sort();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (months[key]) return months[key];
  const past = keys.filter((one) => one < key);
  const pick = past.length ? past[past.length - 1] : keys[0];
  return pick ? months[pick] : undefined;
}

export interface WeekBoss { type: string; label: string; now: boolean }

/**
 * 이번 주(또는 다음) D-MAX 보스 — BossAcc 와 같은 규칙이다.
 *   1) 오늘이 걸쳐 있는 dmax 일정
 *   2) 없으면 앞으로 올 dmax 일정 중 가장 빠른 것
 * 일정표가 다루는 달이 이번 달이 아니면 지난 달 보스를 '이번 주' 로 내밀지 않는다 (v2.13.0 QA-20).
 */
export function weekBoss(months: Record<string, ScheduleMonth>, today = new Date()): WeekBoss | null {
  const month = pickMonth(months, today);
  if (!month) return null;
  if (today.getFullYear() !== month.ym.y || today.getMonth() + 1 !== month.ym.m) return null;
  const day = today.getDate();
  const items = month.items.filter((item) => item.cat === 'dmax' && item.t);
  const strip = (label: string) => label.split(' (')[0]?.replace('D-MAX ', '') ?? '';
  const current = items.find((item) => day >= item.s && day <= item.e);
  if (current?.t) return { type: current.t, label: strip(current.label), now: true };
  const next = items.filter((item) => item.s > day).sort((left, right) => left.s - right.s)[0];
  return next?.t ? { type: next.t, label: strip(next.label), now: false } : null;
}
