// ─────────────────────────────────────────────────────────────────────────────
// lib/hosting.ts — 응답 헤더 · 옛 주소 이동의 원본 한 벌 (2026-10-15 Cloudflare Pages 이전)
//
// Vercel 에서는 next.config.ts 의 headers() · redirects() 가 이 표를 읽어 서버가 붙였다.
// Cloudflare Pages 는 정적 파일만 올리므로 같은 표를 `_headers` · `_redirects` 파일로 굽는다(app/%5Fheaders · app/%5Fredirects).
// **표를 두 벌 적지 않는다** — 두 호스팅이 같은 값을 내야 옮기는 동안 헤더 하나가 조용히 빠지지 않는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { ROUTES, ROUTE_LEGACY } from '../routes';

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
 * 옛 주소 → 새 주소, 위에서부터 처음 맞는 줄을 쓴다. `/*` 는 그 아래 주소 전부.
 * **두 호스팅이 이 표 하나를 쓴다** — Cloudflare Pages 는 `_redirects`(redirectsFile), Vercel 은 next.config.ts 의 redirects().
 * Vercel 판도 `dynamicParams = false` 로 구운 주소만 있어, 뒷부분을 붙여 옮기면 전환 전 · rollback 뒤에도 404 다 (Codex, PR #372)
 *
 * **그 아래 주소는 구운 화면이면 그대로, 아니면 새 화면의 맨 주소로 보낸다.** Vercel 에서는 `/pve/뭐든` 을 요청 때 그려
 * `/pve` 화면을 냈지만, 정적 빌드에는 구운 주소만 있어 뒷부분을 붙여 옮기면 404 가 된다(Codex, PR #372).
 * 다만 `/rank/pve/solo` 처럼 뒷부분이 그 자체로 구운 화면(`/pve/solo`)이면 그 화면으로 보낸다 — 맨 주소로 뭉개면 다른 화면이 뜬다(Codex, PR #374).
 * 정확한 줄을 와일드카드보다 먼저 적는다 — Cloudflare 는 위에서부터 처음 맞는 줄을 쓴다
 */
export function legacyRedirects(): ReadonlyArray<readonly [string, string]> {
  const baked = ROUTES.filter((route) => route.path && route.kind !== 'detail').map((route) => route.path);
  return [...ROUTE_LEGACY].flatMap(([old, next]): (readonly [string, string])[] => [
    [`/${old}`, `/${next}`],
    ...baked.filter((path) => path.startsWith(`${next}/`)).map((path) => [`/${old}/${path.slice(next.length + 1)}`, `/${path}`] as const),
    [`/${old}/*`, `/${next}`],
  ]);
}

/** Cloudflare Pages `_redirects` — legacyRedirects() 를 308 줄로 */
export function redirectsFile(): string {
  return `${legacyRedirects().map(([from, to]) => `${from} ${to} 308`).join('\n')}\n`;
}
