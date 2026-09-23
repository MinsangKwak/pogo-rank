// ─────────────────────────────────────────────────────────────────────────────
// domainroutes.test.ts — 도메인 주소를 실제 요청으로 찌른다 (v5 Phase 5)
//
// **여기서 재는 것은 문이다.** 서비스가 옳게 판정하는지는 domain.test.ts 가 이미 봤다.
// 이 파일은 그 판정이 **HTTP 로 새지 않는지**를 본다 — 토큰 없이 열리는 주소가 있는지,
// 권한이 모자랄 때 403 이 아니라 200 이 나가는지, 상한이 409 로 오는지.
//
// 규칙에서 옮겨 온 것 중 가장 조심할 것: **남의 것을 못 만지는가.**
// Firestore 는 경로에 uid 가 박혀 있어 규칙이 그것을 견줬다. REST 는 경로에 uid 가 없다 —
// 토큰의 sub 만 본다. 그게 새면 아무나 남의 것을 만진다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { buildApp } from '../app.ts';
import { readEnv } from '../env.ts';
import { makeAccessTokens } from '../lib/jwt.ts';
import type { Role } from '../lib/rbac.ts';
import { testDatabaseUrl } from './dbUrl.ts';
import { TEST_AUTH_ENV } from './envFixture.ts';

const url = testDatabaseUrl();
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

const env = readEnv({
  DATABASE_URL: url || 'postgres://u:p@localhost:5432/db',
  ALLOWED_ORIGINS: TEST_AUTH_ENV.APP_ORIGIN,
  NODE_ENV: 'test',
  RATE_LIMIT_PER_MINUTE: '1000',
  ...TEST_AUTH_ENV,
});
const tokens = makeAccessTokens(env.auth.jwtSecret);

let sql: Sql;
let app: FastifyInstance;
const ids: Record<Role, string> = { pending: '', approved: '', admin: '', root: '' };

/** 그 권한인 사람의 Authorization 헤더 */
async function as(role: Role): Promise<{ authorization: string }> {
  return { authorization: `Bearer ${await tokens.sign({ sub: ids[role], role, beta: false })}` };
}

describe.skipIf(!url)('도메인 주소', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
    app = await buildApp(env, sql);
    await app.ready();
  });
  afterAll(async () => { if (app) await app.close(); if (sql) await sql.end(); });
  beforeEach(async () => {
    await sql`delete from users`;
    await sql`delete from trainers`;
    for (const role of ['pending', 'approved', 'admin', 'root'] as Role[]) {
      const [row] = await sql<{ id: string }[]>`
        insert into users (google_sub, email, role)
        values (${`g-${role}`}, ${`${role}@example.test`}, ${role}) returning id`;
      ids[role] = row!.id;
    }
  });

  describe('담아 두기', () => {
    it('담고 읽고 뺀다', async () => {
      const headers = await as('approved');
      expect((await app.inject({ method: 'PUT', url: '/v1/me/favorites/25', headers })).statusCode).toBe(204);

      const list = await app.inject({ method: 'GET', url: '/v1/me/favorites', headers });
      expect(list.json()).toEqual({ favorites: [25], cap: 1000 });

      expect((await app.inject({ method: 'DELETE', url: '/v1/me/favorites/25', headers })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/v1/me/favorites', headers })).json())
        .toEqual({ favorites: [], cap: 1000 });
    });

    it('승인 대기도 담는다 — 상한만 낮다 (v3.60.0)', async () => {
      const headers = await as('pending');
      expect((await app.inject({ method: 'PUT', url: '/v1/me/favorites/7', headers })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/v1/me/favorites', headers })).json())
        .toEqual({ favorites: [7], cap: 200 });
    });

    it('★ 상한을 넘으면 409 다 — 요청은 멀쩡하고 지금 상태가 안 받아 준다', async () => {
      const rows = Array.from({ length: 200 }, (_, i) => ({ user_id: ids.pending, dex: i + 1 }));
      await sql`insert into favorites ${sql(rows)}`;
      const response = await app.inject({ method: 'PUT', url: '/v1/me/favorites/500', headers: await as('pending') });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { reason: string }).reason).toBe('limit');
    });

    it('★ 남의 것은 안 보인다 — 경로에 uid 가 없고 토큰의 sub 만 본다', async () => {
      await app.inject({ method: 'PUT', url: '/v1/me/favorites/25', headers: await as('approved') });
      expect((await app.inject({ method: 'GET', url: '/v1/me/favorites', headers: await as('pending') })).json())
        .toEqual({ favorites: [], cap: 200 });
    });

    it('토큰 없이는 못 연다', async () => {
      expect((await app.inject({ method: 'GET', url: '/v1/me/favorites' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'PUT', url: '/v1/me/favorites/25' })).statusCode).toBe(401);
    });

    it('포켓몬 번호가 아니면 400 이다', async () => {
      const headers = await as('approved');
      // 스키마가 정수만 받으므로 글자는 여기서 걸린다
      expect((await app.inject({ method: 'PUT', url: '/v1/me/favorites/abc', headers })).statusCode).toBe(400);
      expect((await app.inject({ method: 'PUT', url: '/v1/me/favorites/0', headers })).statusCode).toBe(400);
    });
  });

  describe('트레이너 코드', () => {
    it('관리자가 넣고 승인된 사람이 읽는다', async () => {
      expect((await app.inject({
        method: 'PUT', url: '/v1/trainers/민상', headers: await as('admin'),
        payload: { code: '1234 5678 9012', sortOrder: 1 },
      })).statusCode).toBe(204);

      const list = await app.inject({ method: 'GET', url: '/v1/trainers', headers: await as('approved') });
      expect(list.json()).toEqual({ trainers: [{ name: '민상', code: '1234 5678 9012', sortOrder: 1 }] });
    });

    it('★ 승인 대기는 목록도 못 본다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/trainers', headers: await as('pending') });
      expect(response.statusCode).toBe(403);
      // 403 이다. 401 이 아니다 — 다시 로그인해도 달라지지 않는다
      expect((response.json() as { reason: string }).reason).toBe('forbidden');
    });

    it('★ 승인된 사람은 쓰지 못한다', async () => {
      expect((await app.inject({
        method: 'PUT', url: '/v1/trainers/x', headers: await as('approved'), payload: { code: 'y' },
      })).statusCode).toBe(403);
      expect((await app.inject({
        method: 'DELETE', url: '/v1/trainers/x', headers: await as('approved'),
      })).statusCode).toBe(403);
    });

    it('빈 코드는 400 이다', async () => {
      const response = await app.inject({
        method: 'PUT', url: '/v1/trainers/민상', headers: await as('admin'), payload: { code: '   ' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('관리자가 지운다', async () => {
      await app.inject({
        method: 'PUT', url: '/v1/trainers/민상', headers: await as('admin'), payload: { code: 'c' },
      });
      expect((await app.inject({
        method: 'DELETE', url: '/v1/trainers/민상', headers: await as('admin'),
      })).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: '/v1/trainers', headers: await as('root') })).json())
        .toEqual({ trainers: [] });
    });
  });

  describe('사람 관리', () => {
    it('루트가 목록을 본다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/admin/users', headers: await as('root') });
      expect(response.statusCode).toBe(200);
      const { users } = response.json() as { users: { email: string; role: string; lastSeenAt: string | null }[] };
      expect(users).toHaveLength(4);
      // 아직 로그인한 적 없는 줄이라 null 이다 — 화면에 'undefined' 가 안 나가게 칸을 채워 보낸다
      expect(users.every((one) => one.lastSeenAt === null)).toBe(true);
    });

    it('★ 위임 관리자의 목록에는 승인 대기가 안 실린다', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/admin/users', headers: await as('admin') });
      expect(response.statusCode).toBe(200);
      const { users } = response.json() as { users: { role: string }[] };
      expect(users.some((one) => one.role === 'pending')).toBe(false);
      expect(users).toHaveLength(3);
    });

    it('승인된 사람은 목록을 아예 못 본다', async () => {
      expect((await app.inject({ method: 'GET', url: '/v1/admin/users', headers: await as('approved') })).statusCode).toBe(403);
    });

    it('루트가 승인한다', async () => {
      expect((await app.inject({
        method: 'PATCH', url: `/v1/admin/users/${ids.pending}`, headers: await as('root'),
        payload: { role: 'approved' },
      })).statusCode).toBe(204);
      const [row] = await sql<{ role: string }[]>`select role from users where id = ${ids.pending}`;
      expect(row!.role).toBe('approved');
    });

    it('★ 루트는 API 로 만들 수 없다 — 스키마가 먼저 막는다', async () => {
      const response = await app.inject({
        method: 'PATCH', url: `/v1/admin/users/${ids.approved}`, headers: await as('root'),
        payload: { role: 'root' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('★ 위임 관리자는 사람을 못 들인다', async () => {
      expect((await app.inject({
        method: 'PATCH', url: `/v1/admin/users/${ids.pending}`, headers: await as('admin'),
        payload: { role: 'approved' },
      })).statusCode).toBe(403);
    });

    it('★ 내보내면 그 사람의 로그인이 끊긴다', async () => {
      // 액세스 토큰은 15분 사는 물건이라 권한만 내리면 그 15분이 안 막힌다
      await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at)
                values (${ids.approved}, sha256('x'), gen_random_uuid(), now() + interval '30 days')`;
      await app.inject({
        method: 'PATCH', url: `/v1/admin/users/${ids.approved}`, headers: await as('root'),
        payload: { role: 'pending' },
      });
      const [row] = await sql<{ n: string }[]>`
        select count(*)::text as n from sessions where user_id = ${ids.approved} and revoked_at is null`;
      expect(row!.n).toBe('0');
    });

    it('없는 사람은 404 다', async () => {
      expect((await app.inject({
        method: 'PATCH', url: '/v1/admin/users/999999', headers: await as('root'),
        payload: { role: 'approved' },
      })).statusCode).toBe(404);
    });
  });
});
