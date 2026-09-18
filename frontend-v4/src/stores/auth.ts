// ─────────────────────────────────────────────────────────────────────────────
// stores/auth.ts — 로그인 상태 (v3 components/auth.js 의 AUTH 를 옮긴 것)
//
// 상태 넷을 지나간다 (v3 와 같은 이름 — GA 지표가 이 글자를 쓴다)
//   anon     로그인 전
//   loading  이 기기에 로그인 자취가 있는데 SDK 가 아직 안 왔다 — 여기서 로그인 버튼을 내밀면
//            "새로고침했더니 로그아웃됐다" 로 읽힌다. 실제로는 곧 돌아온다
//   pending  로그인은 됐지만 아직 허용 목록에 없다 (가입 요청을 남기고 승인을 기다린다)
//   ok       허용 목록에 있거나 본인이 관리자
//
// **판정은 규칙과 같아야 한다.** 관리자는 ADMIN_UID(루트) 또는 allowlist 문서의 admin: true(위임) —
// 화면에서만 관리자로 보이고 규칙이 막으면 승인 버튼이 permission-denied 로 실패한다.
//
// **권한은 두 갈래다. 겹치지 않는다.**
//   admin  운영을 돕는 자리 — 유저 관리(승인된 사람 목록 · 트레이너 코드)
//   beta   먼저 써 보는 자리 — 실험 기능(내 포켓몬 · D-MAX [미구현])
// 운영을 돕는 사람과 먼저 써 보는 사람은 다르다. 한 깃발로 둘을 다 열면 실험 기능을
// 열어 주려다 유저 목록까지 넘기게 된다. 루트는 만든 사람이라 둘 다 켜져 있다.
//
// **권한은 탭으로 돌아올 때 다시 본다** (v4.2.0). 승인을 내린 뒤에도 그 사람의 탭이 열려 있으면
// 판정은 로그인 때 읽은 그대로라, 새로고침하기 전까지 화면이 예전 권한으로 남았다.
// 다시 읽다 실패하면 **올리지도 내리지도 않는다** — 회선이 끊긴 것을 권한이 사라진 것으로 읽으면,
// 잘 쓰던 사람이 지하철에서 갑자기 쫓겨난다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { AuthApi, AuthUser, DocData } from '../lib/authApi';
import { track } from '../lib/track';

export type AuthStatus = 'anon' | 'loading' | 'pending' | 'ok';

/**
 * 이 기기에 로그인 자취가 있는가 — SDK 를 받기 **전에** 동기로 본다.
 * Firebase 는 로그인 사용자를 'firebase:authUser:…' 키에 남긴다. 그 키가 있으면 새로고침해도
 * 로그인은 그대로이고, 판정이 끝날 때까지 'loading' 으로 그려야 한다 (v3 authStoredUser).
 */
function storedUser(): boolean {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      if ((localStorage.key(index) || '').startsWith('firebase:authUser:')) return true;
    }
  } catch { /* 저장소를 막은 브라우저 — 그때는 어차피 로그인이 안 남는다 */ }
  return false;
}

interface AuthState {
  ready: boolean;          // SDK 를 받아 판정을 시작할 수 있는가
  enabled: boolean;        // 이 빌드가 로그인을 켤 수 있는가 (FIREBASE_CONFIG.apiKey)
  user: AuthUser | null;
  status: AuthStatus;
  admin: boolean;
  adminRoot: boolean;
  beta: boolean;           // 실험 기능을 써 볼 수 있는가 (allowlist 문서의 beta: true · 루트는 항상)
  favs: number[];          // 계정에 담아 둔 도감번호 (화면은 번호순으로 읽는다)
  recheckError: string;    // 권한을 다시 읽다 실패했을 때의 코드 (마지막 판정은 그대로 둔다)
  requestError: string;    // 가입 요청(requests 문서) 쓰기가 실패했을 때의 코드
  api: AuthApi | null;
  /** SDK 를 지금 받아 오게 하는 손잡이 (AuthBridge 가 꽂는다). 두 번 불러도 한 번만 받는다 */
  start: (() => Promise<AuthApi | null>) | null;
  set: (next: Partial<AuthState>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  enabled: false,
  user: null,
  status: storedUser() ? 'loading' : 'anon',
  admin: false,
  adminRoot: false,
  beta: false,
  favs: [],
  recheckError: '',
  requestError: '',
  api: null,
  start: null,
  set,
}));

export const authEmail = () => (useAuthStore.getState().user?.email ?? '').toLowerCase();

/**
 * 로그인을 연다 — **SDK 가 아직 안 왔으면 받아 온 뒤에.**
 *
 * 왜 필요한가 — 로그아웃 상태에서는 '로그인 확인 중' 안내가 안 뜨고 버튼이 바로 보인다.
 * 그런데 SDK 는 첫 그림 뒤에 오므로, 그 사이에 누르면 `api` 가 없어 **아무 일도 안 일어났다.**
 * 눌러도 안 되는 버튼은 고장과 같다. 여기서 받아 오고 열면 언제 눌러도 열린다.
 *
 * 기다렸다 열면 브라우저가 팝업을 막을 수 있지만, signIn 이 막히면 리다이렉트로 넘어간다
 * (lib/authApi.ts) — 창이 뜨는 대신 화면이 넘어갈 뿐, 로그인은 된다.
 */
export async function signInNow(): Promise<void> {
  const state = useAuthStore.getState();
  const api = state.api ?? (await state.start?.()) ?? null;
  await api?.signIn();
}

/** 담을 수 있는가 — **승인 대기도 담을 수 있다**. 담아 둘 것이 있어야 승인을 기다릴 이유도 생긴다 */
export function favEnabled(): boolean {
  const { enabled, status } = useAuthStore.getState();
  return enabled && (status === 'ok' || status === 'pending');
}

/** 로그인·로그아웃마다 — 상태를 다시 계산한다 (v3 onAuthChange) */
export async function applyUser(api: AuthApi, user: AuthUser | null, adminUid: string, adminEmail: string, consent: string) {
  const store = useAuthStore.getState();
  if (!user) {
    store.set({ user: null, status: 'anon', admin: false, adminRoot: false, beta: false, favs: [], recheckError: '', requestError: '' });
    return;
  }
  const email = user.email;
  // ADMIN_UID 가 채워져 있으면 uid 로 판정한다 (공개 저장소에 이메일을 남기지 않기 위함)
  const adminRoot = adminUid ? user.uid === adminUid : !!(adminEmail && email === adminEmail.toLowerCase());
  let approved = adminRoot;
  let delegated = false;
  // 루트는 만든 사람이라 실험 기능이 늘 켜져 있다 — 자기 자신에게 깃발을 달아 줄 자리가 없다
  let beta = adminRoot;
  if (!approved) {
    // 규칙상 본인 이메일 문서는 읽을 수 있다 — 있으면 승인된 사람, admin: true 면 위임 관리자
    const doc = await api.getDoc(`allowlist/${email}`);
    approved = !!doc;
    delegated = doc?.['admin'] === true;
    // **실험 기능은 관리자 권한을 따라가지 않는다** — 깃발이 따로 있어야 따로 줄 수 있다
    beta = doc?.['beta'] === true;
  }
  const status: AuthStatus = approved ? 'ok' : 'pending';
  let favs: number[] = [];
  if (approved) favs = await loadFavs(api, user.uid);
  store.set({ user, status, admin: adminRoot || delegated, adminRoot, beta, favs, recheckError: '' });

  // 계정 카드(본인 이메일 문서)를 로그인마다 갱신한다 — 이 문서가 곧 **가입 요청**이다.
  // 실패하면 조용히 넘기지 않는다: 본인은 '승인 대기 중' 을 보는데 관리자 화면에는 줄이 안 뜬다
  let requestError = '';
  try {
    await api.setDoc(`requests/${email}`, {
      email, name: user.displayName, photo: user.photoURL, uid: user.uid, status,
      ...(consent ? { consent } : {}),
    });
  } catch (error) {
    requestError = (error as { code?: string })?.code || String(error);
  }
  useAuthStore.getState().set({ requestError });
  track('login', { status });
}

/**
 * 권한만 다시 읽는다 — 화면으로 돌아왔을 때 (v4.2.0, components/AuthBridge.tsx).
 *
 * applyUser 와 **다른 함수인 까닭**: 저것은 로그인마다 하는 일이라 가입 요청 문서를 쓰고
 * GA 에 login 을 찍는다. 탭을 옮길 때마다 그것까지 하면 한 사람의 로그인이 하루에 수십 건이 된다.
 * 여기서는 읽기 한 번뿐이다.
 *
 * **실패하면 아무것도 바꾸지 않는다.** 규칙상 본인 문서 읽기는 늘 허용이라, 실패는 곧 회선 문제다.
 * 그것을 '승인이 풀렸다' 로 읽으면 잘 쓰던 사람이 화면에서 쫓겨난다 — 마지막 판정을 그대로 두고
 * 무슨 일이 있었는지만 남긴다 (recheckError).
 */
export async function recheckAccess(): Promise<void> {
  const { api, user, enabled, adminRoot } = useAuthStore.getState();
  if (!api || !user || !enabled) return;
  // 루트는 uid 로 판정한다 — 읽을 문서가 없으니 다시 읽을 것도 없다
  if (adminRoot) return;
  let doc: DocData | null;
  try {
    doc = await api.getDocStrict(`allowlist/${user.email}`);
  } catch (error) {
    useAuthStore.getState().set({ recheckError: (error as { code?: string })?.code || String(error) });
    return;
  }
  // 읽는 사이에 로그아웃했거나 다른 계정으로 바뀌었으면 그 판정을 덮지 않는다
  if (useAuthStore.getState().user?.uid !== user.uid) return;
  const was = useAuthStore.getState().status;
  useAuthStore.getState().set({
    status: doc ? 'ok' : 'pending',
    admin: doc?.['admin'] === true,
    beta: doc?.['beta'] === true,
    recheckError: '',
  });
  // 기다리던 사람이 방금 승인됐다면 ★ 도 가져온다 — 로그인 때는 승인 전이라 못 읽었다.
  // 안 채우면 '내 포켓몬' 이 열리긴 하는데 비어 있고, 그것이 "담아 둔 게 날아갔다" 로 읽힌다
  if (doc && was !== 'ok') {
    const favs = await loadFavs(api, user.uid).catch(() => null);
    if (favs && useAuthStore.getState().user?.uid === user.uid) useAuthStore.getState().set({ favs });
  }
}

/** 계정에 담아 둔 ★ — 번호순으로 읽는다 (담은 차례는 사람에게 뜻이 없다) */
export async function loadFavs(api: AuthApi, uid: string): Promise<number[]> {
  const doc = await api.getDoc(`users/${uid}`);
  const raw = Array.isArray(doc?.['favs']) ? (doc!['favs'] as unknown[]) : [];
  return raw.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
}
