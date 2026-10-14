// ─────────────────────────────────────────────────────────────────────────────
// lib/hosting.ts — 응답 헤더 · 옛 주소 이동의 원본 한 벌 (2026-10-15 Cloudflare Pages 이전)
//
// Vercel 에서는 next.config.ts 의 headers() · redirects() 가 이 표를 읽어 서버가 붙였다.
// Cloudflare Pages 는 정적 파일만 올리므로 같은 표를 `_headers` · `_redirects` 파일로 굽는다(app/%5Fheaders · app/%5Fredirects).
// **표를 두 벌 적지 않는다** — 두 호스팅이 같은 값을 내야 옮기는 동안 헤더 하나가 조용히 빠지지 않는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { ROUTE_LEGACY } from '../routes';

// [이름, 값] — 값은 Cloudflare 에 넣었던 것과 글자까지 같다 (docs/INFRA.md §8 의 3번 표)
export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  // <meta> 로는 못 넣는 것 — 클릭재킹 방어
  ['Content-Security-Policy', "frame-ancestors 'self'"],
  ['Permissions-Policy', 'geolocation=(), microphone=(), camera=()'],
];

/**
 * Cloudflare Pages `_headers` — 모든 주소에 보안 헤더, 이름에 해시가 박힌 번들은 1년 캐시.
 * 번들(/_next/static)은 내용이 바뀌면 이름이 바뀐다 — 오래 둬도 옛 판이 남지 않는다
 */
export function headersFile(): string {
  const lines = ['/*', ...SECURITY_HEADERS.map(([name, value]) => `  ${name}: ${value}`),
    '', '/_next/static/*', '  Cache-Control: public, max-age=31536000, immutable'];
  return `${lines.join('\n')}\n`;
}

/**
 * Cloudflare Pages `_redirects` — 옛 주소를 308 로 옮긴다 (next.config.ts 의 redirects() 와 같은 짝).
 * 정확히 그 주소 한 줄, 그 아래 주소(`/rank/pve/뭐든`) 한 줄
 */
export function redirectsFile(): string {
  const lines = [...ROUTE_LEGACY].flatMap(([old, next]) => [
    `/${old} /${next} 308`,
    `/${old}/* /${next}/:splat 308`,
  ]);
  return `${lines.join('\n')}\n`;
}
