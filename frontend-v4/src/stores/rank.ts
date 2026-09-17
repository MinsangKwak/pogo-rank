// ─────────────────────────────────────────────────────────────────────────────
// stores/rank.ts — 순위 화면의 고른 값 (칩 · 세그먼트 · 리그)
//
// v3 의 전역 `state` 30개 키 중 **함께 바뀌는 것끼리** 묶은 한 덩이다.
// 화면(탭 · 도구)은 여기 없다 — 그건 주소가 정한다(routes.ts · useRoute).
// 같은 값을 두 곳이 들고 있으면 언젠가 어긋난다는 것이 v3.61.1 의 교훈이다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { LeagueKey } from '../types/data';

export type MaxAxis = 'all' | 'dps' | 'tank';
export type PveMode = 'easy' | 'all';

interface RankState {
  league: LeagueKey;
  pvpType: string;          // 'all' 이면 필터 없음
  boss: string;             // PvE '전체' 탭에서 고른 칩
  easyBoss: string;         // PvE '일반' 탭 — 전체 탭과 따로 기억한다 (v3 와 같은 이유)
  maxBoss: string;
  maxAxis: MaxAxis;
  pveMode: PveMode;
  maxShowUnrel: boolean;    // [미구현] 체크 — 데이터만 있고 아직 못 쓰는 줄을 보일지
  set: <K extends keyof RankState>(key: K, value: RankState[K]) => void;
}

const UNREL_KEY = 'pogo_max_unrel';   // v3 와 같은 키

function readUnrel(): boolean {
  try { return localStorage.getItem(UNREL_KEY) === 'on'; } catch { return false; }
}

export const useRankStore = create<RankState>((set) => ({
  league: 'great',
  pvpType: 'all',
  boss: 'overall',
  easyBoss: 'overall',
  maxBoss: 'overall',
  maxAxis: 'all',
  pveMode: 'easy',
  maxShowUnrel: readUnrel(),
  set: (key, value) => {
    if (key === 'maxShowUnrel') {
      try { localStorage.setItem(UNREL_KEY, value ? 'on' : 'off'); } catch { /* 저장 불가 환경 */ }
    }
    set({ [key]: value } as Pick<RankState, typeof key>);
  },
}));
