// ─────────────────────────────────────────────────────────────────────────────
// worker.test.mjs — Worker 가 지키는 셋을 배포 전에 본다
//
// 의존성 없이 `node --test` 로 돈다. Worker 하나 때문에 패키지를 세우지 않으려고.
// 배포 워크플로가 wrangler 를 부르기 전에 돌린다 — 빨가면 올리지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { toOrigin } from './worker.js';

const ORIGIN = 'https://moncamp-api-abc123-du.a.run.app';

function incoming(path, init = {}, cf = { country: 'KR' }) {
  const request = new Request(`https://api.moncamp.kr${path}`, init);
  Object.defineProperty(request, 'cf', { value: cf });
  return request;
}

test('주소는 Cloud Run 으로, 경로와 검색어는 그대로', () => {
  const out = toOrigin(incoming('/v1/auth/google/start?next=%2Fdex&app=https%3A%2F%2Fdev.moncamp.kr'), ORIGIN);
  assert.equal(out.url, `${ORIGIN}/v1/auth/google/start?next=%2Fdex&app=https%3A%2F%2Fdev.moncamp.kr`);
});

test('★ 리다이렉트를 따라가지 않는다 — 로그인의 302 는 브라우저 몫이다', () => {
  assert.equal(toOrigin(incoming('/v1/auth/google/start'), ORIGIN).redirect, 'manual');
});

test('★ 사용자가 보낸 X-Forwarded-For 는 버리고 Cloudflare 가 본 IP 로 덮는다', () => {
  const out = toOrigin(incoming('/v1/events', {
    headers: { 'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '203.0.113.7' },
  }), ORIGIN);
  assert.equal(out.headers.get('x-forwarded-for'), '203.0.113.7');
});

test('Cloudflare IP 가 없으면 X-Forwarded-For 를 아예 안 넘긴다 — 지어낸 값을 믿게 두지 않는다', () => {
  const out = toOrigin(incoming('/v1/events', { headers: { 'x-forwarded-for': '6.6.6.6' } }), ORIGIN);
  assert.equal(out.headers.get('x-forwarded-for'), null);
});

test('나라는 x-country-code 로 — 사용자가 보낸 값은 덮는다', () => {
  const out = toOrigin(incoming('/v1/events', { headers: { 'x-country-code': 'ZZ' } }, { country: 'JP' }), ORIGIN);
  assert.equal(out.headers.get('x-country-code'), 'JP');
  const none = toOrigin(incoming('/v1/events', { headers: { 'x-country-code': 'US' } }, {}), ORIGIN);
  assert.equal(none.headers.get('x-country-code'), null);
});

test('Host 머리는 넘기지 않는다 — Cloud Run 이 모르는 이름이면 404 다', () => {
  const out = toOrigin(incoming('/health', { headers: { host: 'api.moncamp.kr' } }), ORIGIN);
  assert.equal(out.headers.get('host'), null);
});

test('쿠키와 본문은 그대로 간다 — 리프레시 쿠키가 빠지면 로그인이 안 이어진다', async () => {
  const out = toOrigin(incoming('/v1/auth/refresh', {
    method: 'POST', headers: { cookie: 'moncamp_refresh=abc', 'content-type': 'application/json' }, body: '{"a":1}',
  }), ORIGIN);
  assert.equal(out.method, 'POST');
  assert.equal(out.headers.get('cookie'), 'moncamp_refresh=abc');
  assert.equal(await out.text(), '{"a":1}');
});

test('ORIGIN_URL 이 없으면 500 으로 말한다 — 조용히 엉뚱한 곳으로 가지 않는다', async () => {
  const response = await worker.fetch(incoming('/health'), {});
  assert.equal(response.status, 500);
});
