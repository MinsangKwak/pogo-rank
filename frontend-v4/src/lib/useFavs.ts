// ─────────────────────────────────────────────────────────────────────────────
// lib/useFavs.ts — ★ 는 어디에 있는가
//
// **로그인하면 계정, 아니면 이 기기.** 담는 곳이 달라져도 화면이 하는 말은 같아야 한다.
//   로그인 전  이 브라우저(pogo_favs) — 로그인하는 순간 계정으로 합쳐 올린다 (AuthBridge syncAccount)
//   로그인 후  계정(users/{uid}.favs) — v3 가 쓰던 바로 그 문서·그 필드다
//
// 처음 승인 로그인할 때 이 기기의 ★ 를 계정으로 **한 번 합친다** — 담아 둔 것이 사라지면
// "로그인했더니 없어졌다" 가 된다 (v3 가 게스트 플래너 데이터를 옮기던 것과 같은 판단).
//
// 담긴 것은 늘 번호순이다. 담은 차례는 사람에게 뜻이 없고, 저장된 차례가 그대로 나오면
// 목록이 매번 달라 보인다.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from 'react';
import { useFavStore } from '../stores/favs';
import { favEnabled, useAuthStore } from '../stores/auth';
import { useInviteStore } from '../stores/invite';
import { track } from '../lib/track';

export function useFavs() {
  const device = useFavStore((s) => s.favs);
  const toggleDevice = useFavStore((s) => s.toggle);
  const status = useAuthStore((s) => s.status);
  const account = useAuthStore((s) => s.favs);
  const user = useAuthStore((s) => s.user);
  const api = useAuthStore((s) => s.api);
  const setAuth = useAuthStore((s) => s.set);

  const enabled = useAuthStore((s) => s.enabled);
  const onAccount = !!user && !!api && (status === 'ok' || status === 'pending');
  const favs = onAccount ? account : device;

  const toggle = useCallback((dex: number, from = '') => {
    const number = Number(dex);
    if (!Number.isFinite(number)) return;
    // 로그인할 길이 있는데 아직 안 했다면 **담지 말고 권한다** (v3 toggleFav 와 같다).
    // 조용히 이 기기에 담아 두면, 담을 수는 있는데 볼 화면(내 포켓몬)이 잠겨 있어 어디로도 가지 못한다
    if (enabled && !favEnabled()) { useInviteStore.getState().open(from || '즐겨찾기'); return; }
    if (!onAccount || !api || !user) { toggleDevice(number); return; }
    const on = !account.includes(number);
    // 화면을 먼저 바꾼다 — 저장은 뒤따라온다. 느린 회선에서 눌러도 반응이 있어야 한다
    const next = on ? [...account, number].sort((a, b) => a - b) : account.filter((one) => one !== number);
    setAuth({ favs: next });
    track('fav_toggle', { on: on ? 1 : 0, mon: number, from });   // v3 와 같은 이름·같은 값
    void api.arrayEdit(`users/${user.uid}`, 'favs', number, on).catch(() => {
      // 저장이 실패하면 화면도 되돌린다 — 담긴 것처럼 보이는데 안 담긴 상태가 가장 나쁘다.
      // **그 한 마리만** 되돌린다 (v4.7.0 WBS-199). 누를 때 복사해 둔 `account` 로 통째 되돌리면
      // 저장이 끝나기 전에 담은 다른 포켓몬까지 함께 사라진다 — 서버에는 남아 있는데 화면에서만 없어져
      // 새로고침하면 되살아나는 어긋남이 됐다. 바탕은 실패한 순간의 지금 값을 읽는다
      const now = useAuthStore.getState().favs;
      const back = on ? now.filter((one) => one !== number) : [...now, number].sort((a, b) => a - b);
      useAuthStore.getState().set({ favs: back });
    });
  }, [enabled, onAccount, api, user, account, setAuth, toggleDevice]);

  return { favs, has: (dex: number) => favs.includes(Number(dex)), toggle, onAccount, canFav: !onAccount || favEnabled() };
}
