// ─────────────────────────────────────────────────────────────────────────────
// lib/docTitle.ts — 탭 제목 한 벌 (2026-10-02)
//
// 서버(app/layout.tsx · app/[...slug]/page.tsx 의 메타데이터)와 브라우저(App 의 화면 이동)가 같은 글을 쓴다.
// 화면 이동이 서버를 거치지 않게 된 뒤(lib/nav.ts) 제목은 브라우저가 고친다 — 둘이 따로 적히면 어긋난다
// ─────────────────────────────────────────────────────────────────────────────
import type { RouteDef } from '../routes';

export const HOME_TITLE = '포켓몬고 다이맥스 티어표 · 맥스 배틀 덱 · 도감 | moncamp';

/** 화면 제목 — 루트 화면은 이름을 안 적는다(주소만 알아도 '운영 통계' 가 드러나지 않게) */
export function routeDocTitle(route: RouteDef): string {
  if (route.id === 'home') return HOME_TITLE;
  if ('root' in route && route.root) return 'moncamp';
  return `${route.title ?? route.nav ?? 'moncamp'} | moncamp`;
}

/** 포켓몬 상세 제목 */
export function monDocTitle(name: string): string {
  return `${name} — 종족값·타입 상성·기술 | 포켓몬고 도감`;
}
