// ─────────────────────────────────────────────────────────────────────────────
// app/layout.tsx — 문서의 바깥 (v5 Phase 6)
//
// v4 의 index.html 이 하던 일이다. 머리의 글자들은 **같은 문장을 그대로 옮겼다** —
// 검색어가 앞, 브랜드가 뒤. moncamp 는 아직 아무도 모르는 이름이라 맨 앞 자리를 브랜드에
// 주면 그 자리가 버려진다 (v3 부터 이어 온 판단).
//
// 주소마다 달라지는 제목·설명은 페이지가 generateMetadata 로 덮는다.
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '../src/styles';
import Providers from './providers';

const SITE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://moncamp.kr';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: '포켓몬고 다이맥스 티어표 · 맥스 배틀 덱 · 도감 | moncamp',
  description: '포켓몬고 다이맥스·거다이맥스 티어표, 맥스 배틀 덱 짜기, 레이드·PvP 순위, 전 종 도감과 타입 상성, 이벤트 일정을 한 화면에서. 무료 비공식 팬 도구 (Pokémon GO Dynamax tier list · Max Battle deck · Pokédex).',
  // keywords 는 구글이 무시하지만 **네이버는 아직 참고한다** — 한 줄이라 비용이 없다.
  // 띄어쓰기 변형과 줄임말을 넣는다: 사람들은 '맥스배틀' 을 붙여 쓰고 포켓몬고를 '포고' 라 부른다
  keywords: ['포켓몬고', '포켓몬 GO', '포고', '포켓몬고 티어표', '포켓몬고 다이맥스', '다이맥스', '거다이맥스',
    '다이맥스 티어표', '맥스배틀', '맥스 배틀', '맥스배틀 덱', '포켓몬고 레이드 티어표', '포켓몬고 도감',
    '포켓몬고 상성', '타입 상성', '포켓몬고 개체값', 'PvP 랭킹', '포켓몬고 이벤트 일정',
    'Pokemon GO', 'Dynamax', 'Gigantamax', 'Max Battle', 'tier list', 'Pokedex', 'type chart'],
  referrer: 'strict-origin-when-cross-origin',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-512.png' },
  openGraph: {
    type: 'website',
    siteName: 'moncamp',
    title: 'moncamp — 포켓몬고 다이맥스 티어표 · 맥스 배틀 덱 · 도감',
    description: '다이맥스 티어표부터 맥스 배틀 덱까지. 포켓몬고 순위·도감·일정을 한 화면에서 봐요.',
    url: '/',
    locale: 'ko_KR',
    // 화면은 KR/EN 둘 다 된다 — 영어권 공유에서도 같은 카드가 뜨게 밝힌다
    alternateLocale: ['en_US'],
    images: [{ url: '/og-design.png', width: 1733, height: 908, alt: 'moncamp — 도트 캠프와 함께하는 포켓몬 GO 가이드' }],
  },
  twitter: { card: 'summary_large_image' },
  // dev 채널은 색인을 막는다 — 같은 글이 두 주소에 뜨면 검색엔진이 둘을 견준다
  robots: process.env['NEXT_PUBLIC_CHANNEL'] === 'dev' ? { index: false, follow: false } : { index: true, follow: true },
};

/**
 * **첫 그림 전에 테마를 맞춘다.** 번들을 받고 나서 맞추면 흰 화면이 한 번 번쩍인다 —
 * 어두운 테마를 쓰는 사람에게는 매번 눈이 부시다.
 *
 * 저장소를 막은 브라우저에서는 조용히 넘어간다. 값 이름은 `pogo_theme` 그대로다 —
 * 브라우저에 이미 들어 있어 바꾸면 남의 설정이 끊긴다 (CLAUDE.md §2).
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('pogo_theme');
if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;return;}
document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}catch(e){}})();`;

/**
 * **옛 해시 주소를 이어 준다** (v5 Phase 6).
 *
 * `#` 뒤는 서버로 안 간다 — 그래서 `next.config.ts` 의 308 리다이렉트로는 못 잡는다.
 * 이미 공유된 링크(`https://moncamp.kr/#/mon/25`)와 북마크가 살아 있어야 하므로
 * 문서 머리에서 한 번 본다. 경로 문자열 자체는 안 바뀌므로 1:1 이다 (CLAUDE.md §2).
 *
 * `replace` 라 뒤로가기 기록에 옛 주소가 쌓이지 않는다.
 */
const HASH_SCRIPT = `(function(){try{var h=location.hash;
if(h.length<3||h.charAt(1)!=='/')return;
var p=h.slice(1);
if(location.pathname!=='/'&&location.pathname!=='')return;
location.replace(p);}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: HASH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
