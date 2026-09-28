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
import { useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { bindRouter, internalHref, markForward } from '../lib/nav';
import { showVeil, settleVeil } from '../lib/veil';

export default function RouterBridge() {
  const router = useRouter();
  // 우리 전환 안에서 옮겨야 기다리는 동안을 안다 (isPending)
  const [pending, start] = useTransition();
  useEffect(() => {
    bindRouter((href) => { markForward(); showVeil(); start(() => router.push(href, { scroll: false })); }, () => { showVeil(); router.back(); });
  }, [router]);

  // 전환이 끝났다 = 새 화면이 섰다 (전환은 새 화면의 조각 · 데이터가 올 때까지 안 끝난다). 그때 덮개를 걷는다.
  // **전환이 있었을 때만.** pending 은 처음부터 false 라, 그냥 보면 하이드레이션 직후 첫 덮개를 걷어 버린다 —
  // 그때는 아직 서버 본문이 그대로라 덮어야 할 바로 그 구간이다 (Codex, PR #214). 첫 덮개는 App 의 <Settled> 가 걷는다
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) { wasPending.current = true; return; }
    if (!wasPending.current) return;
    wasPending.current = false;
    settleVeil();
  }, [pending]);

  // 브라우저의 뒤로 · 앞으로는 전환 밖이다 — 덮고, App 의 <Settled> 가 새 화면에서 걷는다.
  // **해시만 바뀐 popstate 는 덮지 않는다** — `#content`(건너뛰기 링크) · `#stat-search`(구역 바로가기)처럼
  // 같은 화면 안의 이동도 popstate 를 내는데, 화면이 안 바뀌니 <Settled> 가 새로 서지 않아 덮개가 8초 동안 갇혔다
  // (2026-09-28 운영 통계 바로가기에서 실측). 마지막으로 선 화면의 주소를 적어 두고, 그것과 같으면 지나간다
  const pathname = usePathname();
  const seen = useRef('');
  useEffect(() => { seen.current = `${window.location.pathname}${window.location.search}`; }, [pathname]);
  useEffect(() => {
    const onPop = () => {
      if (`${window.location.pathname}${window.location.search}` === seen.current) return;
      showVeil();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
      showVeil();
      start(() => router.push(href, { scroll: false }));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);
  return <div className="nav-pending" aria-hidden="true" hidden={!pending} />;
}
