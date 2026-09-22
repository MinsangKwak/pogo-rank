// ─────────────────────────────────────────────────────────────────────────────
// app/sitemap.ts — 색인해 달라고 내미는 목록 (v5 Phase 6)
//
// **전에는 낼 것이 없었다.** 주소가 전부 해시라(`#/mon/25`) 서버가 아는 주소는 `/` 하나였다.
// 1,184종이 생겼으니 그것을 적는다 — 크롤러가 스스로 찾아내기를 기다리지 않는다.
//
// 우선순위는 **바뀌는 빈도**로 가른다. 순위표는 매일 다시 굽고 도감은 거의 안 바뀐다
// ─────────────────────────────────────────────────────────────────────────────
import type { MetadataRoute } from 'next';
import { ROUTES, type RouteDef } from '../src/routes';
import { allSprites } from '../src/lib/facts.server';

const SITE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://moncamp.kr';

/** 매일 다시 구워지는 자리 */
const DAILY = new Set(['dmax', 'pve', 'pvp', 'raids', 'eggs', 'schedule', 'game-updates']);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // 잠긴 화면(로그인·승인)은 안 적는다 — 크롤러가 들어가도 볼 것이 없다
  const pages = (ROUTES as readonly RouteDef[])
    .filter((route) => route.kind !== 'detail' && !route.locked)
    .map((route) => ({
      url: `${SITE}/${route.path}`,
      lastModified: now,
      changeFrequency: (DAILY.has(route.id) ? 'daily' : 'weekly') as 'daily' | 'weekly',
      priority: route.path === '' ? 1 : 0.8,
    }));

  const mons = allSprites().map((sprite) => ({
    url: `${SITE}/mon/${sprite}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...pages, ...mons];
}
