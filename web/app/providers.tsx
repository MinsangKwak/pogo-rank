// ─────────────────────────────────────────────────────────────────────────────
// app/providers.tsx — 클라이언트 쪽 바탕 (v5 Phase 6)
//
// v4 의 main.tsx 가 하던 일이다. 경계를 **두 겹**으로 둔다 (그물 규칙과 같은 생각 —
// 위가 뚫려도 아래가 잡는다).
//   바깥(여기)  셸까지 못 그릴 때. Shell.tsx 가 머리줄에서 useMeta() 를 쓰므로,
//               그 자료를 못 받으면 안쪽 경계는 그려지지도 않는다
//   안쪽(App)   화면 하나만 못 그릴 때. 셸은 남고 본문 자리에만 '다시 불러오기' 가 뜬다
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataBoundary } from '../src/components/DataBoundary';
import RouterBridge from '../src/components/RouterBridge';

export default function Providers({ children }: { children: ReactNode }) {
  // **요청마다 새로 만든다.** 모듈 최상위에 두면 서버에서 클라이언트들이 캐시를 나눠 쓴다 —
  // 한 사람의 데이터가 다른 사람에게 갈 수 있는 자리다
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 빌드 데이터는 키에 해시가 들어 있어 영원히 신선하다 (src/lib/data.ts 참고)
        staleTime: 60 * 1000,
        // 받는 것이 CDN 의 정적 파일이라 재시도가 싸고, 흔들리는 휴대폰 회선에서는 한 번으로 모자랐다
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={client}>
      <RouterBridge />
      <DataBoundary>{children}</DataBoundary>
    </QueryClientProvider>
  );
}
