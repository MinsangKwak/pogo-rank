// ─────────────────────────────────────────────────────────────────────────────
// jwt.test.ts — 액세스 토큰이 **위조를 거부하는지** 본다 (v5 Phase 4)
//
// **왜 공격 모양부터 적나.** JWT 사고는 발급이 아니라 검증에서 난다. 발급은 안 되면 바로
// 드러나지만, 검증이 무른 것은 아무 증상이 없다 — 공격자가 올 때까지.
// 그래서 여기서 재는 것은 "되는가" 보다 "안 되는가" 쪽이 많다.
//
// 넷을 막는다.
//   ① alg: none — 서명을 아예 안 한 토큰
//   ② 알고리즘 바꿔치기 — 같은 열쇠로 HS512 서명한 토큰 (우리는 HS256 만 받는다)
//   ③ 본문 손대기 — 권한을 root 로 고쳐 다시 이어 붙인 토큰
//   ④ 만료 · 남의 열쇠 · 남의 발행자
//
// Firestore 규칙에는 이 자리가 없었다 — 토큰 검증을 Firebase 가 했기 때문이다.
// 그 일을 우리가 가져오면서 생긴 책임이고, 그래서 검사도 여기서 새로 생긴다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { makeAccessTokens, TokenError } from '../lib/jwt.ts';

const SECRET = 'x'.repeat(48);
const tokens = makeAccessTokens(SECRET);

const CLAIMS = { sub: '12', role: 'approved' as const, beta: false };

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** 손으로 토큰을 짠다 — 공격자가 할 수 있는 일을 그대로 한다 */
function forge(header: object, payload: object, secret: string | null): string {
  const head = `${b64(header)}.${b64(payload)}`;
  if (secret === null) return `${head}.`;
  const alg = (header as { alg: string }).alg === 'HS512' ? 'sha512' : 'sha256';
  return `${head}.${createHmac(alg, secret).update(head).digest('base64url')}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);
const body = (over: object = {}) => ({
  sub: '12', role: 'root', beta: true,
  iss: 'moncamp', aud: 'moncamp-web',
  iat: nowSec(), exp: nowSec() + 900,
  ...over,
});

/** 거부되는가. 거부 이유까지는 안 본다 — 이유별 메시지는 판마다 다르다 */
async function rejected(token: string): Promise<boolean> {
  try { await tokens.verify(token); return false; } catch { return true; }
}

describe('발급한 토큰은 그대로 돌아온다', () => {
  it('권한과 실험 깃발이 왕복한다', async () => {
    const token = await tokens.sign({ sub: '7', role: 'admin', beta: true });
    expect(await tokens.verify(token)).toEqual({ sub: '7', role: 'admin', beta: true });
  });

  it('sub 는 문자열이다 — bigint 를 number 로 담으면 정밀도가 샌다', async () => {
    // users.id 는 bigint 다. 9007199254740993 은 double 로 담는 순간 ...992 가 된다.
    // 남의 줄을 가리키게 되는 값이라 문자열로만 다닌다
    const big = '9007199254740993';
    const token = await tokens.sign({ sub: big, role: 'approved', beta: false });
    const back = await tokens.verify(token);
    expect(back.sub).toBe(big);
    expect(typeof back.sub).toBe('string');
  });
});

describe('위조를 거부한다', () => {
  it('① 서명이 없는 토큰(alg: none)을 안 받는다', async () => {
    expect(await rejected(forge({ alg: 'none', typ: 'JWT' }, body(), null))).toBe(true);
  });

  it('② 알고리즘을 바꾼 토큰을 안 받는다 — HS256 만 받는다', async () => {
    // 열쇠는 맞다. 알고리즘만 HS512 다. 받는 알고리즘을 못 박지 않으면 이것이 통과한다
    expect(await rejected(forge({ alg: 'HS512', typ: 'JWT' }, body(), SECRET))).toBe(true);
  });

  it('③ 본문만 고쳐 이어 붙인 토큰을 안 받는다', async () => {
    const real = await tokens.sign(CLAIMS);
    const [head, , sign] = real.split('.');
    const forged = `${head}.${b64({ ...CLAIMS, role: 'root' })}.${sign}`;
    expect(await rejected(forged)).toBe(true);
  });

  it('④ 남의 열쇠로 서명한 토큰을 안 받는다', async () => {
    expect(await rejected(forge({ alg: 'HS256', typ: 'JWT' }, body(), 'y'.repeat(48)))).toBe(true);
  });

  it('발행자와 수신자가 다르면 안 받는다', async () => {
    // 같은 열쇠를 다른 용도로 쓰는 토큰이 흘러들어오는 것을 막는다
    expect(await rejected(forge({ alg: 'HS256', typ: 'JWT' }, body({ iss: 'somewhere' }), SECRET))).toBe(true);
    expect(await rejected(forge({ alg: 'HS256', typ: 'JWT' }, body({ aud: 'other-app' }), SECRET))).toBe(true);
  });

  it('쓰레기 문자열을 안 받는다', async () => {
    for (const junk of ['', 'a.b.c', 'not-a-token', '...']) {
      expect(await rejected(junk), junk).toBe(true);
    }
  });

  it('권한 칸이 넷 중 하나가 아니면 안 받는다', async () => {
    // 열쇠가 새더라도 role 은 우리가 아는 값이어야 한다. 모르는 값이 atLeast() 에 들어가면
    // RANK[role] 이 undefined 가 되고 비교가 조용히 false 가 된다 — 그쪽으로 안 보낸다
    expect(await rejected(forge({ alg: 'HS256', typ: 'JWT' }, body({ role: 'superuser' }), SECRET))).toBe(true);
  });
});

describe('시간', () => {
  it('만료된 토큰을 안 받고, 만료라고 말한다', async () => {
    // 만료는 다른 거부와 달라야 한다 — 프런트가 '다시 로그인' 이 아니라 '갱신' 으로 가야 하기 때문
    const stale = makeAccessTokens(SECRET, -1);
    const token = await stale.sign(CLAIMS);
    await expect(tokens.verify(token)).rejects.toSatisfy(
      (error: unknown) => error instanceof TokenError && error.reason === 'expired',
    );
  });

  it('만료가 아닌 거부는 invalid 다', async () => {
    await expect(tokens.verify('not-a-token')).rejects.toSatisfy(
      (error: unknown) => error instanceof TokenError && error.reason === 'invalid',
    );
  });

  it('기본 수명은 15분이다 — 짧아야 훔쳐도 오래 못 쓴다', async () => {
    const token = await tokens.sign(CLAIMS);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(900);
  });
});

describe('열쇠', () => {
  it('짧은 열쇠로는 아예 못 만든다', () => {
    // 부팅에서 죽는 쪽이 낫다 — 무른 열쇠로 뜬 서버는 아무 증상이 없다
    expect(() => makeAccessTokens('short')).toThrow();
    expect(() => makeAccessTokens('')).toThrow();
  });
});
