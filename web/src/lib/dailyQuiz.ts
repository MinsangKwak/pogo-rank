// ─────────────────────────────────────────────────────────────────────────────
// lib/dailyQuiz.ts — 오늘의 실루엣 퀴즈 (2026-09-28)
//
// **재미가 있어야 다시 온다.** 홈에 날마다 바뀌는 실루엣 하나를 세우고, 이름을 검색해 맞히게 한다.
// 맞히는 길이 검색이라 검색이 늘고(순위의 밑천), 하루 한 문제라 내일 또 온다.
//
// 문제는 **날짜로 정해진다** — 같은 날은 누구에게나 같은 포켓몬이다(서로 물어볼 수 있다). 서버가 없다:
// 한국 날짜 글자를 해시해 후보 목록의 자리를 고른다. 후보는 도감 기본 종(폼 아님)이고 타입이 있는 것만 —
// 힌트가 타입이라서다. 힌트는 틀린 횟수만큼 열린다: 타입 → 도감 번호대 → 이름 첫 글자.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export interface QuizMon { sprite: number; name: string; types: readonly string[] }

/** 한국 날짜 'YYYY-MM-DD' — 밤 9시 뒤에 문제가 바뀌지 않게 (maxSlides 와 같은 셈) */
export function kstDayKey(nowMs = Date.now()): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 글자 → 0 이상의 정수. 자바스크립트 문자열 해시(djb2) — 흩어지기만 하면 된다 */
export function hashKey(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash;
}

/** 오늘의 문제 — 후보가 없으면 null. 후보 차례가 같으면 같은 날엔 늘 같은 것 */
export function pickDaily<T>(pool: readonly T[], dayKey: string): T | null {
  if (!pool.length) return null;
  return pool[hashKey(`quiz:${dayKey}`) % pool.length] ?? null;
}

/** 퀴즈 후보 — 도감 기본 종(1~9999)에 타입이 있는 것. 이름순이라 데이터가 같으면 차례도 같다 */
export function quizPool(names: Readonly<Record<string, string>>, forms: Readonly<Record<string, { types?: readonly string[] }>>): QuizMon[] {
  return Object.entries(names)
    .map(([dexNo, name]) => ({ sprite: Number(dexNo), name, types: forms[dexNo]?.types ?? [] }))
    .filter((mon) => Number.isFinite(mon.sprite) && mon.sprite > 0 && mon.sprite < 10000 && mon.types.length > 0)
    .sort((left, right) => left.sprite - right.sprite);
}

/** 도감 번호대 — 25 → '#1~100', 150 → '#101~200' */
export function dexBand(sprite: number): string {
  const from = Math.floor((sprite - 1) / 100) * 100 + 1;
  return `#${from}~${from + 99}`;
}

/**
 * 힌트 — 틀린 횟수(misses)만큼 연다. 첫 힌트는 공짜가 아니다: 실루엣만 보고 맞히는 것이 이 놀이다.
 * 타입 이름은 화면이 TYPE_KO 로 바꾼다 — 여기는 키만 준다
 */
export function quizHints(mon: QuizMon, misses: number): { kind: 'type' | 'band' | 'initial'; value: string }[] {
  const all = [
    { kind: 'type' as const, value: mon.types.join(' · ') },
    { kind: 'band' as const, value: dexBand(mon.sprite) },
    { kind: 'initial' as const, value: mon.name.slice(0, 1) },
  ];
  return all.slice(0, Math.max(0, Math.min(all.length, misses)));
}

/** 정답 판정 — 폼 이름('메가 리자몽')으로 맞혀도 기본 종이 같으면 정답. 공백을 무시한다 */
export function isAnswer(mon: QuizMon, guess: { sprite: number; name: string }): boolean {
  const norm = (text: string) => text.replace(/\s/g, '');
  return guess.sprite === mon.sprite || norm(guess.name).endsWith(norm(mon.name));
}

export interface QuizRecord {
  /** 이 기록의 날 */
  day: string;
  /** 오늘 틀린 횟수 */
  misses: number;
  /** 오늘 맞혔나 */
  solved: boolean;
  /** 연속으로 맞힌 날 수 (오늘 포함) */
  streak: number;
  /** 마지막으로 맞힌 날 */
  lastSolved: string;
}

export const QUIZ_KEY = 'pogo_quiz';

export const freshRecord = (day: string): QuizRecord => ({ day, misses: 0, solved: false, streak: 0, lastSolved: '' });

/** 어제였는지 — 'YYYY-MM-DD' 둘의 날짜 차가 1 */
export function isYesterday(day: string, today: string): boolean {
  const gap = (Date.parse(today) - Date.parse(day)) / 86_400_000;
  return gap === 1;
}

/** 날이 바뀌면 오늘 칸은 비우고 연속 기록만 잇는다. 어제 못 맞혔으면 연속은 0 이다 */
export function rollRecord(record: QuizRecord | null, today: string): QuizRecord {
  if (!record || record.day !== today) {
    const kept = record && record.lastSolved && (record.lastSolved === today || isYesterday(record.lastSolved, today)) ? record.streak : 0;
    return { ...freshRecord(today), streak: kept, lastSolved: record?.lastSolved ?? '' };
  }
  return record;
}

/** 맞혔다 — 어제도 맞혔으면 연속 +1, 아니면 1 부터 */
export function solveRecord(record: QuizRecord): QuizRecord {
  if (record.solved) return record;
  const streak = record.lastSolved && isYesterday(record.lastSolved, record.day) ? record.streak + 1 : 1;
  return { ...record, solved: true, streak, lastSolved: record.day };
}

export const missRecord = (record: QuizRecord): QuizRecord => (record.solved ? record : { ...record, misses: record.misses + 1 });

const isRecord = (value: unknown): value is QuizRecord => {
  const one = value as QuizRecord | null;
  return !!one && typeof one === 'object' && typeof one.day === 'string' && Number.isFinite(one.misses)
    && typeof one.solved === 'boolean' && Number.isFinite(one.streak) && typeof one.lastSolved === 'string';
};

export function readRecord(storage: Pick<Storage, 'getItem'> | null): QuizRecord | null {
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(QUIZ_KEY) ?? 'null');
    return isRecord(parsed) ? parsed : null;
  } catch { return null; }
}

export function writeRecord(storage: Pick<Storage, 'setItem'> | null, record: QuizRecord): void {
  try { storage?.setItem(QUIZ_KEY, JSON.stringify(record)); } catch { /* 저장소를 막은 브라우저 */ }
}
