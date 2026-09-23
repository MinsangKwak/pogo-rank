// ─────────────────────────────────────────────────────────────────────────────
// google.ts — 구글 인가 코드 흐름. **구글과 말하는 일은 이 파일에서만 한다.**
//
// **왜 인가 코드 흐름인가.** 암묵적 흐름(토큰을 주소로 받는 것)은 토큰이 브라우저 기록과
// 리퍼러에 남는다. 인가 코드는 한 번 쓰면 죽는 값이고, 그것을 토큰으로 바꾸는 일은
// 비밀번호를 쥔 서버만 할 수 있다 — 브라우저는 토큰을 구경도 못 한다.
//
// **PKCE 를 함께 쓴다.** 비밀번호가 서버에만 있으니 이론상 없어도 되지만, 코드가 가로채여
// 우리 콜백보다 먼저 도착하는 경우를 막는다. 검증자를 모르면 코드만으로는 아무것도 못 한다.
//
// **서명이 맞다고 해서 우리에게 온 것은 아니다.** 이 흐름의 고전적인 구멍이 aud 를 안 보는 것이다 —
// 아무 구글 앱의 id_token 이나 가져다 들이밀면 로그인이 된다. 그래서 넷을 다시 본다:
// 서명 · 발행자 · **수신자(aud)** · **우리가 낸 nonce**.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { randomBytes, createHash } from 'node:crypto';
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey, type CryptoKey } from 'jose';
import type { GoogleProfile } from '../services/auth.ts';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
/** 구글은 둘 다 쓴다 — 스킴이 붙은 쪽과 안 붙은 쪽 */
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** 거부의 이유. 화면에 다른 말을 띄워야 하는 만큼만 가른다 */
export class GoogleError extends Error {
  constructor(readonly reason: 'exchange' | 'token' | 'nonce' | 'email', message: string) {
    super(message);
    this.name = 'GoogleError';
  }
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface StartParams {
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface GoogleOAuth {
  authorizeUrl(params: StartParams): string;
  exchange(code: string, codeVerifier: string, nonce: string): Promise<GoogleProfile>;
}

/** state · nonce 처럼 '추측할 수 없으면 되는' 값 */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** PKCE 검증자. RFC 7636 은 43~128자를 요구하고, 32바이트를 base64url 하면 43자다 */
export function newVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/** 검증자의 sha256. 구글에는 이것만 보내고 검증자는 우리가 쥐고 있는다 */
export function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export interface GoogleDeps {
  /** 검사가 갈아 끼운다 — 진짜 구글을 부르는 검사는 CI 에서 못 돈다 */
  fetch?: typeof fetch;
  /** 기본은 구글의 공개 인증서. 검사는 제 열쇠를 준다 */
  keys?: JWTVerifyGetKey | CryptoKey;
}

export function makeGoogleOAuth(config: GoogleConfig, deps: GoogleDeps = {}): GoogleOAuth {
  const call = deps.fetch ?? fetch;
  // createRemoteJWKSet 은 받아 온 열쇠를 스스로 캐시한다 — 로그인마다 구글을 부르지 않는다
  const keys = deps.keys ?? createRemoteJWKSet(new URL(CERTS_URL));

  return {
    authorizeUrl({ state, nonce, codeChallenge }) {
      const query = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        // 이름과 사진은 화면에 쓰고 이메일은 신원 확인에 쓴다. 그 밖은 안 받는다
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        // plain 을 쓰면 가로챈 쪽이 도전값을 그대로 검증자로 쓸 수 있다
        code_challenge_method: 'S256',
        // **구글의 리프레시 토큰을 안 받는다.** 세션은 우리가 돌린다(sessions 표) —
        // 안 쓸 비밀은 안 받는 것이 제일 싸게 지키는 길이다
        access_type: 'online',
        prompt: 'select_account',
      });
      return `${AUTHORIZE_URL}?${query.toString()}`;
    },

    async exchange(code, codeVerifier, nonce) {
      let payload: { id_token?: unknown };
      try {
        const response = await call(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            code_verifier: codeVerifier,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
        });
        // **답 본문을 오류에 안 싣는다.** 오류는 로그로 가고 로그는 오래 남는다 —
        // 그 본문에 우리가 보낸 값이 되비치는 경우가 있다
        if (!response.ok) {
          throw new GoogleError('exchange', `구글 토큰 주소가 ${response.status} 를 줬습니다`);
        }
        payload = (await response.json()) as { id_token?: unknown };
      } catch (error) {
        if (error instanceof GoogleError) throw error;
        throw new GoogleError('exchange', '구글 토큰 주소와 말하지 못했습니다');
      }

      if (typeof payload.id_token !== 'string') {
        throw new GoogleError('exchange', '구글 답에 id_token 이 없습니다');
      }

      let claims: Record<string, unknown>;
      try {
        // 알고리즘·발행자·**수신자**를 못 박는다. aud 를 안 보면 아무 구글 앱의 토큰이나 통한다
        const result = await jwtVerify(payload.id_token, keys as JWTVerifyGetKey, {
          algorithms: ['RS256'],
          issuer: ISSUERS,
          audience: config.clientId,
        });
        claims = result.payload as Record<string, unknown>;
      } catch {
        throw new GoogleError('token', '구글 id_token 을 믿을 수 없습니다');
      }

      // **우리가 시작한 로그인인가.** 남이 자기 로그인을 남의 브라우저에 밀어 넣는
      // 로그인 CSRF 가 이 자리로 들어온다
      if (claims['nonce'] !== nonce) {
        throw new GoogleError('nonce', '우리가 시작한 로그인이 아닙니다');
      }

      const { sub, email, email_verified: verified } = claims;
      if (typeof sub !== 'string' || !sub) {
        throw new GoogleError('token', 'id_token 에 sub 가 없습니다');
      }
      // 확인 안 된 주소를 신원으로 받으면, 남의 주소를 적은 계정이 그 사람 행세를 한다
      if (typeof email !== 'string' || !email || verified !== true) {
        throw new GoogleError('email', '확인된 이메일이 아닙니다');
      }

      // 빈 값을 빈 글자로 내린다 — 화면이 `${undefined}` 를 찍는 일을 서버에서 막는다 (CLAUDE.md §1)
      return {
        sub,
        email,
        name: typeof claims['name'] === 'string' ? claims['name'] : '',
        picture: typeof claims['picture'] === 'string' ? claims['picture'] : '',
      };
    },
  };
}
