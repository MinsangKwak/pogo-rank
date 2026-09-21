// ─────────────────────────────────────────────────────────────────────────────
// test/permission.test.tsx — 누가 무엇을 볼 수 있는가 (v4.0.1 깃발 둘)
//
// **이 파일이 막으려는 것은 규칙의 오류가 아니라 배선의 공백이다.**
// v4.0.1 에 터진 버그는 `beta` 를 저장은 하는데 **아무도 안 읽은** 것이었다.
// 규칙(useLockReason)만 검사하면 그 버그는 그대로 통과한다 — 규칙은 멀쩡했으니까.
// 그래서 규칙을 쓰는 컴포넌트를 실제로 그려 보고, 스토어가 문서에서 깃발을 읽는지도 본다.
//
// 브라우저를 안 쓴다. 같은 것을 브라우저로 보려면 빌드 6초에 기동과 렌더 대기가 더 붙는다.
// ─────────────────────────────────────────────────────────────────────────────
import { render, screen, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAuthStore, applyUser, recheckAccess, type AuthStatus } from '../stores/auth';
import { useLockReason, lockedAttrs } from '../lib/useLocked';
import { ROUTES, ROUTE_NAV, routeById, routeCanonical } from '../routes';
import { NavItem } from '../components/Shell';
import { Tile } from '../screens/Home';
import LockCard from '../components/LockCard';
import type { AuthApi, AuthUser, DocData } from '../lib/authApi';

// 계정 한 자리를 세운다. 실제 로그인 판정이 끝난 뒤의 스토어 모습과 같다
function signedIn(status: AuthStatus, extra: { admin?: boolean; adminRoot?: boolean; beta?: boolean } = {}) {
  useAuthStore.getState().set({
    enabled: true,
    status,
    user: { uid: 'u1', email: 'a@b.c', displayName: '테스트', photoURL: '' } as AuthUser,
    admin: false, adminRoot: false, beta: false,
    ...extra,
  });
}

const PLANNER = routeById('planner')!;
const DEX = routeById('dex')!;

describe('잠금 판정 — 다섯 갈래', () => {
  // [이름, 세우는 법, 기대하는 까닭]
  const CASES: [string, () => void, '' | 'login' | 'beta'][] = [
    ['로그인 전', () => useAuthStore.getState().set({ enabled: true, status: 'anon' }), 'login'],
    ['승인 대기', () => signedIn('pending'), 'login'],
    ['승인 O · 깃발 X', () => signedIn('ok'), 'beta'],
    ['승인 O · 깃발 O', () => signedIn('ok', { beta: true }), ''],
    ['관리자 O · 깃발 X', () => signedIn('ok', { admin: true }), 'beta'],
  ];

  it.each(CASES)('내 포켓몬 — %s', (_label, setup, want) => {
    setup();
    const { result } = renderHook(() => useLockReason('planner'));
    expect(result.current).toBe(want);
  });

  it('판정 중에는 잠그지 않는다 — 깜빡임이 "로그아웃됐다" 로 읽힌다', () => {
    useAuthStore.getState().set({ enabled: true, status: 'loading' });
    const { result } = renderHook(() => useLockReason('planner'));
    expect(result.current).toBe('');
  });

  it('로그인을 못 쓰는 빌드에서는 잠그지 않는다 — 열 길 없는 자물쇠는 고장이다', () => {
    useAuthStore.getState().set({ enabled: false, status: 'anon' });
    const { result } = renderHook(() => useLockReason('planner'));
    expect(result.current).toBe('');
  });

  it('잠그지 않는 화면은 어떤 상태에서도 열린다', () => {
    signedIn('ok');
    const { result } = renderHook(() => useLockReason('dex'));
    expect(result.current).toBe('');
  });

  it('까닭마다 다른 말을 붙인다 — 승인된 사람에게 "로그인하면" 은 말이 안 된다', () => {
    expect(lockedAttrs('login').title).toBe('로그인하면 열려요');
    expect(lockedAttrs('beta').title).toBe('실험 기능이에요');
    expect(lockedAttrs('').title).toBe('');
    expect(lockedAttrs('beta')['aria-disabled']).toBe('true');
    expect(lockedAttrs('')['aria-disabled']).toBeUndefined();
  });
});

describe('배선 — 규칙을 쓰는 자리가 셋이다', () => {
  // 규칙이 맞아도 화면이 안 읽으면 소용이 없다. v4.0.1 버그가 정확히 그것이었다
  it('메뉴 줄이 깃발 없는 계정에게 잠금 표시를 붙인다', () => {
    signedIn('ok');
    const { container } = render(<NavItem route={PLANNER} now="home" />);
    const row = container.querySelector('a')!;
    expect(row.className).toContain('is-locked');
    expect(row.getAttribute('title')).toBe('실험 기능이에요');
    expect(row.getAttribute('aria-disabled')).toBe('true');
  });

  it('메뉴 줄이 깃발 있는 계정에게는 안 붙인다', () => {
    signedIn('ok', { beta: true });
    const { container } = render(<NavItem route={PLANNER} now="home" />);
    const row = container.querySelector('a')!;
    expect(row.className).not.toContain('is-locked');
    expect(row.getAttribute('aria-disabled')).toBeNull();
  });

  it('홈 타일도 같은 답을 쓴다', () => {
    signedIn('ok');
    const { container } = render(<Tile route={PLANNER} />);
    const tile = container.querySelector('a')!;
    expect(tile.className).toContain('is-locked');
    expect(tile.getAttribute('title')).toBe('실험 기능이에요');
  });

  it('잠그지 않는 화면의 타일에는 설명글이 남는다', () => {
    signedIn('ok', { beta: true });
    const { container } = render(<Tile route={DEX} />);
    expect(container.querySelector('a')!.className).not.toContain('is-locked');
  });
});

describe('잠금 카드 — 까닭마다 얼굴이 다르다', () => {
  it('실험 기능 판에는 로그인 버튼을 안 준다 — 이미 로그인한 사람이 본다', () => {
    signedIn('ok');
    render(<LockCard reason="beta" />);
    expect(screen.getByText('실험 기능이에요')).toBeInTheDocument();
    expect(screen.getByText('관리자가 실험 기능 이용 권한을 부여하면 사용할 수 있어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('로그인 전에는 로그인 버튼을 준다', () => {
    useAuthStore.getState().set({ enabled: true, status: 'anon' });
    render(<LockCard reason="login" />);
    expect(screen.getByText('로그인하면 열려요')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('승인 대기에는 기다리라고만 한다 — 눌러도 달라질 것이 없다', () => {
    signedIn('pending');
    render(<LockCard reason="login" />);
    expect(screen.getByText('승인을 기다리는 중이에요')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

// allowlist 문서 한 장을 내놓는 가짜 서버. 규칙(firestore.rules)이 허락하는 것만 흉내 낸다
function fakeApi(doc: DocData | null, strict?: () => Promise<DocData | null>): AuthApi {
  return {
    onUser: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), deleteUser: vi.fn(),
    getDoc: vi.fn(async (path: string) => (path.startsWith('allowlist/') ? doc : null)),
    getDocStrict: strict ?? vi.fn(async () => doc),
    setDoc: vi.fn(async () => {}), deleteDoc: vi.fn(async () => {}),
    listDocs: vi.fn(async () => []), arrayEdit: vi.fn(async () => {}),
  } as unknown as AuthApi;
}

const USER: AuthUser = { uid: 'u1', email: 'a@b.c', displayName: '테스트', photoURL: '' } as AuthUser;

describe('스토어 — 깃발 둘을 따로 읽는다', () => {
  it('admin 이 켜져도 beta 는 따라 켜지지 않는다', async () => {
    await applyUser(fakeApi({ approved: true, admin: true }), USER, 'root-uid', '', '');
    const s = useAuthStore.getState();
    expect(s.admin).toBe(true);
    expect(s.beta).toBe(false);
  });

  it('beta 가 켜져도 admin 은 따라 켜지지 않는다', async () => {
    await applyUser(fakeApi({ approved: true, beta: true }), USER, 'root-uid', '', '');
    const s = useAuthStore.getState();
    expect(s.beta).toBe(true);
    expect(s.admin).toBe(false);
  });

  it('루트는 만든 사람이라 둘 다 켜져 있다', async () => {
    await applyUser(fakeApi(null), USER, 'u1', '', '');
    const s = useAuthStore.getState();
    expect(s.adminRoot).toBe(true);
    expect(s.beta).toBe(true);
    expect(s.status).toBe('ok');
  });

  it('승인 문서가 없으면 승인 대기이고 깃발은 둘 다 내려간다', async () => {
    await applyUser(fakeApi(null), USER, 'root-uid', '', '');
    const s = useAuthStore.getState();
    expect(s.status).toBe('pending');
    expect(s.admin).toBe(false);
    expect(s.beta).toBe(false);
  });

  it('로그아웃하면 깃발도 같이 내려간다', async () => {
    await applyUser(fakeApi({ approved: true, beta: true, admin: true }), USER, 'root-uid', '', '');
    await applyUser(fakeApi(null), null, 'root-uid', '', '');
    const s = useAuthStore.getState();
    expect(s.beta).toBe(false);
    expect(s.admin).toBe(false);
    expect(s.status).toBe('anon');
  });
});

describe('🎒 내 포켓몬은 실험 기능으로 살아 있다', () => {
  // v4.2.0 에 이 화면을 통째로 지웠다가 v4.2.1 에 되살렸다. 다시 없어지면 여기서 잡는다.
  // 권한 구조는 처음부터 이것이다 — **관리자는 유저 관리, 실험 기능은 D-MAX [미구현] 과 내 포켓몬.**
  it('라우트가 있고, 로그인과 실험 기능 깃발을 둘 다 요구한다', () => {
    const route = routeById('planner');
    expect(route).toBeDefined();
    expect(route!.locked).toBe(true);
    expect(route!.beta).toBe(true);
  });

  it('메뉴에 "내 포켓몬" 줄이 선다', () => {
    expect(ROUTE_NAV.map((route) => route.nav)).toContain('내 포켓몬');
  });

  it('옛 주소 넷이 내 포켓몬으로 이어진다 — 공유된 링크가 살아 있어야 한다', () => {
    for (const old of ['plan', 'planner/collection', 'plan/collection', 'favs']) {
      expect(routeCanonical(old)).toBe('planner');
    }
  });

  it('깃발을 단 라우트는 내 포켓몬 하나다 — 실수로 다른 화면이 잠기지 않게', () => {
    expect(ROUTES.filter((route) => 'beta' in route).map((route) => route.id)).toEqual(['planner']);
    expect(ROUTES.filter((route) => 'locked' in route).map((route) => route.id)).toEqual(['planner']);
  });
});

describe('권한 재확인 — 탭으로 돌아왔을 때 (v4.2.0)', () => {
  it('승인을 내리면 다음 재확인에서 열린다 — 새로고침을 기다리지 않는다', async () => {
    await applyUser(fakeApi(null), USER, 'root-uid', '', '');
    expect(useAuthStore.getState().status).toBe('pending');
    useAuthStore.getState().set({ enabled: true, api: fakeApi({ approved: true }) });
    await recheckAccess();
    expect(useAuthStore.getState().status).toBe('ok');
  });

  it('승인을 거두면 다음 재확인에서 닫힌다', async () => {
    await applyUser(fakeApi({ approved: true, admin: true }), USER, 'root-uid', '', '');
    useAuthStore.getState().set({ enabled: true, api: fakeApi(null) });
    await recheckAccess();
    const s = useAuthStore.getState();
    expect(s.status).toBe('pending');
    expect(s.admin).toBe(false);
  });

  it('승인되는 순간 ★ 도 가져온다 — 열렸는데 비어 있으면 "날아갔다" 로 읽힌다', async () => {
    await applyUser(fakeApi(null), USER, 'root-uid', '', '');
    expect(useAuthStore.getState().favs).toEqual([]);
    const api = fakeApi({ approved: true }) as AuthApi & { getDoc: ReturnType<typeof vi.fn> };
    api.getDoc = vi.fn(async (path: string) => (path.startsWith('users/') ? { favs: [25, 6] } : { approved: true }));
    useAuthStore.getState().set({ enabled: true, api });
    await recheckAccess();
    expect(useAuthStore.getState().favs).toEqual([6, 25]);   // 번호순으로 읽는다
  });

  it('못 읽으면 권한을 올리지도 내리지도 않는다 — 회선이 끊긴 것을 해제로 읽으면 안 된다', async () => {
    await applyUser(fakeApi({ approved: true, admin: true, beta: true }), USER, 'root-uid', '', '');
    const boom = vi.fn(async () => { throw { code: 'unavailable' }; });
    useAuthStore.getState().set({ enabled: true, api: fakeApi(null, boom) });
    await recheckAccess();
    const s = useAuthStore.getState();
    expect(s.status).toBe('ok');
    expect(s.admin).toBe(true);
    expect(s.beta).toBe(true);
    expect(s.recheckError).toBe('unavailable');   // 마지막 판정은 그대로, 재시도 안내만 남는다
  });

  it('루트는 다시 읽지 않는다 — uid 로 판정하므로 읽을 문서가 없다', async () => {
    await applyUser(fakeApi(null), USER, 'u1', '', '');
    const strict = vi.fn(async () => null);
    useAuthStore.getState().set({ enabled: true, api: fakeApi(null, strict) });
    await recheckAccess();
    expect(strict).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('ok');
  });

  it('읽는 사이에 계정이 바뀌면 그 판정을 덮지 않는다', async () => {
    await applyUser(fakeApi({ approved: true }), USER, 'root-uid', '', '');
    const slow = vi.fn(async () => {
      useAuthStore.getState().set({ user: { ...USER, uid: 'u2' } as AuthUser, status: 'pending' });
      return { approved: true } as DocData;
    });
    useAuthStore.getState().set({ enabled: true, api: fakeApi(null, slow) });
    await recheckAccess();
    expect(useAuthStore.getState().status).toBe('pending');
  });
});
