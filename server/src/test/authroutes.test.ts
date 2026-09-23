// ─────────────────────────────────────────────────────────────────────────────
// authroutes.test.ts — 로그인의 HTTP 자리를 실제 요청으로 찌른다 (v5 Phase 4)
//
// app.inject() 라 포트를 안 연다. 구글만 가짜고 **나머지는 전부 진짜다** — 진짜 Postgres,
// 진짜 토큰, 진짜 쿠키. 가짜로 바꿀수록 검사가 재는 것이 줄어든다.
//
// 여기서 재는 것 넷
//   ① 토큰이 주소에 안 실린다 — 주소는 기록·리퍼러·로그 셋에 남고 지울 수 없다
//   ② 쿠키가 httpOnly 다 — 스크립트가 읽으면 XSS 하나로 세션이 통째로 나간다
//   ③ 앱 밖으로 안 보낸다 — 열린 리다이렉트
//   ④ 권한이 모자라면 403 이고 401 이 아니다 — 다시 로그인해도 달라지지 않는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { buildApp } from '../app.ts';
import { readEnv } from '../env.ts';
import { makeAccessTokens } from '../lib/jwt.ts';
import { makeRequireRole } from '../plugins/requireRole.ts';
import { GoogleError, type GoogleOAuth } from '../lib/google.ts';
import type { GoogleProfile } from '../services/auth.ts';
import { LOGIN_COOKIE } from '../lib/loginState.ts';
import { REFRESH_COOKIE } from '../routes/auth.ts';
import { testDatabaseUrl } from './dbUrl.ts';
import { TEST_AUTH_ENV } from './envFixture.ts';

const url = testDatabaseUrl();
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');
const APP = TEST_AUTH_ENV.APP_ORIGIN;

const env = readEnv({
  DATABASE_URL: url || 'postgres://u:p@localhost:5432/db',
  ALLOWED_ORIGINS: `${APP},https://dev.moncamp.kr`,
  NODE_ENV: 'test',
  RATE_LIMIT_PER_MINUTE: '1000',
  ...TEST_AUTH_ENV,
});
const tokens = makeAccessTokens(env.auth.jwtSecret);

/**
 * 구글 대신 답하는 자리. 다음 exchange 가 무엇을 낼지 검사가 정한다.
 *
 * **타입을 손으로 적는다.** 메서드 안에서 제 이름을 다시 부르므로(fakeGoogle.next),
 * 타입 추론이 제 꼬리를 문다 — TS7022. satisfies 만으로는 그 고리가 안 끊어진다
 */
const fakeGoogle: GoogleOAuth & { next: GoogleError | null; profile: GoogleProfile } = {
  next: null as null | GoogleError,
  profile: { sub: 'g-1', email: 'friend@example.test', name: '친구', picture: 'https://x.test/a.png' },
  authorizeUrl({ state }: { state: string }) {
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`;
  },
  async exchange() {
    if (fakeGoogle.next) throw fakeGoogle.next;
    return fakeGoogle.profile;
  },
};

let sql: Sql;
let app: FastifyInstance;

const cookieOf = (response: { cookies: unknown[] }, name: string) =>
  (response.cookies as { name: string; value: string; httpOnly?: boolean; sameSite?: string; path?: string }[])
    .find((one) => one.name === name);

/** 시작 → 콜백을 끝까지 밟아 리프레시 쿠키를 받아 온다 */
async function signIn(userAgent = 'vitest'): Promise<string> {
  const start = await app.inject({ method: 'GET', url: '/v1/auth/google/start?next=/dex' });
  const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
  const state = new URL(start.headers.location as string).searchParams.get('state')!;
  const back = await app.inject({
    method: 'GET',
    url: `/v1/auth/google/callback?code=the-code&state=${encodeURIComponent(state)}`,
    cookies: { [LOGIN_COOKIE]: sealed },
    headers: { 'user-agent': userAgent },
  });
  return cookieOf(back, REFRESH_COOKIE)!.value;
}

describe.skipIf(!url)('로그인 주소', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
    app = await buildApp(env, sql, { google: fakeGoogle, tokens });
    await app.ready();
  });
  afterAll(async () => { if (app) await app.close(); if (sql) await sql.end(); });
  beforeEach(async () => {
    await sql`delete from users`;
    fakeGoogle.next = null;
  });

  describe('시작', () => {
    it('구글로 보내고 로그인 쿠키를 심는다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/auth/google/start' });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('accounts.google.com');

      const cookie = cookieOf(response, LOGIN_COOKIE)!;
      // 이 쿠키에 PKCE 검증자가 들어 있다 — 페이지 스크립트가 읽으면 PKCE 가 무의미해진다
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite?.toLowerCase()).toBe('lax');
      // 화면을 그리는 요청마다 따라다닐 이유가 없다
      expect(cookie.path).toBe('/v1/auth');
    });

    it('state 가 주소와 쿠키 양쪽에 같이 들어간다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/auth/google/start' });
      const state = new URL(response.headers.location as string).searchParams.get('state');
      expect(state).toBeTruthy();
      expect(state!.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('돌아오는 자리', () => {
    it('제대로 밟으면 앱으로 보내고 리프레시 쿠키를 심는다', async () => {
      const start = await app.inject({ method: 'GET', url: '/v1/auth/google/start?next=/dex' });
      const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
      const state = new URL(start.headers.location as string).searchParams.get('state')!;

      const response = await app.inject({
        method: 'GET',
        url: `/v1/auth/google/callback?code=c&state=${encodeURIComponent(state)}`,
        cookies: { [LOGIN_COOKIE]: sealed },
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(`${APP}/dex`);
      const cookie = cookieOf(response, REFRESH_COOKIE)!;
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.value.length).toBeGreaterThanOrEqual(32);
    });

    it('★ 토큰이 주소에 안 실린다', async () => {
      // 주소는 브라우저 기록·리퍼러·서버 로그 셋에 남고, 셋 다 우리가 못 지운다
      const start = await app.inject({ method: 'GET', url: '/v1/auth/google/start' });
      const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
      const state = new URL(start.headers.location as string).searchParams.get('state')!;
      const response = await app.inject({
        method: 'GET',
        url: `/v1/auth/google/callback?code=c&state=${encodeURIComponent(state)}`,
        cookies: { [LOGIN_COOKIE]: sealed },
      });
      const location = response.headers.location as string;
      expect(location).not.toContain('token');
      expect(location).not.toContain(cookieOf(response, REFRESH_COOKIE)!.value);
    });

    it('★ 앱 밖으로 안 보낸다', async () => {
      // next 를 그대로 붙이면 로그인시킨 브라우저를 남의 사이트로 보낼 수 있다
      for (const next of ['https://evil.test', '//evil.test', '/\\evil.test']) {
        const start = await app.inject({ method: 'GET', url: `/v1/auth/google/start?next=${encodeURIComponent(next)}` });
        const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
        const state = new URL(start.headers.location as string).searchParams.get('state')!;
        const response = await app.inject({
          method: 'GET',
          url: `/v1/auth/google/callback?code=c&state=${encodeURIComponent(state)}`,
          cookies: { [LOGIN_COOKIE]: sealed },
        });
        expect(new URL(response.headers.location as string).origin, next).toBe(APP);
      }
    });

    // v5 Phase 7 — dev.moncamp.kr 에서 로그인하면 dev 로 돌아와야 한다.
    // 전에는 APP_ORIGIN 하나로만 보내서, dev 에서 로그인한 사람이 moncamp.kr(옛 화면)로 튕겨 나갔다
    it('로그인을 시작한 화면으로 돌아간다 (허용된 곳이면)', async () => {
      const DEV = 'https://dev.moncamp.kr';
      const start = await app.inject({ method: 'GET', url: `/v1/auth/google/start?next=/dex&app=${encodeURIComponent(DEV)}` });
      const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
      const state = new URL(start.headers.location as string).searchParams.get('state')!;
      const response = await app.inject({
        method: 'GET',
        url: `/v1/auth/google/callback?code=c&state=${encodeURIComponent(state)}`,
        cookies: { [LOGIN_COOKIE]: sealed },
      });
      expect(response.headers.location).toBe(`${DEV}/dex`);
    });

    it('★ 허용 목록 밖의 화면으로는 안 보낸다 — 기본 화면으로 간다', async () => {
      // app 을 그대로 믿으면 열린 리다이렉트다. ALLOWED_ORIGINS 가 문지기다
      for (const other of ['https://evil.test', 'https://dev.moncamp.kr.evil.test', 'javascript:alert(1)', 'https://dev.moncamp.kr/']) {
        const start = await app.inject({ method: 'GET', url: `/v1/auth/google/start?app=${encodeURIComponent(other)}` });
        const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
        const state = new URL(start.headers.location as string).searchParams.get('state')!;
        const response = await app.inject({
          method: 'GET',
          url: `/v1/auth/google/callback?code=c&state=${encodeURIComponent(state)}`,
          cookies: { [LOGIN_COOKIE]: sealed },
        });
        expect(new URL(response.headers.location as string).origin, other).toBe(APP);
      }
    });

    it('state 가 다르면 로그인이 안 된다', async () => {
      // 남이 자기 인가 코드를 남의 브라우저에 밀어 넣는 로그인 CSRF 가 이 자리로 들어온다
      const start = await app.inject({ method: 'GET', url: '/v1/auth/google/start' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/google/callback?code=c&state=someone-elses',
        cookies: { [LOGIN_COOKIE]: cookieOf(start, LOGIN_COOKIE)!.value },
      });
      expect(response.headers.location).toContain('login=state');
      expect(cookieOf(response, REFRESH_COOKIE)).toBeUndefined();
    });

    it('쿠키가 없으면 expired 로 돌려보낸다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/auth/google/callback?code=c&state=x' });
      expect(response.headers.location).toContain('login=expired');
    });

    it('구글 화면에서 취소하면 cancelled 로 돌려보낸다', async () => {
      const start = await app.inject({ method: 'GET', url: '/v1/auth/google/start' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/auth/google/callback?error=access_denied',
        cookies: { [LOGIN_COOKIE]: cookieOf(start, LOGIN_COOKIE)!.value },
      });
      expect(response.headers.location).toContain('login=cancelled');
    });

    it('구글이 준 토큰을 못 믿으면 로그인이 안 된다', async () => {
      fakeGoogle.next = new GoogleError('token', '못 믿는다');
      const start = await app.inject({ method: 'GET', url: '/v1/auth/google/start' });
      const sealed = cookieOf(start, LOGIN_COOKIE)!.value;
      const state = new URL(start.headers.location as string).searchParams.get('state')!;
      const response = await app.inject({
        method: 'GET',
        url: `/v1/auth/google/callback?code=c&state=${encodeURIComponent(state)}`,
        cookies: { [LOGIN_COOKIE]: sealed },
      });
      expect(response.headers.location).toContain('login=token');
      expect(cookieOf(response, REFRESH_COOKIE)).toBeUndefined();
    });
  });

  describe('갱신', () => {
    it('쿠키로 액세스 토큰을 받는다', async () => {
      const refresh = await signIn();
      const response = await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: refresh },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { access: string; role: string; expiresIn: number };
      expect(body.role).toBe('pending');
      expect(body.expiresIn).toBe(900);
      expect((await tokens.verify(body.access)).role).toBe('pending');
      // 회전됐다 — 답에 새 쿠키가 실려 온다
      expect(cookieOf(response, REFRESH_COOKIE)!.value).not.toBe(refresh);
    });

    it('쿠키가 없으면 401 이다', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/auth/refresh' });
      expect(response.statusCode).toBe(401);
      expect((response.json() as { reason: string }).reason).toBe('missing');
    });

    it('이미 쓴 쿠키면 401 이고 쿠키를 지운다', async () => {
      const refresh = await signIn();
      await app.inject({ method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: refresh } });
      const again = await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: refresh },
      });
      expect(again.statusCode).toBe(401);
      expect((again.json() as { reason: string }).reason).toBe('reuse');
      // 못 쓰는 쿠키를 남겨 두면 브라우저가 같은 값으로 401 을 반복한다
      expect(cookieOf(again, REFRESH_COOKIE)!.value).toBe('');
    });
  });

  describe('나', () => {
    it('토큰 없이는 401 이다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/me' });
      expect(response.statusCode).toBe(401);
      expect((response.json() as { reason: string }).reason).toBe('missing');
    });

    it('토큰이 있으면 내 정보가 온다', async () => {
      const refresh = await signIn();
      const { access } = (await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: refresh },
      })).json() as { access: string };

      const response = await app.inject({
        method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${access}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        email: 'friend@example.test', name: '친구', role: 'pending', beta: false,
      });
    });

    it('쓰레기 토큰이면 401 이고 이유를 말한다', async () => {
      const response = await app.inject({
        method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer not-a-token' },
      });
      expect(response.statusCode).toBe(401);
      expect((response.json() as { reason: string }).reason).toBe('invalid');
    });

    it('만료된 토큰은 expired 라고 말해 준다', async () => {
      // 프런트가 '다시 로그인' 이 아니라 '갱신' 으로 가야 한다
      const stale = makeAccessTokens(env.auth.jwtSecret, -1);
      const token = await stale.sign({ sub: '1', role: 'approved', beta: false });
      const response = await app.inject({
        method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${token}` },
      });
      expect((response.json() as { reason: string }).reason).toBe('expired');
    });

    it('계정을 지우면 그 토큰으로 아무것도 못 한다', async () => {
      const refresh = await signIn();
      const { access } = (await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: refresh },
      })).json() as { access: string };

      const gone = await app.inject({
        method: 'DELETE', url: '/v1/me', headers: { authorization: `Bearer ${access}` },
      });
      expect(gone.statusCode).toBe(204);

      const after = await app.inject({
        method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${access}` },
      });
      expect(after.statusCode).toBe(404);
      const [row] = await sql<{ n: string }[]>`select count(*)::text as n from users`;
      expect(row!.n).toBe('0');
    });
  });

  describe('로그아웃', () => {
    it('그 기기만 끊고 쿠키를 지운다', async () => {
      const phone = await signIn('phone');
      const desktop = await signIn('desktop');

      const out = await app.inject({ method: 'POST', url: '/v1/auth/logout', cookies: { [REFRESH_COOKIE]: phone } });
      expect(out.statusCode).toBe(204);
      expect(cookieOf(out, REFRESH_COOKIE)!.value).toBe('');

      expect((await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: phone },
      })).statusCode).toBe(401);
      expect((await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: desktop },
      })).statusCode).toBe(200);
    });

    it('쿠키 없이 눌러도 조용히 끝난다', async () => {
      expect((await app.inject({ method: 'POST', url: '/v1/auth/logout' })).statusCode).toBe(204);
    });

    it('기기 목록에 사람을 가리키는 값이 없다', async () => {
      const refresh = await signIn('phone');
      const { access } = (await app.inject({
        method: 'POST', url: '/v1/auth/refresh', cookies: { [REFRESH_COOKIE]: refresh },
      })).json() as { access: string };

      const response = await app.inject({
        method: 'GET', url: '/v1/auth/sessions', headers: { authorization: `Bearer ${access}` },
      });
      const { sessions } = response.json() as { sessions: Record<string, unknown>[] };
      expect(sessions.length).toBeGreaterThan(0);
      // IP 는 표에 자리가 없다 (CLAUDE.md §3) — 답에도 있을 수 없다
      expect(Object.keys(sessions[0]!)).toEqual(['id', 'userAgent', 'issuedAt', 'expiresAt']);
    });
  });
});

describe('권한이 모자랄 때 (DB 없이)', () => {
  it('403 이고 401 이 아니다 — 다시 로그인해도 달라지지 않는다', async () => {
    const bare = Fastify({ logger: false });
    const requireRole = makeRequireRole(tokens);
    bare.get('/admin-only', { preHandler: requireRole('admin') }, async () => ({ ok: true }));
    bare.get('/anyone', { preHandler: requireRole('pending') }, async () => ({ ok: true }));
    await bare.ready();

    const approved = await tokens.sign({ sub: '1', role: 'approved', beta: false });
    const admin = await tokens.sign({ sub: '2', role: 'admin', beta: false });

    const low = await bare.inject({ method: 'GET', url: '/admin-only', headers: { authorization: `Bearer ${approved}` } });
    expect(low.statusCode).toBe(403);
    expect((low.json() as { reason: string }).reason).toBe('forbidden');

    expect((await bare.inject({
      method: 'GET', url: '/admin-only', headers: { authorization: `Bearer ${admin}` },
    })).statusCode).toBe(200);
    expect((await bare.inject({
      method: 'GET', url: '/anyone', headers: { authorization: `Bearer ${approved}` },
    })).statusCode).toBe(200);

    await bare.close();
  });
});
