// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// lockgate.test.ts — 잠긴 화면이 새지 않는지 본다 (2026-09-23 dev 제보 둘)
//
//   ① 실험 기능이 없는 사람이 '내 포켓몬' 을 누르면 화면이 떴다가 지워졌다.
//      메뉴 줄은 링크라 누를 때마다 문서를 새로 열고, 그러면 판정이 'loading' 에서 시작한다.
//      그 사이에 본문을 그렸다 → 판정 중에는 '확인 중' 만 세운다
//   ② 실험 기능 잠금이 눌렸다 → 주소를 떼서 링크가 아니게 한다.
//      로그인 잠금은 눌린다 — 로그인 버튼이 있는 카드로 가야 한다
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { useAuthStore, type AuthStatus } from '../stores/auth';
import { routeById, type RouteDef } from '../routes';
import { NavItem } from '../components/Shell';
import { Tile } from '../screens/Home';
import { Screen } from '../App';

const planner = routeById('planner') as RouteDef;

function as(status: AuthStatus, beta: boolean) {
  useAuthStore.setState({ enabled: true, status, beta, ready: status !== 'loading' });
}

afterEach(() => cleanup());

describe('실험 기능 잠금은 누를 수 없다', () => {
  it('승인됐지만 깃발이 없으면 메뉴 줄 · 홈 타일에 주소가 없다', () => {
    as('ok', false);
    const nav = render(createElement(NavItem, { route: planner, now: 'home' })).container.querySelector('a')!;
    expect(nav.hasAttribute('href')).toBe(false);
    expect(nav.getAttribute('aria-disabled')).toBe('true');
    const tile = render(createElement(Tile, { route: planner })).container.querySelector('a')!;
    expect(tile.hasAttribute('href')).toBe(false);
  });

  it('깃발이 있으면 링크다', () => {
    as('ok', true);
    const nav = render(createElement(NavItem, { route: planner, now: 'home' })).container.querySelector('a')!;
    expect(nav.getAttribute('href')).toBe('/planner');
    expect(nav.hasAttribute('aria-disabled')).toBe(false);
  });

  it('로그인 잠금은 눌린다 — 로그인 카드로 가는 길이다', () => {
    as('anon', false);
    const nav = render(createElement(NavItem, { route: planner, now: 'home' })).container.querySelector('a')!;
    expect(nav.getAttribute('href')).toBe('/planner');
    expect(nav.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('판정 중에는 잠긴 화면의 본문을 그리지 않는다', () => {
  const screen = () => render(createElement(Screen, { route: planner, rest: '', onOpen: () => {} })).container;

  it('확인 중이면 본문 대신 확인 카드', () => {
    as('loading', false);
    const view = screen();
    expect(view.querySelector('.plan__lock[aria-busy="true"]')).not.toBeNull();
    expect(view.textContent).toContain('확인하는 중');
  });

  it('확인이 끝나 깃발이 없으면 실험 기능 카드 — 로그인 버튼은 없다', () => {
    as('ok', false);
    const view = screen();
    expect(view.textContent).toContain('실험 기능이에요');
    expect(view.querySelector('button')).toBeNull();
  });

  it('로그인 전이면 로그인 카드', () => {
    as('anon', false);
    expect(screen().textContent).toContain('로그인하면 열려요');
  });
});
