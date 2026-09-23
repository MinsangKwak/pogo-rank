/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next 는 tsconfig 의 jsx 를 preserve 로 둔다 — 검사가 화면 조각을 그리려면 esbuild 가 JSX 를 직접 풀어야 한다
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/**/*.test.ts'],
  },
});
