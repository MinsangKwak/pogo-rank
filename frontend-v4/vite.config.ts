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
