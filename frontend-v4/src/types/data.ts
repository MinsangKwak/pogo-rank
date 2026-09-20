// ─────────────────────────────────────────────────────────────────────────────
// types/data.ts — 빌드 데이터의 모양
//
// v3 에는 이 표가 없었다. 436개 전역이 서로의 모양을 **주석으로만** 약속하고 있었고,
// `row.cshare` 처럼 v3.58.0 에 새로 생긴 필드는 있는 줄이 있고 없는 줄이 있어
// 읽는 쪽이 매번 `?? 기본값` 으로 막아야 했다. 여기서는 그걸 타입이 강제한다.
// ─────────────────────────────────────────────────────────────────────────────

export type TypeKey = string;   // 'fire' · 'water' … DEX_DATA.chart 의 키

/** 한 종/폼의 종족값과 기술 (DEX_DATA.forms[스프라이트 id]) */
export interface DexForm {
  name: string;                 // 폼 라벨 ('' 이면 원종)
  types: TypeKey[];
  atk: number;
  def: number;
  hp: number;
  fast: [string, number][];     // [기술명, 레거시 여부]
  charged: [string, number][];
}

export interface DexData {
  chart: Record<TypeKey, Record<TypeKey, number>>;   // 공격 타입 → 방어 타입 → 배율
  cpm: Record<string, number>;                       // l20 · l25 · l30 · l35 · l40 · l50
  cpms: number[];
  dex: Record<string, number>;                        // 스프라이트 id → 도감번호
  names: Record<string, string>;                      // 도감번호 → 한글 이름
  en: Record<string, string>;
  evo: Record<string, number[][]>;                   // 도감번호 → [단계][그 단계의 종]. 분기 진화는 한 단계에 여러 마리
  forms: Record<string, DexForm>;
  // rel === false 면 게임마스터에만 있고 아직 못 쓰는 폼 ('미구현' 을 달아 밝힌다)
  megas: Record<string, { sprite: number; label: string; rel?: boolean }[]>;
  cls: Record<string, unknown>;
  rel: number[];                                      // 출시된 도감번호
  moveKo: Record<string, string>;
  formKo: Record<string, string>;
}

export interface DexBundle {
  DEX_DATA: DexData;
  TYPE_KO: Record<TypeKey, string>;
  TYPE_EN: Record<TypeKey, string>;
  FORM_LABELS: string[];
  SPRITE_IDS: number[];
  SPRITE_ANIM_IDS: number[];
}

/** 순위표 한 줄의 공통 뼈대 — PvE · D-MAX 가 공유한다 */
export interface RankRow {
  sprite: number;
  name: string;
  en: string;
  types: TypeKey[];
  fast: string;
  charged: string;
  gmax?: boolean;
  unrel?: boolean;              // 데이터만 있고 아직 게임에 없는 줄
  /** 지난 갱신 대비 순위 변동 (backend/rank_diff.py). 양수면 상승, 음수면 하락. 안 움직였으면 없다 */
  d?: number;
}

export interface PveRow extends RankRow {
  dps: number;
  tdo: number;
  score: number;
  /** v3.58.0 — 실제로 때리는 타입. 자기 첫 타입과 같으면 싣지 않는다 */
  ftype?: TypeKey;
  ctype?: TypeKey;
  /** 차지기가 한 사이클에서 차지하는 피해 비중 (두 기술 타입이 갈릴 때만) */
  cshare?: number;
  /** '일반'(PVE_EASY) 표에만 있다 — 같은 속성 최강 어태커 대비 % 와 티어 글자 */
  ratio?: number;
  tier?: string;
}

export interface DmaxRow extends RankRow {
  atk?: number;
  power?: number;
  stab?: boolean;
  dmg?: number;
  bulk: number;
  bulkMul?: number;
  score: number;
  pct?: number;
  tier?: string;
  // 탱커 표(DMAX_TANK)만 갖는 칸 — EHP = 체력 × 방어 ÷ 받는 배율
  ehp?: number;
  mult?: number;
  hp?: number;
  def?: number;
}

export interface PvpRow {
  rank: number;
  name: string;
  en: string;
  sprite: number;
  types: TypeKey[];
  fast: string;
  charged: string;
  score: number;
  d?: number;        // 지난 갱신 대비 순위 변동 (backend/rank_diff.py)
}

export type LeagueKey = 'little' | 'great' | 'ultra' | 'master';

export interface MaxBundle {
  DMAX_DATA: Record<string, DmaxRow[]>;
  DMAX_TANK: Record<string, DmaxRow[]>;
  DMAX_TIER: Record<string, DmaxRow[]>;
  MAX_POOL: Record<string, 'G' | 'D'>;
}

export interface PveBundle {
  /** **키는 보스 타입이다** — 불꽃 → 불꽃 보스를 잡는 카운터(물·땅). 솔플 계산기와 상세의 활용처가 쓴다 */
  PVE_DATA: Record<string, PveRow[]>;
  /** 키는 **어태커 자신의 타입** — 불꽃 → 불꽃 포켓몬. 전설·환상·UB·메가·섀도우는 뺀 목록 */
  PVE_EASY: Record<string, PveRow[]>;
  /** PVE_EASY 와 같은 묶음 기준에 전설·환상·UB·메가·섀도우를 남긴 것 — 레이드 화면의 「전체」 탭 */
  PVE_BY_TYPE: Record<string, PveRow[]>;
  BOSS_LIST: unknown[];
}

export interface PvpBundle {
  PVP_DATA: Record<LeagueKey, PvpRow[]>;
  VALUE_DATA: Record<string, unknown>;
  // 속성별 레이드 성능표 (사람이 관리하는 시트). 상세 팝업의 '보스로 만났을 때' 가 이것을 먼저 본다
  SHEET_DATA: { pve?: Record<string, SheetRow[]> };
}

/** 레이드 보스 · 알 부화 한 줄 */
export interface GamedayMon {
  sprite: number;
  name: string;
  shiny: boolean;
  types?: TypeKey[];
  cp: { min: number; max: number };
  cpBoost?: { min: number; max: number };
  weather?: string[];
  regional?: boolean;
  sync?: boolean;
  gift?: boolean;
}

export interface GamedayEvent {
  id: string;
  title: string;
  heading?: string;
  type: string;
  start: string;
  end: string;
  dex?: number[];
}

export interface GamedayBundle {
  GAMEDAY: {
    fetched: string;
    raids: Record<string, GamedayMon[]>;
    eggs: Record<string, GamedayMon[]>;
    events: GamedayEvent[];
  };
  // 시즌 기술 변경 — 없는 시즌도 있다 (그때는 메뉴 줄 자체를 만들지 않는다).
  // affected 는 스프라이트 id → 그 종에 걸린 변경 (상세 팝업이 종별로 읽는다)
  MOVE_CHANGES?: {
    season: string;
    date: string;
    moves: MoveChange[];
    /** 새로 배우는 기술 — 위력이 바뀐 것이 아니라 배울 수 있게 된 것 */
    newMoves: { sprite: number; name: string; dex: number; move: string; moveId?: string }[];
    affected?: Record<string, { up?: string[]; down?: string[]; energy?: string[]; new?: string[]; legacy?: string[] }>;
  };
}

export interface FavEvent {
  id: string;
  title: string;
  type: string;
  start: string;
  end: string;
  dex: number[];
}

export interface FavEventsBundle {
  FAV_EVENTS: FavEvent[];
}

export interface GameUpdate {
  id: string;
  title: string;
  date?: string;
  summary?: string;
  featured?: boolean;
  category?: string[];        // 'pvp' · 'gym' … (UPDATE_CATS 의 키)
  announcedAt?: string;       // 공식 발표일
  effectiveAt?: string;       // 게임에 적용되는 날
  checkedAt?: string;         // 원문을 마지막으로 본 날 — 앞의 둘이 없을 때 대신 적는다
  effectiveNote?: string;
  // 상태 두 축 — 뜻이 서로 다르므로 한 줄에 섞지 않는다.
  //   근거     무엇으로 확인했는가 (공식 발표인가, 관찰인가)
  //   게임 적용 게임에서 언제 적용되는가 (발표만 된 것과 이미 적용된 것은 다르다)
  evidenceStatus?: string;
  rolloutStatus?: string;
  key?: string[];
  beforeAfter?: BeforeAfter[];
  playerImpact?: string[];
  suggestedActions?: string[];
  moncampAdvice?: string;
  related?: string[];
  revisions?: { at: string; note: string }[];
  sources?: UpdateSource[];
  [key: string]: unknown;
}

/** 원문 링크 한 건 — 썸네일은 공식 og:image 를 그대로 가리킨다 (우리 저장소로 복사하지 않는다) */
export interface UpdateSource {
  lang: string;
  label: string;
  url: string;
  image?: string;
}

/** 변경 전·후 한 줄. before 가 비면 '이전 값 미확인' 이라고 적는다 (지어내지 않는다) */
export interface BeforeAfter { label: string; before?: string; after: string }

/**
 * 아카이브 한 건 — 사람이 쓴 요약이 **없는** 소식.
 * 공식 제목·날짜·원문 링크와 원문에서 그대로 따온 인용(excerpt)만 있다.
 */
export interface ArchiveEntry {
  id: string;
  kind?: string;
  title: string;
  date?: string;
  excerpt?: string;
  sources?: UpdateSource[];
}

export interface UpdatesBundle {
  GAME_UPDATES: GameUpdate[];
  GAME_ARCHIVE: ArchiveEntry[];
}

export interface MetaBundle {
  RANK_DELTA_DATE: string;
  RANK_FRESH_DAYS: number;
  DATA_FETCHED: string;
  DATA_STALE: string[];
  /** 문의 이메일 — 빌드가 환경변수에서 읽어 넣는다. 비면 문구가 '사이트 운영자' 로 바뀐다 */
  CONTACT_EMAIL: string;
  /** 이 문자열이 바뀌면 ☰ 에 빨간 점이 뜬다 — 날짜나 항목 수를 비교하지 않는다 */
  RELEASE_VER: string;
  /** 서랍 맨 아래에 적는 판 번호 (v3 머리줄의 .app-bar__version 과 같은 값) */
  APP_VERSION: string;
  /** 데이터 기준 시각. DATA_FETCHED(날짜만) 와 다른 값이다 — 서랍의 '기준일' 은 이쪽이다 */
  DATA_TIMESTAMP: string;
  /**
   * 로그인 설정 — 빌드가 환경변수에서 읽어 넣는다.
   * **apiKey 가 비면 로그인 기능 자체가 꺼진다** (v3 authEnabled 와 같은 규칙) — 눌러도 안 되는
   * 버튼을 내밀지 않는다. 값이 공개돼도 되는 이유는 접근 제어를 전부 Firestore 규칙이 맡기 때문이다.
   */
  FIREBASE_CONFIG: Record<string, string>;
  /** 규칙(firestore.rules)의 isAdmin() 과 **같은 값이어야 한다** — 화면만 관리자로 보이면 규칙이 막는다 */
  ADMIN_UID: string;
  ADMIN_EMAIL: string;
}

/** 패치노트 한 묶음. 최신 날짜가 위로 오도록 **적힌 차례 그대로** 쓴다 (코드에서 다시 정렬하지 않는다) */
export interface ReleaseGroup { date: string; items: string[] }

export interface ReleaseBundle {
  RELEASE_NOTES: ReleaseGroup[];
  RELEASE_VER: string;
  /**
   * 패치노트 영문판 — **날짜(묶음 키)로 통째 짝지어** 둔다.
   * 항목이 `**굵게**` 가 섞인 문장 덩어리라, 낱말 단위로 찾는 일반 사전으로는 문장을 못 맞춘다.
   * 없는 날짜는 한국어 그대로 나간다.
   */
  RELEASE_NOTES_EN?: Record<string, string[]>;
}

/**
 * 활용처 — 이름 → [[순위표, 순위], …] (v3 VALUE_DATA.usage_places).
 * 압축 형태라 333종을 담고도 32KB 다.
 */
export interface UsageBundle {
  USAGE_PLACES: Record<string, [string, number][]>;
  /** 이름 → [PvE, PvP] 0~100 점 (v3 VALUE_DATA.meter). 도감 줄의 알약이 쓴다 */
  METER: Record<string, [number, number]>;
}

export interface Manifest {
  built: string;
  files: Record<string, { hash: string; bytes: number }>;
}

/**
 * 월 일정표 — v3 components/schedule.js 의 손으로 적은 표.
 * s·e 는 **이 달의 몇 일**이며 양끝 포함이다. 달을 넘기는 일정은 이 달 안에서 끊어 적는다.
 * t 는 dmax 분류에만 붙는 보스 속성 키다 ('이번 주 보스' 카드가 읽는다).
 */
export interface ScheduleItem {
  source?: string;
  s: number;
  e: number;
  cat: string;
  label: string;
  t?: string;
}

export interface ScheduleMonth {
  ym: { y: number; m: number };
  note: string;
  items: ScheduleItem[];
}

export interface ScheduleCat {
  name: string;
  color: string;
  type: string;
}

export interface ScheduleBundle {
  SCHEDULE_MONTHS: Record<string, ScheduleMonth>;
  SCHEDULE_CATS: Record<string, ScheduleCat>;
}

/** 기술 한 건의 변경 — kind 가 'energy' 면 위력이 아니라 에너지만 바뀐 것이다 */
export interface MoveChange {
  id: string;
  ko: string;
  kind: 'up' | 'down' | 'energy';
  from?: number;
  to?: number;
  note?: string;
}

/** 시트 행 — score 는 그 속성 최강 대비 %라 타입이 달라도 견줄 수 있다 */
export interface SheetRow {
  name: string;
  en: string;
  sprite: number;
  types: TypeKey[];
  score?: number;
  rank?: number;
}

/** 인기 검색어 한 줄 — sprite 는 이름을 못 찾으면 없다(그림 없이 이름만 세운다) */
export interface HotSearchRow {
  name: string;
  count: number;
  sprite?: number | null;
}

/**
 * 인기 검색어 묶음 (backend/hotsearch_build.py).
 * asOf 가 null 이면 아직 한 번도 집계가 안 돈 것이다 — rows 도 비어 있다.
 */
export interface HotSearchBundle {
  asOf: string | null;
  window: string;
  rows: HotSearchRow[];
}
