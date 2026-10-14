// ─────────────────────────────────────────────────────────────────────────────
// app/%5Fredirects/route.ts — Cloudflare Pages 의 `_redirects` 파일 (2026-10-15)
//
// 옛 주소(#/… 를 뗀 v4 경로)를 308 로 옮긴다 — Vercel 에서는 next.config.ts 의 redirects() 가 하던 일.
// 정적 내보내기에서 out/_redirects 로 구워진다. 내용은 src/lib/hosting.ts 한 곳
// ─────────────────────────────────────────────────────────────────────────────
import { redirectsFile } from '../../src/lib/hosting';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(redirectsFile(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
