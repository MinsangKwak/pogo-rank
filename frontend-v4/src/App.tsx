// ─────────────────────────────────────────────────────────────────────────────
// App.tsx — 주소를 화면에 잇고, 셸의 네 자리를 연다
//
// v3 의 render() 는 69곳에서 직접 불리고 $content 를 비운 뒤 다시 그렸다.
// 여기에는 그 함수가 없다 — 주소가 바뀌면 React 가 알아서 바꾼다.
//
// **셸의 DOM 순서는 v3 와 같아야 한다** (CSS 가 자리를 보고 그린다):
//   .app-bar → #app-nav → #page-head(+#page-head-actions)
//   → .layout(#screen-tabs, #controls, #content, footer)
// 처음에 세그먼트·필터·머리 버튼을 전부 #content 에 몰아넣었더니 레이아웃이 통째로 어긋났다.
// 화면은 <Slot name="tabs"> 라고만 적고 실제 DOM 은 포털이 그 자리에 넣는다 (components/Slots.tsx).
//
// <Suspense> 를 한 곳에 두는 이유 — 화면마다 `if (isLoading)` 분기를 두면
// 그 분기가 곧 빠뜨리는 자리가 된다. 데이터 기다림은 경계 하나가 맡는다.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect, useState } from 'react';
import { AppBar, AppNav, Drawer, Footer, PageHead, ToTop } from './components/Shell';
import { SlotProvider } from './components/Slots';
import { useRoute } from './lib/useRoute';
import { trackPageView, track } from './lib/track';
import type { RouteDef } from './routes';
import Home from './screens/Home';
import Dex from './screens/Dex';
import { Dmax, Pve, Pvp } from './screens/Ranks';
import { Eggs, Raids } from './screens/Gameday';
import Schedule from './screens/Schedule';
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
  // 포털이 꽂힐 자리. ref 가 아니라 state 인 이유 — 붙은 뒤 한 번 더 그려야 포털이 들어간다
  const [tabsEl, setTabsEl] = useState<HTMLDivElement | null>(null);
  const [bossEl, setBossEl] = useState<HTMLDivElement | null>(null);
  const [controlsEl, setControlsEl] = useState<HTMLDivElement | null>(null);
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);

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
  const home = route.id === 'home';

  return (
    <SlotProvider value={{ tabs: tabsEl, bossAcc: bossEl, controls: controlsEl, headActions: actionsEl }}>
      <a className="skip-link" href="#content">본문으로 건너뛰기</a>
      <div id="px-bg" aria-hidden="true">
        <div className="px-ball px-ball--1" />
        <div className="px-ball px-ball--2" />
      </div>

      <AppBar onMenu={() => setMenuOpen(true)} home={home} />
      <AppNav now={route.id} />

      {/* 홈에는 화면 머리가 없다 — 제목이 히어로 안에 있다 (v3 syncAppShell 과 같은 규칙) */}
      {home ? null : <PageHead route={route} actionsRef={setActionsEl} />}

      {/* **자리(슬롯)는 기다림 밖에 둔다.** 안에 두면 데이터를 기다리는 동안 자리가 사라지고,
          그 자리를 붙들던 state 가 null 이 되어 다시 그리고 → 또 기다리고 를 끝없이 돈다.
          D-MAX 의 '이번 주 보스' 가 일정 데이터를 기다리다 화면이 통째로 멎었다 (React #185).
          v3 도 셸은 붙박이 HTML 이고 본문만 갈아 끼운다 — 같은 모양이다. */}
      {isShell ? (
        <div className="layout">
          <div className="screen-tabs" id="screen-tabs" ref={setTabsEl} />
          {/* 이번 주 보스는 탭과 필터 **사이** — v3 의 자리 그대로다 (list.css 가 그 틈을 8px 로 좁힌다) */}
          <div style={{ display: 'contents' }} ref={setBossEl} />
          <div className="controls" id="controls" ref={setControlsEl} />
          <div id="content">
            <Suspense fallback={<Splash />}>
              <Screen route={route} onOpen={setDetail} />
            </Suspense>
          </div>
          <Footer />
        </div>
      ) : (
        <div id="page">
          <Suspense fallback={<Splash />}>
            <Screen route={route} onOpen={setDetail} />
          </Suspense>
          <p className="ip-notice">moncamp는 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc. 에, Pokémon GO 는 Scopely Explore, Inc. 에 있으며 이 서비스는 권리자와 무관합니다.</p>
        </div>
      )}
      <Suspense fallback={null}>
        {detail === null ? null : <MonDetail dex={detail} onClose={() => setDetail(null)} />}
      </Suspense>

      <ToTop />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} now={route.id} />
    </SlotProvider>
  );
}
