// merge-schedule.mjs 의 타입 — 검사(vitest)가 같은 함수를 부르기 위한 선언
import type { ScheduleMonth } from '../src/types/data';
export function mergeSchedule(
  hand: Record<string, ScheduleMonth> | undefined,
  auto: Record<string, ScheduleMonth> | undefined,
): Record<string, ScheduleMonth>;
