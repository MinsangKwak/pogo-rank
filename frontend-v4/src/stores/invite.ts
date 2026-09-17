// ─────────────────────────────────────────────────────────────────────────────
// stores/invite.ts — 로그인 권유 팝업을 여는 자리
//
// ★ 를 누른 곳(상세 팝업·내 포켓몬)과 팝업을 그리는 곳(App)이 멀어서, 눌린 사실만 여기에 둔다.
// 값은 **어느 화면에서 불렀는가** — 팝업 문장과 GA 지표가 그 이름을 쓴다 (v3 openLoginInvite 의 screenName).
// null 이면 닫힌 것이다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';

interface InviteState {
  screen: string | null;
  open: (screen: string) => void;
  close: () => void;
}

export const useInviteStore = create<InviteState>((set) => ({
  screen: null,
  open: (screen) => set({ screen }),
  close: () => set({ screen: null }),
}));
