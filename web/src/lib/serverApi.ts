// ─────────────────────────────────────────────────────────────────────────────
// lib/serverApi.ts — 우리 서버와 말하는 **유일한 자리** (v5 Phase 6/7)
//
// Firebase SDK 와 Firestore 문서를 걷어낸 자리다. 전에는 화면이 `setDoc('allowlist/{email}')`
// 처럼 문서를 직접 썼다 — 그건 보안 규칙이 이메일로만 문서를 찾을 수 있어서 생긴 모양이지
// 뜻이 아니었다. 이제는 뜻대로 부른다 (server/AUTH.md).
//
// **액세스 토큰은 메모리에만 둔다.** localStorage 에 두면 XSS 하나로 통째로 나간다.
// 새로고침하면 사라지는데, 그래도 되는 이유는 httpOnly 리프레시 쿠키가 남아 있어
// `refresh()` 한 번이면 되돌아오기 때문이다.
//
// **401 을 한 번만 되받는다.** 만료면 갱신하고 다시 보낸다. 두 번째도 401 이면 진짜 끊긴 것이다 —
// 무한히 되받으면 서버가 죽었을 때 브라우저가 스스로를 때린다.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'pending' | 'approved' | 'admin' | 'root';

export interface Me {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
  beta: boolean;
}

export interface Trainer { name: string; code: string; sortOrder: number }

export interface AdminUser extends Me {
  createdAt: string;
  lastSeenAt: string | null;
}

/** 루트 통계 화면이 받는 모양 — server/src/routes/stats.ts 의 STATS_REPLY 와 같다 */
export interface StatRanked { key: string; hits: number; visitors: number }
export interface StatDay { day: string; hits: number; visitors: number }
export interface StatEvents {
  hits: number;
  visitors: number;
  perDay: StatDay[];
  top: StatRanked[];
  surfaces: StatRanked[];
  countries: StatRanked[];
}
export interface Ga4Row { key: string; views: number; users: number }
export type Ga4Stats =
  | { status: 'off' | 'error'; reason: string }
  | {
    status: 'ok';
    users: number;
    newUsers: number;
    views: number;
    sessions: number;
    perDay: { day: string; users: number; views: number; sessions: number }[];
    pages: Ga4Row[];
    countries: Ga4Row[];
  };
export interface AdminStats {
  generatedAt: string;
  days: number;
  users: {
    total: number; pending: number; approved: number; admin: number; root: number; beta: number;
    active1d: number; active7d: number; active30d: number;
    newPerDay: { day: string; count: number }[];
  };
  sessions: { active: number };
  favorites: { total: number; people: number; top: { dex: number; users: number }[] };
  search: StatEvents;
  views: StatEvents;
  ga4: Ga4Stats;
}

export interface Session { access: string; expiresIn: number; role: Role; beta: boolean }

/** 서버 주소. 안 주면 로그인 기능이 통째로 꺼진다 (빌드마다 다를 수 있다) */
const API = (process.env['NEXT_PUBLIC_API_URL'] ?? '').replace(/\/+$/, '');

export const authEnabled = (): boolean => API !== '';

/** 실패를 삼키지 않는다 — '없다' 와 '못 읽었다' 는 화면에서 정반대다 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly reason: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let access = '';

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    // 리프레시 쿠키가 실려 가야 한다. 서버의 허용 주소 목록이 이것을 받아 준다
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(access ? { authorization: `Bearer ${access}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function fail(response: Response): Promise<never> {
  let reason = '';
  let message = `요청이 실패했습니다 (${response.status})`;
  try {
    const body = (await response.json()) as { error?: string; reason?: string };
    reason = body.reason ?? '';
    if (body.error) message = body.error;
  } catch { /* 본문이 JSON 이 아닌 경우 — 상태 코드만으로 충분하다 */ }
  throw new ApiError(response.status, reason, message);
}

/** 리프레시 쿠키로 액세스 토큰을 받아 온다. 없으면 null — 로그인 전이라는 뜻이다 */
export async function refresh(): Promise<Session | null> {
  if (!authEnabled()) return null;
  const response = await raw('/v1/auth/refresh', { method: 'POST' });
  if (response.status === 401) { access = ''; return null; }
  if (!response.ok) return fail(response);
  const session = (await response.json()) as Session;
  access = session.access;
  return session;
}

/** 토큰을 달고 부른다. 만료면 **한 번만** 갱신하고 다시 보낸다 */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!authEnabled()) throw new ApiError(0, 'disabled', '이 빌드는 로그인이 꺼져 있습니다');
  let response = await raw(path, init);
  if (response.status === 401) {
    const session = await refresh();
    if (!session) return fail(response);
    response = await raw(path, init);
  }
  if (!response.ok) return fail(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const serverApi = {
  /**
   * 구글 로그인으로 보낸다. **팝업이 아니라 최상위 이동이다** — 서버가 쿠키를 심어야 하고,
   * 쿠키는 팝업 창에서 심으면 부모 창이 모른다
   */
  signIn(next = '/'): void {
    if (!authEnabled()) return;
    // 어느 화면에서 시작했는지도 넘긴다 — dev 에서 누르면 dev 로 돌아와야 한다.
    // 서버가 ALLOWED_ORIGINS 로 거르므로 여기서 값을 꾸며도 밖으로는 못 나간다
    const app = encodeURIComponent(window.location.origin);
    window.location.assign(`${API}/v1/auth/google/start?next=${encodeURIComponent(next)}&app=${app}`);
  },

  refresh,
  hasToken: () => access !== '',

  me: () => call<Me>('/v1/me'),

  async logout(): Promise<void> {
    access = '';
    if (!authEnabled()) return;
    // 쿠키를 지우는 일이라 토큰이 없어도 부른다
    await raw('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
  },

  logoutAll: () => call<void>('/v1/auth/logout-all', { method: 'POST' }),

  async deleteAccount(): Promise<void> {
    await call<void>('/v1/me', { method: 'DELETE' });
    access = '';
  },

  favorites: () => call<{ favorites: number[]; cap: number }>('/v1/me/favorites'),
  addFavorite: (dex: number) => call<void>(`/v1/me/favorites/${dex}`, { method: 'PUT' }),
  removeFavorite: (dex: number) => call<void>(`/v1/me/favorites/${dex}`, { method: 'DELETE' }),

  trainers: async () => (await call<{ trainers: Trainer[] }>('/v1/trainers')).trainers,
  putTrainer: (name: string, code: string, sortOrder = 0) =>
    call<void>(`/v1/trainers/${encodeURIComponent(name)}`, { method: 'PUT', ...json({ code, sortOrder }) }),
  removeTrainer: (name: string) =>
    call<void>(`/v1/trainers/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  /** 루트 통계 (2026-09-24) — 모아 센 값만 온다. 기간 7~90일 */
  adminStats: (days: number) => call<AdminStats>(`/v1/admin/stats?days=${days}`),

  listUsers: async () => (await call<{ users: AdminUser[] }>('/v1/admin/users')).users,
  setRole: (id: string, change: { role?: Role; beta?: boolean }) =>
    call<void>(`/v1/admin/users/${id}`, { method: 'PATCH', ...json(change) }),
};
