// ─────────────────────────────────────────────────────────────────────────────
// routes/auth.ts — 로그인의 HTTP 자리. (v5 Phase 4)
//
// **브라우저는 토큰을 구경도 못 한다.** 리프레시는 httpOnly 쿠키에만 있고, 액세스 토큰은
// 갱신 요청의 **답 본문**으로만 나간다. 주소(`?token=…`)로 내보내면 브라우저 기록과
// 리퍼러와 서버 로그 셋에 한꺼번에 남는다 — 지울 수 없는 자리들이다.
//
// **그래서 콜백은 토큰을 안 준다.** 구글에서 돌아온 브라우저에는 쿠키만 심고 앱으로 보낸다.
// 앱이 그 쿠키로 `POST /v1/auth/refresh` 를 한 번 불러 액세스 토큰을 받는다.
//
// 쿠키 이름에 `moncamp_` 를 붙인다 — v3 부터 쓰던 `pogo_*` 는 브라우저에 이미 들어 있어
// 건드리면 남의 데이터가 끊긴다 (CLAUDE.md §2). 새로 만드는 것은 접두사로 가른다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
// 타입만 들여온다 — @fastify/cookie 가 request.cookies 와 reply.setCookie 를 선언에 얹는다
import type {} from '@fastify/cookie';
import type { Env } from '../env.ts';
import type { Role } from '../lib/rbac.ts';
import { AuthError, type Auth } from '../services/auth.ts';
import { GoogleError, newVerifier, challengeOf, randomToken, type GoogleOAuth } from '../lib/google.ts';
import { LOGIN_COOKIE, safePath, type LoginStateCodec } from '../lib/loginState.ts';

export const REFRESH_COOKIE = 'moncamp_refresh';
/** 리프레시가 실려 갈 자리를 좁힌다 — 화면을 그리는 요청마다 따라다닐 이유가 없다 */
const REFRESH_PATH = '/v1/auth';
const REFRESH_DAYS = 30;

export interface AuthRouteDeps {
  auth: Auth;
  google: GoogleOAuth;
  login: LoginStateCodec;
  requireRole: (min: Role) => preHandlerHookHandler;
  env: Env;
}

/** 길이가 다르면 timingSafeEqual 이 던진다 — 길이부터 본다 */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 답 스키마를 손으로 적는다 — 칸 없는 object 는 값이 있어도 `{}` 로 나간다 (CLAUDE.md §3) */
const SESSION_REPLY = {
  type: 'object',
  properties: {
    access: { type: 'string', description: '액세스 토큰. 메모리에만 두고 저장소에 안 담는다' },
    expiresIn: { type: 'integer', description: '초' },
    role: { type: 'string', enum: ['pending', 'approved', 'admin', 'root'] },
    beta: { type: 'boolean' },
  },
  required: ['access', 'expiresIn', 'role', 'beta'],
} as const;

const ERROR_REPLY = {
  type: 'object',
  properties: { error: { type: 'string' }, reason: { type: 'string' } },
  required: ['error'],
} as const;

const PROFILE_REPLY = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    picture: { type: 'string' },
    role: { type: 'string', enum: ['pending', 'approved', 'admin', 'root'] },
    beta: { type: 'boolean' },
  },
  required: ['id', 'email', 'name', 'picture', 'role', 'beta'],
} as const;

export function authRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const { auth, google, login, requireRole, env } = deps;
  const secure = env.nodeEnv === 'production';

  const cookieBase = {
    httpOnly: true,
    // **Lax 다.** 구글에서 돌아오는 것은 최상위 이동이라 Lax 로도 실려 온다.
    // moncamp.kr 과 api.moncamp.kr 은 같은 사이트라 앱의 요청에도 따라온다.
    // None 은 CSRF 를 스스로 열어 주는 값이라 안 쓴다
    sameSite: 'lax' as const,
    secure,
    path: REFRESH_PATH,
  };

  /**
   * 돌아갈 화면을 고른다 — **허용 목록에 글자 그대로 있을 때만** 그쪽이다.
   * 접두사·포함으로 견주면 `https://dev.moncamp.kr.evil.test` 가 통과한다. 아니면 기본 화면(APP_ORIGIN)
   */
  const originOf = (raw: string | undefined) =>
    raw && env.allowedOrigins.includes(raw) ? raw : env.auth.appOrigin;

  /** 앱 안으로만 보낸다 — 밖으로 보내면 열린 리다이렉트다 (loginState.safePath · originOf) */
  const backToApp = (next: string, origin: string | undefined, error?: string) => {
    const url = new URL(safePath(next), originOf(origin));
    if (error) url.searchParams.set('login', error);
    return url.toString();
  };

  // ── 시작 ─────────────────────────────────────────────────────────────────
  app.get('/v1/auth/google/start', {
    schema: {
      tags: ['인증'],
      summary: '구글 로그인 화면으로 보낸다',
      querystring: {
        type: 'object',
        properties: {
          next: { type: 'string', description: '마치고 돌아갈 앱 안의 경로' },
          app: { type: 'string', description: '로그인을 시작한 화면의 origin. ALLOWED_ORIGINS 밖이면 기본 화면으로 돌아간다' },
        },
      },
      response: { 302: { description: '구글로', type: 'null' } },
    },
  }, async (request, reply) => {
    const { next, app: from } = request.query as { next?: string; app?: string };
    const state = randomToken();
    const nonce = randomToken();
    const verifier = newVerifier();

    const sealed = await login.seal({ state, nonce, verifier, next: safePath(next), origin: originOf(from) });
    reply.setCookie(LOGIN_COOKIE, sealed, { ...cookieBase, maxAge: login.ttlSeconds });
    return reply.redirect(google.authorizeUrl({ state, nonce, codeChallenge: challengeOf(verifier) }), 302);
  });

  // ── 돌아오는 자리 ────────────────────────────────────────────────────────
  app.get('/v1/auth/google/callback', {
    schema: {
      tags: ['인증'],
      summary: '구글이 인가 코드를 돌려주는 자리',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          state: { type: 'string' },
          error: { type: 'string', description: '사용자가 구글 화면에서 취소하면 온다' },
        },
      },
      response: { 302: { description: '앱으로', type: 'null' } },
    },
  }, async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const sealed = request.cookies[LOGIN_COOKIE];
    const pending = sealed ? await login.open(sealed) : null;
    // 쓰든 못 쓰든 지운다 — 한 번 쓰고 버리는 값이다
    reply.clearCookie(LOGIN_COOKIE, cookieBase);

    const next = pending?.next ?? '/';
    const origin = pending?.origin;
    if (query.error) return reply.redirect(backToApp(next, origin, 'cancelled'), 302);
    // 쿠키가 없거나 만료됐다. 구글 화면에서 10분 넘게 머물렀거나 다른 브라우저로 돌아왔다
    if (!pending) return reply.redirect(backToApp(next, origin, 'expired'), 302);
    // **state 를 견준다.** 남이 자기 인가 코드를 남의 브라우저에 밀어 넣는 로그인 CSRF 를 막는다
    if (!query.state || !sameSecret(query.state, pending.state)) {
      return reply.redirect(backToApp(next, origin, 'state'), 302);
    }
    if (!query.code) return reply.redirect(backToApp(next, origin, 'nocode'), 302);

    try {
      const profile = await google.exchange(query.code, pending.verifier, pending.nonce);
      const session = await auth.signIn(profile, request.headers['user-agent'] ?? '');
      reply.setCookie(REFRESH_COOKIE, session.refresh, { ...cookieBase, maxAge: REFRESH_DAYS * 86400 });
      // **토큰을 주소에 안 싣는다.** 앱이 쿠키로 갱신을 한 번 불러 받아 간다
      return reply.redirect(backToApp(next, origin), 302);
    } catch (error) {
      if (error instanceof GoogleError) return reply.redirect(backToApp(next, origin, error.reason), 302);
      if (error instanceof AuthError) return reply.redirect(backToApp(next, origin, error.reason), 302);
      app.log.error({ error }, '로그인 처리 실패');
      return reply.redirect(backToApp(next, origin, 'error'), 302);
    }
  });

  // ── 갱신 ─────────────────────────────────────────────────────────────────
  app.post('/v1/auth/refresh', {
    schema: {
      tags: ['인증'],
      summary: '리프레시 쿠키로 액세스 토큰을 받는다',
      response: { 200: SESSION_REPLY, 401: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE] ?? '';
    if (!token) return reply.code(401).send({ error: '로그인이 필요합니다', reason: 'missing' });

    try {
      const session = await auth.rotate(token, request.headers['user-agent'] ?? '');
      reply.setCookie(REFRESH_COOKIE, session.refresh, { ...cookieBase, maxAge: REFRESH_DAYS * 86400 });
      return reply.send({
        access: session.access,
        expiresIn: 900,
        role: session.role,
        beta: session.beta,
      });
    } catch (error) {
      // 못 쓰는 쿠키는 지운다 — 남겨 두면 브라우저가 계속 같은 값을 들고 와 401 을 반복한다
      reply.clearCookie(REFRESH_COOKIE, cookieBase);
      const reason = error instanceof AuthError ? error.reason : 'invalid';
      return reply.code(401).send({ error: '다시 로그인해 주세요', reason });
    }
  });

  // ── 로그아웃 ─────────────────────────────────────────────────────────────
  app.post('/v1/auth/logout', {
    schema: {
      tags: ['인증'],
      summary: '이 기기의 로그인을 끊는다',
      response: { 204: { description: '끊었다', type: 'null' } },
    },
  }, async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    // 없는 토큰이어도 조용히 끝낸다 — 이미 지워진 쿠키로 다시 누르는 일은 흔하다
    if (token) await auth.signOut(token);
    reply.clearCookie(REFRESH_COOKIE, cookieBase);
    return reply.code(204).send();
  });

  app.post('/v1/auth/logout-all', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['인증'],
      summary: '모든 기기의 로그인을 끊는다',
      security: [{ accessToken: [] }],
      response: { 204: { description: '끊었다', type: 'null' }, 401: ERROR_REPLY },
    },
  }, async (request, reply) => {
    await auth.signOutEverywhere(request.claims!.sub);
    reply.clearCookie(REFRESH_COOKIE, cookieBase);
    return reply.code(204).send();
  });

  app.get('/v1/auth/sessions', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['인증'],
      summary: '어디서 로그인했는지 — IP 는 담지 않는다 (CLAUDE.md §3)',
      security: [{ accessToken: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userAgent: { type: 'string' },
                  issuedAt: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
                required: ['id', 'userAgent', 'issuedAt', 'expiresAt'],
              },
            },
          },
          required: ['sessions'],
        },
        401: ERROR_REPLY,
      },
    },
  }, async (request, reply) => {
    const rows = await auth.sessionsOf(request.claims!.sub);
    return reply.send({
      sessions: rows.map((row) => ({
        id: row.id,
        userAgent: row.userAgent,
        issuedAt: row.issuedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
    });
  });

  // ── 나 ───────────────────────────────────────────────────────────────────
  app.get('/v1/me', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['인증'],
      summary: '내 정보',
      security: [{ accessToken: [] }],
      response: { 200: PROFILE_REPLY, 401: ERROR_REPLY, 404: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const profile = await auth.profileOf(request.claims!.sub);
    // 토큰은 멀쩡한데 사람이 없다 — 계정을 지운 뒤 남은 토큰이다
    if (!profile) return reply.code(404).send({ error: '없는 사람입니다', reason: 'gone' });
    return reply.send(profile);
  });

  app.delete('/v1/me', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['인증'],
      summary: '계정을 지운다 — 세션과 담아 둔 것이 같이 사라진다',
      security: [{ accessToken: [] }],
      response: { 204: { description: '지웠다', type: 'null' }, 401: ERROR_REPLY },
    },
  }, async (request, reply) => {
    await auth.deleteAccount(request.claims!.sub);
    reply.clearCookie(REFRESH_COOKIE, cookieBase);
    return reply.code(204).send();
  });
}
