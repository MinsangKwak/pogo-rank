/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

// 검사는 포트도 DB 도 없이 돈다 — 순수 함수와 app.inject() 뿐이다.
// 실제 DB 를 태우는 통합 검사는 DATABASE_URL 이 있을 때만 깨어난다 (src/test/integration.test.ts).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.ts'],
  },
});
