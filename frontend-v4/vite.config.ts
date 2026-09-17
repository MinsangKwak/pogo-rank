import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 2026-09-17 v4.0.0-alpha.1 React 전환 미리보기
//   base 가 '/react/' 인 이유 — 미리보기를 dev.moncamp.kr/react/ 에 얹는다 (v3 는 루트 그대로).
//   스프라이트는 복사하지 않고 '../sprites/' 로 v3 배포본의 것을 그대로 쓴다 (40MB 를 두 벌 두지 않는다).
export default defineConfig({
  base: '/react/',
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
