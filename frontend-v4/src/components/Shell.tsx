// ─────────────────────────────────────────────────────────────────────────────
// components/Shell.tsx — 머리줄 · 왼쪽 메뉴 · 화면 머리 · 바닥
//
// **클래스명과 DOM id 를 v3 와 똑같이 쓴다.** 그것이 디자인을 그대로 유지하는 방법이고,
// 회귀 34 스위트가 붙잡고 있는 계약이다 (`.app-bar` · `#app-nav` · `#page-head` · `#menu-planner` …).
// CSS 는 frontend/styles 의 것을 한 줄도 안 고치고 그대로 쓴다 (src/styles.ts).
//
// 도트 아이콘도 v3 표를 그대로 쓴다 (components/PxIcon.tsx) — 이모지로 두면
// 기기마다 다른 매끈한 그림이 도트 스프라이트 옆에 서서 결이 어긋난다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { ROUTE_GROUPS, ROUTE_NAV, routeById, routeDesc, type RouteDef } from '../routes';
import { usePrefStore, themeIsDark, THEME_WORD, type Theme } from '../stores/pref';
import { releaseSeen } from '../lib/release';
import { setLang, useLang } from '../lib/useLang';
import { useGameday, useMeta } from '../lib/data';
import { track } from '../lib/track';
import { PxIcon } from './PxIcon';
import { routeNote } from '../lib/notes';
import Account from './Account';
import Trainers from './Trainers';

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
      <span className="drawer__ico" aria-hidden="true"><PxIcon emoji={route.icon ?? ''} /></span>
      <span className="drawer__label">{route.nav}</span>
    </a>
  );
}

// [상태, 버튼 아이콘, 버튼이 말하는 것] — v3 components/theme.js THEME_FACE 그대로.
// 아이콘은 **지금 상태**를 가리킨다. 세 상태를 도는 버튼이라 '다음에 무엇이 되는지' 를 한 글자로 못 적는다
const THEME_FACE: Record<Theme, [string, string]> = {
  system: ['🌗', '화면 테마: 기기 설정 따름'],
  light: ['☀️', '화면 테마: 밝게 — 누르면 어둡게'],
  dark: ['🌙', '화면 테마: 어둡게 — 누르면 밝게'],
};

export function AppBar({ onMenu, home }: { onMenu: () => void; home: boolean }) {
  const theme = usePrefStore((s) => s.theme);
  const toggleTheme = usePrefStore((s) => s.toggleTheme);
  const [icon, label] = THEME_FACE[theme];
  const newRelease = useNewRelease();
  const now = useLang();
  return (
    <header className="app-bar">
      <div className="app-bar__head">
        {/* 2026-09-17 홈에는 뒤로가기가 없다 — v3 app-shell.js 의 `backButton.hidden = home`.
            여기가 처음이라 돌아갈 앞 화면이 없고, 있는 버튼은 "누를 수 있다" 는 약속이다 (제보) */}
        <button className="icon-btn" aria-label="이전 화면" hidden={home}
          onClick={() => { if (history.length > 1) history.back(); else location.hash = '#/'; }}>
          <PxIcon emoji="←" />
        </button>
        <h1 id="app-title" tabIndex={-1}>
          <button type="button" id="app-logo" className="app-bar__logo"
            onClick={() => { location.hash = '#/'; }}>moncamp</button>
          {/* 주소가 같아 화면만 보고는 v3 인지 v4 인지 알 수가 없다 — 눈으로 가르는 표식 (root.css) */}
          <span className="v4-mark" id="v4-mark" title="React 로 만든 판입니다" aria-hidden="true">
            <PxIcon emoji="⚛" /><PxIcon emoji="◓" />
          </span>
        </h1>
      </div>
      <button className="app-search" id="app-search" aria-label="포켓몬 검색"
        onClick={() => { location.hash = '#/dex'; }}>
        <span className="app-search__ico" aria-hidden="true">🔍</span>
        <span className="app-search__ph">포켓몬을 검색하세요</span>
        <kbd className="app-search__key" aria-hidden="true">/</kbd>
      </button>
      <div className="app-bar__actions">
        <button className="icon-btn" id="search-toggle" aria-label="포켓몬 검색 — 도감으로"
          onClick={() => { location.hash = '#/dex'; }}><PxIcon emoji="🔍" /></button>
        <button
          className="icon-btn"
          id="theme-toggle"
          aria-label={label}
          aria-live="polite"
          data-icon={icon}
          title={label}
          onClick={() => { toggleTheme(); track('theme_switch', { to: themeIsDark(theme) ? 'light' : 'dark' }); }}
        >
          <PxIcon emoji={icon} />
        </button>
        {/* 버튼 글자는 "지금 누르면 갈 언어" 다 (한국어면 EN, 영어면 KR) — 상태가 아니라 행동 표시다.
            이 글자는 사전을 타지 않는다(data-i18n="off") — 맡기면 뜻이 뒤집힌다 */}
        <button className="icon-btn lang-toggle" id="lang-toggle" aria-live="polite" data-i18n="off"
          aria-label={now === 'en' ? 'View in Korean (한국어로 보기)' : 'View in English (영어로 보기)'}
          onClick={() => { const next = now === 'en' ? 'ko' : 'en'; void setLang(next); track('lang_switch', { lang: next }); }}>
          {now === 'en' ? 'KR' : 'EN'}
        </button>
        <button className={`icon-btn${newRelease ? ' dot-badge' : ''}`} id="menu-toggle" aria-label="메뉴" aria-haspopup="dialog"
          aria-expanded={false} aria-controls="drawer-backdrop" onClick={onMenu}><PxIcon emoji="☰" /></button>
      </div>
    </header>
  );
}

export function AppNav({ now, onConsent }: { now: string; onConsent: () => void }) {
  return (
    <aside className="app-nav" id="app-nav">
      <nav className="nav-menu" aria-label="서비스 이동">
        <a href="#/" className="drawer__item" {...(now === 'home' ? { 'aria-current': 'page' as const } : {})}>
          <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🏠" /></span>
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
        <NavExtra onConsent={onConsent} />
      </div>
    </aside>
  );
}

/**
 * 메뉴 아래쪽의 곁줄 — 자주 안 가지만 있어야 하는 것들 (v3 index.html #drawer-extra).
 * 이 줄이 통째로 없으면 넓은 화면에서 왼쪽 메뉴가 절반 높이로 끝나 화면이 비어 보인다.
 */
function NavExtra({ onConsent }: { onConsent: () => void }) {
  const { data: meta } = useMeta();
  const { data: gameday } = useGameday();
  const newRelease = useNewRelease();
  const go = (hash: string) => () => { location.hash = hash; };
  const date = gameday.MOVE_CHANGES?.date;
  const changes = date ? `${Number(date.split('-')[1])}/${Number(date.split('-')[2])}` : '';
  return (
    <div id="drawer-extra">
      {/* 시즌 기술 변경 — 변경 데이터가 있을 때만 줄을 만든다 (없는 것을 설명하지 않는다) */}
      {changes ? (
        // 이 줄만 아이콘·라벨 칸 없이 글자 한 줄이다 (v3 initMoveChangesMenu 가 textContent 를 통째로 갈아 끼운다)
        <button className="drawer__item" id="menu-changes" onClick={go('#/changes')}>
          ⚔️ {changes} 기술 변경
        </button>
      ) : null}
      <button className={`drawer__item${newRelease ? ' dot-badge' : ''}`} id="menu-release" onClick={go('#/release')}>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🎉" /></span>
        <span className="drawer__label">패치노트</span>
      </button>
      {/* ⚠️ 이 주소는 **사용자 버그 제보용 트래커**다 — 내부 WBS 주소로 바꾸지 말 것 (쓰는 사람이 다르다) */}
      <a className="drawer__item" href="https://www.notion.so/a0472984122d4f25b9b445b57465568f"
        target="_blank" rel="noopener">
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🛠" /></span>
        <span className="drawer__label">QA·버그 제보 (노션)</span>
      </a>
      <button className="drawer__item" onClick={go('#/privacy')}>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🔒" /></span>
        <span className="drawer__label">개인정보처리방침</span>
      </button>
      <button className="drawer__item" onClick={go('#/terms')}>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="📜" /></span>
        <span className="drawer__label">이용약관</span>
      </button>
      <ThemeItem />
      <button className="drawer__item" id="menu-settings" onClick={go('#/settings')}>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🛠" /></span>
        <span className="drawer__label">설정</span>
      </button>
      {/* 개인정보처리방침이 '☰ 메뉴 → 통계·저장소 설정' 이라고 적어 뒀다 — 이 줄이 없으면 방침이 거짓말이 된다 */}
      <button className="drawer__item" id="menu-consent" onClick={onConsent}>
        <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🍪" /></span>
        <span className="drawer__label">통계·저장소 설정</span>
      </button>
      <p className="drawer__meta">
        PvPoke · PokeMiners 데이터<br />{`기준일 ${meta.DATA_TIMESTAMP} · 매일 00시 자동 갱신`}
      </p>
    </div>
  );
}

/** 좁은 화면에는 머리줄에 테마 버튼 자리가 없다 — 이 줄이 그 일을 한다 (v3 #menu-theme) */
function ThemeItem() {
  const theme = usePrefStore((s) => s.theme);
  const toggleTheme = usePrefStore((s) => s.toggleTheme);
  const [icon, label] = THEME_FACE[theme];
  return (
    <button className="drawer__item" id="menu-theme" onClick={toggleTheme} aria-label={label}>
      <span className="drawer__ico" aria-hidden="true"><PxIcon emoji={icon} /></span>
      <span className="drawer__label">화면 테마</span>
      <span className="drawer__value" id="menu-theme-value">{THEME_WORD[theme]}</span>
    </button>
  );
}

/**
 * 새 패치노트가 있는가. 판 번호는 제 묶음(release.json)에 있어 셸이 그걸 기다릴 수는 없다 —
 * 매니페스트의 해시를 열쇠로 쓰지 않고, 화면이 열릴 때 기록한 값과 견준다.
 * 패치노트를 열면 markReleaseSeen 이 알려 주므로 그때 다시 센다.
 */
function useNewRelease(): boolean {
  const { data: meta } = useMeta();
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const onSeen = () => setSeen((n) => n + 1);
    window.addEventListener('moncamp:release-seen', onSeen);
    return () => window.removeEventListener('moncamp:release-seen', onSeen);
  }, []);
  void seen;   // 알림을 받으면 다시 세기만 하면 된다
  return !!meta.RELEASE_VER && !releaseSeen(meta.RELEASE_VER);
}

/** 화면 머리 — 브레드크럼 · 제목 · 한 줄 설명 · 오른쪽 동작.
    오른쪽 칸은 비워 두고 자리만 넘긴다 — 화면이 포털로 채운다 (components/Slots.tsx) */
export function PageHead({ route, actionsRef }: { route: RouteDef; actionsRef: (node: HTMLDivElement | null) => void }) {
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
      <div className="page-head__actions" id="page-head-actions" ref={actionsRef} />
    </header>
  );
}

export function Footer({ onConsent }: { onConsent: () => void }) {
  const { data: meta } = useMeta();
  return (
    <footer>
      <p className="foot-lead">포켓몬고 응애 친구들을 위해 만들어진 서비스예요.</p>
      <p id="ip-notice">moncamp는 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc. 에, Pokémon GO 는 Scopely Explore, Inc. 에 있으며 이 서비스는 권리자와 무관합니다.</p>
      <p>데이터는 PvPoke · PokeMiners · PokeAPI · LeekDuck 의 공개 자료를 사용합니다. 코드는 열람용으로 공개돼 있으며 포크·재배포는 안 됩니다. 데이터·이미지는 각 출처의 조건을 따릅니다 (저장소 LICENSE · NOTICE).</p>
      <p className="foot-links">
        {/* 문의 이메일은 빌드가 넣은 값이다 — 저장소에 적어 두지 않는다 (v3 index.html __CONTACT__) */}
        {meta.CONTACT_EMAIL ? <>문의·건의: <a href={`mailto:${meta.CONTACT_EMAIL}`}>{meta.CONTACT_EMAIL}</a> · </> : null}
        <a href="#/privacy">개인정보처리방침</a> · <a href="#/terms">이용약관</a> ·{' '}
        <button type="button" id="foot-consent" onClick={onConsent}>통계·저장소 설정</button> ·{' '}
        <a href="https://github.com/MinsangKwak/pogo-rank" target="_blank" rel="noopener">GitHub</a>
      </p>
    </footer>
  );
}

/** ☰ 를 누르면 열리는 서랍 — 좁은 화면에서 왼쪽 메뉴 대신 쓴다 */
export function Drawer({ open, onClose, now, onConsent }: { open: boolean; onClose: () => void; now: string; onConsent: () => void }) {
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
          <button className="icon-btn" id="drawer-close" aria-label="닫기" onClick={onClose}><PxIcon emoji="✕" /></button>
        </div>
        {/* 로그인 상태는 ☰ 메뉴 맨 위 한 곳에서만 보인다 (v3 v2.29.0 에 헤더 👤 를 없애며 정한 자리) */}
        <Account onGo={onClose} />
        {/* 서랍은 세 덩이로 읽힌다 — 👤 마이페이지 · 서비스(갈 곳) · 정보(그 밖).
            제목은 좁은 화면에만 단다: 넓은 화면의 왼쪽 메뉴는 갈 곳만 있는 자리라 또 적을 이유가 없다 */}
        <h2 className="drawer__sec">서비스</h2>
        <nav className="nav-menu" aria-label="서비스 이동">
          <a href="#/" className="drawer__item" onClick={onClose}>
            <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="🏠" /></span>
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
        {/* 정보 덩이는 **카드 한 장으로** 묶는다 — 아코디언과 바깥 링크가 따로 놀면 항목마다 테두리가
            따로 생겨 '목록' 이 아니라 '버튼 무더기' 로 읽힌다 (v3 infoGroup). 버전 줄은 카드 밖이다 */}
        <h2 className="drawer__sec">정보</h2>
        <div className="drawer__group">
          {/* 기준 안내는 본문이 아니라 여기 산다 — 늘 보이면 목록보다 긴 글이 화면을 밀어낸다 (v3 #note-acc) */}
          <details className="schedule" id="note-acc">
            <summary>
              <span className="drawer__ico" aria-hidden="true"><PxIcon emoji="ℹ️" /></span>
              <span className="drawer__label">기준 안내 (지금 보는 화면)</span>
            </summary>
            <p className="note" id="note">{routeNote(now)}</p>
          </details>
          <Trainers />
          {/* **좁은 화면에서는 여기가 유일한 메뉴다.** 이 줄들이 없으면 휴대폰에서
              설정 · 약관 · 개인정보 · 패치노트 · 통계 설정으로 갈 길이 통째로 사라진다 */}
          <NavExtra onConsent={onConsent} />
        </div>
        <Version />
      </aside>
    </div>
  );
}

/** 서랍 맨 아래 한 줄 (v3 versionMeta). 판 번호는 빌드가 실어 준 값만 쓴다 — 손으로 적지 않는다 */
function Version() {
  const { data: meta } = useMeta();
  return <p className="drawer__meta">{`moncamp · ${meta.APP_VERSION}`}</p>;
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
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><PxIcon emoji="↑" /></button>
  );
}
