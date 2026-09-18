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
import { Suspense, lazy, useEffect, useState } from 'react';
import { AppBar, AppNav, Drawer, Footer, PageHead, ToTop } from './components/Shell';
import { SlotProvider } from './components/Slots';
import { useRoute } from './lib/useRoute';
import type { MonPick, OpenMon } from './lib/mon';
import { useLockReason } from './lib/useLocked';
import { trackPageView, track } from './lib/track';
import type { RouteDef } from './routes';
import Home from './screens/Home';
import Dex from './screens/Dex';
import { Dmax, Pve, Pvp } from './screens/Ranks';
import { Eggs, Raids } from './screens/Gameday';
import Schedule from './screens/Schedule';
import { NotPorted } from './screens/Misc';
import MonDetail from './screens/MonDetail';
import ConsentDialog from './components/Consent';
import LoginInvite from './components/LoginInvite';
import { useInviteStore } from './stores/invite';
import LangBridge from './components/LangBridge';
import AuthBridge from './components/AuthBridge';
import LockCard from './components/LockCard';

// ── 눌러 들어가는 화면은 **누를 때 받는다** ────────────────────────────────────
// 첫 화면(홈·도감·티어표)에 없는 것을 첫 묶음에 넣을 이유가 없다. v3 도 같은 이유로
// app-lazy.js 를 갈랐다. 기다림은 이미 있는 <Suspense> 하나가 받는다 —
// 이 화면들은 어차피 제 데이터 묶음을 기다리느라 한 번 그 자리를 지나간다
const GameUpdates = lazy(() => import('./screens/GameUpdates'));
const Release = lazy(() => import('./screens/Release'));
const Changes = lazy(() => import('./screens/Changes'));
const Privacy = lazy(() => import('./screens/Legal').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./screens/Legal').then((m) => ({ default: m.Terms })));
const Settings = lazy(() => import('./screens/Settings'));
const Planner = lazy(() => import('./screens/Planner'));
const Finder = lazy(() => import('./screens/Finder'));
const IvRankPage = lazy(() => import('./screens/IvRankPage'));
const PvpDeck = lazy(() => import('./screens/PvpDeck'));
const DmaxDeck = lazy(() => import('./screens/DmaxDeck'));
const SoloCalc = lazy(() => import('./screens/SoloCalc'));

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
function Screen({ route, rest, onOpen }: { route: RouteDef; rest: string; onOpen: OpenMon }) {
  // 판정은 lib/useLocked 하나가 한다 — 메뉴 줄·홈 타일도 같은 답을 쓴다
  const reason = useLockReason(route.id);
  if (reason) return <LockCard reason={reason} />;
  switch (route.id) {
    case 'home': return <Home onOpen={onOpen} />;
    case 'dex': return <Dex onOpen={onOpen} />;
    case 'dmax': return <Dmax onOpen={onOpen} />;
    case 'pve': return <Pve onOpen={onOpen} />;
    case 'pvp': return <Pvp onOpen={onOpen} />;
    case 'raids': return <Raids onOpen={onOpen} />;
    case 'eggs': return <Eggs onOpen={onOpen} />;
    case 'schedule': return <Schedule />;
    case 'game-updates': return <GameUpdates rest={rest} />;
    case 'planner': return <Planner />;
    case 'finder': return <Finder />;
    // 화면 아래 화면 — 부모 화면의 도구 버튼 하나로만 들어온다 (주소가 도구를 정한다)
    case 'ivrank': return <IvRankPage />;
    case 'pvp-deck': return <PvpDeck onOpen={onOpen} />;
    case 'dmax-deck': return <DmaxDeck onOpen={onOpen} />;
    case 'pve-solo': return <SoloCalc onOpen={onOpen} />;
    case 'release': return <Release />;
    case 'changes': return <Changes onOpen={onOpen} />;
    case 'privacy': return <Privacy />;
    case 'terms': return <Terms />;
    case 'settings': return <Settings />;
    // #/mon/<id> 는 본문이 따로 없다 — 팝업이 곧 그 화면이라, 뒤에는 홈을 깔아 준다 (v3 와 같다)
    case 'mon': return <Home onOpen={onOpen} />;
    default: return <NotPorted route={route} />;
  }
}

export default function App() {
  const { route, rest } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const invite = useInviteStore((s) => s.screen);
  const closeInvite = useInviteStore((s) => s.close);
  // [스프라이트, 영문명]. 영문명은 **연 쪽이 들고 있던 것**만 넘긴다 —
  // v3 도 순위표 줄에서 열면 이름 아래에 Melmetal 이 서고, 도감에서 열면 서지 않는다
  const [detail, setDetail] = useState<MonPick | null>(null);
  const openMon: OpenMon = (pick) => {
    const sprite = pick.sprite;
    setDetail(pick);
    track('detail_open', { sprite });
    // 주소를 상세로 바꿔 두는 것은 **홈(과 상세) 위에서만** 이다 (v3 detailSyncHash 의 규칙).
    //   목록 위에서 바꾸면 뒤에 깔린 화면이 그 목록에서 홈으로 갈리고, ✕ 를 눌러도 목록으로 못 돌아온다.
    //   기록에 쌓지 않고 바꿔치기한다 — ✕ 한 번으로 닫혀야 한다
    if (route.id === 'home' || route.id === 'mon') {
      try { history.replaceState(history.state, '', `#/mon/${sprite}`); } catch { /* 파일 프로토콜 등 */ }
    }
  };
  const closeMon = () => {
    setDetail(null);
    // 상세 주소에서 닫으면 홈으로 — 그 자리에 남기면 새로고침에 팝업이 되살아난다
    if (location.hash.startsWith('#/mon/')) { try { history.replaceState(history.state, '', '#/'); } catch { /* 위와 같다 */ } }
  };

  // 주소가 바뀌면 팝업도 따라간다.
  //   #/mon/<스프라이트 id> 로 바로 들어오면(공유 링크) 그 팝업을 열고,
  //   **다른 화면으로 옮겨 가면 닫는다.** 안 닫으면 <dialog> 가 새 화면 위에 그대로 떠서
  //   아무 데도 눌리지 않는다 (메뉴로 검색식 화면에 갔는데 클릭이 안 먹어 찾았다).
  //   목록에서 열 때는 주소가 안 바뀌므로(홈에서만 replaceState) 이 효과가 방해하지 않는다
  useEffect(() => {
    if (route.id !== 'mon') { setDetail(null); return; }
    const sprite = Number(rest);
    if (!Number.isFinite(sprite) || !sprite) return;
    // 공유 링크에는 이름이 없다 — 스프라이트만 넘기고 상세가 색인에서 찾게 둔다 (v3 openDetailBySprite)
    setDetail((now) => (now?.sprite === sprite ? now : { sprite }));
  }, [route, rest]);
  // 화면을 옮기면 열려 있던 팝업·서랍은 닫는다 — <dialog> 가 새 화면 위에 그대로 떠 있으면
  // 아무 데도 눌리지 않는다 (상세 팝업에서 같은 자리를 이미 한 번 겪었다)
  useEffect(() => { setConsentOpen(false); setMenuOpen(false); closeInvite(); }, [route, rest, closeInvite]);

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

  // #/mon/<id> 뒤에 깔리는 것은 홈이다 — 셸도 머리줄도 홈과 같게 둔다 (v3 detailSyncHash 가 둘을 같이 본다)
  const asHome = route.id === 'home' || route.id === 'mon';
  const isShell = route.kind === 'shell' || route.kind === 'plan' || asHome;
  const home = asHome;
  // **상세일 때 머리줄은 홈이 아니다.** 돌아갈 곳이 있으니 뒤로가기를 주고,
  // 그 자리에 로고까지 두면 같은 줄이 "여기가 처음" 과 "돌아갈 수 있다" 를 같이 말하게 된다.
  //
  // **주소가 아니라 팝업이 떴는지를 본다.** 주소는 홈에서 열 때만 #/mon/… 으로 바뀐다
  // (목록 위에서 바꾸면 ✕ 를 눌러도 목록으로 못 돌아온다 — openMon 머리말).
  // 그래서 route.id 만 보면 도감·티어표에서 연 상세는 그대로 로고가 남는다.
  const onDetail = detail !== null;

  return (
    <SlotProvider value={{ tabs: tabsEl, bossAcc: bossEl, controls: controlsEl, headActions: actionsEl }}>
      <a className="skip-link" href="#content">본문으로 건너뛰기</a>
      <div id="px-bg" aria-hidden="true">
        <div className="px-ball px-ball--1" />
        <div className="px-ball px-ball--2" />
      </div>

      <LangBridge />
      <AuthBridge />

      {/* 로고는 home 이 정한다 (뒤로가기가 있으면 접는다).
          상세에서 뒤로가기는 **팝업을 닫는다** — 화면을 떠나면 뒤에 보던 목록까지 잃는다 */}
      <AppBar onMenu={() => setMenuOpen(true)} home={home && !onDetail}
        onBack={onDetail ? closeMon : undefined} />
      <AppNav now={route.id} onConsent={() => setConsentOpen(true)} />

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
              <Screen route={route} rest={rest} onOpen={openMon} />
            </Suspense>
          </div>
          <Footer onConsent={() => setConsentOpen(true)} />
        </div>
      ) : (
        <div id="page">
          <Suspense fallback={<Splash />}>
            <Screen route={route} rest={rest} onOpen={openMon} />
          </Suspense>
          {/* 약관·개인정보처리방침은 제 본문 끝에 같은 고지를 이미 달고 있다 — 여기서 한 번 더 붙이지 않는다 (v3 와 같다) */}
          {route.id === 'terms' || route.id === 'privacy' ? null : (
            <p className="ip-notice">moncamp는 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc. 에, Pokémon GO 는 Scopely Explore, Inc. 에 있으며 이 서비스는 권리자와 무관합니다.</p>
          )}
        </div>
      )}
      <Suspense fallback={null}>
        {detail === null ? null : <MonDetail pick={detail} onClose={closeMon} />}
      </Suspense>

      {consentOpen ? <ConsentDialog onClose={() => setConsentOpen(false)} /> : null}
      {/* ★ 를 눌렀는데 로그인 전일 때 — 누른 곳과 그리는 곳이 멀어 stores/invite.ts 를 거친다 */}
      {invite !== null ? <LoginInvite screen={invite} onClose={closeInvite} /> : null}

      <ToTop />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} now={route.id} onConsent={() => setConsentOpen(true)} />
    </SlotProvider>
  );
}
