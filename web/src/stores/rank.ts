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
  // [맥스 참가 가능 다른 유닛] 체크 — 다이맥스 없이 맥스 배틀에 참가하는 종('맥스 참가 검왕 자시안' 등)을 보일지.
  // 기본은 끔 — 다이맥스 · 거다이맥스만 보고 싶은 사람이 있다 (2026-10-06 주인 결정)
  maxShowJoin: boolean;
  // 상세의 '더보기' 가 넘긴 이름 — 순위 화면이 그 줄로 내려가 한 번 밝히고 비운다 (2026-09-30).
  // 저장하지 않는다 — 다음에 열 때까지 남으면 엉뚱한 줄이 밝아진다
  focus: string;
  set: <K extends keyof RankState>(key: K, value: RankState[K]) => void;
}

const UNREL_KEY = 'pogo_max_unrel';   // v3 와 같은 키
const JOIN_KEY = 'pogo_max_join';     // 새 키 (2026-10-06) — 값은 미구현과 같이 '1' 켬 · '0' 끔

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
function readJoin(): boolean {
  try { return localStorage.getItem(JOIN_KEY) === '1'; } catch { return false; }
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
  maxShowJoin: readJoin(),
  focus: '',
  set: (key, value) => {
    if (key === 'maxShowUnrel') {
      try { localStorage.setItem(UNREL_KEY, value ? '1' : '0'); } catch { /* 저장 불가 환경 */ }
    }
    if (key === 'maxShowJoin') {
      try { localStorage.setItem(JOIN_KEY, value ? '1' : '0'); } catch { /* 저장 불가 환경 */ }
    }
    set({ [key]: value } as Pick<RankState, typeof key>);
  },
}));
