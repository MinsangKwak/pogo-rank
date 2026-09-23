// ─────────────────────────────────────────────────────────────────────────────
// components/Slots.tsx — 화면이 **셸의 정해진 자리**에 조각을 넣는 길
//
// 왜 필요한가. v3 의 셸은 자리가 넷으로 갈려 있다 —
//
//   <header id="page-head">… <div id="page-head-actions">   ← 미구현 체크 · 도구 버튼 · 보기 방식
//   <div class="layout">
//     <div id="screen-tabs">   ← 세그먼트 (전체/딜러/탱커)
//     <details id="boss-acc">  ← 이번 주 보스 (D-MAX 화면만)
//     <div id="controls">      ← 타입 필터 접이식
//     <div id="content">       ← 본문
//
// 처음에 이 셋을 전부 #content 안에 몰아넣었더니 **레이아웃이 통째로 어긋났다.**
// CSS 가 `.layout > #controls` · `.page-head__actions .tool-btn` 처럼 자리를 보고 그리기 때문이다.
//
// 화면마다 이 조각을 props 로 올려 보내면 App 이 네 겹 프롭 드릴이 된다.
// 대신 포털을 쓴다 — 화면은 자기 자리에서 <Slot name="controls"> 라고만 적고,
// React 가 실제 DOM 은 셸의 그 자리에 넣는다. **DOM 순서는 v3 와 같고, 코드는 화면에 모인다.**
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type SlotName = 'tabs' | 'bossAcc' | 'controls' | 'headActions';

const SlotContext = createContext<Partial<Record<SlotName, HTMLElement | null>>>({});

export const SlotProvider = SlotContext.Provider;

export function Slot({ name, children }: { name: SlotName; children: ReactNode }) {
  const targets = useContext(SlotContext);
  const target = targets[name];
  // 첫 렌더에는 ref 가 아직 안 붙어 있다 — 그때는 아무것도 안 그리고, 붙은 뒤 다시 그린다
  return target ? createPortal(children, target) : null;
}
