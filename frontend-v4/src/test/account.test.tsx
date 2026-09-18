// ─────────────────────────────────────────────────────────────────────────────
// test/account.test.tsx — 계정 삭제는 **다 지워야 지운 것이다** (v4.2.0)
//
// 고치기 전에는 문서 삭제 둘이 실패를 삼켰다. 규칙이 막거나 회선이 끊기면 문서는 남은 채
// 인증 계정만 지워져, 본인은 "지웠다" 고 알고 서버에는 이메일·이름이 남는다.
// 그 상태는 본인이 다시 지울 길도 없다 — 로그인할 계정이 없으니까.
// ─────────────────────────────────────────────────────────────────────────────
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Account from '../components/Account';
import { useAuthStore } from '../stores/auth';
import type { AuthApi, AuthUser } from '../lib/authApi';

const USER: AuthUser = { uid: 'u1', email: 'a@b.c', displayName: '테스트', photoURL: '' } as AuthUser;

/** 문서 삭제가 막히는 가짜 서버. deleteUser 를 불렀는지 세어 둔다 */
function api(deleteDoc: () => Promise<void>) {
  const deleteUser = vi.fn(async () => {});
  return {
    handle: {
      onUser: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), deleteUser,
      getDoc: vi.fn(async () => null), getDocStrict: vi.fn(async () => null),
      setDoc: vi.fn(async () => {}), deleteDoc: vi.fn(deleteDoc),
      listDocs: vi.fn(async () => []), arrayEdit: vi.fn(async () => {}),
    } as unknown as AuthApi,
    deleteUser,
  };
}

beforeEach(() => { vi.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => { vi.restoreAllMocks(); });

type Seed = Partial<ReturnType<typeof useAuthStore.getState>>;

function signIn(handle: AuthApi, extra: Seed = {}) {
  useAuthStore.getState().set({
    enabled: true, status: 'pending', user: USER, api: handle,
    admin: false, adminRoot: false, beta: false, favs: [], recheckError: '', requestError: '',
    ...extra,
  });
}

describe('계정 삭제', () => {
  it('문서가 안 지워지면 인증 계정에 손대지 않는다 — 지울 길 없는 찌꺼기를 남기지 않게', async () => {
    const server = api(async () => { throw { code: 'permission-denied' }; });
    signIn(server.handle);
    render(<Account onGo={() => {}} />);
    fireEvent.click(screen.getByText('계정 삭제'));
    expect(await screen.findByText(/삭제 실패/)).toBeInTheDocument();
    expect(await screen.findByText(/permission-denied/)).toBeInTheDocument();
    expect(server.deleteUser).not.toHaveBeenCalled();
  });

  it('문서가 지워지면 인증 계정까지 간다', async () => {
    const server = api(async () => {});
    signIn(server.handle);
    render(<Account onGo={() => {}} />);
    fireEvent.click(screen.getByText('계정 삭제'));
    await vi.waitFor(() => expect(server.deleteUser).toHaveBeenCalled());
  });

  it('묻는 말에 아니오면 아무것도 안 한다', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const server = api(async () => {});
    signIn(server.handle);
    render(<Account onGo={() => {}} />);
    fireEvent.click(screen.getByText('계정 삭제'));
    expect(server.handle.deleteDoc).not.toHaveBeenCalled();
    expect(server.deleteUser).not.toHaveBeenCalled();
  });
});

describe('권한 재확인 안내', () => {
  it('다시 확인하지 못했으면 마지막 권한이라고 알린다', () => {
    const server = api(async () => {});
    signIn(server.handle);
    useAuthStore.getState().set({ recheckError: 'unavailable' });
    render(<Account onGo={() => {}} />);
    expect(screen.getByText(/권한을 다시 확인하지 못했어요/)).toBeInTheDocument();
  });

  it('잘 읽혔으면 안내를 안 띄운다', () => {
    const server = api(async () => {});
    signIn(server.handle);
    render(<Account onGo={() => {}} />);
    expect(screen.queryByText(/권한을 다시 확인하지 못했어요/)).toBeNull();
  });
});

describe('🎒 내 포켓몬 셈 — 열리지 않으면 아예 안 보인다', () => {
  // 제보: 실험 기능을 해제했는데 ☰ 메뉴의 계정 카드에는 [🎒 내 포켓몬 1마리] 가 그대로 남았다.
  // 화면과 메뉴 줄은 useLockReason 을 쓰는데 이 줄만 안 썼다 — 눌러도 잠긴 화면이 나왔다
  it('실험 기능 깃발이 있으면 보인다', () => {
    const server = api(async () => {});
    signIn(server.handle, { status: 'ok', beta: true, favs: [25] });
    render(<Account onGo={() => {}} />);
    expect(screen.getByText('1마리')).toBeInTheDocument();
    expect(document.querySelector('.account__stat-go')).not.toBeNull();
  });

  it('깃발을 떼면 줄이 통째로 사라진다 — 🔒 를 붙여 남기지 않는다', () => {
    const server = api(async () => {});
    signIn(server.handle, { status: 'ok', beta: false, favs: [25] });
    render(<Account onGo={() => {}} />);
    expect(document.querySelector('.account__stat-go')).toBeNull();
  });

  it('승인이 풀리면 역시 안 보인다', () => {
    const server = api(async () => {});
    signIn(server.handle, { status: 'pending', beta: true, favs: [25] });
    render(<Account onGo={() => {}} />);
    expect(document.querySelector('.account__stat-go')).toBeNull();
  });
});
