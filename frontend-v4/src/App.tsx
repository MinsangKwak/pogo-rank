// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — 주소를 화면에 잇는다
//
// v3 의 render() 는 69곳에서 직접 불리고 $content 를 비운 뒤 다시 그렸다.
// 여기에는 그 함수가 없다 — 주소가 바뀌면 React 가 알아서 바꾼다.
//
// <Suspense> 를 한 곳에 두는 이유 — 화면마다 `if (isLoading)` 분기를 두면
// 그 분기가 곧 빠뜨리는 자리가 된다. 데이터 기다림은 경계 하나가 맡는다.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect, useState } from 'react';
import { AppBar, AppNav, Drawer, Footer, PageHead, ToTop } from './components/Shell';
import { useRoute } from './lib/useRoute';
import { trackPageView, track } from './lib/track';
import type { RouteDef } from './routes';
import Home from './screens/Home';
import Dex from './screens/Dex';
import { Dmax, Pve, Pvp } from './screens/Ranks';
import { Eggs, Raids, Schedule } from './screens/Gameday';
import { GameUpdates, Locked, NotPorted } from './screens/Misc';
import MonDetail from './screens/MonDetail';

function Splash() {
  return (
    <div id="splash">
      <div className="splash__ball" aria-hidden="true" />
      <div className="splash__title">moncamp</div>
      <div className="splash__bar"><i /></div>
      <div className="splash__sub">불러오는 중…</div>
    </div>
  );
}

/** 라우트 하나가 그리는 본문 */
function Screen({ route, onOpen }: { route: RouteDef; onOpen: (sprite: number) => void }) {
  switch (route.id) {
    case 'home': return <Home onOpen={onOpen} />;
    case 'dex': return <Dex onOpen={onOpen} />;
    case 'dmax': return <Dmax onOpen={onOpen} />;
    case 'pve': return <Pve onOpen={onOpen} />;
    case 'pvp': return <Pvp onOpen={onOpen} />;
    case 'raids': return <Raids onOpen={onOpen} />;
    case 'eggs': return <Eggs onOpen={onOpen} />;
    case 'schedule': return <Schedule />;
    case 'game-updates': return <GameUpdates />;
    // 잠긴 화면 — 잠금은 라우터 표(locked)가 정한다 (v3 와 같은 규칙)
    case 'planner': return <Locked name="내 포켓몬" />;
    default: return <NotPorted route={route} />;
  }
}

export default function App() {
  const { route } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);

  // body 의 data-* 는 CSS 선택자와 GA 가 읽는다 — v3 와 같은 값으로 채운다
  useEffect(() => {
    const body = document.body.dataset;
    body['route'] = route.id;
    body['mode'] = route.kind === 'plan' ? 'plan' : 'dex';
    if (route.id === 'home') body['home'] = 'true'; else delete body['home'];
    trackPageView(route.title ?? route.nav ?? route.id);
    track('route_view', { route: route.id });
  }, [route]);

  const isShell = route.kind === 'shell' || route.kind === 'plan';

  return (
    <>
      <a className="skip-link" href="#content">본문으로 건너뛰기</a>
      <div id="px-bg" aria-hidden="true">
        <div className="px-ball px-ball--1" />
        <div className="px-ball px-ball--2" />
      </div>

      <AppBar onMenu={() => setMenuOpen(true)} home={route.id === 'home'} />
      <AppNav now={route.id} />

      {/* 홈이 아닌 화면에는 머리줄 — v3 는 page 라우트에만 붙였지만 셸 라우트도 같은 머리를 쓴다 */}
      {route.id === 'home' ? null : <PageHead route={route} />}

      <Suspense fallback={<Splash />}>
        {isShell ? (
          <div className="layout">
            <div id="content">
              <Screen route={route} onOpen={setDetail} />
            </div>
            <Footer />
          </div>
        ) : (
          <div id="page">
            <Screen route={route} onOpen={setDetail} />
            <p className="ip-notice">moncamp는 비공식 팬 프로젝트입니다.</p>
          </div>
        )}
        {detail === null ? null : <MonDetail dex={detail} onClose={() => setDetail(null)} />}
      </Suspense>

      <ToTop />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} now={route.id} />
    </>
  );
}
