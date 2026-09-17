// ─────────────────────────────────────────────────────────────────────────────
// stores/favs.ts — ★ 담아 둔 포켓몬
//
// **v3 는 이것을 계정에 둔다** (Firestore `users/{uid}.favs`). 여기도 로그인하면 계정에 둔다
// (stores/auth.ts) — 이 파일이 맡는 것은 **로그인 전**의 ★ 다.
//
// 로그인해야만 담을 수 있게 하면 📣 소식도, 내 포켓몬 화면도 로그인 전에는 영영 빈 채다.
// 그래서 로그인 전에는 이 기기에 담아 두고, 승인 로그인하는 순간 계정으로 **합쳐 올린다**
// (components/AuthBridge.tsx syncAccount) — 담아 둔 것이 사라지지 않는다.
//
// 키는 `pogo_favs` — v3 가 안 쓰는 이름이다 (v3 의 pogo_* 25개와 겹치지 않는 것을 확인했다).
// 계정이 붙는 날, 이 값을 첫 로그인 때 계정으로 올려 주면 담아 둔 것이 안 사라진다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';

const FAVS_KEY = 'pogo_favs';

function read(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    // **읽을 때도 번호순으로 세운다** (v3 planFavDex 와 같다). 담은 차례는 사람에게 뜻이 없고,
    // 저장된 차례가 그대로 화면에 나오면 목록이 매번 달라 보인다 —
    // 토글할 때만 정렬했더니 처음 불러온 목록만 뒤죽박죽이었다
    return saved.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  } catch { return []; }   // 저장 불가 환경(사생활 보호 모드) · 깨진 값
}

interface FavState {
  /** 도감번호 모음. 화면에서는 번호순으로 읽는다 */
  favs: number[];
  has: (dex: number) => boolean;
  toggle: (dex: number) => void;
  /** 계정으로 옮긴 뒤 이 기기 목록을 비운다 — 두 곳이 어긋나면 어느 쪽이 참인지 알 수 없다 */
  clear: () => void;
}

export const useFavStore = create<FavState>((set, get) => ({
  favs: read(),
  has: (dex) => get().favs.includes(Number(dex)),
  toggle: (dex) => {
    const number = Number(dex);
    if (!Number.isFinite(number)) return;
    const now = get().favs;
    // 번호순으로 둔다 — 담은 차례는 사람에게 뜻이 없고, 목록이 매번 달라 보이면 찾기 어렵다
    const next = now.includes(number)
      ? now.filter((one) => one !== number)
      : [...now, number].sort((a, b) => a - b);
    try { localStorage.setItem(FAVS_KEY, JSON.stringify(next)); } catch { /* 위와 같다 */ }
    set({ favs: next });
  },
  clear: () => {
    try { localStorage.removeItem(FAVS_KEY); } catch { /* 위와 같다 */ }
    set({ favs: [] });
  },
}));
