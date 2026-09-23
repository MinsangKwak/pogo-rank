// ─────────────────────────────────────────────────────────────────────────────
// lib/heroArt.ts — 홈 히어로 일러스트의 주소 한 벌
//
// **주소가 두 곳에 적히면 한쪽만 바뀐다.** 이 그림은 화면(screens/Home.tsx)과
// 문서 머리의 미리받기(app/page.tsx) 두 곳에서 쓰인다. 파일 이름을 양쪽에 적어 두면
// 그림을 갈 때 미리받기가 없는 파일을 가리켜, 받지도 않을 132KB 를 먼저 받는다.
//
// **왜 미리 받나.** 이 <img> 는 서버 HTML 에 없다 — 앱이 붙어야 생긴다. 그래서 전에는
// 앱이 뜬 뒤에야 요청이 나갔고, 첫 그림에 3.9초가 걸렸다 (실측 1.6Mbps·CPU 4배).
// 머리에서 미리 받으면 스크립트를 받는 동안 같이 내려온다.
// ─────────────────────────────────────────────────────────────────────────────
import { BASE } from './base';

export const HERO_ART = {
  src: `${BASE}images/max-battle-articuno-team-1200.webp`,
  srcSet: `${BASE}images/max-battle-articuno-team-720.webp 720w, ${BASE}images/max-battle-articuno-team-1200.webp 1200w`,
  sizes: '(max-width: 699px) 100vw, (max-width: 999px) 90vw, 55vw',
  width: 1200,
  height: 800,
} as const;
