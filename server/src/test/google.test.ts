// ─────────────────────────────────────────────────────────────────────────────
// google.test.ts — 구글 인가 코드 흐름 (v5 Phase 4)
//
// **진짜 구글을 안 부른다.** 자격증명이 있어야 도는 검사는 CI 에서 못 돌고, 못 도는 검사는
// 없는 검사다. 그래서 토큰 주고받는 자리를 가짜 fetch 로, id_token 검증을 검사용 열쇠로 바꾼다.
// 바꿔 끼울 수 있게 만든 것 자체가 설계다 — 못 바꾸면 이 코드는 영영 안 재진다.
//
// **재는 것은 '구글이 맞다고 한 것을 우리가 얼마나 다시 보는가' 다.**
// id_token 은 구글이 서명한 값이지만, 서명이 맞다고 해서 **우리에게 온 것**은 아니다 —
// 다른 앱에 발급된 토큰을 가져다 들이미는 것이 이 흐름의 고전적인 공격이다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect } from 'vitest';
import { SignJWT, generateKeyPair, type CryptoKey } from 'jose';
import { makeGoogleOAuth, newVerifier, challengeOf, randomToken, GoogleError } from '../lib/google.ts';

const CONFIG = {
  clientId: 'test.apps.googleusercontent.com',
  clientSecret: 'GOCSPX-test',
  redirectUri: 'http://localhost:8080/v1/auth/google/callback',
};

const { publicKey, privateKey } = await generateKeyPair('RS256');
const NONCE = 'nonce-1';

/** 구글이 줬을 법한 id_token 을 검사용 열쇠로 짠다 */
async function idToken(over: Record<string, unknown> = {}, key: CryptoKey = privateKey): Promise<string> {
  const claims = {
    sub: 'g-123', email: 'friend@example.test', email_verified: true,
    name: '친구', picture: 'https://x.test/a.png', nonce: NONCE,
    ...over,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(typeof over['iss'] === 'string' ? over['iss'] : 'https://accounts.google.com')
    .setAudience(typeof over['aud'] === 'string' ? over['aud'] : CONFIG.clientId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/** 토큰 주소가 이렇게 답한다고 치고 — 마지막으로 받은 요청도 같이 돌려준다 */
function fakeFetch(reply: { status?: number; body: unknown }) {
  const seen: { url?: string; body?: URLSearchParams } = {};
  const impl = (async (url: string | URL, init?: RequestInit) => {
    seen.url = String(url);
    seen.body = new URLSearchParams(String(init?.body ?? ''));
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { impl, seen };
}

const oauthWith = (fetchImpl: typeof fetch) =>
  makeGoogleOAuth(CONFIG, { fetch: fetchImpl, keys: publicKey });

/** 막히는가. 막혔다면 이유를 돌려준다 */
async function refused(run: () => Promise<unknown>): Promise<string> {
  try { await run(); return '(안 막혔다)'; }
  catch (error) { return error instanceof GoogleError ? error.reason : `(다른 오류: ${String(error)})`; }
}

describe('PKCE — 인가 코드를 가로채도 못 바꾸게', () => {
  it('검증자는 매번 다르고 길이가 규격 안이다', () => {
    // RFC 7636 은 43~128자를 요구한다. 32바이트를 base64url 하면 43자다
    const a = newVerifier();
    expect(a).not.toBe(newVerifier());
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(a.length).toBeLessThanOrEqual(128);
    expect(a).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('도전값은 검증자의 sha256 이다 — 같은 검증자면 같은 값', () => {
    const verifier = newVerifier();
    expect(challengeOf(verifier)).toBe(challengeOf(verifier));
    expect(challengeOf(verifier)).not.toBe(verifier);
  });

  it('state 와 nonce 는 추측할 수 없는 길이다', () => {
    expect(randomToken().length).toBeGreaterThanOrEqual(32);
    expect(randomToken()).not.toBe(randomToken());
  });
});

describe('구글로 보내는 주소', () => {
  const url = () => new URL(makeGoogleOAuth(CONFIG).authorizeUrl({
    state: 'st', nonce: NONCE, codeChallenge: 'ch',
  }));

  it('구글 인가 주소로 간다', () => {
    expect(url().origin + url().pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('인가 코드 흐름에 필요한 칸이 전부 있다', () => {
    const q = url().searchParams;
    expect(q.get('response_type')).toBe('code');
    expect(q.get('client_id')).toBe(CONFIG.clientId);
    expect(q.get('redirect_uri')).toBe(CONFIG.redirectUri);
    expect(q.get('state')).toBe('st');
    expect(q.get('nonce')).toBe(NONCE);
    expect(q.get('code_challenge')).toBe('ch');
    // plain 을 쓰면 가로챈 쪽이 도전값을 그대로 검증자로 쓸 수 있다
    expect(q.get('code_challenge_method')).toBe('S256');
  });

  it('필요한 만큼만 달라고 한다', () => {
    // 이름과 사진은 화면에 쓰고 이메일은 신원 확인에 쓴다. 그 밖은 안 받는다
    expect(url().searchParams.get('scope')).toBe('openid email profile');
  });

  it('구글의 리프레시 토큰을 안 받는다', () => {
    // 세션은 우리가 돌린다(sessions 표). 구글 리프레시까지 받으면 보관할 비밀이 하나 더 는다 —
    // 안 쓸 비밀은 안 받는 것이 제일 싸게 지키는 길이다
    expect(url().searchParams.get('access_type')).toBe('online');
  });

  it('비밀번호는 주소에 안 실린다', () => {
    expect(url().search).not.toContain(CONFIG.clientSecret);
  });
});

describe('코드를 사람으로 바꾼다', () => {
  it('제대로 된 답이면 프로필이 나온다', async () => {
    const { impl, seen } = fakeFetch({ body: { id_token: await idToken() } });
    const profile = await oauthWith(impl).exchange('the-code', 'the-verifier', NONCE);

    expect(profile).toEqual({
      sub: 'g-123', email: 'friend@example.test', name: '친구', picture: 'https://x.test/a.png',
    });
    expect(seen.url).toBe('https://oauth2.googleapis.com/token');
    expect(seen.body?.get('grant_type')).toBe('authorization_code');
    expect(seen.body?.get('code')).toBe('the-code');
    expect(seen.body?.get('code_verifier')).toBe('the-verifier');
    expect(seen.body?.get('client_secret')).toBe(CONFIG.clientSecret);
    expect(seen.body?.get('redirect_uri')).toBe(CONFIG.redirectUri);
  });

  it('★ 다른 앱에 발급된 토큰을 안 받는다', async () => {
    // 구글이 서명한 것은 맞지만 우리에게 온 것이 아니다. aud 를 안 보면
    // 아무 구글 앱의 토큰으로 우리 서비스에 로그인할 수 있다 — 이 흐름의 고전적인 구멍이다
    const { impl } = fakeFetch({ body: { id_token: await idToken({ aud: 'someone-else.apps.googleusercontent.com' }) } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('token');
  });

  it('발행자가 구글이 아니면 안 받는다', async () => {
    const { impl } = fakeFetch({ body: { id_token: await idToken({ iss: 'https://evil.test' }) } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('token');
  });

  it('남의 열쇠로 서명한 토큰을 안 받는다', async () => {
    const other = await generateKeyPair('RS256');
    const { impl } = fakeFetch({ body: { id_token: await idToken({}, other.privateKey) } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('token');
  });

  it('★ nonce 가 다르면 안 받는다', async () => {
    // 우리가 시작하지 않은 로그인이다. 남이 자기 로그인을 남의 브라우저에 밀어 넣는
    // 로그인 CSRF 가 이 자리로 들어온다
    const { impl } = fakeFetch({ body: { id_token: await idToken({ nonce: 'someone-elses' }) } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('nonce');
  });

  it('이메일이 확인되지 않았으면 안 받는다', async () => {
    // 확인 안 된 주소를 신원으로 받으면, 남의 주소를 적은 계정이 그 사람 행세를 한다
    const { impl } = fakeFetch({ body: { id_token: await idToken({ email_verified: false }) } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('email');
  });

  it('이메일이 아예 없으면 안 받는다', async () => {
    const { impl } = fakeFetch({ body: { id_token: await idToken({ email: undefined }) } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('email');
  });

  it('토큰 주소가 오류를 주면 그대로 막는다', async () => {
    const { impl } = fakeFetch({ status: 400, body: { error: 'invalid_grant' } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('exchange');
  });

  it('id_token 이 답에 없으면 막는다', async () => {
    const { impl } = fakeFetch({ body: { access_token: 'ya29.x' } });
    expect(await refused(() => oauthWith(impl).exchange('c', 'v', NONCE))).toBe('exchange');
  });

  it('오류 메시지에 비밀번호가 안 섞인다', async () => {
    // 오류는 로그로 가고 로그는 오래 남는다
    const { impl } = fakeFetch({ status: 400, body: { error: 'invalid_grant' } });
    try { await oauthWith(impl).exchange('c', 'v', NONCE); }
    catch (error) { expect(String(error)).not.toContain(CONFIG.clientSecret); }
  });

  it('이름과 사진이 없어도 빈 글자로 온다', async () => {
    // 화면이 `${undefined}` 를 찍는 일을 서버에서 막는다 (CLAUDE.md §1 과 같은 생각)
    const { impl } = fakeFetch({ body: { id_token: await idToken({ name: undefined, picture: undefined }) } });
    const profile = await oauthWith(impl).exchange('c', 'v', NONCE);
    expect(profile.name).toBe('');
    expect(profile.picture).toBe('');
  });
});
