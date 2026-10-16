// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppBar, AppNav, BottomBar, Drawer } from '../components/Shell';
import { useAuthStore } from '../stores/auth';
import { usePrefStore } from '../stores/pref';
import { setLang } from '../lib/i18n';
import { setRegion } from '../lib/region';
import { go } from '../lib/nav';
import { openSearch } from '../stores/search';
import { ROUTE_NAV } from '../routes';

vi.mock('../lib/data', () => ({ useMetaSoft: () => undefined }));
vi.mock('../lib/track', () => ({ track: vi.fn() }));
vi.mock('../lib/nav', () => ({ go: vi.fn(), goBack: vi.fn() }));
vi.mock('../stores/search', () => ({ openSearch: vi.fn() }));
vi.mock('../components/Trainers', () => ({ default: () => null }));

const onMenu = vi.fn();
const onClose = vi.fn();
const common = { now: 'home', onConsent: vi.fn(), onNote: vi.fn() };
const css = readFileSync(join(__dirname, '../styles/pixel/shell.css'), 'utf8');
const storage = new Map<string, string>();
const localStore = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};

beforeEach(async () => {
  vi.stubGlobal('localStorage', localStore);
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }));
  useAuthStore.setState({ enabled: true, user: null, status: 'anon', admin: false, adminRoot: false, role: null, beta: false, favs: [], recheckError: '' });
  usePrefStore.getState().setTheme('dark');
  setRegion('kr');
  await setLang('ko');
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('데스크톱 이동의 한 자리', () => {
  it('상단에 로그인 진입점을 유지하고 왼쪽에는 계정·서비스 메뉴를 둔다', () => {
    const { container } = render(createElement('div', null,
      createElement(AppBar, { onMenu }), createElement(AppNav, { ...common, onMenu })));
    const bar = container.querySelector('.app-bar')!;
    expect(bar.querySelector('#bar-login')?.textContent).toContain('로그인');
    for (const id of ['app-search', 'lang-toggle', 'region-toggle', 'theme-toggle']) expect(bar.querySelector(`#${id}`)).not.toBeNull();
    expect(bar.querySelector('.region-toggle__code')?.textContent).toBe('KR');
    expect(bar.querySelector('#region-toggle')?.getAttribute('aria-label')).toContain('한국');
    const rail = container.querySelector('.app-nav')!;
    expect(rail.querySelectorAll('#menu-settings')).toHaveLength(1);
    expect(rail.querySelector('.px-nav__utilities #nav-mypage')?.textContent).toBe('로그인');
    fireEvent.click(bar.querySelector('#bar-login')!);
    expect(onMenu).toHaveBeenCalledOnce();
    fireEvent.click(rail.querySelector('#nav-mypage')!);
    expect(onMenu).toHaveBeenCalledTimes(2);
    fireEvent.click(rail.querySelector('#menu-settings')!);
    expect(go).toHaveBeenCalledWith('/settings');
    fireEvent.click(bar.querySelector('#app-search')!);
    expect(openSearch).toHaveBeenCalledWith('bar');
  });

  it('로그인한 계정은 마이페이지로, 로그인 없는 빌드는 설정만 보인다', () => {
    useAuthStore.setState({ status: 'ok', user: { uid: 'test', email: '', displayName: '', photoURL: '' } });
    const bar = render(createElement(AppBar, { onMenu })).container;
    expect(bar.querySelector('#bar-account')?.textContent).toContain('마이페이지');
    cleanup();
    const { container, unmount } = render(createElement(AppNav, { ...common, onMenu }));
    expect(container.querySelector('#nav-mypage')?.textContent).toBe('마이페이지');
    unmount();
    useAuthStore.setState({ enabled: false, user: null, status: 'anon' });
    const offlineBar = render(createElement(AppBar, { onMenu })).container;
    expect(offlineBar.querySelector('#bar-login')?.getAttribute('title')).toContain('로그인이 꺼져');
    fireEvent.click(offlineBar.querySelector('#bar-login')!);
    expect(onMenu).toHaveBeenCalled();
    cleanup();
    const offline = render(createElement(AppNav, { ...common, onMenu })).container;
    expect(offline.querySelector('#nav-mypage')).toBeNull();
    expect(offline.querySelector('#menu-settings')).not.toBeNull();
  });
});

describe('모바일 전체 메뉴의 기능 접근', () => {
  it('계정·언어·지역·테마·설정을 주 메뉴보다 먼저 배치하고 중복하지 않는다', () => {
    const { container } = render(createElement(Drawer, { ...common, open: true, onClose }));
    expect(container.querySelector('.account .account__login')).not.toBeNull();
    const utilities = container.querySelector('.drawer__locale')!;
    expect([...utilities.querySelectorAll('button')].map((button) => button.id)).toEqual(['menu-language', 'menu-region', 'menu-theme', 'menu-settings']);
    expect(utilities.nextElementSibling?.className).toBe('nav-menu');
    for (const id of ['menu-language', 'menu-region', 'menu-theme', 'menu-settings']) expect(container.querySelectorAll(`#${id}`)).toHaveLength(1);
    expect(css).toContain('.drawer__panel .px-nav__item { min-height: var(--tap); }');
    expect(css).toContain('.drawer__locale .px-nav__item { min-height: var(--tap);');
    fireEvent.click(container.querySelector('#menu-settings')!);
    expect(onClose).toHaveBeenCalledOnce();
    expect(go).toHaveBeenCalledWith('/settings');
  });

  it('테마는 메뉴를 닫지 않고 저장되며 상단 버튼과 동기화된다', async () => {
    await setLang('en');
    const { container } = render(createElement('div', null,
      createElement(AppBar, { onMenu }), createElement(Drawer, { ...common, open: true, onClose })));
    const theme = container.querySelector('#menu-theme')!;
    expect(theme.textContent).toBe('ThemeDark');
    expect(container.querySelector('.drawer__locale #menu-settings')?.textContent).toBe('Settings');
    fireEvent.click(theme);
    expect(localStorage.getItem('pogo_theme')).toBe('light');
    expect(theme.textContent).toBe('ThemeLight');
    expect(container.querySelector('#theme-toggle')?.getAttribute('data-icon')).toBe('sun');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('모든 주 메뉴를 유지하고 선택된 설정도 표시한다', () => {
    const { container } = render(createElement(Drawer, { ...common, now: 'settings', open: true, onClose }));
    expect([...container.querySelectorAll('.nav-menu [data-route]')].map((link) => link.getAttribute('data-route')).sort()).toEqual(ROUTE_NAV.map((route) => route.id).sort());
    expect(container.querySelector('#menu-settings')?.getAttribute('aria-current')).toBe('page');
    expect(css).toContain('.drawer__locale .px-nav__item[aria-current="page"] { background: var(--brand-subtle);');
  });

  it('머리줄 대신 하단에서 홈·검색·내 포켓몬·전체 메뉴에 접근한다', () => {
    const { container } = render(createElement(BottomBar, { now: 'home', onMenu }));
    const items = [...container.querySelectorAll('.px-bottom__item')];
    expect(items.map((item) => item.textContent)).toEqual(['홈', '검색', '내 포켓몬', '전체 메뉴']);
    fireEvent.click(items[1]!);
    expect(openSearch).toHaveBeenCalledWith('bottom');
    fireEvent.click(items[3]!);
    expect(onMenu).toHaveBeenCalledOnce();
    expect(css).toContain('.app-bar { display: flex; min-height: 5.6rem;');
    expect(css).toContain('.app-bar .app-bar__account { display: inline-flex; }');
    expect(css).toContain('.px-bottom { display: flex; }');
  });
});
