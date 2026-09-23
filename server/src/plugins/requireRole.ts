// ─────────────────────────────────────────────────────────────────────────────
// plugins/requireRole.ts — 권한을 요구하는 문 하나. (v5 Phase 4)
//
// **판정은 lib/rbac.ts 가 하고 여기는 문만 연다.** 라우트마다 `if (role !== 'admin')` 을
// 적으면 규칙이 화면 수만큼 늘어난다 — Firestore 에서 규칙과 화면 코드가 두 벌이 됐던 자리다.
//
// **액세스 토큰만 본다. DB 를 안 읽는다.** 요청마다 users 를 읽으면 Cloud Run 이
// 잠에서 깰 때마다 DB 왕복이 는다. 권한이 바뀌면 다음 회전(최대 15분)에 따라온다 —
// 즉시 끊어야 하는 일(강퇴)은 리프레시 사슬을 끊는 쪽이 맡는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { TokenError, type AccessClaims, type AccessTokens } from '../lib/jwt.ts';
import { atLeast, type Role } from '../lib/rbac.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** requireRole 을 통과한 요청에만 있다 */
    claims?: AccessClaims;
  }
}

/** `Authorization: Bearer <토큰>` 에서 토큰만. 모양이 아니면 빈 글자 */
function bearer(request: FastifyRequest): string {
  const header = request.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function makeRequireRole(tokens: AccessTokens) {
  return function requireRole(min: Role): preHandlerHookHandler {
    return async function check(request: FastifyRequest, reply: FastifyReply) {
      const token = bearer(request);
      if (!token) return reply.code(401).send({ error: '로그인이 필요합니다', reason: 'missing' });

      let claims: AccessClaims;
      try {
        claims = await tokens.verify(token);
      } catch (error) {
        // **만료를 따로 말해 준다.** 프런트가 '다시 로그인' 이 아니라 '갱신' 으로 가야 한다 —
        // 이 한 칸이 없으면 15분마다 로그인 화면이 뜬다
        const reason = error instanceof TokenError ? error.reason : 'invalid';
        return reply.code(401).send({ error: '토큰을 믿을 수 없습니다', reason });
      }

      if (!atLeast(claims.role, min)) {
        // 403 이다. 401 이 아니다 — 다시 로그인해도 달라지지 않는다
        return reply.code(403).send({ error: '권한이 없습니다', reason: 'forbidden' });
      }
      request.claims = claims;
    };
  };
}
