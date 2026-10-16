// ─────────────────────────────────────────────────────────────────────────────
// components/AdminShell.tsx — 관리자 캠프 뼈대 (v6 피그마 '06 · ADMIN' — 머리줄 · 왼쪽 메뉴 · 본문)
//
// 일반 셸과 다르다: 검색 · 언어 · 지역 · 하단 바가 없고, 메뉴는 네 줄뿐이다 (운영 대시보드 · 상세 통계 · 가입 승인 · 유저 · 트레이너 코드).
// 루트는 넷 다, 위임 관리자는 유저 관리 · 트레이너 코드 둘만 본다 — 눌러도 안 되는 줄은 아예 안 그린다 (AdminPanel 머리말과 같은 판단).
// 화면 머리(영문 이름표 · 제목 · 설명)는 여기서 그린다 — 일반 PageHead 는 안 선다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { go } from '../lib/nav';
import { ROUTE_EYEBROW, routeHref, type RouteDef, type RouteId } from '../routes';
import { useAuthStore } from '../stores/auth';
import { usePrefStore, themeIsDark } from '../stores/pref';
import { useMetaSoft } from '../lib/data';
import { track } from '../lib/track';
import { PixelIcon, type PixelIconName } from './PixelIcon';

const NAV: { id: RouteId; label: string; icon: PixelIconName; root: boolean }[] = [
  { id: 'admin', label: '운영 대시보드', icon: 'chart', root: true },
  { id: 'admin-stats', label: '상세 통계', icon: 'chart', root: true },
  { id: 'admin-users', label: '가입 승인 · 유저', icon: 'team', root: false },
  { id: 'admin-trainers', label: '트레이너 코드', icon: 'box', root: false },
];

/** 관리자 화면의 머리 — 제목 · 설명은 화면이 넘긴다 (화면마다 글이 다르다) */
export function AdminHead({ route, title, desc, actions }: { route: RouteDef; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="admin__head" id="page-head" data-route={route.id}>
      <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">{ROUTE_EYEBROW[route.id as RouteId] ?? 'CAMP OFFICE'}</p>
      <h2 className="px-title">{title}</h2>
      {desc ? <p className="px-body px-muted admin__desc">{desc}</p> : null}
      {actions ? <div className="admin__head-actions">{actions}</div> : null}
    </header>
  );
}

export default function AdminShell({ now, children }: { now: string; children: ReactNode }) {
  const { adminRoot } = useAuthStore();
  const theme = usePrefStore((s) => s.theme);
  const toggleTheme = usePrefStore((s) => s.toggleTheme);
  const meta = useMetaSoft();
  // 좁은 화면의 메뉴는 머리줄 단추로 연다
  const [open, setOpen] = useState(false);
  const items = NAV.filter((one) => adminRoot || !one.root);
  const link = (one: (typeof NAV)[number]) => (
    <a key={one.id} className="px-nav__item" href={routeHref(one.id)} {...(one.id === now || (one.id === 'admin-users' && now === 'admin-user') ? { 'aria-current': 'page' as const } : {})}
      onClick={() => setOpen(false)}>
      <PixelIcon name={one.icon} /><span className="px-nav__label">{one.label}</span>
    </a>
  );
  return (
    <div className="admin-shell" data-open={open || undefined}>
      <header className="admin-shell__bar app-bar">
        <h1 id="app-title" tabIndex={-1} className="admin-shell__logo">
          <button type="button" id="app-logo" className="app-bar__logo app-bar__logo--brand" aria-label="moncamp 홈" onClick={() => { go('/'); }}><span>MONCAMP</span></button>
          <span className="admin-shell__sub">관리자 캠프</span>
        </h1>
        <div className="app-bar__actions">
          <a className="px-btn px-skin" href="/">서비스 보기</a>
          <button type="button" className="px-btn px-skin icon-btn" id="theme-toggle" aria-label="화면 테마 바꾸기"
            onClick={() => { toggleTheme(); track('theme_switch', { to: themeIsDark(theme) ? 'light' : 'dark' }); }}>테마</button>
          <button type="button" className="px-btn px-btn--icon px-skin icon-btn admin-shell__menu" id="menu-toggle" aria-label="관리자 메뉴" aria-expanded={open}
            onClick={() => setOpen((v) => !v)}><PixelIcon name={open ? 'close' : 'menu'} /></button>
        </div>
      </header>
      <aside className="admin-shell__rail app-nav" id="app-nav">
        <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">CAMP OFFICE</p>
        <p className="px-caption admin-shell__role">{adminRoot ? '루트 관리자' : '위임 관리자'}</p>
        <hr className="px-divider" />
        <nav className="nav-menu" aria-label="관리자 메뉴">{items.map(link)}</nav>
        <hr className="px-divider" />
        <p className="px-sub">관리자 안내</p>
        <p className="px-caption">{adminRoot ? '가입 승인·권한 관리와 운영 통계는 루트 전용이에요.' : '승인된 이용자 목록 조회와 트레이너 코드 관리를 할 수 있어요.'}</p>
        <a className="px-btn px-btn--block px-skin" href="/">서비스로 돌아가기</a>
        {meta?.APP_VERSION ? <p className="px-caption px-mono" data-i18n="off">{meta.APP_VERSION}</p> : null}
      </aside>
      <main className="admin-shell__main" id="page">{children}</main>
    </div>
  );
}
