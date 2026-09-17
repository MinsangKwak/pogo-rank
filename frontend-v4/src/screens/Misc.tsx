// ─────────────────────────────────────────────────────────────────────────────
// screens/Misc.tsx — 아직 안 옮긴 화면
//
// **아직 안 옮긴 화면을 빈 화면으로 두지 않는다.** 미리보기를 보는 사람이
// "깨졌다" 와 "아직 안 만들었다" 를 구별할 수 있어야 한다 — v3 로 가는 길을 같이 준다.
// ─────────────────────────────────────────────────────────────────────────────
import type { RouteDef } from '../routes';

/** 아직 안 옮긴 화면 */
export function NotPorted({ route }: { route: RouteDef }) {
  const name = route.title ?? route.nav ?? route.id;
  return (
    <section className="plan__lock">
      <span className="plan__lock-ico" aria-hidden="true">🚧</span>
      <h2>{name} 는 아직 안 옮겼어요</h2>
      <p>이 미리보기는 계산 화면(Phase 4)까지입니다. 설정 · 약관 · 패치노트와 계정 화면(Phase 5)은 다음 판이에요.</p>
      <a className="drawer__item account__login plan__lock-go" href={`https://moncamp.kr/#/${route.path}`}>
        v3 에서 이 화면 보기 ↗
      </a>
    </section>
  );
}
