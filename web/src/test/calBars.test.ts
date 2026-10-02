'use strict';
// 2026-10-02 달력 막대 — 여러 날 일정을 주마다 막대 하나로 잇는다 (lib/calBars.ts)
import { describe, expect, it } from 'vitest';
import { calWeeks } from '../lib/calBars';
import type { ScheduleItem } from '../types/data';

const item = (s: number, e: number, label: string): ScheduleItem => ({ s, e, cat: 'event', label });

describe('달력 막대', () => {
  // 2026년 10월 1일은 목요일 — 첫 주는 목 · 금 · 토 세 칸이다
  it('10/3~10/20 행사는 주마다 막대 하나로, 끊긴 쪽은 이어짐으로 표시한다', () => {
    const weeks = calWeeks(2026, 10, [item(3, 20, '긴 행사')]);
    expect(weeks).toHaveLength(5);
    const pieces = weeks.flatMap((week) => week.segments.map((seg) => ({ col: seg.col, span: seg.span, head: seg.head, tail: seg.tail })));
    expect(pieces).toEqual([
      { col: 7, span: 1, head: true, tail: false },
      { col: 1, span: 7, head: false, tail: false },
      { col: 1, span: 7, head: false, tail: false },
      { col: 1, span: 3, head: false, tail: true },
    ]);
  });

  it('겹치지 않는 일정은 같은 줄을 나눠 쓴다', () => {
    const [, second] = calWeeks(2026, 10, [item(4, 5, '앞'), item(7, 9, '뒤')]);
    expect(second!.segments.map((seg) => seg.lane)).toEqual([0, 0]);
  });

  it('두 주 넘는 배경 행사는 짧은 행사에 위 줄을 내어 준다', () => {
    const [, second] = calWeeks(2026, 10, [item(1, 31, '한 달 내내'), item(6, 9, '한글날')]);
    const lane = Object.fromEntries(second!.segments.map((seg) => [seg.item.label, seg.lane]));
    expect(lane).toEqual({ 한글날: 0, '한 달 내내': 1 });
  });

  it('분류 순으로 위 줄을 받는다 — 보스 막대가 행사를 밀어내지 않는다', () => {
    const boss = { s: 4, e: 10, cat: 'raid5', label: '보스' };
    const [, second] = calWeeks(2026, 10, [boss, item(6, 9, '한글날')], 1, ['event', 'raid5']);
    expect(second!.segments.map((seg) => seg.item.label)).toEqual(['한글날']);
  });

  it('보이는 줄 밖으로 밀린 일정은 날짜마다 센다 — 같은 날 시작이면 긴 일정이 먼저 줄을 얻는다', () => {
    const [, second] = calWeeks(2026, 10, [item(4, 4, '가'), item(4, 4, '나'), item(4, 4, '다'), item(4, 5, '라')], 3);
    expect(second!.segments.map((seg) => seg.item.label)).toEqual(['라', '가', '나']);
    expect(second!.hidden).toEqual({ 4: 1 });
  });
});
