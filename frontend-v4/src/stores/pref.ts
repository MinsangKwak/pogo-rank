// ─────────────────────────────────────────────────────────────────────────────
// stores/pref.ts — 기기에 남는 개인 설정 (테마 · 보기 방식)
//
// **localStorage 키를 한 글자도 바꾸지 않는다.** `pogo_theme` 에 이미 값이 들어 있는 기기가
// 있고, 새 버전이 그 값을 못 읽으면 첫 실행에 테마가 튄다.
//
// 그래서 zustand 의 `persist` 를 기본형으로 쓰지 않는다 — persist 는 `{state, version}` 래퍼로
// 감싸 저장하는데 v3 는 날값('dark')을 넣었다. 여기서는 **v3 와 같은 날값**을 읽고 쓴다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';

const THEME_KEY = 'pogo_theme';       // v3 components/theme.js 와 같은 키
const COLS_KEY = (screen: string) => `pogo_${screen}_cols`;   // pogo_dex_cols · pogo_raids_cols …

export type Theme = 'light' | 'dark';

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* 저장 불가 환경(사생활 보호 모드) — 기본값으로 간다 */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 보기 방식의 기본값은 **화면 폭이 정한다** — v3 dom.js wideCards() 와 같은 1100px 경계.
 * 좁은 화면에서 카드를 기본으로 두면 한 줄에 한 장씩 서서 스크롤만 길어지고,
 * CSS 가 카드용으로 감춰 둔 칸(세대·CP·타입)까지 같이 사라진다.
 * (처음에 폭과 무관하게 grid 를 기본으로 뒀다가 390px 에서 v3 와 다른 줄이 나왔다.)
 */
export function wideCards(): boolean {
  return window.matchMedia?.('(min-width: 1100px)').matches ?? false;
}

export function readCols(screen: string, fallback?: 'grid' | 'list'): 'grid' | 'list' {
  try {
    const saved = localStorage.getItem(COLS_KEY(screen));
    if (saved === 'grid' || saved === 'list') return saved;
  } catch { /* 위와 같다 */ }
  return fallback ?? (wideCards() ? 'grid' : 'list');
}

interface PrefState {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
  cols: Record<string, 'grid' | 'list'>;
  setCols: (screen: string, next: 'grid' | 'list') => void;
}

export const usePrefStore = create<PrefState>((set, get) => ({
  theme: readTheme(),
  setTheme: (next) => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* 위와 같다 */ }
    set({ theme: next });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  cols: {},
  setCols: (screen, next) => {
    try { localStorage.setItem(COLS_KEY(screen), next); } catch { /* 위와 같다 */ }
    set((state) => ({ cols: { ...state.cols, [screen]: next } }));
  },
}));

// 첫 그림 전에 <html data-theme> 을 맞춘다 — 늦으면 흰 화면이 한 번 번쩍인다
document.documentElement.dataset.theme = usePrefStore.getState().theme;
