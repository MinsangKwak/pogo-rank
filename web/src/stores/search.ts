// ─────────────────────────────────────────────────────────────────────────────
// stores/search.ts — 검색 팔레트가 열려 있는가 (2026-09-28)
//
// 여는 자리가 셋이다 — 상단 바의 검색칸 · 홈의 검색 단추 · 키보드(/ · Ctrl+K). 한 곳의 state 로 두면
// 셋이 그 컴포넌트를 거쳐야 하므로, 테마·언어처럼 작은 저장소 하나에 둔다 (stores/pref.ts 와 같은 틀)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { create } from 'zustand';

interface SearchState {
  open: boolean;
  /** 어디서 열었는가 — 팔레트가 첫 안내 문구를 고를 때 본다 ('bar' · 'home' · 'key') */
  from: string;
  show: (from?: string) => void;
  hide: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  open: false,
  from: 'bar',
  show: (from = 'bar') => set({ open: true, from }),
  hide: () => set({ open: false }),
}));

/** 훅 밖에서 여는 길 — 키보드 단축키 · 이벤트 핸들러 */
export const openSearch = (from?: string): void => useSearchStore.getState().show(from);
