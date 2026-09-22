// ─────────────────────────────────────────────────────────────────────────────
// lib/solo.ts — 솔플 레이드 계산기의 셈 (v3 views/ifsolo.js 이식)
//
// 묻는 것 하나 — **"이 보스를 혼자 제한 시간 안에 잡을 수 있나."**
// 레이드 보스의 전투 체력은 개체 종족값과 무관하게 티어마다 고정이라,
// 그 물음은 곧 "이 티어의 고정 체력을 제한 시간 안에 깎을 수 있나" 가 된다.
//
// 운용 모델은 '전멸하고 다시 입장' 이 아니라 **기절 직전 이탈 → 부활약 → 같은 덱 재진입** 이다
// (실측 제공자 협업). 그래서 두 종류의 시간 손실만 센다: 교체 1초 · 재진입 5.5초.
//
// 도메인 약어 — DPS 초당 피해량 · TDO 기절할 때까지 누적으로 넣는 총 피해량 · CPM 레벨별 능력치 배율
// ─────────────────────────────────────────────────────────────────────────────
import type { DexData, PveRow } from '../types/data';
import type { BossEntry } from './search';

export interface SoloTier { id: string; label: string; hp: number; time: number }

/**
 * 티어별 체력·제한시간. 근거 — 레이드 보스의 전투 체력은 게임 구조상 티어 고정값이고
 * (1성 600 · 3성 3,600 · 4성 9,000 · 5성/메가 15,000), 제한 시간도 티어 고정이다.
 */
export const SOLO_TIERS: readonly SoloTier[] = [
  { id: 't1', label: '1성', hp: 600, time: 180 },
  { id: 't3', label: '3성', hp: 3600, time: 180 },
  { id: 't4', label: '4성', hp: 9000, time: 300 },
  { id: 't5', label: '5성', hp: 15000, time: 300 },
  { id: 'mega', label: '메가', hp: 15000, time: 300 },
];

const CPM50 = 0.8403;   // 레벨50의 CP 배율

export const SWAP_LOSS = 1;       // 같은 팀 안에서 다음 포켓몬 교체(초)
export const REVIVE_LOSS = 5.5;   // 실측: 기절 직전 이탈 → 부활 → 재진입 5~6초

// PVE_DATA 의 DPS·TDO 는 '방어 200 / 초당 피해 30 인 가상의 보스' 기준이라 그대로 쓰면 실전과 어긋난다.
// 아래 둘은 실측 제공자의 메가 솔플 실측치에 맞춘 보정 계수다
const TDO_CAL = 3;     // 자체 계산이 어태커 생존을 과소평가해 3배 보정
const DPS_CAL = 1.2;   // 자체 계산 DPS 가 실전 대비 보수적이라 +20%

export interface Buff { id: string; label: string; m: number }
export const BUFFS: readonly Buff[] = [
  { id: 'none', label: '버프 없음', m: 1 },
  { id: 'mega', label: '메가부스트 +30%', m: 1.3 },
  { id: 'full', label: '풀버프 +60%', m: 1.6 },   // 메가부스트 + 날씨 + 친구 대략치
];

interface Stats { atk: number; def: number; hp: number }

/** 보스의 종족값. 빌드가 심어 준 값(ba·bd·bs)이 있으면 그것을, 없으면 도감에서 */
export function bossStats(dex: DexData, boss: BossEntry): Stats | undefined {
  if (boss.ba != null && boss.bd != null && boss.bs != null) return { atk: boss.ba, def: boss.bd, hp: boss.bs };
  return dex.forms[String(boss.sprite)] ?? dex.forms[String(dex.dex[boss.sprite] ?? boss.sprite)];
}

/** 레이드 화면에 표시되는 보스 CP — 체력 자리에 티어 고정 체력을 넣은 CP 공식 (뮤츠 5성 54,148 로 검증) */
export function raidCp(dex: DexData, boss: BossEntry, tier: SoloTier): number | null {
  const stats = bossStats(dex, boss);
  return stats ? Math.floor(((stats.atk + 15) * Math.sqrt(stats.def + 15) * Math.sqrt(tier.hp)) / 10) : null;
}

/** 잡은 뒤 레벨50까지 풀강했을 때의 최대 CP (개체값 15/15/15 · CPM50) */
export function maxCp(dex: DexData, boss: BossEntry): number | null {
  const stats = bossStats(dex, boss);
  return stats ? Math.floor(((stats.atk + 15) * Math.sqrt(stats.def + 15) * Math.sqrt(stats.hp + 15) * CPM50 * CPM50) / 10) : null;
}

/**
 * 보스 → 티어 자동 판정.
 * 메가·원시 → 메가, 전설·환상·울트라비스트 → 4성, 최종 진화 → 3성, 그 외 1성.
 * 게임 내 실제 배치와 다르면 이 규칙만 고치면 된다.
 */
export function inferTier(dex: DexData, boss: BossEntry): string {
  if (/^(메가|원시)/.test(boss.name)) return 'mega';
  const dexNo = String(dex.dex[boss.sprite] ?? boss.sprite);
  if (dex.cls?.[dexNo]) return 't4';
  const chain = dex.evo?.[dexNo];
  const last = chain?.[chain.length - 1];
  const isFinal = last ? last.includes(Number(dexNo)) : (dex.forms[dexNo]?.atk ?? 0) >= 160;
  return isFinal ? 't3' : 't1';
}

/**
 * 복합 타입 보스의 '나머지 타입' 보정 — **때리는 타입**으로 잰다 (v3.58.0).
 * 570마리 중 70마리는 자속이 아닌 주력기를 든다(사이코 타입 메가Y 뮤츠가 10만볼트로 물 보스를 때리는 식).
 * 스피드기와 차지기의 타입이 다를 수 있으므로 한 사이클에서 각자 넣는 피해량(cshare)으로 가중한다.
 */
function attackTypeMult(chart: DexData['chart'], attacker: PveRow, against: string): number {
  const own = attacker.types[0];
  const fast = chart[attacker.ftype ?? own ?? '']?.[against] ?? 1;
  const charged = chart[attacker.ctype ?? own ?? '']?.[against] ?? 1;
  const share = typeof attacker.cshare === 'number' ? attacker.cshare : 1;
  return fast * (1 - share) + charged * share;
}

/**
 * 보스 상대 카운터 풀 — 보스 타입별 순위를 합치고, 복합 타입은 위 함수로 나머지 타입을 보정한다.
 * 같은 포켓몬이 두 타입 목록에 겹치면 DPS 가 높은 쪽을 남긴다.
 */
export function counterPool(dex: DexData, pveData: Record<string, PveRow[]>, bossTypes: readonly string[]): PveRow[] {
  const byName = new Map<string, PveRow>();
  for (let index = 0; index < bossTypes.length; index += 1) {
    const main = bossTypes[index];
    const other = bossTypes[1 - index];   // 단일 타입 보스면 undefined
    for (const attacker of pveData[main ?? ''] ?? []) {
      const adjust = other ? attackTypeMult(dex.chart, attacker, other) : 1;
      const candidate: PveRow = { ...attacker, dps: attacker.dps * adjust, tdo: Math.round(attacker.tdo * adjust) };
      const previous = byName.get(attacker.name);
      if (!previous || candidate.dps > previous.dps) byName.set(attacker.name, candidate);
    }
  }
  return [...byName.values()];
}

export interface SoloOpts { lv50: boolean; buff: string }

/**
 * 카운터 풀을 실제 종족값·풀강·버프로 스케일링한다.
 *   200/보스방어 → 방어가 높은 보스일수록 내 DPS 가 줄고, 그만큼 나도 오래 버틴다
 *   200/보스공격 → 공격이 높은 보스일수록 내가 빨리 죽으므로 TDO 만 줄인다
 */
export function scaledPool(dex: DexData, pveData: Record<string, PveRow[]>, boss: BossEntry, opts: SoloOpts): PveRow[] {
  const stats = bossStats(dex, boss);
  const defenseScale = 200 / (stats?.def || 200);
  const attackScale = 200 / (stats?.atk || 200);
  const levelDamage = opts.lv50 ? 1.063 : 1;   // 풀강: CPM50/CPM40 = 딜 +6.3%
  const levelTdo = opts.lv50 ? 1.2 : 1;        // 풀강: 내구·체력까지 → TDO 약 +20%
  const buff = BUFFS.find((one) => one.id === opts.buff)?.m ?? 1;
  return counterPool(dex, pveData, boss.types).map((attacker) => ({
    ...attacker,
    dps: attacker.dps * DPS_CAL * defenseScale * levelDamage * buff,
    tdo: Math.round(attacker.tdo * TDO_CAL * defenseScale * attackScale * levelTdo * buff),
  }));
}

export interface SoloPlan {
  time: number;
  cycles: number;
  revives: number;
  squad: PveRow[];
  possible: boolean;
}

/**
 * 정예 k마리를 부활시켜 돌려쓰는 사이클 시뮬레이션.
 * 한 사이클 = 덱 전원이 각자 TDO 만큼 딜을 넣고 전부 기절하기까지.
 */
export function simulateRevive(squad: readonly PveRow[], tier: SoloTier) {
  const cycleDamage = squad.reduce((sum, member) => sum + member.tdo, 0);
  const cycleTime = squad.reduce((sum, member) => sum + member.tdo / member.dps, 0) + (squad.length - 1) * SWAP_LOSS;
  const fullCycles = Math.floor(tier.hp / cycleDamage);
  let remain = tier.hp - fullCycles * cycleDamage;
  // 재진입 로스는 '전멸 후 이어서 싸울 때' 만: 잔여 딜이 남았으면 fullCycles 회, 딱 떨어지면 −1 회
  let time = fullCycles * cycleTime + Math.max(0, fullCycles - (remain > 0 ? 0 : 1)) * REVIVE_LOSS;
  // 마지막 자투리 체력은 덱 앞쪽부터 필요한 만큼만 때려서 마무리
  for (const member of squad) {
    if (remain <= 0) break;
    const dealt = Math.min(member.tdo, remain);
    time += dealt / member.dps + (member === squad[0] ? 0 : SWAP_LOSS);
    remain -= dealt;
  }
  return {
    time: Math.round(time),
    cycles: fullCycles + (tier.hp - fullCycles * cycleDamage > 0 ? 1 : 0),
    revives: fullCycles * squad.length,
  };
}

/** DPS 상위 2마리만 후보로 두고 1마리 덱 / 2마리 덱을 각각 돌려 더 빠른 쪽을 고른다 */
export function buildSoloPlan(candidates: readonly PveRow[], tier: SoloTier): SoloPlan | null {
  const pool = [...candidates].sort((left, right) => right.dps - left.dps).slice(0, 2);
  let best: SoloPlan | null = null;
  for (let size = 1; size <= pool.length; size += 1) {
    const squad = pool.slice(0, size);
    const result = simulateRevive(squad, tier);
    if (!best || result.time < best.time) best = { ...result, squad, possible: false };
  }
  if (best) best.possible = best.time <= tier.time;
  return best;
}

/**
 * 제한 시간 동안 이 덱이 넣을 수 있는 최대 딜 — '딜이 얼마 모자라서 못 잡았다' 를 말하기 위한 값.
 * simulateRevive 와 방향이 반대다: 시간을 고정하고 그 안에 들어가는 누적 딜을 센다.
 */
export function damageInTime(squad: readonly PveRow[], tier: SoloTier): number {
  let elapsed = 0;
  let dealt = 0;
  let index = 0;
  let cycles = 0;
  while (elapsed < tier.time && cycles < 200) {   // 200 은 무한 루프 방지용 상한
    const member = squad[index];
    if (!member) break;
    const fight = Math.min(member.tdo / member.dps, tier.time - elapsed);
    dealt += fight * member.dps;
    elapsed += fight;
    if (elapsed >= tier.time) break;
    index += 1;
    if (index >= squad.length) { index = 0; cycles += 1; elapsed += REVIVE_LOSS; }
    else elapsed += SWAP_LOSS;
  }
  return Math.round(dealt);
}

/** 제한 시간 대비 여유(또는 부족) 비율 문구 */
export function marginText(plan: { time: number }, tier: SoloTier): string {
  const percent = Math.round(((tier.time - plan.time) / tier.time) * 100);
  return percent >= 0 ? `시간 여유 ${percent}%` : `약 ${-percent}% 부족`;
}
