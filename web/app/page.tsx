// ─────────────────────────────────────────────────────────────────────────────
// app/page.tsx — 홈 (v5 Phase 6)
// ─────────────────────────────────────────────────────────────────────────────
import { HERO_ART } from '../src/lib/heroArt';
import RouteIntro from '../src/components/RouteIntro';
import { ROUTES } from '../src/routes';

export default function HomePage() {
  return (
    <>
      {/* **첫 그림(LCP)을 스크립트와 나란히 받는다.** 이 그림의 <img> 는 앱이 붙어야 생기므로,
          미리 안 받으면 앱이 뜬 뒤에야 요청이 나간다 (실측 3.9초). React 가 이 link 를
          문서 머리로 올려 준다. 화면과 같은 주소를 쓴다 — lib/heroArt.ts 한 곳에 적혀 있다 */}
      <link rel="preload" as="image" href={HERO_ART.src}
        imageSrcSet={HERO_ART.srcSet} imageSizes={HERO_ART.sizes} fetchPriority="high" />
      <RouteIntro route={ROUTES[0]} />
    </>
  );
}
