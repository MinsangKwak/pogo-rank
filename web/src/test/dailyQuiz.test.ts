'use strict';
// 오늘의 실루엣 퀴즈 — 같은 날은 같은 문제, 힌트는 틀린 만큼, 연속 기록은 어제와만 잇는다 (lib/dailyQuiz.ts)
import { describe, it, expect } from 'vitest';
import { kstDayKey, pickDaily, quizPool, dexBand, quizHints, isAnswer, rollRecord, solveRecord, missRecord, freshRecord, readRecord, QUIZ_KEY } from '../lib/dailyQuiz';

const pool = quizPool(
  { '1': '이상해씨', '25': '피카츄', '150': '뮤츠', '10001': '메가 리자몽', '493': '아르세우스' },
  { '1': { types: ['grass', 'poison'] }, '25': { types: ['electric'] }, '150': { types: ['psychic'] }, '10001': { types: ['fire'] } },
);

describe('오늘의 문제', () => {
  it('한국 날짜로 하루가 바뀐다', () => {
    expect(kstDayKey(Date.parse('2026-09-28T14:59:00Z'))).toBe('2026-09-28');
    expect(kstDayKey(Date.parse('2026-09-28T15:00:00Z'))).toBe('2026-09-29');
  });
  it('후보는 타입 있는 기본 종만, 번호순', () => {
    expect(pool.map((mon) => mon.name)).toEqual(['이상해씨', '피카츄', '뮤츠']);
  });
  it('같은 날은 같은 문제, 날이 다르면 (대개) 다른 문제, 빈 후보는 null', () => {
    const a = pickDaily(pool, '2026-09-28');
    expect(a).toEqual(pickDaily(pool, '2026-09-28'));
    expect(a).not.toBeNull();
    const days = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
    expect(new Set(days.map((day) => pickDaily(pool, day)!.name)).size).toBeGreaterThan(1);
    expect(pickDaily([], '2026-09-28')).toBeNull();
  });
});

describe('힌트 · 정답', () => {
  const mutu = pool[2]!;
  it('힌트는 틀린 횟수만큼 — 타입 → 번호대 → 첫 글자', () => {
    expect(quizHints(mutu, 0)).toEqual([]);
    expect(quizHints(mutu, 1)).toEqual([{ kind: 'type', value: 'psychic' }]);
    expect(quizHints(mutu, 2).map((one) => one.value)).toEqual(['psychic', '#101~200']);
    expect(quizHints(mutu, 9).map((one) => one.value)).toEqual(['psychic', '#101~200', '뮤']);
    expect(dexBand(1)).toBe('#1~100');
    expect(dexBand(100)).toBe('#1~100');
    expect(dexBand(101)).toBe('#101~200');
  });
  it('종 번호가 같아야 정답 — 이름 꼬리가 같은 다른 종(왕콘치 · 콘치)은 아니다', () => {
    expect(isAnswer(mutu, { sprite: 150 })).toBe(true);
    expect(isAnswer(mutu, { sprite: 151 })).toBe(false);
    const konchi = { sprite: 118, name: '콘치', types: ['water'] };
    expect(isAnswer(konchi, { sprite: 119 })).toBe(false);
    // 폼은 기본 종 번호를 알려 줄 때만 — 모르면 아니다
    expect(isAnswer(mutu, { sprite: 10150 })).toBe(false);
    expect(isAnswer(mutu, { sprite: 10150 }, (sprite) => (sprite === 10150 ? 150 : undefined))).toBe(true);
  });
});

describe('기록', () => {
  it('날이 바뀌면 오늘 칸을 비우고, 어제 맞혔을 때만 연속을 잇는다', () => {
    const solvedYesterday = { ...freshRecord('2026-09-27'), solved: true, streak: 3, lastSolved: '2026-09-27' };
    const today = rollRecord(solvedYesterday, '2026-09-28');
    expect(today).toMatchObject({ day: '2026-09-28', misses: 0, solved: false, streak: 3, lastSolved: '2026-09-27' });
    expect(rollRecord({ ...solvedYesterday, lastSolved: '2026-09-25', day: '2026-09-25' }, '2026-09-28').streak).toBe(0);
    expect(rollRecord(null, '2026-09-28')).toEqual(freshRecord('2026-09-28'));
    expect(rollRecord(today, '2026-09-28')).toBe(today);
  });
  it('맞히면 연속 +1(어제도 맞혔을 때) 또는 1, 두 번 맞혀도 한 번', () => {
    const today = rollRecord({ ...freshRecord('2026-09-27'), solved: true, streak: 3, lastSolved: '2026-09-27' }, '2026-09-28');
    const solved = solveRecord(missRecord(today));
    expect(solved).toMatchObject({ solved: true, streak: 4, misses: 1, lastSolved: '2026-09-28' });
    expect(solveRecord(solved)).toBe(solved);
    expect(missRecord(solved)).toBe(solved);
    expect(solveRecord(freshRecord('2026-09-28')).streak).toBe(1);
  });
  it('깨진 저장값은 없는 것으로', () => {
    expect(readRecord({ getItem: () => 'nope' })).toBeNull();
    expect(readRecord({ getItem: () => JSON.stringify({ day: 1 }) })).toBeNull();
    expect(readRecord({ getItem: (key: string) => (key === QUIZ_KEY ? JSON.stringify(freshRecord('2026-09-28')) : null) })).toEqual(freshRecord('2026-09-28'));
    expect(readRecord(null)).toBeNull();
  });
});
