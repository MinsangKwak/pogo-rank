// ─────────────────────────────────────────────────────────────────────────────
// test/signin.test.ts — 로그인 버튼은 **언제 눌러도** 열려야 한다
//
// 막으려는 것 — 로그아웃 상태에서는 '로그인 확인 중' 안내가 안 뜨고 버튼이 바로 보인다.
// 그런데 Firebase SDK 는 첫 그림 뒤에 오므로, 그 사이에 누르면 `api` 가 없어
// **아무 일도 안 일어났다.** 눌러도 안 되는 버튼은 고장과 같다.
// signInNow 가 그때 SDK 를 받아 오고 여는지를 여기서 지킨다.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';
import { signInNow, useAuthStore } from '../stores/auth';
import type { AuthApi } from '../lib/authApi';

const fakeApi = () => ({ signIn: vi.fn(async () => {}) } as unknown as AuthApi);

describe('로그인 — SDK 가 아직 없을 때', () => {
  it('받아 온 뒤 연다 (지금까지는 눌러도 아무 일이 없었다)', async () => {
    const api = fakeApi();
    const start = vi.fn(async () => api);
    useAuthStore.getState().set({ api: null, start });

    await signInNow();

    expect(start).toHaveBeenCalledTimes(1);
    expect(api.signIn).toHaveBeenCalledTimes(1);
  });

  it('이미 와 있으면 다시 받지 않는다 — 기다림 없이 바로 연다', async () => {
    const api = fakeApi();
    const start = vi.fn(async () => api);
    useAuthStore.getState().set({ api, start });

    await signInNow();

    expect(start).not.toHaveBeenCalled();
    expect(api.signIn).toHaveBeenCalledTimes(1);
  });

  it('SDK 를 못 받아도 터지지 않는다 — 로그인만 안 될 뿐이다', async () => {
    useAuthStore.getState().set({ api: null, start: vi.fn(async () => null) });
    await expect(signInNow()).resolves.toBeUndefined();
  });

  it('로그인 실패는 부르는 쪽으로 넘긴다 — 계정 화면이 까닭을 적는다', async () => {
    const api = { signIn: vi.fn(async () => { throw { code: 'auth/popup-blocked' }; }) } as unknown as AuthApi;
    useAuthStore.getState().set({ api, start: null });
    await expect(signInNow()).rejects.toMatchObject({ code: 'auth/popup-blocked' });
  });
});
