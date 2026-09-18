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
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import type { AuthApi, AuthUser } from '../lib/authApi';
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
  requestError: string;    // 가입 요청(requests 문서) 쓰기가 실패했을 때의 코드
  api: AuthApi | null;
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
  requestError: '',
  api: null,
  set,
}));

export const authEmail = () => (useAuthStore.getState().user?.email ?? '').toLowerCase();

/** 담을 수 있는가 — **승인 대기도 담을 수 있다**. 담아 둘 것이 있어야 승인을 기다릴 이유도 생긴다 */
export function favEnabled(): boolean {
  const { enabled, status } = useAuthStore.getState();
  return enabled && (status === 'ok' || status === 'pending');
}

/** 로그인·로그아웃마다 — 상태를 다시 계산한다 (v3 onAuthChange) */
export async function applyUser(api: AuthApi, user: AuthUser | null, adminUid: string, adminEmail: string, consent: string) {
  const store = useAuthStore.getState();
  if (!user) {
    store.set({ user: null, status: 'anon', admin: false, adminRoot: false, beta: false, favs: [], requestError: '' });
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
  store.set({ user, status, admin: adminRoot || delegated, adminRoot, beta, favs });

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

/** 계정에 담아 둔 ★ — 번호순으로 읽는다 (담은 차례는 사람에게 뜻이 없다) */
export async function loadFavs(api: AuthApi, uid: string): Promise<number[]> {
  const doc = await api.getDoc(`users/${uid}`);
  const raw = Array.isArray(doc?.['favs']) ? (doc!['favs'] as unknown[]) : [];
  return raw.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
}
