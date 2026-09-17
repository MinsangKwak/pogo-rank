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

// **저장 값은 '1'(리스트) · '2'(그리드) 다** — v3 components/ui.js layoutInitial 의 관례 그대로.
// 'grid'/'list' 로 적었더니 키 이름은 같은데 값이 안 읽혀, 이미 고른 사람의 보기가 첫 실행에 되돌아갔다
const COLS_GRID = '2';
const COLS_LIST = '1';

/**
 * 테마는 **세 갈래**다 (v3 components/theme.js THEME_ORDER 와 같다).
 *   system  기기 설정을 따른다 — <html> 의 data-theme 를 아예 떼어 둔다
 *   light   늘 밝게
 *   dark    늘 어둡게
 * 헤더 버튼은 그중 둘만 돈다(지금 보이는 것의 반대). 세 갈래를 고르는 자리는 설정 화면이다 —
 * "자주 뒤집는 것" 과 "한 번 정해 두는 것" 은 같은 자리에 있을 이유가 없다.
 */
export type Theme = 'system' | 'light' | 'dark';
export const THEME_ORDER: readonly Theme[] = ['system', 'light', 'dark'];
export const THEME_WORD: Record<Theme, string> = { system: '기기 설정', light: '밝게', dark: '어둡게' };

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
  } catch { /* 저장 불가 환경(사생활 보호 모드) — 기본값으로 간다 */ }
  return 'system';
}

/** 지금 실제로 어두운 화면인가 — '기기 설정' 은 기기에 물어봐야 안다 */
export function themeIsDark(choice: Theme): boolean {
  if (choice === 'dark') return true;
  if (choice === 'light') return false;
  return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function applyTheme(next: Theme) {
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = next;
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
    if (saved === COLS_GRID) return 'grid';
    if (saved === COLS_LIST) return 'list';
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
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* 위와 같다 */ }
    set({ theme: next });
  },
  // 버튼은 둘만 돈다 — **지금 보이는 것의 반대로**. '기기 설정' 에서 누르면 그 순간 화면의 반대가 된다
  toggleTheme: () => get().setTheme(themeIsDark(get().theme) ? 'light' : 'dark'),
  cols: {},
  setCols: (screen, next) => {
    try { localStorage.setItem(COLS_KEY(screen), next === 'grid' ? COLS_GRID : COLS_LIST); } catch { /* 위와 같다 */ }
    set((state) => ({ cols: { ...state.cols, [screen]: next } }));
  },
}));

// 첫 그림 전에 <html data-theme> 을 맞춘다 — 늦으면 흰 화면이 한 번 번쩍인다
applyTheme(usePrefStore.getState().theme);
