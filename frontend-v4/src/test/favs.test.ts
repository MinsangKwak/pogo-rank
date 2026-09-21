// ─────────────────────────────────────────────────────────────────────────────
// test/favs.test.ts — ★ 저장이 실패해도 뒤따른 입력은 살아야 한다 (WBS-199)
//
// 재현: 피카츄(25)를 담고 저장이 끝나기 전에 리자몽(6)을 담는다. 피카츄 저장이 실패하면
// 피카츄만 빠져야 한다. 예전에는 누를 때 복사해 둔 목록으로 통째 되돌려 리자몽까지 사라졌다.
// ─────────────────────────────────────────────────────────────────────────────
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFavs } from '../lib/useFavs';
import { useAuthStore } from '../stores/auth';
import type { AuthApi } from '../lib/authApi';

// arrayEdit 마다 promise 를 손에 쥐어 두고, 검사가 원하는 순간에 실패시킨다
function deferredApi() {
  const pending: Array<{ reject: (reason?: unknown) => void; resolve: () => void }> = [];
  const api = {
    arrayEdit: vi.fn(() => new Promise<void>((resolve, reject) => { pending.push({ resolve, reject }); })),
  } as unknown as AuthApi;
  return { api, pending };
}

function signedIn(api: AuthApi, favs: number[] = []) {
  useAuthStore.getState().set({
    ready: true, enabled: true, status: 'ok', favs, api,
    user: { uid: 'u1', email: 'a@b.c', displayName: 'a' } as never,
  });
}

describe('useFavs 저장 실패 되돌리기', () => {
  it('앞 저장이 실패해도 뒤에 담은 것은 남는다', async () => {
    const { api, pending } = deferredApi();
    signedIn(api);
    const { result } = renderHook(() => useFavs());
    act(() => { result.current.toggle(25); });
    act(() => { result.current.toggle(6); });
    expect(useAuthStore.getState().favs).toEqual([6, 25]);
    await act(async () => { pending[0]!.reject(new Error('unavailable')); await Promise.resolve(); });
    expect(useAuthStore.getState().favs).toEqual([6]);   // 피카츄만 빠진다
    await act(async () => { pending[1]!.resolve(); await Promise.resolve(); });
    expect(useAuthStore.getState().favs).toEqual([6]);
  });

  it('빼기가 실패하면 그 한 마리만 다시 들어온다', async () => {
    const { api, pending } = deferredApi();
    signedIn(api, [6, 25]);
    const { result } = renderHook(() => useFavs());
    act(() => { result.current.toggle(25); });   // 빼기
    act(() => { result.current.toggle(6); });    // 이어서 빼기
    expect(useAuthStore.getState().favs).toEqual([]);
    await act(async () => { pending[0]!.reject(new Error('permission-denied')); await Promise.resolve(); });
    expect(useAuthStore.getState().favs).toEqual([25]);  // 리자몽 빼기는 그대로, 피카츄만 돌아온다
  });
});
