// ─────────────────────────────────────────────────────────────────────────────
// stores/quiz.ts — 오늘의 실루엣 퀴즈의 상태 (2026-09-28)
//
// 홈 카드(문제 · 힌트 · 연속 기록)와 검색 팔레트(정답 판정)가 같은 것을 본다. 기록은 이 브라우저에 남는다
// (pogo_quiz) — 밖으로 안 나간다. 서버가 없는 놀이라 남과 겨루는 것이 아니라 어제의 나와 잇는 것이다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { create } from 'zustand';
import { kstDayKey, missRecord, readRecord, rollRecord, solveRecord, writeRecord, type QuizMon, type QuizRecord } from '../lib/dailyQuiz';

interface QuizState {
  /** 오늘의 문제 — 홈이 데이터를 받아 정한다. 팔레트는 이것과 견준다 */
  target: QuizMon | null;
  record: QuizRecord;
  /** 마지막 틀린 이름 — 팔레트가 "아니에요" 한 줄에 적는다 */
  lastMiss: string;
  setTarget: (target: QuizMon | null) => void;
  /** 저장소의 기록을 오늘로 굴려 온다 — 처음 그릴 때 한 번 */
  load: () => void;
  solve: () => void;
  miss: (name: string) => void;
}

const storage = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export const useQuizStore = create<QuizState>((set, get) => ({
  target: null,
  record: rollRecord(null, kstDayKey()),
  lastMiss: '',
  setTarget: (target) => set({ target }),
  load: () => set({ record: rollRecord(readRecord(storage()), kstDayKey()) }),
  solve: () => {
    const record = solveRecord(rollRecord(get().record, kstDayKey()));
    writeRecord(storage(), record);
    set({ record, lastMiss: '' });
  },
  miss: (name) => {
    const record = missRecord(rollRecord(get().record, kstDayKey()));
    writeRecord(storage(), record);
    set({ record, lastMiss: name });
  },
}));
