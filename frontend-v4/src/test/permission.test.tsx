// ─────────────────────────────────────────────────────────────────────────────
// test/permission.test.tsx — 누가 무엇을 볼 수 있는가
//
// **이 파일이 막으려는 것은 규칙의 오류가 아니라 배선의 공백이다.**
// v4.0.1 에 터진 버그는 `beta` 를 저장은 하는데 **아무도 안 읽은** 것이었다.
// 규칙(useLockReason)만 검사하면 그 버그는 그대로 통과한다 — 규칙은 멀쩡했으니까.
//
// **v4.2.0 에 판이 바뀌었다.** 내 포켓몬(🎒)을 접으면서 `locked`·`beta` 를 다는 라우트가
// 하나도 남지 않았다. 그래서 검사도 셋으로 갈린다 —
//   ① 잠금 **장치**  라우트 없이 확인할 수 있는 것만 (lockedAttrs · LockCard 의 얼굴)
//   ② 표의 **불변**  아직 아무 라우트도 깃발을 안 단다. 다는 날 이 검사가 빨개져
//                    ①만으로는 모자란다는 것(배선까지 봐야 한다는 것)을 알린다
//   ③ **삭제 회귀**  내 포켓몬이 되살아나면 빨개진다
//
// 브라우저를 안 쓴다. 같은 것을 브라우저로 보려면 빌드 6초에 기동과 렌더 대기가 더 붙는다.
// ─────────────────────────────────────────────────────────────────────────────
import { render, screen, renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAuthStore, applyUser, recheckAccess, type AuthStatus } from '../stores/auth';
import { useLockReason, lockedAttrs } from '../lib/useLocked';
import { ROUTES, ROUTE_NAV, routeById, routeCanonical } from '../routes';
import { Tile } from '../screens/Home';
import LockCard from '../components/LockCard';
import type { AuthApi, AuthUser, DocData } from '../lib/authApi';

// 계정 한 자리를 세운다. 실제 로그인 판정이 끝난 뒤의 스토어 모습과 같다
function signedIn(status: AuthStatus, extra: { admin?: boolean; adminRoot?: boolean; beta?: boolean } = {}) {
  useAuthStore.getState().set({
    enabled: true,
    status,
    user: { uid: 'u1', email: 'a@b.c', displayName: '테스트', photoURL: '' } as AuthUser,
    admin: false, adminRoot: false, beta: false, recheckError: '',
    ...extra,
  });
}

describe('① 잠금 장치 — 라우트 없이 확인되는 것', () => {
  it('까닭마다 다른 말을 붙인다 — 승인된 사람에게 "로그인하면" 은 말이 안 된다', () => {
    expect(lockedAttrs('login').title).toBe('로그인하면 열려요');
    expect(lockedAttrs('beta').title).toBe('실험 기능이에요');
    expect(lockedAttrs('').title).toBe('');
    expect(lockedAttrs('beta')['aria-disabled']).toBe('true');
    expect(lockedAttrs('')['aria-disabled']).toBeUndefined();
  });

  it('실험 기능 판에는 로그인 버튼을 안 준다 — 이미 로그인한 사람이 본다', () => {
    signedIn('ok');
    render(<LockCard reason="beta" />);
    expect(screen.getByText('실험 기능이에요')).toBeInTheDocument();
    expect(screen.getByText('관리자가 열어 주면 실험 기능을 써볼 수 있어요.')).toBeInTheDocument();
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

  it('깃발을 안 단 화면은 어떤 상태에서도 열린다', () => {
    signedIn('pending');
    const { result } = renderHook(() => useLockReason('dex'));
    expect(result.current).toBe('');
  });

  it('잠그지 않는 화면의 타일에는 잠금 표시가 안 붙는다', () => {
    signedIn('ok');
    const { container } = render(<Tile route={routeById('dex')!} />);
    expect(container.querySelector('a')!.className).not.toContain('is-locked');
  });
});

describe('② 표의 불변 — 지금은 아무도 깃발을 안 단다', () => {
  // 깃발을 다는 라우트가 생기면 이 둘이 빨개진다. 그때 할 일은 숫자를 고치는 것이 아니라,
  // 그 라우트로 ①을 넘어 **배선까지** (메뉴 줄·홈 타일·화면 본문 셋) 검사를 되살리는 것이다.
  // v4.0.1 버그가 배선의 공백이었다 — 규칙만 맞고 읽는 사람이 없었다
  it('locked 를 다는 라우트가 없다', () => {
    expect(ROUTES.filter((route) => 'locked' in route).map((route) => route.id)).toEqual([]);
  });

  it('beta 를 다는 라우트가 없다 — 깃발과 배선은 남아 있고, 열리는 화면만 없다', () => {
    expect(ROUTES.filter((route) => 'beta' in route).map((route) => route.id)).toEqual([]);
  });
});

describe('③ 삭제 회귀 — 내 포켓몬(🎒)이 되살아나면 빨개진다', () => {
  it('라우트 표에 planner 가 없다', () => {
    expect(routeById('planner')).toBeUndefined();
  });

  it('메뉴에 "내 포켓몬" 줄이 없다', () => {
    expect(ROUTE_NAV.map((route) => route.nav)).not.toContain('내 포켓몬');
  });

  it('옛 주소 다섯은 홈으로 간다 — 공유된 링크와 북마크가 빈 화면으로 떨어지지 않게', () => {
    for (const old of ['planner', 'plan', 'planner/collection', 'plan/collection', 'favs']) {
      expect(routeCanonical(old)).toBe('');
    }
  });

  it('옛 주소 아래 경로도 홈으로 간다 — `#//collection` 같은 주소를 남기지 않는다', () => {
    expect(routeCanonical('planner/mons/25')).toBe('');
  });

  it('이미 쓰는 주소는 건드리지 않는다', () => {
    expect(routeCanonical('dex')).toBeNull();
    expect(routeCanonical('pvp/deck')).toBeNull();
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
    expect(useAuthStore.getState().status).toBe('ok');
    useAuthStore.getState().set({ enabled: true, api: fakeApi(null) });
    await recheckAccess();
    const s = useAuthStore.getState();
    expect(s.status).toBe('pending');
    expect(s.admin).toBe(false);
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

  it('다시 읽히면 안내를 걷는다', async () => {
    await applyUser(fakeApi({ approved: true }), USER, 'root-uid', '', '');
    useAuthStore.getState().set({ enabled: true, recheckError: 'unavailable', api: fakeApi({ approved: true }) });
    await recheckAccess();
    expect(useAuthStore.getState().recheckError).toBe('');
  });

  it('로그인을 못 쓰는 빌드에서는 다시 읽지 않는다', async () => {
    await applyUser(fakeApi({ approved: true }), USER, 'root-uid', '', '');
    const strict = vi.fn(async () => null);
    useAuthStore.getState().set({ enabled: false, api: fakeApi(null, strict) });
    await recheckAccess();
    expect(strict).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe('ok');
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
    // 읽는 동안 다른 사람으로 로그인했다 — 늦게 온 답이 그 사람의 권한을 덮으면 안 된다
    const slow = vi.fn(async () => {
      useAuthStore.getState().set({ user: { ...USER, uid: 'u2' } as AuthUser, status: 'pending' });
      return { approved: true } as DocData;
    });
    useAuthStore.getState().set({ enabled: true, api: fakeApi(null, slow) });
    await recheckAccess();
    expect(useAuthStore.getState().status).toBe('pending');
  });
});
