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
  evo: Record<string, unknown>;
  forms: Record<string, DexForm>;
  megas: Record<string, { sprite: number; label: string }[]>;
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
  PVE_DATA: Record<string, PveRow[]>;
  PVE_EASY: Record<string, PveRow[]>;
  BOSS_LIST: unknown[];
}

export interface PvpBundle {
  PVP_DATA: Record<LeagueKey, PvpRow[]>;
  VALUE_DATA: Record<string, unknown>;
  SHEET_DATA: Record<string, unknown>;
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
  // 시즌 기술 변경 — 없는 시즌도 있다 (그때는 메뉴 줄 자체를 만들지 않는다)
  MOVE_CHANGES?: { season: string; date: string; moves: MoveChange[] };
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
  [key: string]: unknown;
}

export interface UpdatesBundle {
  GAME_UPDATES: GameUpdate[];
  GAME_ARCHIVE: unknown[];
}

export interface MetaBundle {
  RANK_DELTA_DATE: string;
  RANK_FRESH_DAYS: number;
  DATA_FETCHED: string;
  DATA_STALE: string[];
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
