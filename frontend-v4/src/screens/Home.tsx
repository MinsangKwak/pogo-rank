// ─────────────────────────────────────────────────────────────────────────────
// screens/Home.tsx — 서비스 홈
//
// v3 components/home.js 의 구성을 그대로 따른다 (v3.55.0 에 게임 업데이트를 맨 아래로 내렸다):
//   히어로 → 용도별 상위 포켓몬 → 갈래 카드 → 게임 업데이트
// 타일의 이름·아이콘·설명은 **전부 라우터 표에서** 온다 (v2.66.0 의 규칙 — 글을 두 곳에 적지 않는다).
// ─────────────────────────────────────────────────────────────────────────────
import { ROUTE_GROUPS, ROUTE_NAV, routeDesc, routeHash, type RouteDef } from '../routes';
import { useMax, useUpdates, useMeta, usePve, useDex } from '../lib/data';
import { Sprite } from '../components/Bits';
import { NameNode } from '../components/Row';
import { track } from '../lib/track';

// 갈래마다 문 앞에 세우는 스타터 (v3 home.js 와 같은 번호 — 꼬부기 · 파이리 · 이상해씨)
const STARTER: Record<string, number> = { today: 7, pick: 4, mine: 1 };

// 주소는 라우터 표의 path 에서 온다 — 손으로 조립하면 v3.61.0 의 죽은 링크가 되풀이된다
function Tile({ route }: { route: RouteDef }) {
  return (
    <a className="home__tile" href={`#/${route.path}`} data-route={route.id} title={routeDesc(route.id)}
      {...(route.id === 'planner' ? { id: 'home-tile-planner' } : {})}>
      <span className="home__icon" aria-hidden="true">{route.icon}</span>
      <strong>{route.nav}</strong>
      <span className="home__arrow" aria-hidden="true">›</span>
    </a>
  );
}

// v3 components/home.js homePickGroup 과 **같은 마크업**이다.
// 처음에 pick__row 안에 그림과 이름을 바로 넣었더니 이름이 세로로 한 글자씩 쪼개졌다 —
// CSS 가 .pick__row > .pick__body 를 flex 자식으로 잡고 있어 중간 칸이 꼭 있어야 한다.
// 클래스명을 그대로 쓰면서 **구조까지** 같아야 디자인이 같다는 것을 여기서 배웠다.
interface PickRow { sprite: number; name: string; meta: string }

function PickCard({ title, hint, rows, href, labels, onOpen }: {
  title: string; hint: string; rows: PickRow[]; href: string | null;
  labels: readonly string[]; onOpen: (sprite: number) => void;
}) {
  const first = rows[0];
  if (!first) return null;
  return (
    <section className="pick__group" aria-label={title}>
      <div className="pick__head">
        <h4><span className="pick__crown" aria-hidden="true">👑</span>{title}</h4>
        <p className="pick__hint">{hint}</p>
        {href ? <a className="pick__all" href={href}>전체 보기 ↗</a> : null}
      </div>
      <div className="pick__grid">
        <button className="pick__hero" type="button" aria-label={`1위 ${first.name}`} onClick={() => onOpen(first.sprite)}>
          <span className="pick__spotlight" aria-hidden="true">NO.01</span>
          <Sprite id={first.sprite} />
          <span className="pick__inspect" aria-hidden="true">상세 보기 ↗</span>
        </button>
        <ol className="pick__list">
          {rows.map((row, index) => (
            <li key={`${row.sprite}-${index}`}>
              <button className="pick__row" type="button" onClick={() => onOpen(row.sprite)}>
                <span className="pick__rank">{index + 1}</span>
                <span className="pick__body">
                  <span className="pick__name"><NameNode name={row.name} labels={labels} /></span>
                  <span className="pick__meta">{row.meta}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function Home({ onOpen }: { onOpen: (sprite: number) => void }) {
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: dex } = useDex();
  const { data: updates } = useUpdates();
  const { data: meta } = useMeta();

  // 2026-09-17 **미구현(데이터만 등록된 개체)은 뺀다** — 홈은 '지금 셀 수 있는 셋' 을 보여 주는 자리다.
  //   제보: 홈 1위에 아직 게임에 없는 '거다이맥스 검왕 자시안' 이 서 있었다.
  //   v3 home.js 의 HOME_PICKS.dmax 가 같은 필터를 이미 걸고 있었는데 그걸 빠뜨렸다.
  //   D-MAX 화면 쪽은 [미구현 포함] 체크가 따로 있어 거기서는 고를 수 있다 (v3 와 같은 규칙).
  const dmax = (max.DMAX_TIER['overall'] ?? []).filter((row) => !row.unrel).slice(0, 3)
    // 티어표는 공격 × 맥스무브 위력 × 자속이라 내구가 안 들어간다 — 그래서 티어와 맥스무브 속성을 적는다
    .map((row) => ({ sprite: row.sprite, name: row.name, meta: `${row.tier} 티어 · ${dex.TYPE_KO[row.charged] ?? ''} 맥스` }));
  const raid = (pve.PVE_DATA['overall'] ?? []).slice(0, 3)
    .map((row) => ({ sprite: row.sprite, name: row.name, meta: `DPS ${row.dps} · 버팀 ${row.tdo}` }));

  return (
    <div className="home-dashboard">
      <section className="home__welcome" aria-label="소개">
        <div className="home__intro">
          <h2>포켓몬고, 무엇을 키울까</h2>
          <p>다이맥스 티어표부터 맥스 배틀 덱까지. 순위·도감·일정을 한 화면에서 봐요.</p>
          <div className="home__cta">
            <a className="home__btn home__btn--primary" href={routeHash('dmax')}
              onClick={() => track('home_cta', { to: 'dmax' })}>다이맥스 티어표 보기<span aria-hidden="true"> →</span></a>
            <a className="home__btn" href={routeHash('dmax-deck')}
              onClick={() => track('home_cta', { to: 'dmax-deck' })}>맥스 배틀 덱 짜기</a>
          </div>
        </div>
      </section>

      <section className="home__picks">
        <div className="home__section">
          <h3>용도별 상위 포켓몬</h3>
          <span>추천은 기준에 따라 달라져요 · 데이터 기준일 {meta.DATA_FETCHED.slice(0, 10)}</span>
        </div>
        <PickCard title="다이맥스" hint="다이맥스 배틀에서 활약하는 포켓몬" rows={dmax}
          href={routeHash('dmax')} labels={dex.FORM_LABELS} onOpen={onOpen} />
        <PickCard title="레이드" hint="종합 점수 순 · DPS 와 버팀(TDO)을 함께 봐요" rows={raid}
          href={routeHash('pve')} labels={dex.FORM_LABELS} onOpen={onOpen} />
      </section>

      <section className="home__features" aria-label="서비스 기능">
        <div className="home__section">
          <h3>무엇이 필요한가요?</h3>
          <span>목적에 맞는 화면으로 바로 가요</span>
        </div>
        <div className="home__service-grid">
          {ROUTE_GROUPS.map(([id, label, desc]) => (
            <section key={id} className={`home__service-group home__service-group--${id}`}>
              <div className="home__group-head">
                <img className="home__starter" src={`${import.meta.env.BASE_URL}../sprites/${STARTER[id]}.png`}
                  alt="" aria-hidden="true" width={96} height={96} />
                <h4 className="home__group">{label}</h4>
                <p className="home__group-desc">{desc}</p>
              </div>
              <div className="home__grid">
                {ROUTE_NAV.filter((route) => route.group === id && !route.parent).map((route) => (
                  <Tile key={route.id} route={route} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {/* v3.55.0 게임 업데이트는 맨 아래 — 매일 보는 것이 아니라 가끔 확인하는 것이라서 */}
      <section className="home-updates">
        <div className="home__section">
          <h3>게임 업데이트</h3>
          <span>공식 발표를 확인한 것만 적어요</span>
        </div>
        <ul className="home-updates__list">
          {updates.GAME_UPDATES.slice(0, 3).map((row) => (
            <li key={row.id}><a href={`#/game-updates/${row.id}`}>{row.title}</a> <em>{row.date}</em></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
