// ─────────────────────────────────────────────────────────────────────────────
// jwt.ts — 액세스 토큰의 **관문**. 서명과 검증은 이 파일에서만 한다.
//
// **왜 직접 안 짜나.** HMAC 자체는 표준 라이브러리에 있으니 서명은 열 줄이면 된다.
// 문제는 검증이다 — alg 를 못 박지 않아 `none` 을 받거나, 만료를 안 보거나, 서명을
// 비상수 시간으로 견주는 실수가 JWT 사고의 거의 전부고, 셋 다 아무 증상이 없다.
// 그래서 검증된 라이브러리(jose)를 쓰고, **우리가 할 일은 그것을 좁게 설정하는 것**이다.
// jose 의 기본값은 넉넉한 쪽이라 좁히지 않으면 열린 채로 돈다 — test/jwt.test.ts 가 그 좁힘을 잰다.
//
// **담는 것을 최소로 둔다.** 이름도 이메일도 안 담는다. 토큰은 브라우저에 있는 물건이고,
// 담은 값은 만료 전까지 못 무른다 — 권한이 바뀌어도 15분은 옛 권한으로 돈다.
// 그래서 수명이 짧고, 되돌려야 할 일(차단·강퇴)은 리프레시 회전이 맡는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { SignJWT, jwtVerify, errors } from 'jose';
import { isRole, type Role } from './rbac.ts';

/** 같은 열쇠를 다른 용도로 쓰는 토큰이 흘러들어오는 것을 막는 한 쌍 */
const ISSUER = 'moncamp';
const AUDIENCE = 'moncamp-web';

/** 15분. 훔쳐도 오래 못 쓰는 길이이면서, 15분마다 갱신이 도는 부담은 없는 자리 */
const DEFAULT_TTL_SECONDS = 900;

/** HS256 의 열쇠는 해시 출력(32바이트)보다 짧을 이유가 없다 */
const MIN_SECRET_BYTES = 32;

/** 거부의 이유. **만료는 나머지와 갈라야 한다** — 프런트가 '다시 로그인' 이 아니라 '갱신' 으로 가야 한다 */
export class TokenError extends Error {
  constructor(readonly reason: 'expired' | 'invalid', message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

export interface AccessClaims {
  /** users.id. **문자열이다** — bigint 를 number 로 담으면 큰 값에서 정밀도가 새고 남의 줄을 가리킨다 */
  sub: string;
  role: Role;
  beta: boolean;
}

export interface AccessTokens {
  sign(claims: AccessClaims): Promise<string>;
  verify(token: string): Promise<AccessClaims>;
  readonly ttlSeconds: number;
}

export function makeAccessTokens(secret: string, ttlSeconds = DEFAULT_TTL_SECONDS): AccessTokens {
  // 무른 열쇠로 뜬 서버는 아무 증상이 없다 — 만드는 자리에서 죽는 쪽이 낫다
  if (Buffer.byteLength(secret) < MIN_SECRET_BYTES) {
    throw new Error(`JWT 열쇠가 ${MIN_SECRET_BYTES}바이트보다 짧습니다 — openssl rand -hex 32 로 만듭니다`);
  }
  const key = new TextEncoder().encode(secret);

  return {
    ttlSeconds,

    async sign(claims) {
      // iat 를 직접 넣는다 — exp 와 같은 시각에서 재야 수명이 정확히 ttl 이 된다
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({ role: claims.role, beta: claims.beta })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(claims.sub)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt(now)
        .setExpirationTime(now + ttlSeconds)
        .sign(key);
    },

    async verify(token) {
      let payload: Record<string, unknown>;
      try {
        // **알고리즘을 못 박는다.** 안 박으면 헤더가 시키는 대로 검증한다 —
        // alg: none 과 HS512 바꿔치기가 그 틈으로 들어온다
        const result = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          issuer: ISSUER,
          audience: AUDIENCE,
        });
        payload = result.payload as Record<string, unknown>;
      } catch (error) {
        if (error instanceof errors.JWTExpired) throw new TokenError('expired', '토큰이 만료됐습니다');
        throw new TokenError('invalid', '토큰이 올바르지 않습니다');
      }

      // **서명이 맞아도 모양을 다시 본다.** 우리가 발급한 토큰이라도 판이 바뀌면 칸이 달라질 수 있고,
      // 모르는 role 이 rbac 의 비교에 들어가면 `undefined >= n` 이 조용히 false 가 된다
      const { sub, role, beta } = payload;
      if (typeof sub !== 'string' || !sub) throw new TokenError('invalid', '토큰에 sub 가 없습니다');
      if (!isRole(role)) throw new TokenError('invalid', '토큰의 권한 값을 모릅니다');
      if (typeof beta !== 'boolean') throw new TokenError('invalid', '토큰의 beta 가 참/거짓이 아닙니다');
      return { sub, role, beta };
    },
  };
}
