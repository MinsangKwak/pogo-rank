// ─────────────────────────────────────────────────────────────────────────────
// components/Shell.tsx — v6 뼈대: 머리줄 · 왼쪽 메뉴 레일 · 화면 머리 · 바닥글 · 모바일 하단 바로가기 · 전체 메뉴 시트
//
// 피그마 '01 · 서비스 홈' 의 틀을 따른다 — 머리줄(로고 · 검색 · 언어 · 지역 · 테마), 224px 레일(계정 · 설정,
// 네 갈래 "지금 뭐 하지 / 뭘 데려갈까 / 뭘 키울까 / 정보", 하위 줄은 ↳), 1100px 아래는 레일 대신 하단 네 칸(홈 · 검색 · 내 포켓몬 · 전체 메뉴).
// DOM id 는 그대로다 (`#app-nav` · `#page-head` · `#menu-toggle` · `#drawer-backdrop` · `#menu-planner` …) — 회귀 검사와 지표가 본다 (CLAUDE.md §4).
// 메뉴 순서는 routes.ts 의 표 하나에서 온다 — 여기서 손으로 줄을 적지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import { go, goBack } from '../lib/nav';
import { openSearch } from '../stores/search';

import { useEffect, useState, type ReactNode } from 'react';
import { ROUTE_GROUPS, ROUTE_NAV, ROUTE_EYEBROW, routeById, routeDesc, routeHref, type RouteDef, type RouteId } from '../routes';
import { usePrefStore, themeIsDark, THEME_WORD, type Theme } from '../stores/pref';
import { useAuthStore } from '../stores/auth';
import { useInviteStore } from '../stores/invite';
import { releaseSeen } from '../lib/release';
import { setLang, useLang } from '../lib/useLang';
import { setRegion, useRegion } from '../lib/region';
import { useMetaSoft } from '../lib/data';
import { track } from '../lib/track';
import { routeNote } from '../lib/notes';
import { useLockReason, lockedAttrs } from '../lib/useLocked';
import { PixelIcon, EMOJI_TO_PIXEL, type PixelIconName } from './PixelIcon';
import Account from './Account';
import Trainers from './Trainers';

// 라우트 표의 이모지 → 픽셀 아이콘. 표에 없는 글자는 안내 아이콘으로 둔다 — 빈 칸보다 '아이콘 자리' 가 보이는 편이 낫다
function iconOf(emoji: string | undefined): PixelIconName {
  return (emoji && EMOJI_TO_PIXEL[emoji]) || 'info';
}

/** 메뉴 한 줄 — 레일과 시트가 같은 조각을 쓴다. 하위 줄(parent 가 있는 줄)은 ↳ 로 들여 쓴다 */
export function NavItem({ route, now, onGo }: { route: RouteDef; now: string; onGo?: () => void }) {
  // 잠긴 줄은 흐려지고 제목에 이유가 붙는다. 로그인 잠금은 눌린다 — 로그인 안내가 있는 카드로 간다 (useLocked 머리말)
  const reason = useLockReason(route.id);
  const lock = lockedAttrs(reason);
  const child = !!route.parent;
  return (
    <a
      {...(lock.inert ? {} : { href: `/${route.path}` })}
      className={`px-nav__item${child ? ' px-nav__item--child' : ''}${lock.className}`}
      data-route={route.id}
      data-parent={route.parent}
      {...(route.id === 'changes' ? { id: 'menu-changes' } : {})}
      {...(route.id === 'planner' ? { id: 'menu-planner' } : {})}
      {...(route.id === now ? { 'aria-current': 'page' as const } : {})}
      {...(lock['aria-disabled'] ? { 'aria-disabled': lock['aria-disabled'] } : {})}
      title={reason ? lock.title : routeDesc(route.id)}
      onClick={onGo}
    >
      {child ? null : <PixelIcon name={iconOf(route.icon)} />}
      <span className="px-nav__label">{route.nav}</span>
    </a>
  );
}

/** 갈래 하나 — 제목 줄 + 그 갈래의 줄들(자식은 부모 바로 뒤, ROUTE_NAV 의 순서) */
function NavGroup({ id, label, now, onGo }: { id: string; label: string; now: string; onGo?: () => void }) {
  return (
    <>
      <h3 className="px-nav__group nav-menu__sec">{label}</h3>
      {ROUTE_NAV.filter((route) => route.group === id).map((route) => <NavItem key={route.id} route={route} now={now} onGo={onGo} />)}
    </>
  );
}

/** '정보' 갈래 — 라우트 표의 갈래가 아니라 셸의 줄이다 (기준 안내 · 패치 노트 · 제보 · 방침 · 약관 · 통계 설정) */
function NavInfo({ now, onGo, onConsent, onNote }: { now: string; onGo?: () => void; onConsent: () => void; onNote: () => void }) {
  const newRelease = useNewRelease();
  const goTo = (href: string) => () => { onGo?.(); go(href); };
  const current = (id: string) => (id === now ? { 'aria-current': 'page' as const } : {});
  return (
    <>
      <h3 className="px-nav__group nav-menu__sec">정보</h3>
      <button type="button" className="px-nav__item" id="menu-note" onClick={() => { onGo?.(); onNote(); }}>
        <PixelIcon name="info" /><span className="px-nav__label">기준 안내 (지금 보는 화면)</span>
      </button>
      <button type="button" className={`px-nav__item${newRelease ? ' dot-badge' : ''}`} id="menu-release" onClick={goTo('/release')} {...current('release')}>
        <PixelIcon name="file" /><span className="px-nav__label">패치 노트</span>
      </button>
      {/* ⚠️ 이 주소는 **사용자 버그 제보용 트래커**다 — 내부 WBS 주소로 바꾸지 말 것 (쓰는 사람이 다르다) */}
      <a className="px-nav__item" href="https://www.notion.so/a0472984122d4f25b9b445b57465568f" target="_blank" rel="noopener" onClick={onGo}>
        <PixelIcon name="info" /><span className="px-nav__label">QA · 버그 제보 ↗</span>
      </a>
      <button type="button" className="px-nav__item" onClick={goTo('/privacy')} {...current('privacy')}>
        <PixelIcon name="shield" /><span className="px-nav__label">개인정보 처리방침</span>
      </button>
      <button type="button" className="px-nav__item" onClick={goTo('/terms')} {...current('terms')}>
        <PixelIcon name="shield" /><span className="px-nav__label">이용 약관</span>
      </button>
      {/* 개인정보처리방침이 '메뉴 → 통계·저장소 설정' 이라고 적어 뒀다 — 이 줄이 없으면 방침이 거짓말이 된다 */}
      <button type="button" className="px-nav__item" id="menu-consent" onClick={() => { onGo?.(); onConsent(); }}>
        <PixelIcon name="gear" /><span className="px-nav__label">통계 · 저장소 설정</span>
      </button>
    </>
  );
}

/** 계정과 가까운 설정 진입 — 레일과 전체 메뉴에서 각각 한 번만 둔다. */
function SettingsItem({ now, onGo }: { now: string; onGo?: () => void }) {
  const language = useLang();
  return (
    <button type="button" className="px-nav__item" id="menu-settings" data-i18n="off"
      {...(now === 'settings' ? { 'aria-current': 'page' as const } : {})}
      onClick={() => { onGo?.(); go('/settings'); }}>
      <PixelIcon name="gear" /><span className="px-nav__label">{language === 'en' ? 'Settings' : '설정'}</span>
    </button>
  );
}

// [상태, 아이콘, 버튼이 말하는 것]. 아이콘은 **지금 상태**를 가리킨다
const THEME_FACE: Record<Theme, [PixelIconName, string]> = {
  system: ['moon', '화면 테마: 기기 설정 따름'],
  light: ['sun', '화면 테마: 밝게 — 누르면 어둡게'],
  dark: ['moon', '화면 테마: 어둡게 — 누르면 밝게'],
};

/** 머리줄 — 검색과 빠른 표시 설정. 계정·서비스 이동은 왼쪽 레일이 맡는다. */
export function AppBar({ onMenu, onBack }: { onMenu: () => void; home?: boolean; onBack?: () => void }) {
  const theme = usePrefStore((s) => s.theme);
  const toggleTheme = usePrefStore((s) => s.toggleTheme);
  const [icon, label] = THEME_FACE[theme];
  const newRelease = useNewRelease();
  const now = useLang();
  const region = useRegion();
  return (
    <header className="app-bar">
      <div className="app-bar__head">
        {/* 홈에는 뒤로가기가 없다 — 돌아갈 앞 화면이 없고, 있는 버튼은 "누를 수 있다" 는 약속이다 */}
        <button className="px-btn px-btn--icon px-skin icon-btn" aria-label="상세 닫기" hidden={!onBack}
          onClick={() => { if (onBack) { onBack(); return; } goBack(); }}>
          <PixelIcon name="back" />
        </button>
        {/* h1 은 늘 남긴다 — 없애면 화면에 제목이 없어지고 포커스가 돌아올 자리(#app-title)도 사라진다 */}
        <h1 id="app-title" tabIndex={-1}>
          <button type="button" id="app-logo" className="app-bar__logo app-bar__logo--brand" aria-label="moncamp 홈" onClick={() => { go('/'); }}>
            <span>MONCAMP</span>
          </button>
        </h1>
      </div>
      {/* 검색칸은 팔레트를 연다 (components/SearchPalette.tsx) */}
      <button className="app-search px-skin" id="app-search" aria-label="포켓몬 검색" onClick={() => { openSearch('bar'); }}>
        <PixelIcon name="search" />
        <span className="app-search__ph">포켓몬 이름, 번호로 빠르게 검색</span>
        <kbd className="app-search__key" aria-hidden="true">/</kbd>
      </button>
      <div className="app-bar__actions">
        <button className="px-btn px-btn--icon px-skin icon-btn" id="search-toggle" aria-label="포켓몬 검색" onClick={() => { openSearch('bar'); }}><PixelIcon name="search" /></button>
        {/* 버튼 글자는 "지금 누르면 갈 언어" 다 — 행동 표시. 이 글자는 사전을 타지 않는다 */}
        <button className="px-btn px-skin icon-btn lang-toggle" id="lang-toggle" aria-live="polite" data-i18n="off"
          aria-label={now === 'en' ? 'View in Korean (한국어로 보기)' : 'View in English (영어로 보기)'}
          onClick={() => { const next = now === 'en' ? 'ko' : 'en'; void setLang(next); track('lang_switch', { lang: next }); }}>
          {now === 'en' ? 'KR' : 'EN'}
        </button>
        {/* 지역은 언어와 따로 돈다 — **지금 지역**을 적는다 */}
        <button className="px-btn px-skin icon-btn region-toggle" id="region-toggle" aria-live="polite" data-i18n="off"
          aria-label={region === 'eu' ? '일정 기준 지역: 유럽 (누르면 한국 기준) · Schedule region: Europe' : '일정 기준 지역: 한국 (누르면 유럽 기준) · Schedule region: Korea'}
          onClick={() => { const next = region === 'eu' ? 'kr' : 'eu'; setRegion(next); track('region_switch', { region: next }); }}>
          <PixelIcon name="globe" />
          <span className="region-toggle__code">{region === 'eu' ? 'EU' : 'KR'}</span>
        </button>
        <button className="px-btn px-btn--icon px-skin icon-btn" id="theme-toggle" aria-label={label} aria-live="polite" data-icon={icon} title={label}
          onClick={() => { toggleTheme(); track('theme_switch', { to: themeIsDark(theme) ? 'light' : 'dark' }); }}>
          <PixelIcon name={icon} />
        </button>
        <button className={`px-btn px-btn--icon px-skin icon-btn${newRelease ? ' dot-badge' : ''}`} id="menu-toggle" aria-label="전체 메뉴" aria-haspopup="dialog"
          aria-expanded={false} aria-controls="drawer-backdrop" onClick={onMenu}><PixelIcon name="menu" /></button>
      </div>
    </header>
  );
}

/** 왼쪽 메뉴 레일 (1100px 이상). 계정과 설정을 먼저 찾고 그 아래에서 서비스로 이동한다. */
export function AppNav({ now, onConsent, onMenu, onNote }: { now: string; onConsent: () => void; onMenu: () => void; onNote: () => void }) {
  const { enabled, user, status } = useAuthStore();
  return (
    <aside className="app-nav" id="app-nav">
      <nav className="nav-menu" aria-label="서비스 이동">
        <div className="px-nav__utilities">
          {enabled ? <button type="button" className="px-btn px-btn--block px-skin px-nav__mypage" id="nav-mypage" aria-haspopup="dialog" aria-controls="drawer-backdrop" onClick={onMenu}>
            <PixelIcon name="user" />{user || status === 'loading' ? '마이페이지' : '로그인'}
          </button> : null}
          <SettingsItem now={now} />
        </div>
        <a href="/" className="px-nav__item" {...(now === 'home' ? { 'aria-current': 'page' as const } : {})}>
          <PixelIcon name="home" /><span className="px-nav__label">서비스 홈</span>
        </a>
        {ROUTE_GROUPS.map(([id, label]) => <NavGroup key={id} id={id} label={label} now={now} />)}
        <NavInfo now={now} onConsent={onConsent} onNote={onNote} />
      </nav>
    </aside>
  );
}

/**
 * 새 패치노트가 있는가. 판 번호는 제 묶음(release.json)에 있어 셸이 그걸 기다릴 수는 없다 —
 * 화면이 열릴 때 기록한 값과 견준다. 패치노트를 열면 markReleaseSeen 이 알려 주므로 그때 다시 센다
 */
function useNewRelease(): boolean {
  const meta = useMetaSoft();
  const [seen, setSeen] = useState(0);
  useEffect(() => {
    const onSeen = () => setSeen((n) => n + 1);
    window.addEventListener('moncamp:release-seen', onSeen);
    return () => window.removeEventListener('moncamp:release-seen', onSeen);
  }, []);
  void seen;
  return !!meta?.RELEASE_VER && !releaseSeen(meta.RELEASE_VER);
}

/** 화면 머리 — 영문 이름표 · 제목 · 한 줄 설명 · 오른쪽 동작(포털 자리, components/Slots.tsx) */
export function PageHead({ route, actionsRef }: { route: RouteDef; actionsRef: (node: HTMLDivElement | null) => void }) {
  const parent = route.parent ? routeById(route.parent) : undefined;
  const name = route.title ?? route.nav ?? route.id;
  const eyebrow = ROUTE_EYEBROW[route.id as RouteId] ?? (parent ? `${parent.nav ?? parent.id} / ${name}` : name);
  return (
    <header className="page-head" id="page-head" data-route={route.id}>
      <nav className="page-head__crumb" aria-label="위치">
        <a className="page-head__crumb-home" href="/">홈</a>
        <span className="page-head__crumb-sep" aria-hidden="true">›</span>
        <a className="page-head__crumb-up" href={parent ? `/${parent.path}` : '/'} hidden={!parent}>{parent ? (parent.title ?? parent.nav) : ''}</a>
        <span className="page-head__crumb-sep" aria-hidden="true" hidden={!parent}>›</span>
        <span className="page-head__crumb-now" data-i18n="off">{eyebrow}</span>
      </nav>
      <h2>{name}</h2>
      <p className="page-head__desc">{routeDesc(route.id)}</p>
      {/* 단추는 화면이 데이터를 받은 뒤 포털로 들어온다. 단추가 서는 화면은 자리를 먼저 비워 둔다 (CLS) */}
      <div className="page-head__actions" id="page-head-actions" ref={actionsRef} data-reserve={route.actions ? '' : undefined} />
    </header>
  );
}

export function Footer({ onConsent }: { onConsent: () => void }) {
  const meta = useMetaSoft();
  return (
    <footer>
      <p className="foot-lead" data-i18n="off">MONCAMP / POGO-RANK · 데이터와 함께, 더 즐거운 모험.</p>
      <p>순위와 수치는 비교를 돕는 참고 정보입니다. 실제 성과는 상대·기술·레벨·전투 조건에 따라 달라집니다.</p>
      <p id="ip-notice">moncamp는 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc.에, Pokémon GO는 Scopely Explore, Inc.에 있으며 이 서비스는 권리자와 무관합니다.</p>
      <p>데이터는 PvPoke · PokeMiners · PokeAPI · LeekDuck의 공개 자료를 사용합니다. 코드는 열람용으로 공개하며 포크·재배포를 허용하지 않습니다. 데이터·이미지는 각 출처의 조건을 따릅니다 (저장소 LICENSE · NOTICE).</p>
      <p className="foot-links">
        {/* 문의 이메일은 빌드가 넣은 값이다 — 저장소에 적어 두지 않는다 */}
        {meta?.CONTACT_EMAIL ? <>문의·건의: <a href={`mailto:${meta.CONTACT_EMAIL}`}>{meta.CONTACT_EMAIL}</a> · </> : null}
        <a href="/privacy">개인정보처리방침</a> · <a href="/terms">이용약관</a> ·{' '}
        <button type="button" id="foot-consent" onClick={onConsent}>통계·저장소 설정</button> ·{' '}
        <a href="https://github.com/MinsangKwak/pogo-rank" target="_blank" rel="noopener">GitHub</a>
        {meta?.DATA_TIMESTAMP ? <> · {`기준일 ${meta.DATA_TIMESTAMP}`}</> : null}
      </p>
    </footer>
  );
}

/** 모바일 하단 바로가기 — 홈 · 검색 · 내 포켓몬 · 전체 메뉴 (피그마 'Mobile navigation shortcuts') */
export function BottomBar({ now, onMenu }: { now: string; onMenu: () => void }) {
  const planLock = useLockReason('planner');
  const openInvite = useInviteStore((s) => s.open);
  const item = (label: string, icon: PixelIconName, body: ReactNode, props: Record<string, unknown>) => (
    <button type="button" className="px-bottom__item" {...props}>{body}<PixelIcon name={icon} />{label}</button>
  );
  return (
    <nav className="px-bottom" aria-label="빠른 이동">
      <a className="px-bottom__item" href="/" {...(now === 'home' ? { 'aria-current': 'page' as const } : {})}><PixelIcon name="home" />홈</a>
      {item('검색', 'search', null, { onClick: () => openSearch('bottom') })}
      {/* 내 포켓몬은 승인제다 — 로그인 전이면 안내 팝업(D07)으로, 열리면 화면으로 */}
      {item('내 포켓몬', 'box', null, {
        ...(now === 'planner' ? { 'aria-current': 'page' } : {}),
        onClick: () => { if (planLock === 'login') { openInvite('bottom'); return; } go(routeHref('planner')); },
      })}
      {item('전체 메뉴', 'menu', null, { onClick: onMenu, 'aria-haspopup': 'dialog', 'aria-controls': 'drawer-backdrop' })}
    </nav>
  );
}

/** 전체 메뉴 시트 (D06) — 마이페이지 카드 · 기존 메뉴 순서 그대로 · 정보 · 출처 */
export function Drawer({ open, onClose, now, onConsent, onNote }: { open: boolean; onClose: () => void; now: string; onConsent: () => void; onNote: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer" id="drawer-backdrop" onClick={onClose}>
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="전체 메뉴" onClick={(event) => event.stopPropagation()}>
        <div className="drawer__head">
          <div><b>전체 메뉴</b><small>계정 · 화면 설정 · 서비스 이동</small></div>
          <button className="px-btn px-btn--icon px-skin icon-btn" id="drawer-close" aria-label="닫기" onClick={onClose}><PixelIcon name="close" /></button>
        </div>
        {/* 로그인 상태는 여기 한 곳에서만 보인다 */}
        <Account onGo={onClose} />
        <LocaleItems now={now} onGo={onClose} />
        <nav className="nav-menu" aria-label="서비스 이동">
          <a href="/" className="px-nav__item" onClick={onClose} {...(now === 'home' ? { 'aria-current': 'page' as const } : {})}>
            <PixelIcon name="home" /><span className="px-nav__label">서비스 홈</span>
          </a>
          {ROUTE_GROUPS.map(([id, label]) => <NavGroup key={id} id={id} label={label} now={now} onGo={onClose} />)}
          <NavInfo now={now} onGo={onClose} onConsent={onConsent} onNote={onNote} />
        </nav>
        <div className="drawer__group">
          {/* 기준 안내는 시트에서도 읽힌다 — 팝업(D11)과 같은 글 (lib/notes.ts) */}
          <details className="schedule" id="note-acc">
            <summary><PixelIcon name="info" /><span className="drawer__label">기준 안내 (지금 보는 화면)</span></summary>
            <p className="note" id="note">{routeNote(now)}</p>
          </details>
          <Trainers />
        </div>
        <Version />
      </aside>
    </div>
  );
}

// 모바일에서 머리줄을 숨겨도 계정 바로 아래에서 표시 설정과 전체 설정을 찾을 수 있다.
function LocaleItems({ now, onGo }: { now: string; onGo: () => void }) {
  const language = useLang();
  const region = useRegion();
  return (
    <div className="drawer__group drawer__locale" role="group" aria-label={language === 'en' ? 'Display settings' : '화면 설정'} data-i18n="off">
      <button type="button" className="px-nav__item" id="menu-language" aria-live="polite"
        aria-label={language === 'en' ? 'View in Korean (한국어로 보기)' : 'View in English (영어로 보기)'}
        onClick={() => { const next = language === 'en' ? 'ko' : 'en'; void setLang(next); track('lang_switch', { lang: next }); }}>
        <PixelIcon name="globe" />
        <span className="px-nav__label">{language === 'en' ? 'Language' : '언어'}</span>
        <span className="drawer__value">{language === 'en' ? 'English' : '한국어'}</span>
      </button>
      <button type="button" className="px-nav__item" id="menu-region" aria-live="polite"
        aria-label={region === 'eu' ? '일정 기준 지역: 유럽 (누르면 한국 기준) · Schedule region: Europe' : '일정 기준 지역: 한국 (누르면 유럽 기준) · Schedule region: Korea'}
        onClick={() => { const next = region === 'eu' ? 'kr' : 'eu'; setRegion(next); track('region_switch', { region: next }); }}>
        <PixelIcon name="globe" />
        <span className="px-nav__label">{language === 'en' ? 'Schedule region' : '일정 기준 지역'}</span>
        <span className="drawer__value">{region === 'eu' ? (language === 'en' ? 'EU · Europe' : 'EU · 유럽') : (language === 'en' ? 'KR · Korea' : 'KR · 한국')}</span>
      </button>
      <ThemeItem />
      <SettingsItem now={now} onGo={onGo} />
    </div>
  );
}

/** 좁은 화면에는 머리줄에 테마 버튼 자리가 없다 — 이 줄이 그 일을 한다 (v3 #menu-theme) */
function ThemeItem() {
  const language = useLang();
  const theme = usePrefStore((s) => s.theme);
  const toggleTheme = usePrefStore((s) => s.toggleTheme);
  const [icon, label] = THEME_FACE[theme];
  return (
    <button type="button" className="px-nav__item" id="menu-theme" aria-live="polite"
      onClick={() => { toggleTheme(); track('theme_switch', { to: themeIsDark(theme) ? 'light' : 'dark' }); }}
      aria-label={language === 'en' ? `Theme: ${theme === 'system' ? 'System setting' : theme === 'dark' ? 'Dark (switch to Light)' : 'Light (switch to Dark)'}` : label}>
      <PixelIcon name={icon} />
      <span className="px-nav__label">{language === 'en' ? 'Theme' : '화면 테마'}</span>
      <span className="drawer__value" id="menu-theme-value">{language === 'en' ? ({ system: 'System', light: 'Light', dark: 'Dark' } as const)[theme] : THEME_WORD[theme]}</span>
    </button>
  );
}

/** 시트 맨 아래 한 줄 — 판 번호 · 출처. 판 번호는 빌드가 실어 준 값만 쓴다 */
function Version() {
  const meta = useMetaSoft();
  return (
    <p className="drawer__meta">
      {meta?.APP_VERSION ? <><span data-i18n="off">{`MONCAMP · ${meta.APP_VERSION}`}</span><br /></> : null}
      비공식 팬 프로젝트 · PvPoke · PokeMiners 데이터
      {meta?.DATA_TIMESTAMP ? <><br />{`기준일 ${meta.DATA_TIMESTAMP} · 매일 00시 자동 갱신`}</> : null}
    </p>
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
    <button id="totop" className="px-btn px-btn--icon px-skin icon-btn totop" hidden={!show} aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><PixelIcon name="up" /></button>
  );
}
