// ─────────────────────────────────────────────────────────────────────────────
// app/[...slug]/page.tsx — 홈 말고 전부 (v5 Phase 6)
//
// **화면을 스무 파일로 쪼개지 않았다.** 셸은 주소를 보고 본문을 고르는 한 덩어리라
// (src/App.tsx), 쪼개면 그 판단이 파일 수만큼 복사된다. 여기서 하는 일은 셋이다.
//
//   ① 구울 주소 목록 — 라우트 표 + 스프라이트 1,184장 (generateStaticParams)
//   ② 주소마다 다른 제목·설명·정규 주소 (generateMetadata)
//   ③ 상세 주소에는 **미리 그린 사실**을 넘겨 준다 — 크롤러가 읽는 것이 그것이다
//
// Next 는 클라이언트 컴포넌트도 HTML 로 먼저 그린다. 그래서 셸이 'use client' 여도
// 문서에는 내용이 실린다 — 데이터를 기다리는 자리만 비어 있고, 그 자리를 ③ 이 채운다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RouteIntro from '../../src/components/RouteIntro';
import { ROUTES, routeOfPath, routeDesc } from '../../src/routes';
import { allSprites, monFacts } from '../../src/lib/facts.server';
import MonFacts, { monTitle, monDescription } from '../../src/components/MonFacts';

/**
 * 표에 없는 주소도 그린다. 라우트 아래의 자유로운 뒷부분(`/game-updates/<id>` ·
 * `/dmax/deck`)이 있어서다 — 아래 page 가 라우트를 못 찾으면 그때 404 를 낸다
 */
export const dynamicParams = true;

export function generateStaticParams(): { slug: string[] }[] {
  const pages = ROUTES
    .filter((route) => route.path && route.kind !== 'detail')
    .map((route) => ({ slug: route.path.split('/') }));
  // **1,184장.** 이것이 이 판의 목적이다 — 종마다 색인될 주소가 하나씩 생긴다
  const mons = allSprites().map((sprite) => ({ slug: ['mon', String(sprite)] }));
  return [...pages, ...mons];
}

function spriteOf(slug: string[]): number | null {
  if (slug[0] !== 'mon' || slug.length !== 2) return null;
  const sprite = Number(slug[1]);
  return Number.isInteger(sprite) && sprite > 0 ? sprite : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join('/');

  const sprite = spriteOf(slug);
  if (sprite !== null) {
    const facts = monFacts(sprite);
    if (facts) {
      return {
        title: monTitle(facts),
        description: monDescription(facts),
        alternates: { canonical: `/mon/${sprite}` },
        openGraph: {
          title: monTitle(facts),
          description: monDescription(facts),
          url: `/mon/${sprite}`,
          images: [{ url: `/sprites/${sprite}.png`, alt: facts.name }],
        },
      };
    }
  }

  const found = routeOfPath(path);
  if (!found) return {};
  const title = found.route.title ?? found.route.nav ?? 'moncamp';
  const description = routeDesc(found.route.id);
  // 루트 화면은 검색에 안 올린다 — 사이트맵에도 없다(잠긴 화면)
  // 루트 화면은 정적 머리에도 이름을 안 적는다 — 주소만 알아도 '운영 통계' 가 있다는 것이 드러난다. 검색 · 사이트맵에도 없다
  if ('root' in found.route && found.route.root) return { title: 'moncamp', robots: { index: false, follow: false } };
  return {
    title: `${title} | moncamp`,
    ...(description ? { description } : {}),
    alternates: { canonical: `/${found.route.path}` },
    openGraph: {
      title: `${title} — moncamp`,
      ...(description ? { description } : {}),
      url: `/${found.route.path}`,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const path = slug.join('/');

  const sprite = spriteOf(slug);
  if (sprite !== null) {
    const facts = monFacts(sprite);
    // 모르는 번호면 404 다 — 200 으로 빈 화면을 주면 검색엔진이 그것을 색인한다
    if (!facts) notFound();
    return <MonFacts facts={facts} />;
  }

  const found = routeOfPath(path);
  if (!found) notFound();
  return <RouteIntro route={found.route} />;
}
