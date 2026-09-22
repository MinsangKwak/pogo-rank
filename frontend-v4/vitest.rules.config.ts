// ─────────────────────────────────────────────────────────────────────────────
// vitest.rules.config.ts — Firestore 규칙 검사만 돌리는 판 (v4.9.7)
//
// 기본 판(vite.config.ts)과 갈라 둔 이유 셋
//   · 에뮬레이터(Java)가 있어야 돈다 — 기본 `npm test` 에 섞으면 에뮬레이터 없는 자리에서 다 빨개진다
//   · jsdom 이 아니라 node 다 — firebase 클라이언트 SDK 가 gRPC 로 에뮬레이터에 붙는다
//   · setup.ts(스토어 초기화)가 필요 없다
//
//   cd frontend-v4 && npm run test:rules
// ─────────────────────────────────────────────────────────────────────────────
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/rules/**/*.test.ts'],
    // 에뮬레이터 첫 응답이 느릴 수 있다 — 기본 5초는 규칙 적재(loadFirestoreRules)에 모자란다
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
