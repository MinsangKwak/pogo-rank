// ─────────────────────────────────────────────────────────────────────────────
// components/AuthBridge.tsx — 로그인 설정을 받아 판정을 시작한다
//
// SDK 는 **첫 화면을 그린 뒤에** 받는다 (lib/authApi.ts 의 동적 import).
// 로그인은 티어표를 보는 데 필요한 기능이 아니라, 첫 그림을 늦출 이유가 없다.
// 그리는 것은 없다 — 상태만 잇는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useMeta } from '../lib/data';
import { getAuthApi } from '../lib/authApi';
import { applyUser, authEmail, useAuthStore } from '../stores/auth';
import { termsAccepted, TERMS_VER } from '../lib/terms';
import { useFavStore } from '../stores/favs';
import { usePrefStore, type Theme } from '../stores/pref';

export default function AuthBridge() {
  const { data: meta } = useMeta();
  useEffect(() => {
    const enabled = !!meta.FIREBASE_CONFIG?.['apiKey'];
    useAuthStore.getState().set({ enabled });
    if (!enabled) { useAuthStore.getState().set({ status: 'anon' }); return; }
    let alive = true;
    void getAuthApi(meta.FIREBASE_CONFIG, meta.ADMIN_UID).then((api) => {
      if (!alive) return;
      useAuthStore.getState().set({ api, ready: true });
      api.onUser((user) => {
        void applyUser(api, user, meta.ADMIN_UID, meta.ADMIN_EMAIL, termsAccepted() ? TERMS_VER : '')
          .then(() => syncAccount(api, user));
      });
    }).catch(() => {
      // SDK 를 못 받아도 앱은 그대로 돈다 — 로그인만 안 될 뿐이다
      useAuthStore.getState().set({ status: 'anon' });
    });
    return () => { alive = false; };
  }, [meta]);
  return null;
}

/**
 * 로그인 뒤 한 번 — 이 기기에 있던 것을 계정과 맞춘다.
 *   ★   이 기기 목록을 계정에 **합친다**. 사라지면 "로그인했더니 없어졌다" 가 된다
 *   테마 계정에 저장해 둔 값이 이 기기 값보다 우선한다 (마지막으로 고른 값이 계정에 있다)
 */
async function syncAccount(api: Awaited<ReturnType<typeof getAuthApi>>, user: { uid: string } | null) {
  if (!user) return;
  const state = useAuthStore.getState();
  if (state.status !== 'ok' && state.status !== 'pending') return;
  const doc = await api.getDoc(`users/${user.uid}`);
  // 첫 로그인이면 빈 문서를 만들어 둔다 — 이후 ★ 갱신이 merge 로 늘 성공하도록 (v3 loadFavs 와 같다)
  if (!doc) await api.setDoc(`users/${user.uid}`, { email: authEmail(), name: state.user?.displayName ?? '', favs: [] }).catch(() => {});
  const saved = doc?.['theme'];
  if (saved === 'system' || saved === 'light' || saved === 'dark') {
    usePrefStore.getState().setTheme(saved as Theme, { sync: false });
  }
  const device = useFavStore.getState().favs;
  if (!device.length) return;
  const merged = [...new Set([...state.favs, ...device])].sort((a, b) => a - b);
  await api.setDoc(`users/${user.uid}`, { favs: merged });
  useAuthStore.getState().set({ favs: merged });
  useFavStore.getState().clear();   // 옮겼으니 이 기기 목록은 비운다 (두 곳이 어긋나지 않게)
}
