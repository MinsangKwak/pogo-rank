// ─────────────────────────────────────────────────────────────────────────────
// services/auth.ts — 로그인·회전·폐기. **세션 표를 건드리는 일은 여기서만 한다.**
//
// Firebase Auth 가 하던 일을 가져온 자리다. 가져오면서 달라진 것 셋.
//
//   ① **권한이 한 칸이다.** Firestore 는 allowlist·requests 두 컬렉션으로 갈라 뒀는데,
//      그건 규칙이 이메일로만 문서를 찾을 수 있어서였다. 여기서는 users.role 하나다.
//   ② **잠금 방지 열쇠가 환경변수다.** 규칙 본문에 uid 를 박던 것을 ROOT_EMAIL 로 옮겼다.
//      전에는 고치려면 콘솔에 게시해야 했다 — 배포와 따로 도는 절차라 잊기 쉬웠다.
//   ③ **계정 삭제가 한 걸음이다.** Firestore 는 넷이었고 그중 allowlist 가 v4 에서 빠져
//      승인 목록에 이메일이 영영 남았다 (v4.9.7). 여기서는 on delete cascade 가 딸린 줄을 쓸어 간다.
//
// 모든 판정은 DB 안에서 한다 — 읽고 나서 고치는 사이에 남이 끼어들 틈을 안 만든다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';
import type { AccessTokens } from '../lib/jwt.ts';
import { newRefreshToken, hashRefresh } from '../lib/refresh.ts';
import type { Role } from '../lib/rbac.ts';

/** 구글이 id_token 으로 확인해 준 사람. **여기 오는 값은 이미 검증된 것이다** (lib/google.ts) */
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export interface Session {
  userId: string;
  role: Role;
  beta: boolean;
  access: string;
  refresh: string;
  refreshExpiresAt: Date;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
  beta: boolean;
}

export interface DeviceSession {
  id: string;
  userAgent: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * 거부의 이유. 넷을 가르는 까닭은 **프런트가 달리 움직여야** 하기 때문이다 —
 * expired 면 조용히 다시 로그인시키고, reuse 면 사용자에게 알린다
 */
export class AuthError extends Error {
  constructor(readonly reason: 'unknown' | 'expired' | 'revoked' | 'reuse' | 'conflict', message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthOptions {
  /** 이 주소로 로그인하면 언제나 루트다. 규칙에 uid 를 박던 자리를 대신한다 */
  rootEmail: string;
  /** 리프레시 수명(일). 기본 30 */
  refreshTtlDays?: number;
}

export interface Auth {
  signIn(profile: GoogleProfile, userAgent?: string): Promise<Session>;
  rotate(refreshToken: string, userAgent?: string): Promise<Session>;
  signOut(refreshToken: string): Promise<void>;
  signOutEverywhere(userId: string): Promise<void>;
  sessionsOf(userId: string): Promise<DeviceSession[]>;
  profileOf(userId: string): Promise<Profile | null>;
  deleteAccount(userId: string): Promise<void>;
}

const DEFAULT_REFRESH_TTL_DAYS = 30;
/** user_agent 칸의 check 와 같은 값 — 넘치면 DB 가 거부한다 */
const UA_MAX = 500;

interface UserRow { id: string; role: Role; beta: boolean }

/**
 * 그 오류가 이 제약의 유니크 위반인가.
 * postgres.js 는 오류를 그대로 올려 준다 — 23505 는 unique_violation 이다
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const it = error as { code?: unknown; constraint_name?: unknown };
  return it?.code === '23505' && it?.constraint_name === constraint;
}

export function makeAuth(sql: Sql, tokens: AccessTokens, options: AuthOptions): Auth {
  const rootEmail = options.rootEmail.trim().toLowerCase();
  const ttlDays = options.refreshTtlDays ?? DEFAULT_REFRESH_TTL_DAYS;

  /** 새 사슬로 액세스와 리프레시를 함께 낸다. 회전은 사슬을 이어받으므로 따로 쓴다 */
  async function issue(user: UserRow, userAgent: string): Promise<Session> {
    const refresh = newRefreshToken();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    // family_id 를 안 주면 DB 가 새 uuid 를 만든다 — 로그인마다 사슬이 따로 선다
    await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at, user_agent)
              values (${user.id}, ${hashRefresh(refresh)}, gen_random_uuid(),
                      ${expiresAt}, ${userAgent.slice(0, UA_MAX)})`;
    return {
      userId: user.id,
      role: user.role,
      beta: user.beta,
      access: await tokens.sign({ sub: user.id, role: user.role, beta: user.beta }),
      refresh,
      refreshExpiresAt: expiresAt,
    };
  }

  return {
    async signIn(profile, userAgent = '') {
      const email = profile.email.trim().toLowerCase();
      // **권한은 안 덮어쓴다.** upsert 가 role 까지 갈아엎으면 관리자가 로그인할 때마다 대기로 떨어진다.
      // 단 ROOT_EMAIL 은 예외다 — 끌어내려져 있어도 로그인에서 되돌아온다(잠금 방지)
      const isRoot = email === rootEmail;
      let user: UserRow | undefined;
      try {
        [user] = await sql<UserRow[]>`
          insert into users (google_sub, email, display_name, photo_url, role, last_seen_at)
          values (${profile.sub}, ${email}, ${profile.name}, ${profile.picture},
                  ${isRoot ? 'root' : 'pending'}, now())
          on conflict (google_sub) do update
             set email        = excluded.email,
                 display_name = excluded.display_name,
                 photo_url    = excluded.photo_url,
                 role         = case when ${isRoot} then 'root' else users.role end,
                 updated_at   = now(),
                 last_seen_at = now()
          returning id, role, beta`;
      } catch (error) {
        // **이메일이 이미 남의 줄에 있다.** 구글 이메일은 재사용될 수 있고(계정을 지웠다 다시
        // 만들면 주소는 같고 sub 는 다르다), 주소를 바꾸다 남의 주소와 부딪힐 수도 있다.
        //
        // 셋 중 거부를 고른다 —
        //   넘겨주면(옛 줄의 sub 를 갈아끼우면) 옛 계정의 담아 둔 것이 새 사람에게 간다.
        //   합치면 되돌릴 수 없다.
        //   거부는 막다른 길이지만 **사람이 풀 수 있는 막다른 길**이다(옛 계정을 지우면 된다)
        if (isUniqueViolation(error, 'users_email_key')) {
          throw new AuthError('conflict', '이 이메일은 다른 계정이 쓰고 있습니다');
        }
        throw error;
      }
      return issue(user!, userAgent);
    },

    async rotate(refreshToken, userAgent = '') {
      const hash = hashRefresh(refreshToken);

      // **거부를 트랜잭션 안에서 던지지 않는다.** 재사용을 잡으면 사슬을 끊는 update 를 하는데,
      // 그 자리에서 예외를 던지면 트랜잭션이 되감기며 **방금 끊은 것이 되살아난다.**
      // 검사가 그대로 잡았다 — 훔친 쪽이 최신 토큰으로 계속 쓸 수 있는 상태였다.
      // 그래서 판정을 값으로 돌려받아 **커밋된 뒤에** 던진다
      const outcome = await sql.begin(async (tx) => {
        const [row] = await tx<{
          id: string; user_id: string; family_id: string;
          used_at: Date | null; revoked_at: Date | null; expired: boolean;
          role: Role | null; beta: boolean | null;
        }[]>`
          select s.id, s.user_id, s.family_id, s.used_at, s.revoked_at,
                 s.expires_at < now() as expired, u.role, u.beta
            from sessions s
            left join users u on u.id = s.user_id
           where s.refresh_hash = ${hash}
             for update of s`;
        if (!row) return { fail: 'unknown', message: '모르는 토큰입니다' } as const;

        // **재사용.** 이미 회전된 것이 또 왔다 — 네트워크가 답을 잃었거나 누가 훔쳐 갔거나.
        // 구분할 방법이 없으므로 사슬 전체를 끊는다. 훔친 쪽만 조용히 사는 것보다 낫다
        if (row.used_at) {
          await tx`update sessions set revoked_at = now()
                    where family_id = ${row.family_id} and revoked_at is null`;
          return { fail: 'reuse', message: '이미 쓴 토큰입니다 — 이 로그인의 모든 토큰을 끊었습니다' } as const;
        }
        if (row.revoked_at) return { fail: 'revoked', message: '끊긴 토큰입니다' } as const;
        if (row.expired) return { fail: 'expired', message: '만료된 토큰입니다' } as const;
        // left join 이 비면 사람이 지워진 것이다. cascade 가 세션도 지우므로 보통은 안 오지만,
        // 줄이 남아 있는 어떤 경우에도 권한 없이 토큰을 내지 않는다
        if (!row.role) return { fail: 'unknown', message: '없는 사람입니다' } as const;

        // **쓴 표시는 조건부로 한다.** 같은 토큰이 동시에 둘 오면 하나만 이기게 한다 —
        // 둘 다 이기면 사슬이 갈라지고 그 뒤의 재사용 판정이 무의미해진다
        const marked = await tx`update sessions set used_at = now()
                                 where id = ${row.id} and used_at is null returning id`;
        if (!marked.length) return { fail: 'reuse', message: '이미 쓴 토큰입니다' } as const;

        const refresh = newRefreshToken();
        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
        await tx`insert into sessions (user_id, refresh_hash, family_id, expires_at, user_agent)
                 values (${row.user_id}, ${hashRefresh(refresh)}, ${row.family_id},
                         ${expiresAt}, ${userAgent.slice(0, UA_MAX)})`;

        // **권한은 지금 다시 읽은 것을 담는다.** 승인되자마자 다시 로그인하지 않아도
        // 한 번의 회전으로 반영되고, 뺏긴 권한도 같은 길로 따라 내려온다
        const beta = row.beta ?? false;
        return {
          fail: null,
          session: {
            userId: row.user_id,
            role: row.role,
            beta,
            access: await tokens.sign({ sub: row.user_id, role: row.role, beta }),
            refresh,
            refreshExpiresAt: expiresAt,
          },
        } as const;
      });

      if (outcome.fail) throw new AuthError(outcome.fail, outcome.message);
      return outcome.session;
    },

    async signOut(refreshToken) {
      // 없는 토큰이어도 조용히 끝낸다 — 이미 지워진 쿠키로 다시 누르는 일은 흔하다
      await sql`update sessions set revoked_at = now()
                 where refresh_hash = ${hashRefresh(refreshToken)} and revoked_at is null`;
    },

    async signOutEverywhere(userId) {
      await sql`update sessions set revoked_at = now()
                 where user_id = ${userId} and revoked_at is null`;
    },

    async sessionsOf(userId) {
      const rows = await sql<{ id: string; user_agent: string; issued_at: Date; expires_at: Date }[]>`
        select id, user_agent, issued_at, expires_at from sessions
         where user_id = ${userId} and revoked_at is null and used_at is null and expires_at > now()
         order by issued_at desc`;
      return rows.map((row) => ({
        id: row.id, userAgent: row.user_agent, issuedAt: row.issued_at, expiresAt: row.expires_at,
      }));
    },

    async profileOf(userId) {
      const [row] = await sql<{
        id: string; email: string; display_name: string; photo_url: string; role: Role; beta: boolean;
      }[]>`select id, email, display_name, photo_url, role, beta from users where id = ${userId}`;
      if (!row) return null;
      // 빈 값을 빈 글자로 내린다 — 화면이 `${undefined}` 를 찍는 일을 서버에서 막는다 (CLAUDE.md §1)
      return {
        id: row.id, email: row.email, name: row.display_name, picture: row.photo_url,
        role: row.role, beta: row.beta,
      };
    },

    async deleteAccount(userId) {
      // **줄 하나다.** sessions·favorites 는 on delete cascade 로 딸려 간다 —
      // 지우는 자리가 여럿이면 그중 하나가 조용히 빠진다 (v4.9.7 이 그랬다)
      await sql`delete from users where id = ${userId}`;
    },
  };
}
