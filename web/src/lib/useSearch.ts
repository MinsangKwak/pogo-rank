// ─────────────────────────────────────────────────────────────────────────────
// lib/useSearch.ts — 지금 주소의 질의(`?b=…` · `?boss=…`)를 **이동 때마다** 다시 읽는다 (2026-10-13)
//
// `useSearchParams()` 를 쓰지 않는 이유는 lib/useRoute.ts 머리말과 같다 — 그 컴포넌트와 아래가 정적 생성에서 빠진다.
// 그렇다고 처음 들어올 때 한 번만 읽으면, 같은 화면 위에서 팝업의 '솔플 계산기에서 자세히' 를 누를 때처럼
// 경로는 그대로이고 질의만 바뀌는 이동을 놓친다 — 화면이 새로 서지 않아 효과가 다시 돌지 않는다 (Codex, PR #361).
// 그래서 앱의 이동(lib/nav.ts go)과 브라우저의 뒤로 · 앞으로(popstate)를 듣고 그때의 질의를 돌려준다.
// 서버에는 주소가 없으니 빈 글자다 — 하이드레이션 뒤 브라우저 값으로 한 번 더 그린다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useSyncExternalStore } from 'react';
import { onNavigate } from './nav';

function subscribe(listener: () => void): () => void {
  const off = onNavigate(listener);
  window.addEventListener('popstate', listener);
  return () => { off(); window.removeEventListener('popstate', listener); };
}

const read = () => (typeof location === 'undefined' ? '' : location.search);
const none = () => '';

/** 지금 주소의 `?…` (물음표 포함, 없으면 빈 글자). 이동 · 뒤로 · 앞으로 때 바뀐다 */
export function useSearch(): string {
  return useSyncExternalStore(subscribe, read, none);
}
