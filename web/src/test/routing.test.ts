// ─────────────────────────────────────────────────────────────────────────────
// routing.test.ts — 해시를 뗀 자리가 안 새는지 본다 (v5 Phase 6)
//
// **여기서 재는 것은 주소다.** 주소가 틀리면 공유된 링크와 북마크가 끊기고, 그것은
// 되돌릴 수 없다 — 남의 브라우저에 이미 들어 있는 값이기 때문이다 (CLAUDE.md §2).
//
// 셋을 본다
//   ① 경로 문자열이 그대로인가 — `dex` · `mon/25` · `dmax/deck`
//   ② 어디에도 `#` 이 안 남았는가
//   ③ **앱 밖으로 나가는 길이 없는가** — 로그인 뒤 돌아갈 자리를 남이 정할 수 있으면
//      그 사이트가 세션을 받는다
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { ROUTES, ROUTE_LEGACY, routeHref, routeOfPath, routeCanonical } from '../routes';
import { safePath } from '../lib/loginPath';

describe('경로 문자열은 그대로다 (CLAUDE.md §2)', () => {
  it('바깥이 물고 있는 주소가 살아 있다', () => {
    // 공유 링크·북마크·GA 지표가 이 글자에 달려 있다
    expect(routeHref('dex')).toBe('/dex');
    expect(routeHref('dmax-deck')).toBe('/dmax/deck');
    expect(routeHref('mon', '25')).toBe('/mon/25');
    expect(routeHref('home')).toBe('/');
  });

  it('어느 주소에도 해시가 안 남았다', () => {
    for (const route of ROUTES) {
      const href = routeHref(route.id);
      expect(href.startsWith('/'), route.id).toBe(true);
      expect(href.includes('#'), route.id).toBe(false);
    }
  });

  it('긴 경로를 먼저 잡는다 — pvp/deck 이 pvp 에 먹히지 않는다', () => {
    expect(routeOfPath('/pvp/deck')?.route.id).toBe('pvp-deck');
    expect(routeOfPath('/pvp')?.route.id).toBe('pvp');
    expect(routeOfPath('/mon/25')).toMatchObject({ rest: '25' });
  });

  it('모르는 주소는 못 찾는다 — 404 를 낼 근거가 된다', () => {
    expect(routeOfPath('/nope')).toBeNull();
    expect(routeOfPath('/')?.route.id).toBe('home');
  });
});

describe('옛 주소가 이어진다', () => {
  it('legacy 표가 비어 있지 않다', () => {
    // v3.61.0 에 두 화면을 합치며 옛 주소 넷을 planner 로 이어 뒀다 — 그 표가 살아 있어야 한다
    expect(ROUTE_LEGACY.size).toBeGreaterThan(0);
    expect(ROUTE_LEGACY.get('rank/max')).toBe('dmax');
    expect(ROUTE_LEGACY.get('favs')).toBe('planner');
  });

  it('옛 주소 아래까지 이어 준다', () => {
    expect(routeCanonical('rank/pve/뭐든')).toBe('pve/뭐든');
    expect(routeCanonical('dex')).toBeNull();   // 바꿀 것이 없다
  });
});

describe('로그인 뒤 돌아갈 자리는 앱 안이어야 한다', () => {
  it('앱 밖으로 나가는 길을 막는다', () => {
    // 로그인시킨 브라우저를 남의 사이트로 보낼 수 있으면 그 사이트가 세션을 받는다
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '']) {
      expect(safePath(bad), bad).toBe('/');
    }
  });

  it('앱 안의 경로는 그대로 둔다', () => {
    expect(safePath('/dex')).toBe('/dex');
    expect(safePath('/dmax/deck?b=fire')).toBe('/dmax/deck?b=fire');
  });

  it('글자가 아니면 홈이다', () => {
    expect(safePath(undefined)).toBe('/');
    expect(safePath(42)).toBe('/');
  });
});
