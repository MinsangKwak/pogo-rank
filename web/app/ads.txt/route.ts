// ─────────────────────────────────────────────────────────────────────────────
// app/ads.txt/route.ts — 광고 판매 권한 파일 (2026-10-14, 수익화 전 점검)
//
// AdSense 는 사이트 루트의 /ads.txt 로 '이 사이트의 광고를 팔 수 있는 게시자' 를 확인한다. 없으면 심사 · 수익이 깎인다.
// 게시자 ID 는 AdSense 승인 뒤에야 생긴다 — 그래서 파일을 손으로 두지 않고 빌드 값(NEXT_PUBLIC_ADSENSE_CLIENT)으로 만든다.
// 값이 없으면 404 그대로다(지금). 값을 넣고 다시 배포하면 한 줄이 선다 — 줄 모양은 src/lib/ads.ts 의 adsTxtLine 한 곳
// ─────────────────────────────────────────────────────────────────────────────
import { adsTxtLine } from '../../src/lib/ads';

// 빌드 때 한 번 굽는다 — 요청마다 돌 이유가 없다
export const dynamic = 'force-static';

export function GET(): Response {
  const line = adsTxtLine(process.env['NEXT_PUBLIC_ADSENSE_CLIENT']);
  if (!line) return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(`${line}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
