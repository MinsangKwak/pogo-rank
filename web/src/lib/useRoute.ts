// ─────────────────────────────────────────────────────────────────────────────
// lib/useRoute.ts — 지금 어느 화면인가 (v5 Phase 6 에 해시를 뗐다)
//
// **주소가 유일한 원본이다.** v3 는 같은 사실을 `state.tab` · `state.appMode` ·
// `state.pveTool` · `state.pvpTool` · `state.maxTool` 다섯 곳에 복사해 두고
// applyPlanRoute() 가 해시를 읽어 그 다섯을 맞추고 있었다. 여기서는 복사본을 두지 않는다.
//
// **옛 주소를 여기서 안 고친다.** 전에는 `location.replace('#/…')` 로 화면이 옮겼는데,
// 그건 브라우저 안에서만 일어나는 일이라 크롤러에게는 옛 주소가 그대로 200 이었다.
// 이제는 `next.config.mjs` 가 만드는 **308 리다이렉트**가 서버에서 한다 (routes.ts 의 legacy 표).
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { usePathname } from 'next/navigation';
import { ROUTES, routeOfPath, type RouteDef } from '../routes';

export interface CurrentRoute {
  route: RouteDef;
  rest: string;
}

/**
 * **질의(`?b=…`)는 여기서 안 읽는다.** `useSearchParams()` 를 쓰면 그 컴포넌트와 그 아래가
 * 통째로 정적 생성에서 빠진다 — 서버는 주소의 질의를 모르기 때문이다. 셸 전체가 빠지면
 * 이 판의 목적(미리 구워진 HTML)이 사라진다.
 *
 * 질의를 쓰는 화면은 하나뿐이고(덱 주소), 그쪽은 제자리에서 `location.search` 를 읽는다.
 */
export function useRoute(): CurrentRoute {
  const pathname = usePathname() ?? '/';
  const found = routeOfPath(pathname);
  return {
    route: found?.route ?? ROUTES[0],
    rest: found?.rest ?? '',
  };
}
