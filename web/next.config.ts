// ─────────────────────────────────────────────────────────────────────────────
// next.config.ts — v5 Phase 6
//
// **옛 주소를 서버가 옮긴다.** v3·v4 는 화면 안에서 `location.replace('#/…')` 로 옮겼는데,
// 해시는 서버로 안 가므로 크롤러에게는 옛 주소가 그대로였다. 여기서 308 로 옮기면
// 검색엔진이 '옮겨 갔다' 를 알아듣고 색인을 따라 옮긴다.
//
// 표를 손으로 두 번 적지 않는다 — `src/routes.ts` 의 legacy 에서 뒤집어 만든 것을 그대로 읽는다.
// ─────────────────────────────────────────────────────────────────────────────
import type { NextConfig } from 'next';
import { ROUTE_LEGACY } from './src/routes';

const config: NextConfig = {
  reactStrictMode: true,
  // 그림은 v3 빌드가 만든 것을 그대로 쓴다 — 2,000장이 넘어 최적화를 거칠 이유가 없다
  images: { unoptimized: true },

  // 도면(스토리북)은 dev 의 /storybook/ 에 얹힌다 (CLAUDE.md §1-c · dev-pipeline.yml).
  // public/ 의 폴더 주소는 index.html 로 안 풀린다 — 그대로 두면 [...slug] 가 받아 앱의 404 가 된다.
  // 운영에는 이 폴더가 없어 이 규칙이 아무것도 안 한다
  async rewrites() {
    return [
      { source: '/storybook', destination: '/storybook/index.html' },
      { source: '/storybook/', destination: '/storybook/index.html' },
    ];
  },

  async redirects() {
    return [...ROUTE_LEGACY].flatMap(([old, next]) => [
      // 정확히 그 주소
      { source: `/${old}`, destination: `/${next}`, permanent: true },
      // 그 아래 (예: rank/pve/뭐든 → pve/뭐든)
      { source: `/${old}/:rest*`, destination: `/${next}/:rest*`, permanent: true },
    ]);
  },
};

export default config;
