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
  MOVE_CHANGES: Record<string, unknown>;
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
  date: string;
  summary?: string;
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

export interface Manifest {
  built: string;
  files: Record<string, { hash: string; bytes: number }>;
}
