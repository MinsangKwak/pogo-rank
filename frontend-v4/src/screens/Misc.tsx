// ─────────────────────────────────────────────────────────────────────────────
// screens/Misc.tsx — 여기로 오면 안 되는 화면
//
// 표(routes.ts)의 화면은 지금 전부 옮겼다. 그래도 이 자리를 지운 것이 아니라 남겨 둔다 —
// **빈 화면과 없는 화면은 다르다.** 표에 줄을 새로 넣고 App 의 분기를 깜빡하면 여기가 받아 준다.
// ─────────────────────────────────────────────────────────────────────────────
import type { RouteDef } from '../routes';

/** 아직 안 옮긴 화면 */
export function NotPorted({ route }: { route: RouteDef }) {
  const name = route.title ?? route.nav ?? route.id;
  return (
    <section className="plan__lock">
      <span className="plan__lock-ico" aria-hidden="true">🚧</span>
      <h2>{name} 는 아직 안 옮겼어요</h2>
      <p>주소는 맞는데 화면이 아직 준비되지 않았어요. moncamp.kr 에서는 열려요.</p>
      <a className="drawer__item account__login plan__lock-go" href={`https://moncamp.kr/#/${route.path}`}>
        v3 에서 이 화면 보기 ↗
      </a>
    </section>
  );
}
