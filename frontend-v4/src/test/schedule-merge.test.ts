// 월 일정표 병합 — 손으로 적은 줄이 이기고 자동분은 빈 자리만 채운다 (v4.7.2 WBS-224).
// 실제 꾸러미(public/data/schedule.json)가 있으면 그 줄 전량도 훑는다 — 화면이 먹는 모양 그대로
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeSchedule } from '../../scripts/merge-schedule.mjs';
import { weekBoss } from '../lib/schedule';
import type { ScheduleMonth, ScheduleItem } from '../types/data';

const month = (y: number, m: number, items: ScheduleItem[], note = '손'): ScheduleMonth => ({ ym: { y, m }, note, items });

describe('mergeSchedule', () => {
  it('같은 분류·같은 날짜면 손 줄이 남고 자동 줄은 버린다', () => {
    const hand = { '2026-10': month(2026, 10, [{ s: 3, e: 3, cat: 'event', label: '거다이맥스 에이스번 맥스배틀 데이 (14–17시)', source: 'https://x' }]) };
    const auto = { '2026-10': month(2026, 10, [
      { s: 3, e: 3, cat: 'event', label: '거다이맥스 에이스번 맥스 배틀 데이', auto: true },
      { s: 13, e: 19, cat: 'event', label: 'Fall Marathon: Buddy Trek', auto: true },
    ], '자동') };
    const out = mergeSchedule(hand, auto)['2026-10']!;
    expect(out.items.map((one) => one.label)).toEqual(['거다이맥스 에이스번 맥스배틀 데이 (14–17시)', 'Fall Marathon: Buddy Trek']);
    expect(out.items[0]?.source).toBe('https://x');
    expect(out.note).toContain('LeekDuck');
  });

  it('보스 분류는 날짜가 겹치기만 해도 손 줄이 이긴다', () => {
    const hand = { '2026-09': month(2026, 9, [{ s: 30, e: 30, cat: 'raid5', label: '제르네아스 (9/30~10/6)' }]) };
    const auto = { '2026-09': month(2026, 9, [
      { s: 30, e: 30, cat: 'raid5', label: '제르네아스', auto: true },
      { s: 23, e: 29, cat: 'raid5', label: '매시붕 · 페로코체 · 전수목', auto: true },
      { s: 16, e: 22, cat: 'mega', label: '메가 이상해꽃', auto: true },
    ]) };
    const out = mergeSchedule(hand, auto)['2026-09']!;
    // 분류 순서(raid5 → mega) 뒤 시작일 순
    expect(out.items.map((one) => `${one.cat} ${one.s}`)).toEqual(['raid5 23', 'raid5 30', 'mega 16']);
    expect(out.items.find((one) => one.s === 30)?.label).toBe('제르네아스 (9/30~10/6)');
  });

  it('한쪽에만 있는 달은 통째로 들어오고 안내문은 그대로다 — 손 표 이전 달은 세우지 않는다', () => {
    const hand = { '2026-09': month(2026, 9, [{ s: 1, e: 1, cat: 'event', label: '손' }]) };
    const auto = {
      '2026-08': month(2026, 8, [{ s: 3, e: 31, cat: 'event', label: 'LEGO Stores and Pokémon GO', auto: true }], '자동'),
      '2026-11': month(2026, 11, [{ s: 1, e: 5, cat: 'event', label: 'Halloween 2026 Part II', auto: true }], '자동'),
    };
    const out = mergeSchedule(hand, auto);
    expect(Object.keys(out)).toEqual(['2026-09', '2026-11']);
    expect(out['2026-09']!.note).toBe('손');
    expect(out['2026-11']!.note).toBe('자동');
  });

  it('자동분이 없으면 손 표 그대로', () => {
    const hand = { '2026-09': month(2026, 9, []) };
    expect(mergeSchedule(hand, undefined)).toEqual(hand);
    expect(mergeSchedule(hand, {})).toEqual(hand);
  });

  it('자동 dmax 줄만 있어도 이번 주 보스가 선다', () => {
    const auto = { '2026-10': month(2026, 10, [{ s: 5, e: 11, cat: 'dmax', label: 'D-MAX 태우지네 (맥스 먼데이 10/5)', t: 'fire', auto: true }]) };
    const out = mergeSchedule({}, auto);
    expect(weekBoss(out, new Date(2026, 9, 7))).toEqual({ type: 'fire', label: '태우지네', now: true });
  });
});

// 꾸러미가 있으면 전량을 본다 — 빌드가 표 모양을 바꾸면 여기서 빨개진다
const bundle = resolve(__dirname, '../../public/data/schedule.json');
describe.skipIf(!existsSync(bundle))('실데이터 — 합쳐진 일정표 전량', () => {
  const months = JSON.parse(readFileSync(bundle, 'utf-8')).SCHEDULE_MONTHS as Record<string, ScheduleMonth>;
  const cats = JSON.parse(readFileSync(bundle, 'utf-8')).SCHEDULE_CATS as Record<string, unknown>;

  it('모든 줄이 날짜·분류·제목을 갖춘다', () => {
    const bad: string[] = [];
    for (const [key, one] of Object.entries(months)) {
      const [y, m] = key.split('-').map(Number);
      if (one.ym.y !== y || one.ym.m !== m) bad.push(`${key} ym 불일치`);
      const last = new Date(y!, m!, 0).getDate();
      for (const item of one.items) {
        if (!Number.isInteger(item.s) || !Number.isInteger(item.e) || item.s < 1 || item.e > last || item.s > item.e) bad.push(`${key} ${item.label} 날짜 ${item.s}–${item.e}`);
        if (!(item.cat in cats)) bad.push(`${key} ${item.label} 분류 ${item.cat}`);
        if (!item.label || /undefined|NaN|null|\[object/.test(item.label)) bad.push(`${key} 제목 '${item.label}'`);
        if (item.source && !/^https?:\/\//.test(item.source)) bad.push(`${key} ${item.label} source '${item.source}'`);
      }
    }
    expect(bad).toEqual([]);
  });
});
