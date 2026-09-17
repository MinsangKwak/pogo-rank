// ─────────────────────────────────────────────────────────────────────────────
// stores/favs.ts — ★ 담아 둔 포켓몬
//
// **v3 는 이것을 계정에 둔다** (Firestore `users/{uid}.favs`). 로그인한 사람만 담을 수 있고,
// 기기를 바꿔도 따라온다. 미리보기에는 아직 로그인이 없다 (Firebase 는 Phase 5).
//
// 그래서 여기서는 **이 기기에** 둔다. 고른 길이 셋이었다:
//   ① 화면을 잠가 둔다      — 담을 수가 없으니 📣 소식도, 내 포켓몬 화면도 영영 빈 채다
//   ② Firebase 를 먼저 옮긴다 — 승인·약관·계정 삭제까지 딸려 와 순서가 뒤집힌다
//   ③ 이 기기에 둔다        — ★ 를 눌러 보고, 소식이 뜨는 것까지 확인할 수 있다
// ③ 을 골랐다. 미리보기의 일은 **만져 보게 하는 것**이고, 담는 곳이 어디든 화면이 하는 말은 같다.
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
}));
