// ─────────────────────────────────────────────────────────────────────────────
// loginState.ts — 구글에 다녀오는 동안 잊으면 안 되는 셋을 브라우저에 맡긴다 (v5 Phase 4)
//
// 로그인은 두 요청으로 나뉜다. 시작에서 만든 state · nonce · PKCE 검증자를 콜백에서 다시
// 봐야 하는데, **그 사이에 서버는 아무것도 기억하지 않는다** (Cloud Run 은 인스턴스를 재운다).
//
// **표를 만들지 않고 쿠키에 담는다.** 담을 것이 셋뿐이고 수명이 10분이라, 표를 만들면
// 그 표를 쓸어 담는 일까지 같이 생긴다. 대신 서명해서 담는다 — 서명이 없으면 브라우저가
// state 를 고쳐 자기가 시작하지 않은 로그인을 우리가 시작한 것처럼 꾸밀 수 있다.
//
// **검증자는 브라우저에 있어도 된다.** PKCE 가 막는 것은 '인가 코드를 가로챈 남'이지
// 브라우저 자신이 아니다. httpOnly 라 그 페이지의 스크립트도 못 읽는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { SignJWT, jwtVerify, errors } from 'jose';

/** 사람이 구글 화면에서 머뭇거릴 수 있는 만큼. 길게 두면 훔칠 창이 길어진다 */
const TTL_SECONDS = 600;
const ISSUER = 'moncamp';
const AUDIENCE = 'moncamp-login';

export const LOGIN_COOKIE = 'moncamp_login';

export interface LoginState {
  state: string;
  nonce: string;
  verifier: string;
  /** 로그인을 마치고 돌아갈 앱 안의 경로. **경로만 받는다** — 아래 safePath 참고 */
  next: string;
  /**
   * 로그인을 시작한 화면의 origin (v5 Phase 7). dev.moncamp.kr 에서 누르면 dev 로 돌아와야 한다.
   * **여기서는 믿지 않는다** — 봉인은 위조를 막을 뿐 처음 넣은 값이 옳다는 뜻이 아니다.
   * 돌려보내기 직전에 라우트가 ALLOWED_ORIGINS 로 다시 거른다. 옛 쿠키에는 없어 빈 문자열이다
   */
  origin: string;
}

export interface LoginStateCodec {
  seal(value: LoginState): Promise<string>;
  open(sealed: string): Promise<LoginState | null>;
  readonly ttlSeconds: number;
}

/**
 * 돌아갈 자리는 **앱 안의 경로**여야 한다.
 * `//evil.test` 나 `https://evil.test` 를 그대로 붙이면 열린 리다이렉트가 된다 —
 * 로그인시킨 브라우저를 남의 사이트로 보내는 길이다. `/` 하나로 시작하고 `//` 가 아닌 것만 받는다
 */
export function safePath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  // 역슬래시를 슬래시로 읽는 브라우저가 있다 — `/\evil.test` 가 그 틈이다
  if (raw.includes('\\')) return '/';
  return raw.slice(0, 500);
}

export function makeLoginState(secret: string): LoginStateCodec {
  const key = new TextEncoder().encode(secret);
  return {
    ttlSeconds: TTL_SECONDS,

    async seal(value) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({ ...value })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(ISSUER)
        // **액세스 토큰과 다른 aud 를 쓴다.** 같으면 이 쿠키를 액세스 토큰 자리에 들이밀 수 있다
        .setAudience(AUDIENCE)
        .setIssuedAt(now)
        .setExpirationTime(now + TTL_SECONDS)
        .sign(key);
    },

    async open(sealed) {
      try {
        const { payload } = await jwtVerify(sealed, key, {
          algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
        });
        const { state, nonce, verifier, next, origin } = payload as Record<string, unknown>;
        if (typeof state !== 'string' || typeof nonce !== 'string' || typeof verifier !== 'string') return null;
        return { state, nonce, verifier, next: safePath(next), origin: typeof origin === 'string' ? origin : '' };
      } catch (error) {
        // 만료도 위조도 여기서는 같은 답이다 — 어느 쪽이든 다시 시작해야 한다
        void (error instanceof errors.JWTExpired);
        return null;
      }
    },
  };
}
