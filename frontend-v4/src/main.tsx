// ─────────────────────────────────────────────────────────────────────────────
// main.tsx — 시작점
//
// v3 는 <script> 하나가 436개 전역을 선언하고 app.js 가 맨 아래에서 render() 를 불렀다.
// 여기는 모듈 그래프다 — 무엇이 무엇을 필요로 하는지 import 가 말한다.
// ─────────────────────────────────────────────────────────────────────────────
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles';
import App from './App';
import { registerServiceWorker } from './lib/pwa';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 빌드 데이터는 키에 해시가 들어 있어 영원히 신선하다 (lib/data.ts 참고)
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root 가 없습니다');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

// 오프라인 캐시 — 첫 그림을 막지 않게 맨 끝에서 붙인다
registerServiceWorker();
