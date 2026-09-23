// ─────────────────────────────────────────────────────────────────────────────
// components/RouteIntro.tsx — 서버가 그리는 화면 머리 (v5 Phase 6)
//
// 상세가 아닌 주소(도감·티어표·일정…)에서 크롤러가 읽는 덩어리다.
// **사람에게도 쓸모가 있어야 한다** — 크롤러만 보라고 숨겨 둔 글은 검색엔진이 싫어하고,
// 느린 회선에서 먼저 보이는 것이 이 화면이다.
//
// 링크를 함께 둔다. 크롤러는 링크를 따라 다음 주소를 찾는다 — 해시 주소일 때는
// 따라갈 링크가 아예 없었다.
// ─────────────────────────────────────────────────────────────────────────────
import { ROUTE_NAV, routeDesc, type RouteDef } from '../routes';

export default function RouteIntro({ route }: { route: RouteDef }) {
  const title = route.title ?? route.nav ?? 'moncamp';
  const desc = routeDesc(route.id);
  return (
    <div className="detail detail--facts" data-route={route.id}>
      <h1 className="detail__name">{title}</h1>
      {desc ? <p className="detail__sub">{desc}</p> : null}
      <nav className="detail__sec" aria-label="주요 화면">
        <h2>다른 화면</h2>
        <ul>
          {ROUTE_NAV.filter((one) => one.id !== route.id).map((one) => (
            <li key={one.id}><a href={`/${one.path}`}>{one.nav}</a></li>
          ))}
        </ul>
      </nav>
      <p className="detail__foot">불러오는 중…</p>
    </div>
  );
}
