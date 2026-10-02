// ─────────────────────────────────────────────────────────────────────────────
// components/RouterBridge.tsx — 화면 이동을 lib/nav.ts 에 꽂는다 (v5 Phase 6 · 2026-10-02 바꿈)
//
// 화면 스물여덟 곳이 `go('/dex')` 를 부른다. 그 함수가 훅이 아니어서 어디서든 불리는 대신,
// 누군가 한 번은 진짜 이동 수단을 쥐여 줘야 한다 — 그 자리가 여기다.
//
// **이동은 서버를 거치지 않는다 (2026-10-02).** 전에는 `router.push` 로 옮겼는데, Next 는 그때마다
// 새 주소의 서버 조각(`/dex?_rsc=…`)을 받아 온 뒤에야 주소를 바꿨다 — 운영 실측 0.4~1초를 화면 없이 기다렸다
// ('Next.js 로 바꾼 뒤 렌더링이 엄청 느려졌다' 주인 제보). 그런데 화면은 레이아웃의 App 한 덩어리가 주소만 보고 그리고,
// 페이지 조각은 검색엔진용 본문이라 앱이 붙은 뒤에는 화면에 없다 — 받아 올 까닭이 없는 왕복이었다.
// 이제는 `history.pushState` 로 주소만 바꾼다. Next(14.1~)가 이것을 usePathname 에 이어 주므로 App 이 곧바로 새 화면을 그린다.
// 첫 문서 · 새로고침 · 공유 링크는 전과 같이 서버가 구운 HTML 을 받는다 — 색인은 그대로다.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { bindRouter, internalHref, markForward } from '../lib/nav';
import { showVeil } from '../lib/veil';

/**
 * 주소만 바꾼다 — 새 화면은 App 이 그리고, 덮개는 그 화면의 <Settled> 가 걷는다(뒤로 가기와 같은 길).
 * **경로가 같으면 덮지 않는다** — 질의만 바뀐 이동은 화면이 새로 서지 않아 <Settled> 가 안 돌고, 덮개가 갇힌다
 */
export function pushPath(href: string): void {
  markForward();
  const next = new URL(href, window.location.href);
  if (next.pathname !== window.location.pathname) showVeil();
  window.history.pushState(null, '', `${next.pathname}${next.search}${next.hash}`);
}

export default function RouterBridge() {
  // 뒤로는 브라우저에 맡긴다 — popstate 를 Next 가 받아 usePathname 을 고치고, 아래 듣개가 덮는다
  useEffect(() => { bindRouter(pushPath, () => { window.history.back(); }); }, []);

  // 브라우저의 뒤로 · 앞으로는 전환 밖이다 — 덮고, App 의 <Settled> 가 새 화면에서 걷는다.
  // **해시만 바뀐 popstate 는 덮지 않는다** — `#content`(건너뛰기 링크) · `#stat-search`(구역 바로가기)처럼
  // 같은 화면 안의 이동도 popstate 를 내는데, 화면이 안 바뀌니 <Settled> 가 새로 서지 않아 덮개가 8초 동안 갇혔다
  // (2026-09-28 운영 통계 바로가기에서 실측). 마지막으로 선 화면의 **경로**를 적어 두고, 같으면 지나간다.
  // 질의(?b=…)는 안 견준다 — 덱 화면이 제자리에서 replaceState 로 바꾸므로 적어 둔 값이 낡고, 질의만 다른 popstate 는
  // 화면을 안 바꾼다 (lib/useRoute.ts 는 질의를 안 읽는다) (Codex, PR #221)
  const pathname = usePathname();
  const seen = useRef('');
  useEffect(() => { seen.current = window.location.pathname; }, [pathname]);
  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname === seen.current) return;
      showVeil();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 앱 안의 <a href> 도 같은 길로 — 문서를 다시 열지 않고 본문만 갈아 끼운다 (lib/nav.ts internalHref)
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = internalHref(event, anchor, window.location);
      if (href === null) return;
      event.preventDefault();
      pushPath(href);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
