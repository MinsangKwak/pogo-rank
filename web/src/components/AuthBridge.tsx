// ─────────────────────────────────────────────────────────────────────────────
// components/AuthBridge.tsx — 로그인 상태를 잇는다 (v5 Phase 6/7)
//
// **Firebase SDK 가 사라진 자리다.** 전에는 gzip 220KB 짜리 SDK 를 첫 그림 뒤에 받아 왔고,
// 그 지연 때문에 '자취가 있으면 바로 · 없으면 한가할 때' 같은 규칙이 필요했다.
// 이제는 `POST /v1/auth/refresh` 한 번이다 — 미룰 만큼 무거운 것이 없어 규칙도 없어졌다.
//
// 그리는 것은 없다. 상태만 잇는다.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useEffect } from 'react';
import { bootstrapAuth, recheckAccess, useAuthStore } from '../stores/auth';
import { serverApi } from '../lib/serverApi';
import { useFavStore } from '../stores/favs';

/**
 * 이 기기에 담아 둔 ★ 를 계정으로 **한 번 합친다.**
 * 담아 둔 것이 사라지면 "로그인했더니 없어졌다" 가 된다 (v3 가 게스트 플래너를 옮기던 판단).
 * 서버가 이미 가진 것은 다시 안 보낸다 — 같은 것을 또 담아도 한 번이지만, 왕복을 아낀다
 */
async function mergeDeviceFavs(): Promise<void> {
  const device = useFavStore.getState().favs;
  if (!device.length) return;
  const { favs } = useAuthStore.getState();
  const missing = device.filter((dex) => !favs.includes(dex));
  if (!missing.length) return;

  for (const dex of missing) {
    // 하나가 상한에 걸려도 나머지는 올린다 — 전부 포기하면 사람이 무엇이 올라갔는지 모른다
    await serverApi.addFavorite(dex).catch(() => undefined);
  }
  const next = await serverApi.favorites().catch(() => null);
  if (next) useAuthStore.getState().set({ favs: next.favorites, favCap: next.cap });
  useFavStore.getState().clear();
}

export default function AuthBridge() {
  useEffect(() => {
    let alive = true;
    void bootstrapAuth().then(() => {
      if (!alive) return;
      const { status } = useAuthStore.getState();
      if (status === 'ok' || status === 'pending') void mergeDeviceFavs();
    });

    // **화면으로 돌아오면 권한을 다시 본다** (v4.2.0). 승인을 내린 뒤에도 그 사람의 탭이
    // 열려 있으면 판정이 로그인 때 읽은 그대로라, 새로고침 전까지 옛 권한으로 남았다
    const onVisible = () => { if (document.visibilityState === 'visible') void recheckAccess(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return null;
}
