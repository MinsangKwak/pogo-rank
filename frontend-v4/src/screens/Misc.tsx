// ─────────────────────────────────────────────────────────────────────────────
// screens/Misc.tsx — 게임 업데이트 · 아직 안 옮긴 화면
//
// **아직 안 옮긴 화면을 빈 화면으로 두지 않는다.** 미리보기를 보는 사람이
// "깨졌다" 와 "아직 안 만들었다" 를 구별할 수 있어야 한다 — v3 로 가는 길을 같이 준다.
// ─────────────────────────────────────────────────────────────────────────────
import { useUpdates } from '../lib/data';
import type { RouteDef } from '../routes';

export function GameUpdates() {
  const { data } = useUpdates();
  return (
    <div className="page__body" id="page-game-updates" data-route="game-updates">
      <div className="list">
        {data.GAME_UPDATES.map((row) => (
          <article key={row.id} className="upd__card">
            <h3 className="upd__title">{row.title}</h3>
            <p className="upd__date">{row.date}</p>
            {typeof row.summary === 'string' ? <p className="upd__summary">{row.summary}</p> : null}
          </article>
        ))}
      </div>
      <p className="detail__foot">공식 발표를 확인한 것만 적어요. 아카이브 {data.GAME_ARCHIVE.length}건은 아직 안 옮겼어요.</p>
    </div>
  );
}

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
