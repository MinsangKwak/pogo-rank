// ─────────────────────────────────────────────────────────────────────────────
// components/RouterBridge.tsx — Next 라우터를 lib/nav.ts 에 꽂는다 (v5 Phase 6)
//
// 화면 스물여덟 곳이 `go('/dex')` 를 부른다. 그 함수가 훅이 아니어서 어디서든 불리는 대신,
// 누군가 한 번은 진짜 라우터를 쥐여 줘야 한다 — 그 자리가 여기다.
//
// 그리는 것은 없다.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { bindRouter } from '../lib/nav';

export default function RouterBridge() {
  const router = useRouter();
  useEffect(() => {
    bindRouter((href) => router.push(href), () => router.back());
  }, [router]);
  return null;
}
