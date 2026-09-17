// ─────────────────────────────────────────────────────────────────────────────
// components/Shell.tsx — 머리줄 · 왼쪽 메뉴 · 화면 머리 · 바닥
//
// **클래스명과 DOM id 를 v3 와 똑같이 쓴다.** 그것이 디자인을 그대로 유지하는 방법이고,
// 회귀 34 스위트가 붙잡고 있는 계약이다 (`.app-bar` · `#app-nav` · `#page-head` · `#menu-planner` …).
// CSS 는 frontend/styles 의 것을 한 줄도 안 고치고 그대로 쓴다 (src/styles.ts).
//
// v3 와 다른 점 하나 — 도트 아이콘(components/pxicon.js)은 아직 안 옮겼다.
// 지금은 같은 자리에 이모지가 그대로 선다. 미리보기에서 눈에 띄는 유일한 차이다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from 'react';
import { ROUTE_GROUPS, ROUTE_NAV, routeById, routeDesc, type RouteDef } from '../routes';
import { usePrefStore } from '../stores/pref';
import { track } from '../lib/track';

function NavItem({ route, now }: { route: RouteDef; now: string }) {
  return (
    <a
      href={`#/${route.path}`}
      className="drawer__item"
      data-route={route.id}
      {...(route.id === 'planner' ? { id: 'menu-planner' } : {})}
      {...(route.id === now ? { 'aria-current': 'page' as const } : {})}
      title={routeDesc(route.id)}
    >
      <span className="drawer__ico" aria-hidden="true">{route.icon}</span>
      <span className="drawer__label">{route.nav}</span>
    </a>
  );
}

export function AppBar({ onMenu }: { onMenu: () => void }) {
  const theme = usePrefStore((s) => s.theme);
  const toggleTheme = usePrefStore((s) => s.toggleTheme);
  return (
    <header className="app-bar">
      <div className="app-bar__head">
        <button className="icon-btn" aria-label="이전 화면" onClick={() => history.back()}>←</button>
        <h1 id="app-title" tabIndex={-1}>
          <a className="app-bar__logo" href="#/">moncamp</a>
        </h1>
      </div>
      <a className="app-search" id="app-search" aria-label="포켓몬 검색" href="#/dex">
        <span className="app-search__ico" aria-hidden="true">🔍</span>
        <span className="app-search__ph">포켓몬을 검색하세요</span>
        <kbd className="app-search__key" aria-hidden="true">/</kbd>
      </a>
      <div className="app-bar__actions">
        <a className="icon-btn" id="search-toggle" aria-label="포켓몬 검색 — 도감으로" href="#/dex">🔍</a>
        <button
          className="icon-btn"
          id="theme-toggle"
          aria-label={`화면 테마: ${theme === 'dark' ? '어둡게' : '밝게'}`}
          aria-live="polite"
          onClick={() => { toggleTheme(); track('theme_toggle', { to: theme === 'dark' ? 'light' : 'dark' }); }}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </button>
        <button className="icon-btn lang-toggle" id="lang-toggle" aria-label="View in English (영어로 보기)" aria-live="polite">EN</button>
        <button className="icon-btn" id="menu-toggle" aria-label="메뉴" aria-haspopup="dialog" onClick={onMenu}>☰</button>
      </div>
    </header>
  );
}

export function AppNav({ now }: { now: string }) {
  return (
    <aside className="app-nav" id="app-nav">
      <nav className="nav-menu" aria-label="서비스 이동">
        <a href="#/" className="drawer__item" {...(now === 'home' ? { 'aria-current': 'page' as const } : {})}>
          <span className="drawer__ico" aria-hidden="true">🏠</span>
          <span className="drawer__label">서비스 홈</span>
        </a>
        {ROUTE_GROUPS.map(([id, label]) => (
          <div key={id} style={{ display: 'contents' }}>
            <h3 className="nav-menu__sec">{label}</h3>
            {ROUTE_NAV.filter((route) => route.group === id).map((route) => (
              <NavItem key={route.id} route={route} now={now} />
            ))}
          </div>
        ))}
      </nav>
      <div className="app-nav__extra">
        <div id="drawer-extra">
          <p className="drawer__meta">
            React 전환 미리보기 (v4.0.0-alpha.1) · 데이터는 v3 빌드와 같은 것
          </p>
        </div>
      </div>
    </aside>
  );
}

/** 화면 머리 — 브레드크럼 · 제목 · 한 줄 설명 · 오른쪽 동작 */
export function PageHead({ route, actions }: { route: RouteDef; actions?: ReactNode }) {
  const parent = route.parent ? routeById(route.parent) : undefined;
  const name = route.title ?? route.nav ?? route.id;
  return (
    <header className="page-head" id="page-head" data-route={route.id}>
      <nav className="page-head__crumb" aria-label="위치">
        <a className="page-head__crumb-home" href="#/">🏠</a>
        <span className="page-head__crumb-sep" aria-hidden="true">›</span>
        <a className="page-head__crumb-up" href={parent ? `#/${parent.path}` : '#/'} hidden={!parent}>
          {parent ? (parent.title ?? parent.nav) : ''}
        </a>
        <span className="page-head__crumb-sep" aria-hidden="true" hidden={!parent}>›</span>
        <span className="page-head__crumb-now">{name}</span>
      </nav>
      <h2>{name}</h2>
      <p className="page-head__desc">{routeDesc(route.id)}</p>
      <div className="page-head__actions" id="page-head-actions">{actions}</div>
    </header>
  );
}

export function Footer() {
  return (
    <footer>
      <p className="foot-lead">포켓몬고 응애 친구들을 위해 만들어진 서비스예요.</p>
      <p id="ip-notice">moncamp는 비공식 팬 프로젝트이며 Pokémon 및 관련 명칭·이미지의 권리는 각 권리자에게 있습니다.</p>
      <p>데이터는 PvPoke · PokeMiners · PokeAPI · LeekDuck 의 공개 자료를 사용합니다.</p>
      <p className="foot-links">
        <a href="https://github.com/MinsangKwak/pogo-rank" target="_blank" rel="noopener">GitHub</a>
      </p>
    </footer>
  );
}

/** ☰ 를 누르면 열리는 서랍 — 좁은 화면에서 왼쪽 메뉴 대신 쓴다 */
export function Drawer({ open, onClose, now }: { open: boolean; onClose: () => void; now: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer" id="drawer-backdrop" onClick={onClose}>
      <aside className="drawer__panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer__head">
          <b>메뉴</b>
          <button className="icon-btn" id="drawer-close" aria-label="닫기" onClick={onClose}>✕</button>
        </div>
        <nav className="nav-menu" aria-label="서비스 이동">
          <a href="#/" className="drawer__item" onClick={onClose}>
            <span className="drawer__ico" aria-hidden="true">🏠</span>
            <span className="drawer__label">서비스 홈</span>
          </a>
          {ROUTE_GROUPS.map(([id, label]) => (
            <div key={id} style={{ display: 'contents' }}>
              <h3 className="nav-menu__sec">{label}</h3>
              {ROUTE_NAV.filter((route) => route.group === id).map((route) => (
                <div key={route.id} style={{ display: 'contents' }} onClick={onClose}>
                  <NavItem route={route} now={now} />
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}

/** 맨 위로 — 좀 내려가면 나타난다 */
export function ToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button id="totop" className="icon-btn totop" hidden={!show} aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
  );
}
