/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 2026-09-17 v4.0.0-alpha.1 React 전환 미리보기
//   base 가 '/' 인 이유 — 2026-09-17 부터 dev 미리보기는 **통째로 v4** 다.
//   전에는 v3 가 루트를 쓰고 v4 가 /react/ 에 얹혀 있었는데, 한 사이트에 두 앱이 살면
//   "지금 보는 게 어느 쪽이지" 가 늘 따라다닌다. dev 는 v4 하나만 본다.
//   스프라이트는 복사하지 않고 '../sprites/' 로 v3 배포본의 것을 그대로 쓴다 (40MB 를 두 벌 두지 않는다).
export default defineConfig({
  base: '/',
  plugins: [react()],
  // 컴포넌트 검사 — 브라우저도 빌드도 없이 jsdom 에서 돈다.
  // **왜 여기에 두나** — 권한 규칙은 순수 함수지만, v4.0.1 에 터진 버그는 규칙이 아니라
  // 그 규칙을 **아무도 안 읽은** 배선 문제였다. 그래서 규칙만이 아니라 규칙을 쓰는
  // 컴포넌트를 실제로 그려 본다. 브라우저로 같은 것을 보려면 빌드 6초 + 기동이 더 든다.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  build: {
    outDir: 'dist',
    // 코드 스플리팅 — 화면별 청크는 React.lazy 가 만든다. 여기서는 벤더만 가른다
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
