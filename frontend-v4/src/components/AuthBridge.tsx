// ─────────────────────────────────────────────────────────────────────────────
// components/AuthBridge.tsx — 로그인 설정을 받아 판정을 시작한다
//
// SDK 는 **첫 화면을 그린 뒤에** 받는다 (lib/authApi.ts 의 동적 import).
// 로그인은 티어표를 보는 데 필요한 기능이 아니라, 첫 그림을 늦출 이유가 없다.
// 그리는 것은 없다 — 상태만 잇는다.
//
// **언제 받는지는 이 기기에 로그인 자취가 있는가로 갈린다** (2026-09-18).
//   자취 있음  바로 받는다. 판정이 끝나야 화면이 열리고, 기다리는 동안 'loading' 이다
//   자취 없음  브라우저가 한가해질 때 받는다. Firebase 는 gzip 으로도 220KB 가 넘어,
//              티어표만 보러 온 사람의 첫 화면과 대역폭을 다투게 두면 그만큼 늦어진다
// 받는 **시점**만 미룬다 — 받고 나면 하는 일은 같아서, 로그인 버튼을 누르는 자리는
// 한 줄도 안 바뀐다. (아예 안 받으려면 signIn 을 부르는 여덟 곳을 모두 고쳐야 한다)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { useMeta } from '../lib/data';
import { getAuthApi } from '../lib/authApi';
import type { AuthApi } from '../lib/authApi';
import { applyUser, authEmail, recheckAccess, useAuthStore } from '../stores/auth';
import { termsAccepted, TERMS_VER } from '../lib/terms';
import { usePrefStore, type Theme } from '../stores/pref';

/** 이 기기에 로그인 자취가 있는가 — Firebase 는 로그인 사용자를 이 접두사로 남긴다 */
function authTrace(): boolean {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      if ((localStorage.key(index) || '').startsWith('firebase:authUser:')) return true;
    }
  } catch { /* 저장소를 막은 브라우저 — 그때는 어차피 로그인이 안 남는다 */ }
  return false;
}

export default function AuthBridge() {
  const { data: meta } = useMeta();
  useEffect(() => {
    const enabled = !!meta.FIREBASE_CONFIG?.['apiKey'];
    useAuthStore.getState().set({ enabled });
    if (!enabled) { useAuthStore.getState().set({ status: 'anon' }); return; }

    let alive = true;
    // 두 번 불러도 한 번만 받는다 — 한가할 때와 로그인 버튼이 같은 손잡이를 쓴다
    let pending: Promise<AuthApi | null> | null = null;
    const start = () => {
      pending ??= getAuthApi(meta.FIREBASE_CONFIG, meta.ADMIN_UID).then((api) => {
        if (!alive) return null;
        useAuthStore.getState().set({ api, ready: true });
        api.onUser((user) => {
          void applyUser(api, user, meta.ADMIN_UID, meta.ADMIN_EMAIL, termsAccepted() ? TERMS_VER : '')
            .then(() => syncAccount(api, user));
        });
        return api;
      }).catch(() => {
        // SDK 를 못 받아도 앱은 그대로 돈다 — 로그인만 안 될 뿐이다
        useAuthStore.getState().set({ status: 'anon' });
        return null;
      });
      return pending;
    };
    // 손잡이는 **바로** 꽂는다. 받는 것은 미뤄도, 누르면 받아 올 길은 처음부터 있어야 한다
    useAuthStore.getState().set({ start });

    if (authTrace()) { void start(); return () => { alive = false; }; }

    // 한가해질 때. requestIdleCallback 이 없는 브라우저(사파리 일부)는 타이머로 같은 자리에 둔다.
    // 타입 정의는 늘 있다고 보지만 실제로 없는 브라우저가 있다 — 있는지 직접 본다
    const idle = (window as { requestIdleCallback?: typeof window.requestIdleCallback }).requestIdleCallback;
    const id = idle ? idle(() => void start(), { timeout: 3000 }) : window.setTimeout(() => void start(), 1200);
    return () => {
      alive = false;
      if (idle) window.cancelIdleCallback?.(id as number); else clearTimeout(id as number);
    };
  }, [meta]);

  // 화면으로 돌아오면 권한을 다시 읽는다 (v4.2.0).
  // 승인을 내리거나 거둬도, 그 사람의 탭이 열려 있으면 판정은 로그인 때 읽은 그대로였다.
  // **너무 자주 읽지 않는다** — 탭을 오가는 것은 흔한 일이라, 한 번 읽으면 RECHECK_GAP 동안 쉰다
  useEffect(() => {
    let last = 0;
    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < RECHECK_GAP) return;
      last = now;
      void recheckAccess();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  return null;
}

/** 권한을 다시 읽는 사이 — 1분. 탭을 오가는 것은 흔하고, 승인은 그보다 훨씬 드물다 */
const RECHECK_GAP = 60_000;

/**
 * 로그인 뒤 한 번 — 이 기기에 있던 것을 계정과 맞춘다.
 *   테마 계정에 저장해 둔 값이 이 기기 값보다 우선한다 (마지막으로 고른 값이 계정에 있다)
 *
 * v4.2.0 에 ★ 합치기가 여기서 빠졌다 — 내 포켓몬을 접으면서 옮길 것이 없어졌다.
 */
async function syncAccount(api: Awaited<ReturnType<typeof getAuthApi>>, user: { uid: string } | null) {
  if (!user) return;
  const state = useAuthStore.getState();
  if (state.status !== 'ok' && state.status !== 'pending') return;
  const doc = await api.getDoc(`users/${user.uid}`);
  // 첫 로그인이면 빈 문서를 만들어 둔다 — 이 문서가 계정 설정(테마)이 앉는 자리다
  if (!doc) await api.setDoc(`users/${user.uid}`, { email: authEmail(), name: state.user?.displayName ?? '' }).catch(() => {});
  const saved = doc?.['theme'];
  if (saved === 'system' || saved === 'light' || saved === 'dark') {
    usePrefStore.getState().setTheme(saved as Theme, { sync: false });
  }
}
