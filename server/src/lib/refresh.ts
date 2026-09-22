// ─────────────────────────────────────────────────────────────────────────────
// refresh.ts — 리프레시 토큰을 만들고 해시한다.
//
// **JWT 가 아니다.** 리프레시는 담을 내용이 없다 — 서버가 세션 표를 보고 판정하므로
// 토큰은 그저 '그 줄을 가리키는 못 외우는 값' 이면 된다. JWT 로 만들면 회전과 폐기를
// 하려고 어차피 표를 봐야 하는데, 서명까지 얹으면 읽을 것만 는다.
//
// **원문은 DB 에 안 둔다.** sha256 만 담는다 — DB 가 통째로 새도 남의 세션으로 못 들어온다.
// 솔트를 안 쓰는 이유는 값이 256비트 난수라서다. 사전 공격의 대상이 아니다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { randomBytes, createHash } from 'node:crypto';

/** 256비트. 추측이 가능한 길이가 아니다 */
const BYTES = 32;

export function newRefreshToken(): string {
  return randomBytes(BYTES).toString('base64url');
}

/** 표의 refresh_hash 에 들어갈 값. bytea 라 Buffer 그대로 바인딩된다 */
export function hashRefresh(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
