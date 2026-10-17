// ─────────────────────────────────────────────────────────────────────────────
// lib/toast.ts — 짧은 알림 한 줄 (v6 D13 '링크를 복사했어요')
//
// 어디서든 `toast('링크를 복사했어요', 'good')` 한 줄로 띄운다 — 띄우는 쪽은 단추(ShareBtn 등)고, 그리는 쪽은
// components/Toast.tsx 하나다. 둘 사이를 zustand 저장소 하나로 잇는다 — props 로 내려보내면 단추가 선 곳마다 선을 끌어야 한다.
// 한 번에 하나만 둔다 — 두 줄이 쌓이면 어느 것이 방금 것인지 모른다. 새 알림이 오면 앞 것을 바꿔 끼운다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';

/** 테두리 색이 곧 뜻이다 — 보통 · 잘됨(민트) · 주의(빨강) */
export type ToastKind = 'info' | 'good' | 'warn';

export interface ToastItem { id: number; text: string; kind: ToastKind }

interface ToastState {
  item: ToastItem | null;
  show: (text: string, kind?: ToastKind) => void;
  /** 번호가 같을 때만 지운다 — 앞 알림의 타이머가 새 알림을 지우지 않게 */
  dismiss: (id: number) => void;
}

/** 사라지기까지의 시간 — 시안의 '3초 뒤 사라짐' */
export const TOAST_MS = 3000;

export const useToastStore = create<ToastState>((set) => ({
  item: null,
  show: (text, kind = 'info') => set((state) => ({ item: { id: (state.item?.id ?? 0) + 1, text, kind } })),
  dismiss: (id) => set((state) => (state.item?.id === id ? { item: null } : {})),
}));

/** 전역 호출 — 구성요소 밖(이벤트 핸들러 · 라이브러리)에서도 띄울 수 있다 */
export const toast = (text: string, kind: ToastKind = 'info'): void => useToastStore.getState().show(text, kind);
