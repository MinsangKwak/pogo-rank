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
import { DataBoundary } from './components/DataBoundary';
import { registerServiceWorker } from './lib/pwa';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 빌드 데이터는 키에 해시가 들어 있어 영원히 신선하다 (lib/data.ts 참고)
      staleTime: 60 * 1000,
      // 2026-09-22 1 → 2. 받는 것이 CDN 의 정적 파일이라 재시도가 싸고, 흔들리는 휴대폰 회선에서는
      // 한 번으로 모자랐다 — 여기서 못 받으면 DataBoundary 의 '다시 불러오기' 까지 간다
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root 가 없습니다');

// 경계를 **두 겹**으로 둔다 (그물 규칙과 같은 생각 — 위가 뚫려도 아래가 잡는다).
//   바깥(여기)  셸까지 못 그릴 때. Shell.tsx 가 머리줄에서 useMeta() 를 쓰므로,
//               그 자료를 못 받으면 안쪽 경계는 아예 그려지지도 않는다 (실측: #content 가 통째로 사라졌다)
//   안쪽(App)   화면 하나만 못 그릴 때. 셸은 남고 본문 자리에만 '다시 불러오기' 가 뜬다
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataBoundary>
        <App />
      </DataBoundary>
    </QueryClientProvider>
  </StrictMode>,
);

// 오프라인 캐시 — 첫 그림을 막지 않게 맨 끝에서 붙인다
registerServiceWorker();
