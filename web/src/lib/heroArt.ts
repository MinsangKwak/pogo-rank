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

/**
 * 맥스 일정별 일러스트 — 배너의 한 장이 그 일정의 그림이 된다.
 *
 * **그림에 그려진 보스가 그 일정에 다 있어야 붙는다** (`dex` ⊆ 일정의 보스).
 * 그림과 캡션이 따로 가면 '울머기' 라고 적힌 장에 프리져가 선다 — 2026-09-23 제보가 그 자리였다.
 * 그림이 없는 일정은 보스 도트로 같은 구도의 장면을 그린다 (components/MaxPoster.tsx).
 *
 * 새 그림을 붙일 때: public/images 에 720w·1200w webp 를 두고 여기 한 줄을 더한다.
 */
export interface MaxArt {
  /** 그림 속 상대 보스의 도감 번호 */
  dex: readonly number[];
  src: string;
  srcSet: string;
  sizes: string;
  width: number;
  height: number;
  /** 대체 글 — 이름은 도감 실데이터에서 받는다 (§3) */
  alt: (names: Readonly<Record<string, string>>) => string;
}

export const MAX_ART: readonly MaxArt[] = [
  {
    // 레지락·해피너스·루기아·몰드류가 다이맥스 프리져와 맞선다 — 프리져·썬더·파이어 주간(2026-09-21)
    dex: [144],
    ...HERO_ART,
    alt: (names) => `${names['464'] ?? ''}·${names['242'] ?? ''}·${names['249'] ?? ''}·${names['530'] ?? ''}가 다이맥스 ${names['144'] ?? ''}와 맞서는 배틀 일러스트`,
  },
];

/** 이 일정의 그림 — 그림 속 보스가 일정에 다 있어야 준다 */
export function maxArtFor(dex: readonly number[]): MaxArt | undefined {
  return MAX_ART.find((art) => art.dex.every((one) => dex.includes(one)));
}
