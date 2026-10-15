// ─────────────────────────────────────────────────────────────────────────────
// app/%5Fheaders/route.ts — Cloudflare Pages 의 `_headers` 파일 (2026-10-15)
//
// 폴더 이름의 %5F 는 밑줄이다 — 밑줄로 시작하는 폴더는 Next 가 감춰서, 주소 `/_headers` 를 만들려면 이렇게 적는다.
// 정적 내보내기(BUILD_TARGET=static)에서 out/_headers 로 구워지고 Cloudflare Pages 가 읽는다. 내용은 src/lib/hosting.ts 한 곳
// ─────────────────────────────────────────────────────────────────────────────
import { headersFile } from '../../src/lib/hosting';

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(headersFile(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
