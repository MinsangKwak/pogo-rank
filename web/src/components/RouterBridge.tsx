// ─────────────────────────────────────────────────────────────────────────────
// components/RouterBridge.tsx — Next 라우터를 lib/nav.ts 에 꽂는다 (v5 Phase 6)
//
// 화면 스물여덟 곳이 `go('/dex')` 를 부른다. 그 함수가 훅이 아니어서 어디서든 불리는 대신,
// 누군가 한 번은 진짜 라우터를 쥐여 줘야 한다 — 그 자리가 여기다.
//
// 그리는 것은 하나 — 새 화면을 기다리는 동안 맨 위에 서는 가는 띠(.nav-pending).
// 전환은 새 화면이 준비될 때까지 앞 화면을 그대로 두므로, 처음 가는 화면(데이터를 받아야 하는 곳)에서는
// 눌렀는데 1.6초 동안 아무 일도 없는 것처럼 보였다 (dev 실측) — 받고 있다는 것만 알린다
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { bindRouter, internalHref, markForward } from '../lib/nav';

export default function RouterBridge() {
  const router = useRouter();
  // 우리 전환 안에서 옮겨야 기다리는 동안을 안다 (isPending)
  const [pending, start] = useTransition();
  useEffect(() => {
    bindRouter((href) => { markForward(); start(() => router.push(href, { scroll: false })); }, () => router.back());
  }, [router]);

  // 앱 안의 <a href> 를 라우터로 옮긴다 — 문서를 다시 열지 않고 본문만 갈아 끼운다 (lib/nav.ts internalHref).
  // 라우터의 이동은 전환(transition)이라, 새 화면의 조각·데이터가 올 때까지 앞 화면을 그대로 두고 빈 틀을 안 보인다
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = internalHref(event, anchor, window.location);
      if (href === null) return;
      event.preventDefault();
      markForward();
      start(() => router.push(href, { scroll: false }));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);
  return <div className="nav-pending" aria-hidden="true" hidden={!pending} />;
}
