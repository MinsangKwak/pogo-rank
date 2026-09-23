// ─────────────────────────────────────────────────────────────────────────────
// AppClient.tsx — 서버가 그린 것 위에 앱이 올라탄다 (v5 Phase 6)
//
// **왜 서버에서 앱을 안 그리나.** 화면의 데이터는 `fetch('/data/…')` 로 온다. 빌드하는
// 컴퓨터에는 그 주소를 받아 줄 서버가 없어서, 서버 렌더가 Suspense 안에서 영영 안 끝났다
// (실측: 1,184장이 각각 60초를 기다리다 빌드가 섰다).
//
// 묶음을 통째로 HTML 에 박는 길도 있지만 그쪽이 더 나쁘다 — dex.json 하나가 수백 KB 라
// 1,184장에 곱하면 문서가 수백 MB 가 된다.
//
// **그래서 서버가 그리는 것은 '사실' 이다.** 크롤러가 읽어야 하는 것이 그것이고,
// 느린 회선에서 사람이 먼저 보는 것도 그것이다. 앱은 붙고 나서 그 자리를 대신한다.
//
// 첫 그림이 서버와 같아야 하므로(하이드레이션) 붙기 전에는 클라이언트도 같은 것을 그린다.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import App from './App';

export default function AppClient({ seo }: { seo?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <>{seo}</>;
  return <App seo={seo} />;
}
