// 수집 엔드포인트 — 스키마 관문이 실제 요청에서 도는가 (app.inject, 포트도 DB 도 없이)
'use strict';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { readEnv } from '../env.ts';
import { makeFakeSql, type Captured } from './fakeSql.ts';

const env = readEnv({
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  ALLOWED_ORIGINS: 'https://moncamp.kr',
  NODE_ENV: 'test',
  RATE_LIMIT_PER_MINUTE: '1000',
});

const VISITOR = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
let app: FastifyInstance;
let captured: Captured;

beforeAll(async () => {
  const fake = makeFakeSql();
  captured = fake.captured;
  app = await buildApp(env, fake.sql);
  await app.ready();
});

afterAll(async () => { await app.close(); });

const post = (payload: unknown) => app.inject({
  method: 'POST', url: '/v1/events',
  headers: { 'content-type': 'application/json', 'cf-ipcountry': 'KR', origin: 'https://moncamp.kr' },
  payload: payload as object,
});

describe('POST /v1/events', () => {
  it('제대로 된 요청은 204 이고 몸통이 없다 — 프런트는 답을 안 기다린다', async () => {
    const res = await post({ visitor: VISITOR, events: [{ name: 'search', term: '뮤츠', surface: 'dex' }] });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(captured.rows.at(-1)).toMatchObject({ term: '뮤츠', surface: 'dex', country: 'KR', channel: 'prod' });
  });

  it('화이트리스트에 없는 이름은 400 — 저장되지 않는다', async () => {
    const before = captured.rows.length;
    const res = await post({ visitor: VISITOR, events: [{ name: 'page_view' }] });
    expect(res.statusCode).toBe(400);
    expect(captured.rows.length).toBe(before);
  });

  it('스키마에 없는 칸을 붙이면 400 — 아무 값이나 실려 오지 못한다', async () => {
    const res = await post({ visitor: VISITOR, events: [{ name: 'search', term: '뮤츠', ip: '203.0.113.9' }] });
    expect(res.statusCode).toBe(400);
  });

  it('방문자 ID 가 모양이 아니면 400', async () => {
    expect((await post({ visitor: 'short', events: [{ name: 'search', term: '뮤츠' }] })).statusCode).toBe(400);
    expect((await post({ visitor: `${VISITOR}<script>`, events: [{ name: 'search', term: '뮤츠' }] })).statusCode).toBe(400);
  });

  it('한 요청에 20건을 넘기면 400 — 한꺼번에 밀어 넣지 못한다', async () => {
    const many = Array.from({ length: 21 }, () => ({ name: 'search', term: '뮤츠' }));
    expect((await post({ visitor: VISITOR, events: many })).statusCode).toBe(400);
  });

  it('빈 배열도 400 — 보낼 것이 없으면 부르지 않는다', async () => {
    expect((await post({ visitor: VISITOR, events: [] })).statusCode).toBe(400);
  });

  it('다 걸러져 남는 줄이 없어도 204 다 — 보낸 쪽이 틀린 게 아니라 셀 것이 없을 뿐이다', async () => {
    const before = captured.rows.length;
    // 공백만 있는 검색어는 스키마(minLength 1)를 지나고 정규화에서 걸린다 — 두 관문의 역할이 다르다
    const res = await post({ visitor: VISITOR, events: [{ name: 'search', term: '  ' }] });
    expect(res.statusCode).toBe(204);
    expect(captured.rows.length).toBe(before);
  });

  it('IP 헤더를 보내도 저장되는 줄에 안 섞인다', async () => {
    await app.inject({
      method: 'POST', url: '/v1/events',
      headers: {
        'content-type': 'application/json', 'cf-ipcountry': 'JP',
        'x-forwarded-for': '203.0.113.9', origin: 'https://moncamp.kr',
      },
      payload: { visitor: VISITOR, events: [{ name: 'search', term: '리자몽' }] },
    });
    const row = captured.rows.at(-1) ?? {};
    expect(row['country']).toBe('JP');
    expect(JSON.stringify(row)).not.toContain('203.0.113.9');
  });

  it('dev 채널은 dev 로 적힌다 — 미리보기가 운영 순위로 새지 않는다', async () => {
    await post({ visitor: VISITOR, channel: 'dev', events: [{ name: 'search', term: '이상해씨' }] });
    expect(captured.rows.at(-1)).toMatchObject({ channel: 'dev' });
  });
});

describe('출처 판정 — CORS 가 못 막는 자리를 서버가 막는다', () => {
  const beacon = (origin: string | undefined) => app.inject({
    method: 'POST', url: '/v1/events',
    // sendBeacon 이 보내는 모양 그대로 — text/plain 이라 프리플라이트가 없다
    headers: { 'content-type': 'text/plain;charset=UTF-8', ...(origin ? { origin } : {}) },
    payload: JSON.stringify({ visitor: VISITOR, events: [{ name: 'search', term: '비콘' }] }),
  });

  it('sendBeacon 모양(text/plain)을 받아 읽는다 — 떠나면서 보낸 마지막 검색이 사라지지 않는다', async () => {
    const res = await beacon('https://moncamp.kr');
    expect(res.statusCode).toBe(204);
    expect(captured.rows.at(-1)).toMatchObject({ term: '비콘' });
  });

  it('남의 사이트에서 쏜 beacon 은 403 — CORS 만으로는 이게 그냥 들어온다', async () => {
    const before = captured.rows.length;
    const res = await beacon('https://evil.example');
    expect(res.statusCode).toBe(403);
    expect(captured.rows.length).toBe(before);
  });

  it('Origin 이 아예 없어도 403', async () => {
    expect((await beacon(undefined)).statusCode).toBe(403);
  });

  it('JSON 이 아닌 text/plain 은 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/events',
      headers: { 'content-type': 'text/plain', origin: 'https://moncamp.kr' },
      payload: '이건 JSON 이 아니다',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('CORS 응답 헤더', () => {
  it('허용한 주소는 통과한다', async () => {
    const res = await app.inject({
      method: 'OPTIONS', url: '/v1/events',
      headers: { origin: 'https://moncamp.kr', 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('https://moncamp.kr');
  });

  it('모르는 주소에는 허용 헤더를 안 준다', async () => {
    const res = await app.inject({
      method: 'OPTIONS', url: '/v1/events',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('롤업 열쇠', () => {
  it('열쇠 없이 부르면 401', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/admin/rollup' })).statusCode).toBe(401);
  });

  it('진단용 raw 순위도 열쇠가 필요하다 — 문턱 아래 값이 그냥 나가지 않는다', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/hot?raw=true' })).statusCode).toBe(401);
  });
});
