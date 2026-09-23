// ─────────────────────────────────────────────────────────────────────────────
// app/robots.ts — 크롤러에게 하는 말 (v5 Phase 6)
//
// **dev 채널은 통째로 막는다.** 같은 글이 두 주소에 뜨면 검색엔진이 둘을 견주고,
// 진짜 쪽이 밀릴 수 있다. v4 는 이것을 빌드 뒤 HTML 을 고쳐 했다 (finalize-html.mjs) —
// 여기서는 채널을 보고 만든다.
// ─────────────────────────────────────────────────────────────────────────────
import type { MetadataRoute } from 'next';

const SITE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://moncamp.kr';
const isDev = process.env['NEXT_PUBLIC_CHANNEL'] === 'dev';

export default function robots(): MetadataRoute.Robots {
  if (isDev) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
