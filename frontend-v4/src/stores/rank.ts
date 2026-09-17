// ─────────────────────────────────────────────────────────────────────────────
// stores/rank.ts — 순위 화면의 고른 값 (칩 · 세그먼트 · 리그)
//
// v3 의 전역 `state` 30개 키 중 **함께 바뀌는 것끼리** 묶은 한 덩이다.
// 화면(탭 · 도구)은 여기 없다 — 그건 주소가 정한다(routes.ts · useRoute).
// 같은 값을 두 곳이 들고 있으면 언젠가 어긋난다는 것이 v3.61.1 의 교훈이다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { LeagueKey } from '../types/data';

export type MaxAxis = 'all' | 'dealer' | 'tank';   // v3 MAX_AXES 와 같은 id (GA `sub_max_*` 가 이 글자를 쓴다)
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

/**
 * **v3 와 같은 값을 쓴다** — '1' 이 켬, '0' 이 끔.
 * 같은 키에 다른 낱말('on'/'off')을 넣고 있었다. 키가 같아도 뜻이 다르면 다른 키다 —
 * v3 에서 켜 둔 관리자가 v4 에서는 꺼진 채로 열렸다.
 * 읽을 때는 'on' 도 받아 준다 — dev 에서 v4 를 먼저 만져 본 값이 남아 있을 수 있다
 */
function readUnrel(): boolean {
  try {
    const saved = localStorage.getItem(UNREL_KEY);
    return saved === '1' || saved === 'on';
  } catch { return false; }
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
      try { localStorage.setItem(UNREL_KEY, value ? '1' : '0'); } catch { /* 저장 불가 환경 */ }
    }
    set({ [key]: value } as Pick<RankState, typeof key>);
  },
}));
