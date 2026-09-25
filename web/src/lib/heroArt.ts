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
  src: `${BASE}images/max-battle-articuno-panorama-1200.webp`,
  srcSet: `${BASE}images/max-battle-articuno-panorama-720.webp 720w, ${BASE}images/max-battle-articuno-panorama-1200.webp 1200w`,
  sizes: '100vw',
  width: 1200,
  height: 400,
  // 새 3:1 구도는 프리져가 오른쪽에 선다. 모바일에서는 보스 얼굴을 중심으로 자른다.
  focus: 'right top',
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
  /** 좁은 화면에서 보일 자리(object-position) — 상대 보스가 서 있는 곳. 새 그림은 보스를 오른쪽 위에 그린다 */
  focus: string;
  /** 대체 글 — 이름은 도감 실데이터에서 받는다 (§3) */
  alt: (names: Readonly<Record<string, string>>) => string;
}

/** 10월 신규 배너는 같은 3:1 구도와 반응형 WebP 규격을 쓴다. */
function panorama(dex: number, file: string, gmax = false): MaxArt {
  return {
    dex: [dex],
    src: `${BASE}images/max-battle-${file}-1200.webp`,
    srcSet: `${BASE}images/max-battle-${file}-720.webp 720w, ${BASE}images/max-battle-${file}-1200.webp 1200w`,
    sizes: '100vw', width: 1200, height: 400, focus: 'right top',
    alt: (names) => `${gmax ? '거다이맥스' : '다이맥스'} ${names[String(dex)] ?? ''}의 맥스 배틀 경기장 일러스트`,
  };
}

export const MAX_ART: readonly MaxArt[] = [
  panorama(815, 'cinderace-panorama', true),
  panorama(850, 'sizzlipede-panorama'),
  panorama(821, 'rookidee-character-panorama'),
  panorama(215, 'sneasel-panorama'),
  panorama(302, 'sableye-character-panorama'),
  {
    // 고릴타·피카츄가 다이맥스 울머기와 맞선다 — 울머기 주간(2026-09-28). 2172w PNG(2.1MB)를 WebP 두 벌로 줄였다
    dex: [816],
    src: `${BASE}images/max-battle-sobble-panorama-1200.webp`,
    srcSet: `${BASE}images/max-battle-sobble-panorama-720.webp 720w, ${BASE}images/max-battle-sobble-panorama-1200.webp 1200w`,
    sizes: '100vw', width: 1200, height: 400, focus: 'right top',
    // 이름은 도감 실데이터만 쓴다 — 없으면 비운다 (§3)
    alt: (names) => `${names['812'] ?? ''}·${names['25'] ?? ''}의 풀·전기 기술에 맞서는 다이맥스 ${names['816'] ?? ''} 배틀 일러스트`,
  },
  {
    // 거대코뿌리·해피너스·루기아·몰드류가 다이맥스 프리져와 맞선다 — 프리져·썬더·파이어 주간(2026-09-21)
    dex: [144],
    ...HERO_ART,
    alt: (names) => `${names['464'] ?? ''}·${names['242'] ?? ''}·${names['249'] ?? ''}·${names['530'] ?? ''}가 다이맥스 ${names['144'] ?? ''}와 맞서는 배틀 일러스트`,
  },
];

/** 보스 미공개 행사는 특정 포켓몬 대신 알을 소재로 한 콘셉트 그림을 보여 준다. */
const MAX_BATTLE_ARENA_ART: MaxArt = {
  ...panorama(0, 'mystery-egg-panorama'),
  dex: [],
  alt: () => '미공개 맥스 배틀 보스를 상징하는 빛나는 알의 콘셉트 일러스트',
};

/** 알려진 보스가 있으면 해당 그림만 사용한다. 미공개 그림은 확인된 행사에만 붙인다. */
export function maxArtFor(dex: readonly number[], eventId?: string): MaxArt | undefined {
  if (!dex.length && eventId === 'max-battle-day-october-24-2026') return MAX_BATTLE_ARENA_ART;
  return MAX_ART.find((art) => art.dex.every((one) => dex.includes(one)));
}
