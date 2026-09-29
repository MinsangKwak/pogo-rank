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
import { clampDays, resolveRange, kstDay, shiftDay } from '../lib/stats.ts';
import { PERSON_CAP } from '../lib/hot.ts';
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
    // 한 기기에서 두 번 회전한 사슬 — 살아 있는 로그인은 1 이다 (쓴 토큰 둘은 세지 않는다)
    const chain = '00000000-0000-4000-8000-000000000001';
    await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at, used_at) values
      (${ids.root}, decode('01', 'hex'), ${chain}, now() + interval '30 days', now()),
      (${ids.root}, decode('02', 'hex'), ${chain}, now() + interval '30 days', now())`;
    await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at) values
      (${ids.root}, decode('03', 'hex'), ${chain}, now() + interval '30 days')`;
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
      ('view', ${visitorB}, null, 'dmax', 'JP', 'prod'),
      ('view', ${visitorA}, null, 'mon-25', 'KR', 'prod'),
      ('view', ${visitorA}, null, 'mon-25', 'KR', 'prod'),
      ('view', ${visitorB}, null, 'mon-150', 'JP', 'prod'),
      ('view', ${visitorB}, null, 'mon-150', 'JP', 'dev')`;
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
    expect(body.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.from < body.to).toBe(true);
    expect(body.users).toMatchObject({ total: 4, pending: 1, approved: 1, admin: 1, root: 1, beta: 1, active1d: 4 });
    expect(body.users.newPerDay).toHaveLength(7);
    expect(body.users.newPerDay.at(-1).count).toBe(4);
    expect(body.sessions).toEqual({ active: 1 });
    expect(body.favorites).toEqual({ total: 3, people: 3, top: [{ dex: 25, users: 2 }, { dex: 150, users: 1 }] });
    expect(body.search).toMatchObject({ hits: 4, visitors: 2 });
    expect(body.search.top[0]).toEqual({ key: '뮤츠', hits: 3, visitors: 2 });
    expect(body.search.top.map((one: { key: string }) => one.key)).not.toContain('몰래');
    expect(body.search.top.map((one: { key: string }) => one.key)).not.toContain('옛날');
    expect(body.search.surfaces[0]).toEqual({ key: 'app', hits: 2, visitors: 1 });
    // 순위와 같은 계산 — 문턱(3회 · 2명)을 넘은 뮤츠만, 줄이 하나뿐이어도 비우지 않는다
    expect(body.search.hot).toEqual([{ key: '뮤츠', hits: 3, visitors: 2 }]);
    // 하루 창 — 방금 넣은 줄이라 오늘 창에서도 뮤츠가 넘는다
    expect(body.search.hotToday).toEqual([{ key: '뮤츠', hits: 3, visitors: 2 }]);
    expect(body.views.hot).toEqual([]);
    expect(body.views.hotToday).toEqual([]);
    expect(body.search.perDay).toHaveLength(7);
    expect(body.search.perDay.at(-1)).toMatchObject({ hits: 4, visitors: 2 });
    // 상세 팝업(mon-<번호>)은 화면 표에서 'mon' 하나로 접히고, 포켓몬별로는 mons 에 선다 — dev 채널은 안 센다
    expect(body.views).toMatchObject({ hits: 5, visitors: 2, top: [{ key: 'mon', hits: 3, visitors: 2 }, { key: 'dmax', hits: 2, visitors: 2 }], surfaces: [] });
    expect(body.views.mons).toEqual([{ key: '25', hits: 2, visitors: 1 }, { key: '150', hits: 1, visitors: 1 }]);
    expect(body.search.mons).toEqual([]);
    expect(body.ga4).toEqual({ status: 'off', reason: expect.any(String) });
  });

  it('GET /v1/mons/hot — 상세 팝업 view 를 도감 번호로 모은다 (사람당 하루 한도 · 문턱 없음 · dev 제외)', async () => {
    const visitorC = 'c'.repeat(32);
    // 한 사람이 한도(PERSON_CAP)를 넘게 열어도 그만큼만 센다 — 순위를 혼자 만들지 못한다
    for (let i = 0; i < PERSON_CAP + 3; i += 1) {
      await sql`insert into events (name, visitor, term, surface, country, channel) values ('view', ${visitorC}, null, 'mon-6', 'KR', 'prod')`;
    }
    await sql`insert into events (name, visitor, term, surface, country, channel) values
      ('view', ${visitorC}, null, 'mon-999999', 'KR', 'prod')`;
    const res = await app.inject({ method: 'GET', url: '/v1/mons/hot?days=7&limit=5' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=600');
    const body = res.json() as { window: number; rows: { dex: number; hits: number; visitors: number }[] };
    expect(body.window).toBe(7);
    // 본 사람 수가 같으면 횟수 순 — 25(A 두 번) · 6(C 한도만큼) · 150(B 한 번). 여섯 자리 번호 · dev 줄은 없다
    expect(body.rows).toEqual([
      { dex: 6, hits: PERSON_CAP, visitors: 1 },
      { dex: 25, hits: 2, visitors: 1 },
      { dex: 150, hits: 1, visitors: 1 },
    ]);
    // dev 채널 — 미리보기가 제 기록을 본다. 위 seed 의 dev 줄(150) 하나
    const dev = await app.inject({ method: 'GET', url: '/v1/mons/hot?channel=dev' });
    expect(dev.json().rows).toEqual([{ dex: 150, hits: 1, visitors: 1 }]);
    expect((await app.inject({ method: 'GET', url: '/v1/mons/hot?channel=test' })).statusCode).toBe(400);
    // 시간 창 — 방금 넣은 줄이라 최근 1시간에도 다 든다. window 는 0, hours 가 실린다
    const hour = (await app.inject({ method: 'GET', url: '/v1/mons/hot?hours=1&limit=5' })).json();
    expect(hour.window).toBe(0);
    expect(hour.hours).toBe(1);
    expect(hour.rows.map((row: { dex: number }) => row.dex)).toEqual([6, 25, 150]);
    expect((await app.inject({ method: 'GET', url: '/v1/mons/hot?hours=169' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/mons/hot?days=400' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/mons/hot?days=401' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/mons/hot?limit=21' })).statusCode).toBe(400);
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

  it('from · to — 한국 날짜 양끝으로 자른다 (달력 기간)', async () => {
    const headers = await as('root');
    const today = kstDay();
    const from = shiftDay(today, -9);
    const res = await app.inject({ method: 'GET', url: `/v1/admin/stats?from=${from}&to=${today}`, headers });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ from, to: today, days: 10 });
    expect(body.search.perDay).toHaveLength(10);
    expect(body.search.perDay[0].day).toBe(from);
    expect(body.search.hits).toBe(4);
    // 앞 검사(/v1/mons/hot)가 넣은 C 의 mon-6(한도 5회)까지 든다
    expect(body.views.mons).toEqual([{ key: '6', hits: PERSON_CAP, visitors: 1 }, { key: '25', hits: 2, visitors: 1 }, { key: '150', hits: 1, visitors: 1 }]);
    // 오늘을 뺀 기간 — 방금 넣은 줄이 안 든다. 순위 계산(hot · mons)도 같은 양끝을 쓴다
    const past = await app.inject({ method: 'GET', url: `/v1/admin/stats?from=${shiftDay(today, -120)}&to=${shiftDay(today, -1)}`, headers });
    expect(past.statusCode).toBe(200);
    expect(past.json().search).toMatchObject({ hits: 1, hot: [], mons: [] });
    expect(past.json().search.top).toEqual([{ key: '옛날', hits: 1, visitors: 1 }]);
    expect(past.json().views).toMatchObject({ hits: 0, mons: [] });
    // 하루 창은 기간과 무관하게 '지금부터 하루' 다
    expect(past.json().search.hotToday).toEqual([{ key: '뮤츠', hits: 3, visitors: 2 }]);
  });

  it('from · to 가 틀리면 400 — 한쪽만 · 거꾸로 · 미래 · 400일 넘김 · 없는 날', async () => {
    const headers = await as('root');
    const today = kstDay();
    const bad = [
      `from=${today}`,
      `from=${today}&to=${shiftDay(today, -1)}`,
      `from=${today}&to=${shiftDay(today, 1)}`,
      `from=${shiftDay(today, -400)}&to=${today}`,
      `from=2026-02-30&to=${today}`,
      `from=26-09-14&to=${today}`,
    ];
    for (const query of bad) {
      const res = await app.inject({ method: 'GET', url: `/v1/admin/stats?${query}`, headers });
      expect(res.statusCode, query).toBe(400);
    }
    expect((await app.inject({ method: 'GET', url: `/v1/admin/stats?from=${shiftDay(today, -399)}&to=${today}`, headers })).statusCode).toBe(200);
  });

  it('GET /v1/admin/stats/hours — 하루를 24칸으로, 칸마다 많이 본 포켓몬 (루트만 · 운영 채널만)', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats/hours' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats/hours', headers: await as('admin') })).statusCode).toBe(403);
    const headers = await as('root');
    const today = kstDay();
    const res = await app.inject({ method: 'GET', url: `/v1/admin/stats/hours?day=${today}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = res.json();
    expect(body.day).toBe(today);
    expect(body.hours).toHaveLength(24);
    expect(body.hours.map((one: { hour: number }) => one.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    // 방금 넣은 줄은 지금 한국 시각의 칸에 든다 — 다른 칸은 0
    const hour = (new Date().getUTCHours() + 9) % 24;
    // A 의 25 두 번 · B 의 150 한 번 · C 의 6 여덟 번(칸 한도 5) — 합 8, 세 사람
    expect(body.hours[hour]).toEqual({ hour, hits: PERSON_CAP + 3, visitors: 3, mons: [{ key: '6', hits: PERSON_CAP, visitors: 1 }, { key: '25', hits: 2, visitors: 1 }, { key: '150', hits: 1, visitors: 1 }] });
    expect(body.hours.filter((one: { hits: number }) => one.hits > 0)).toHaveLength(1);
    expect(res.body).not.toMatch(/aaaaaaaa|bbbbbbbb/);
    // day 없으면 오늘, 미래 · 400일 밖 · 꼴 틀림은 400
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats/hours', headers })).json().day).toBe(today);
    expect((await app.inject({ method: 'GET', url: `/v1/admin/stats/hours?day=${shiftDay(today, 1)}`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `/v1/admin/stats/hours?day=${shiftDay(today, -400)}`, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/v1/admin/stats/hours?day=today', headers })).statusCode).toBe(400);
  });
});

describe('resolveRange — 요청의 기간을 한국 날짜 양끝으로', () => {
  const now = new Date('2026-09-29T16:00:00Z'); // 한국 9/30 01:00
  it('days 는 오늘을 넣어 센다 · 끝 밖은 끝으로', () => {
    expect(resolveRange({ days: 7 }, now)).toEqual({ from: '2026-09-24', to: '2026-09-30', days: 7 });
    expect(resolveRange({}, now)).toEqual({ from: '2026-09-01', to: '2026-09-30', days: 30 });
    expect(resolveRange({ days: 9999 }, now)).toMatchObject({ days: 400, to: '2026-09-30' });
  });
  it('from · to 는 그대로 — 하루짜리도 된다', () => {
    expect(resolveRange({ from: '2026-09-14', to: '2026-09-30' }, now)).toEqual({ from: '2026-09-14', to: '2026-09-30', days: 17 });
    expect(resolveRange({ from: '2026-09-30', to: '2026-09-30' }, now)).toEqual({ from: '2026-09-30', to: '2026-09-30', days: 1 });
  });
  it('틀린 기간은 이유를 준다', () => {
    expect(resolveRange({ from: '2026-09-14' }, now)).toHaveProperty('error');
    expect(resolveRange({ from: '2026-09-15', to: '2026-09-14' }, now)).toHaveProperty('error');
    expect(resolveRange({ from: '2026-09-14', to: '2026-10-01' }, now)).toHaveProperty('error');
    expect(resolveRange({ from: '2025-08-01', to: '2026-09-30' }, now)).toHaveProperty('error');
    expect(resolveRange({ from: '2026-02-30', to: '2026-09-30' }, now)).toHaveProperty('error');
  });
});
