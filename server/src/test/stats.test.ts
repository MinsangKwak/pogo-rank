'use strict';
// 루트 통계 — 루트만 열리고, 모아 센 값만 나가고, 빈 날은 0 으로 채운다 (routes/stats.ts · lib/stats.ts)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { buildApp } from '../app.ts';
import { readEnv } from '../env.ts';
import { makeAccessTokens } from '../lib/jwt.ts';
import type { Role } from '../lib/rbac.ts';
import { clampDays } from '../lib/stats.ts';
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

async function as(role: Role): Promise<{ authorization: string }> {
  return { authorization: `Bearer ${await tokens.sign({ sub: ids[role], role, beta: false })}` };
}

describe('기간 끝', () => {
  it('7~400일 안으로 — 기본 30', () => {
    expect(clampDays(undefined)).toBe(30);
    expect(clampDays(1)).toBe(7);
    expect(clampDays(365)).toBe(365);
    expect(clampDays(1000)).toBe(400);
    expect(clampDays(Number.NaN)).toBe(30);
  });
});

describe.skipIf(!url)('GET /v1/admin/stats', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
    app = await buildApp(env, sql);
    await app.ready();
    for (const role of ['pending', 'approved', 'admin', 'root'] as Role[]) {
      const [row] = await sql<{ id: string }[]>`
        insert into users (google_sub, email, display_name, role, beta, last_seen_at)
        values (${`g-${role}`}, ${`${role}@example.test`}, ${`이름-${role}`}, ${role}, ${role === 'root'}, now())
        returning id`;
      ids[role] = row!.id;
    }
    await sql`insert into favorites (user_id, dex) values (${ids.approved}, 25), (${ids.admin}, 25), (${ids.root}, 150)`;
    const visitorA = 'a'.repeat(32);
    const visitorB = 'b'.repeat(32);
    await sql`insert into events (name, visitor, term, surface, country, channel) values
      ('search', ${visitorA}, '뮤츠', 'dex', 'KR', 'prod'),
      ('search', ${visitorA}, '뮤츠', 'dex', 'KR', 'prod'),
      ('search', ${visitorB}, '뮤츠', 'app', 'JP', 'prod'),
      ('search', ${visitorB}, '피카츄', 'app', 'JP', 'prod'),
      ('search', ${visitorB}, '몰래', 'app', 'JP', 'dev'),
      ('view', ${visitorA}, null, 'dmax', 'KR', 'prod'),
      ('view', ${visitorB}, null, 'dmax', 'JP', 'prod')`;
    // 지난 기간 — 안 세야 한다
    await sql`insert into events (name, visitor, term, surface, country, channel, created_at)
      values ('search', ${visitorA}, '옛날', 'dex', 'KR', 'prod', now() - interval '100 days')`;
  });
  afterAll(async () => { if (app) await app.close(); if (sql) await sql.end(); });

  it('토큰 없으면 401 · 루트가 아니면 403 — 위임 관리자도 못 본다', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats' })).statusCode).toBe(401);
    for (const role of ['pending', 'approved', 'admin'] as Role[]) {
      expect((await app.inject({ method: 'GET', url: '/v1/admin/stats', headers: await as(role) })).statusCode).toBe(403);
    }
  });

  it('모아 센 값 — 운영 채널만, 기간 안만', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/stats?days=7', headers: await as('root') });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = res.json();
    expect(body.days).toBe(7);
    expect(body.users).toMatchObject({ total: 4, pending: 1, approved: 1, admin: 1, root: 1, beta: 1, active1d: 4 });
    expect(body.users.newPerDay).toHaveLength(7);
    expect(body.users.newPerDay.at(-1).count).toBe(4);
    expect(body.favorites).toEqual({ total: 3, people: 3, top: [{ dex: 25, users: 2 }, { dex: 150, users: 1 }] });
    expect(body.search).toMatchObject({ hits: 4, visitors: 2 });
    expect(body.search.top[0]).toEqual({ key: '뮤츠', hits: 3, visitors: 2 });
    expect(body.search.top.map((one: { key: string }) => one.key)).not.toContain('몰래');
    expect(body.search.top.map((one: { key: string }) => one.key)).not.toContain('옛날');
    expect(body.search.surfaces[0]).toEqual({ key: 'app', hits: 2, visitors: 1 });
    expect(body.search.perDay).toHaveLength(7);
    expect(body.search.perDay.at(-1)).toMatchObject({ hits: 4, visitors: 2 });
    expect(body.views).toMatchObject({ hits: 2, visitors: 2, top: [{ key: 'dmax', hits: 2, visitors: 2 }], surfaces: [] });
    expect(body.ga4).toEqual({ status: 'off', reason: expect.any(String) });
  });

  it('사람을 가리키는 값은 한 칸도 안 나간다 — 이메일 · 이름 · 방문자 ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/admin/stats', headers: await as('root') });
    expect(res.body).not.toMatch(/example\.test|이름-|aaaaaaaa|bbbbbbbb/);
  });

  it('기간은 7~400일 — 밖이면 400', async () => {
    const headers = await as('root');
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats?days=3', headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats?days=401', headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats?days=365', headers })).statusCode).toBe(200);
  });
});
