// ─────────────────────────────────────────────────────────────────────────────
// stores/auth.ts — 로그인 상태 (v5 Phase 6/7 에 Firebase 를 걷어냈다)
//
// 상태 넷을 지나간다 — **이름은 그대로다.** GA 지표가 이 글자를 쓴다 (CLAUDE.md §2)
//   anon     로그인 전
//   loading  이 기기에 로그인 자취가 있는데 아직 확인 전 — 여기서 로그인 버튼을 내밀면
//            "새로고침했더니 로그아웃됐다" 로 읽힌다. 실제로는 곧 돌아온다
//   pending  로그인은 됐지만 아직 승인 전
//   ok       승인됐거나 관리자
//
// **판정을 화면이 안 한다.** 전에는 allowlist 문서를 읽어 화면이 스스로 판정했고, 규칙과
// 어긋나면 눌리는 버튼이 permission-denied 로 실패했다. 이제는 서버가 `role` 하나를 주고
// 화면은 그것을 그린다 — 판정이 한 벌이다.
//
// **권한은 두 갈래다. 겹치지 않는다** (v4.0.1).
//   admin  운영을 돕는 자리 — 트레이너 코드
//   beta   먼저 써 보는 자리 — 실험 기능(내 포켓몬)
// 한 깃발로 둘을 다 열면 실험 기능을 열어 주려다 유저 목록까지 넘기게 된다.
//
// **다시 읽다 실패하면 올리지도 내리지도 않는다** (v4.2.0). 회선이 끊긴 것을 권한이 사라진
// 것으로 읽으면, 잘 쓰던 사람이 지하철에서 갑자기 쫓겨난다.
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { serverApi, authEnabled, ApiError, type Me, type Role } from '../lib/serverApi';
import { track } from '../lib/track';
import { safePath } from '../lib/loginPath';

export type AuthStatus = 'anon' | 'loading' | 'pending' | 'ok';

/** 브라우저가 로그인 쿠키를 들고 있는지는 스크립트가 못 본다(httpOnly) — 자취를 따로 남긴다 */
const TRACE_KEY = 'pogo_signed_in';

export function markSignedIn(on: boolean): void {
  try { if (on) localStorage.setItem(TRACE_KEY, '1'); else localStorage.removeItem(TRACE_KEY); }
  catch { /* 저장소를 막은 브라우저 — 그때는 매번 anon 에서 시작한다 */ }
}

function storedUser(): boolean {
  try { return localStorage.getItem(TRACE_KEY) === '1'; } catch { return false; }
}

export interface AuthUser { uid: string; email: string; displayName: string; photoURL: string }

interface AuthState {
  ready: boolean;          // 첫 확인이 끝났는가
  enabled: boolean;        // 이 빌드가 로그인을 켤 수 있는가 (NEXT_PUBLIC_API_URL)
  user: AuthUser | null;
  status: AuthStatus;
  role: Role | null;
  admin: boolean;
  adminRoot: boolean;
  beta: boolean;
  favs: number[];          // 계정에 담아 둔 번호 (화면은 번호순으로 읽는다)
  favCap: number;
  recheckError: string;    // 다시 읽다 실패했을 때 — 마지막 판정은 그대로 둔다
  set: (next: Partial<AuthState>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  enabled: authEnabled(),
  user: null,
  status: storedUser() ? 'loading' : 'anon',
  role: null,
  admin: false,
  adminRoot: false,
  beta: false,
  favs: [],
  favCap: 200,
  recheckError: '',
  set,
}));

export const authEmail = () => (useAuthStore.getState().user?.email ?? '').toLowerCase();

/** 로그인을 연다 — 지금 보던 자리로 돌아오게 */
export function signInNow(): void {
  const next = typeof window === 'undefined' ? '/' : safePath(`${window.location.pathname}${window.location.search}`);
  serverApi.signIn(next);
}

/** 담을 수 있는가 — **승인 대기도 담을 수 있다** (v3.60.0) */
export function favEnabled(): boolean {
  const { enabled, status } = useAuthStore.getState();
  return enabled && (status === 'ok' || status === 'pending');
}

const asUser = (me: Me): AuthUser => ({
  uid: me.id, email: me.email, displayName: me.name, photoURL: me.picture,
});

/** 서버가 준 사람을 화면의 상태로 옮긴다 */
function apply(me: Me, favs: number[], favCap: number): void {
  useAuthStore.getState().set({
    ready: true,
    user: asUser(me),
    status: me.role === 'pending' ? 'pending' : 'ok',
    role: me.role,
    admin: me.role === 'admin' || me.role === 'root',
    adminRoot: me.role === 'root',
    beta: me.beta,
    favs,
    favCap,
    recheckError: '',
  });
  markSignedIn(true);
}

export function applyAnon(): void {
  useAuthStore.getState().set({
    ready: true, user: null, status: 'anon', role: null,
    admin: false, adminRoot: false, beta: false, favs: [], recheckError: '',
  });
  markSignedIn(false);
}

/**
 * 첫 확인 — 쿠키가 있으면 토큰을 받아 오고 내 정보를 읽는다.
 * **담아 둔 것까지 같이 읽는다** — 없으면 '내 포켓몬' 이 열리긴 하는데 비어 있고,
 * 그것이 "담아 둔 게 날아갔다" 로 읽힌다
 */
export async function bootstrapAuth(): Promise<void> {
  if (!authEnabled()) { useAuthStore.getState().set({ ready: true, status: 'anon' }); return; }
  try {
    const session = await serverApi.refresh();
    if (!session) { applyAnon(); return; }
    const [me, favs] = await Promise.all([serverApi.me(), serverApi.favorites()]);
    apply(me, favs.favorites, favs.cap);
    track('login', { status: me.role === 'pending' ? 'pending' : 'ok' });
  } catch {
    // 회선 문제와 로그아웃을 구별할 수 없다 — 자취가 있으면 로그인된 것으로 두고 다시 본다
    useAuthStore.getState().set({ ready: true, recheckError: 'network' });
  }
}

/**
 * 권한만 다시 읽는다 — 화면으로 돌아왔을 때 (v4.2.0).
 * **실패하면 아무것도 바꾸지 않는다.** 마지막 판정을 그대로 두고 무슨 일이 있었는지만 남긴다
 */
export async function recheckAccess(): Promise<void> {
  const { user, enabled } = useAuthStore.getState();
  if (!enabled || !user) return;
  let me: Me;
  try {
    me = await serverApi.me();
  } catch (error) {
    // 401 은 진짜 끊긴 것이다 — 권한을 뺏겼거나 세션이 폐기됐다 (server/AUTH.md)
    if (error instanceof ApiError && error.status === 401) { applyAnon(); return; }
    useAuthStore.getState().set({ recheckError: error instanceof ApiError ? error.reason || 'error' : 'network' });
    return;
  }
  // 읽는 사이에 로그아웃했거나 다른 계정으로 바뀌었으면 그 판정을 덮지 않는다
  if (useAuthStore.getState().user?.uid !== user.uid) return;
  const was = useAuthStore.getState().status;
  const favs = useAuthStore.getState().favs;
  apply(me, favs, useAuthStore.getState().favCap);
  // 기다리던 사람이 방금 승인됐다면 ★ 도 다시 가져온다 — 상한이 달라졌을 수 있다
  if (was !== 'ok' && me.role !== 'pending') {
    const next = await serverApi.favorites().catch(() => null);
    if (next && useAuthStore.getState().user?.uid === user.uid) {
      useAuthStore.getState().set({ favs: next.favorites, favCap: next.cap });
    }
  }
}

export async function signOutNow(): Promise<void> {
  await serverApi.logout();
  applyAnon();
}
