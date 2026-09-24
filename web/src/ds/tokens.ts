// ─────────────────────────────────────────────────────────────────────────────
// ds/tokens.ts — 디자인 토큰의 **목록**. 값은 여기 없다.
//
// 값은 `frontend/styles/tokens.css` 한 곳이 가진다. 여기 적는 것은 이름과 **쓰임새**다.
// 왜 목록을 따로 두나 — 토큰이 168개인데 어디에 쓰는 값인지가 CSS 주석에만 있어,
// 화면을 짜는 쪽에서는 매번 CSS 를 열어 읽어야 했다. 목록이 있으면 스토리북이 그대로 그려 준다.
//
// **이 파일과 tokens.css 가 어긋나면 검사가 선다** (`src/test/dstokens.test.ts`).
// 없는 토큰을 적어 두면 화면에 `var(--없는것)` 이 나가 색이 통째로 빠지기 때문이다.
// ─────────────────────────────────────────────────────────────────────────────

/** 토큰 한 칸 — 이름과 쓰임새. 값은 브라우저가 CSS 에서 읽는다 */
export interface TokenDef {
  /** `--` 를 포함한 CSS 변수명 */
  name: string;
  /** 어디에 쓰는 값인가 — 무엇인지가 아니라 **언제 고르는지**를 적는다 */
  use: string;
}

export interface TokenGroup {
  id: string;
  title: string;
  /** 이 묶음을 고를 때의 규칙 한 줄 */
  note: string;
  tokens: TokenDef[];
}

// ── 색 ───────────────────────────────────────────────────────────────────────

/** 판과 선 — 밝기 사다리다. 바탕 < 카드 < 눌림 순으로 밝아진다 (다크도 같은 차례) */
export const SURFACE: TokenGroup = {
  id: 'surface',
  title: '판 · 선',
  note: '바탕 < 카드 < 눌림 순으로 밝아진다. 라이트·다크가 같은 차례를 지킨다',
  tokens: [
    { name: '--bg', use: '화면 바탕. 채움 위 글자색으로도 쓴다 (§1-b)' },
    { name: '--surface', use: '카드 · 판 — 바탕보다 한 단 밝다' },
    { name: '--hover', use: '포인터가 올라간 칸 · 눌린 칸' },
    { name: '--line', use: '보통 테두리' },
    { name: '--line-2', use: '한 단 진한 테두리 — 활성 입력처럼 경계를 세울 때' },
  ],
};

/** 글자 — 진한 쪽에서 흐린 쪽으로 넷 */
export const INK: TokenGroup = {
  id: 'ink',
  title: '글자',
  note: '판 위 글자는 --fg 에서 시작한다. #fff 를 글자색으로 쓰지 않는다 — 다크에서 뒤집힌다',
  tokens: [
    { name: '--fg', use: '본문 — 판 위 글자의 기본값' },
    { name: '--ink-2', use: '카드 안 보조 문장 — 본문보다 한 단 흐리다' },
    { name: '--muted', use: '설명 · 단위 · 비활성에 가까운 글자' },
    { name: '--ink-4', use: '자리표시 — 가장 흐린 글자' },
  ],
};

/** 의미 색 — 이름이 곧 쓰임새다. 장식으로 칠하지 않는다 */
export const MEANING: TokenGroup = {
  id: 'meaning',
  title: '의미',
  note: '색은 뜻에만 쓴다 — 타입 · 폼 · 순위 · 상태. 예뻐 보이려고 칠하지 않는다',
  tokens: [
    { name: '--brand', use: '브랜드 · 지금 보고 있는 곳. 몬스터볼 빨강' },
    { name: '--brand-2', use: '다른 갈래를 구분할 때 (PvP 등) — 같은 빨강 한 단 진하게' },
    { name: '--chart-1', use: '그래프 한 계열의 막대 · 선 — 다크에서 브랜드보다 한 단 눌린 빨강 (관리자 통계)' },
    { name: '--point', use: '특별한 것 — 메가 · 전설 · S티어. 빨강의 정반대인 파랑' },
    { name: '--warn', use: '나쁨 — 하향 · 약점 · 삭제' },
    { name: '--caution', use: '주의 — 대기 · A티어' },
    { name: '--good', use: '좋음 — 상향 · 내성' },
    { name: '--off', use: '비활성' },
    { name: '--accent', use: '= --brand. 예전부터 쓰던 이름이라 남겨 둔다' },
  ],
};

/** 어두운 판 — 테마를 **안 타는** 자리 한 벌 (검색식 콘솔 · 홈 히어로) */
export const PLATE: TokenGroup = {
  id: 'plate',
  title: '어두운 판',
  note: '늘 어두운 판에는 이 한 벌만 쓴다. --bg·--fg 는 다크에서 판이 밝아져 뒤집힌다 (v4.4.0)',
  tokens: [
    { name: '--plate', use: '판 채움' },
    { name: '--plate-2', use: '판 안의 한 단 다른 면' },
    { name: '--plate-fg', use: '판 위 글자 — 명암비 14' },
    { name: '--plate-muted', use: '판 위 흐린 글자 — 명암비 7.9' },
    { name: '--plate-line', use: '판 위 선' },
    { name: '--plate-accent', use: '판 위 강조 — 글자로도 채움으로도 쓴다' },
    { name: '--plate-cta', use: '판 위 주 버튼 채움 — --plate-fg 글자와 짝' },
  ],
};

/** 포켓몬 타입 18색 — **게임 원작 값이다. 바꾸지 않는다** */
export const TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;
export type TypeName = (typeof TYPES)[number];

export const TYPE_COLORS: TokenGroup = {
  id: 'type',
  title: '타입',
  note: '게임 원작 값이라 바꾸지 않는다. 밝은 타입 위 흰 글자가 흐린 것은 알려진 한계다 (§1-b)',
  tokens: TYPES.map((type) => ({ name: `--t-${type}`, use: `${type} 타입` })),
};

/** 폼 색 — 게임 아이콘 기준 */
export const FORMS: TokenGroup = {
  id: 'form',
  title: '폼',
  note: '다이맥스는 자홍, 메가는 메가 에너지의 보라·파랑, 섀도우는 어두운 자주',
  tokens: [
    { name: '--c-max', use: '다이맥스 · 거다이맥스' },
    { name: '--c-max-2', use: '다이맥스 짝 색 (그라데이션 끝)' },
    { name: '--c-mega', use: '메가' },
    { name: '--c-mega-2', use: '메가 짝 색' },
    { name: '--c-shadow', use: '섀도우' },
  ],
};

// ── 글자 · 간격 ──────────────────────────────────────────────────────────────

/**
 * 글자 크기 여섯 단. **글꼴로 쓸 수 있는 칸이 갈린다** (§7).
 * 읽는 글(Pretendard)은 sub·body·lead, 크롬(Galmuri)은 body·sec·title·hero 다.
 */
export const FONT_SIZES: TokenGroup = {
  id: 'fs',
  title: '글자 크기',
  note: '여기 없는 크기는 새로 만들지 않는다. Galmuri 에는 1.2·1.6 을 주지 않는다 — 격자 밖이라 뭉개진다',
  tokens: [
    { name: '--fs-sub', use: '12px 보조 — 읽는 글의 최소선 (Pretendard 전용)' },
    { name: '--fs-body', use: '14px 본문 · 칩 · 탭 · 버튼 (두 글꼴 공용)' },
    { name: '--fs-lead', use: '16px 강조 본문 — 이름 · 점수 (Pretendard 전용)' },
    { name: '--fs-sec', use: '22px 구역 제목 (Galmuri)' },
    { name: '--fs-title', use: '28px 화면 제목 (Galmuri)' },
    { name: '--fs-hero', use: '42px 화면에 하나뿐인 숫자 — CP 등 (Galmuri)' },
  ],
};

/** 읽는 글(Pretendard)이 쓸 수 있는 칸 */
export type ReadSize = 'sub' | 'body' | 'lead';
/** 크롬(Galmuri)이 쓸 수 있는 칸 — 12·16 이 없는 것이 이 줄기의 성질이다 */
export type ChromeSize = 'body' | 'sec' | 'title' | 'hero';

export const FONT_STEMS = {
  read: { label: '읽는 글 · Pretendard', sizes: ['sub', 'body', 'lead'] as ReadSize[] },
  chrome: { label: '크롬 · Galmuri', sizes: ['body', 'sec', 'title', 'hero'] as ChromeSize[] },
} as const;

/** 간격 — 4px(0.4rem) 격자. 거리가 같으면 **넓은 쪽**으로 붙인다 */
export const SPACE: TokenGroup = {
  id: 'space',
  title: '간격',
  note: '0.4rem 배수만 쓴다. 이름 없는 칸(1.2rem)도 격자 위면 쓴다 — 격자 밖 값만 금지다',
  tokens: [
    { name: '--space-xs', use: '0.4rem — 붙은 것들 사이 (점과 글자)' },
    { name: '--space-sm', use: '0.8rem — 한 덩어리 안 (칩 줄)' },
    { name: '--space-md', use: '1.6rem — 덩어리와 덩어리 (카드 안 구역)' },
    { name: '--space-lg', use: '2.4rem — 구역과 구역' },
    { name: '--space-xl', use: '3.2rem — 화면 단락' },
  ],
};

export type SpaceStep = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** 간격 칸을 CSS 길이로. `none` 만 0 이고 나머지는 토큰을 그대로 넘긴다 */
export function space(step: SpaceStep): string {
  return step === 'none' ? '0' : `var(--space-${step})`;
}

/** 모양 — 반경 · 도트 한 칸 · 손가락 최소 크기 */
export const SHAPE: TokenGroup = {
  id: 'shape',
  title: '모양',
  note: '반경은 두 단뿐이다. 누르는 것의 최소 높이는 --tap(44px) — Material 48dp · Apple 44pt',
  tokens: [
    { name: '--r-card', use: '카드 모서리 (지금 0 — 도트 그림과 결을 맞춘다)' },
    { name: '--r-chip', use: '칩 모서리' },
    { name: '--px', use: '도트 한 칸 0.2rem — 테두리 · 그림자의 기본 단위' },
    { name: '--tap', use: '누르는 것의 최소 크기 44px' },
    { name: '--shadow-hard', use: '계단 그림자 굵기 (흐림 0). 색은 쓰는 쪽에서 붙인다' },
  ],
};

/** 카드 — TCG 박테 한 벌 */
export const CARD: TokenGroup = {
  id: 'card',
  title: '카드',
  note: '박테는 두 겹이다 — border 로 밝은 쪽, box-shadow 링으로 그 바깥에 어두운 쪽',
  tokens: [
    { name: '--foil-hi', use: '박의 밝은 쪽 — 장식 전용, 글자로 쓰지 않는다' },
    { name: '--foil-lo', use: '박의 어두운 쪽' },
    { name: '--card-border', use: '카드 테두리 한 벌' },
    { name: '--card-ring', use: '테두리 바깥 한 겹' },
    { name: '--card-tint', use: '카드 바탕에 브랜드를 살짝 섞은 색' },
    { name: '--card-shadow', use: '카드 그림자' },
    { name: '--card-shadow-up', use: '떠오른 카드 그림자' },
    { name: '--foil', use: '넓은 면의 박 (머리 띠)' },
    { name: '--holo', use: '홀로그램 무지개' },
    { name: '--holo-soft', use: '늘 깔려 있는 쪽 — 절반 세기' },
  ],
};

/** 스토리북이 그리는 차례. 색 → 글자 → 간격 → 모양 순이다 */
export const TOKEN_GROUPS: TokenGroup[] = [
  SURFACE, INK, MEANING, PLATE, TYPE_COLORS, FORMS,
  FONT_SIZES, SPACE, SHAPE, CARD,
];
