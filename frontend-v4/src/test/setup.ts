// ─────────────────────────────────────────────────────────────────────────────
// test/setup.ts — 검사마다 먼저 도는 자리
//
// **검사끼리 상태를 물려주지 않는다.** 스토어는 모듈 하나에 살아 있는 값이라,
// 앞 검사가 로그인해 둔 채로 다음 검사가 시작되면 통과·실패가 순서에 달리게 된다.
// ─────────────────────────────────────────────────────────────────────────────
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/auth';

// 로그인 전(anon)이 기본이다 — 실제 첫 방문자와 같은 자리에서 시작한다
const BLANK = {
  ready: false, enabled: false, user: null, status: 'anon' as const,
  admin: false, adminRoot: false, beta: false, favs: [], requestError: '', api: null,
};

beforeEach(() => {
  useAuthStore.getState().set(BLANK);
  try { localStorage.clear(); } catch { /* 저장소를 막은 환경 */ }
});

afterEach(() => {
  cleanup();
});
