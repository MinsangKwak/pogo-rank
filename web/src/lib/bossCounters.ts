// ─────────────────────────────────────────────────────────────────────────────
// lib/bossCounters.ts — "이 보스를 상대할 때" 추천 후보 (2026-10-13)
//
// 상세 팝업의 '보스로 만났을 때' 가 안에 품고 있던 셈을 한 곳으로 꺼냈다 — 팝업 맨 위의 '상대할 때' 카드와
// 홈의 '이번 주 보스' 카드가 같은 세 마리를 보여야 한다. 두 곳이 다르면 어느 쪽이 맞는지 알 수 없다.
//
// 보스 종류에 따라 참전 가능한 풀이 다르다 (v2.13.0 QA-49):
//   max  — 맥스 배틀에는 다이맥스 · 거다이맥스와, 다이맥스 없이 참가하는 전설(join)만 들어간다. 메가 · 원시 · 섀도우는 못 들어간다.
//          미구현 · 출시 예정(soon)은 추천하지 않는다 — 지금 데려갈 수 있는 것만 (Codex, PR #341)
//   raid — 전체 포켓몬. 보스 타입을 잘 때리는 공격 타입 둘의 레이드 성능표(시트가 있으면 시트, 없으면 자체 계산) 상위
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { counterTypes } from './matchup';
import { maxVisible } from './maxVisible';
import { dexNoOf, type MonRef } from './mon';
import type { DexData, DmaxRow, PveRow, SheetRow } from '../types/data';

export type BossKind = 'max' | 'raid';

export interface CounterSource {
  chart: DexData['chart'];
  typeKo: Readonly<Record<string, string>>;
  /** 스프라이트 → 도감 번호 (DEX_DATA.dex) — 종 중복을 거르는 열쇠 */
  dexTable: Readonly<Record<string, number>>;
  /** 보스 타입별 맥스 배틀 딜러 표 (max.json DMAX_DATA) */
  dmax: Readonly<Record<string, readonly DmaxRow[]>> | undefined;
  /** 공격 타입별 레이드 성능 — 자체 계산 (pve.json PVE_DATA) */
  pve: Readonly<Record<string, readonly PveRow[]>> | undefined;
  /** 공격 타입별 레이드 성능 — 사람이 관리하는 시트 (pvp.json SHEET_DATA.pve). 있으면 이것이 먼저다 */
  sheet: Readonly<Record<string, readonly SheetRow[]>> | undefined;
  /** D-MAX 화면의 [맥스 참가 가능 다른 유닛] 체크 — 켜져 있어야 검왕 자시안 같은 '맥스 참가' 줄을 추천한다 */
  showJoin?: boolean;
}

export interface BossCounters {
  kind: BossKind;
  rows: MonRef[];
  /** 카드 부제 — '맥스 배틀 추천 후보 — …' */
  sub: string;
  /** 카드 바닥 한 줄 — 어떤 기준으로 골랐는지 */
  foot: string;
  /** 추천의 근거가 된 타입 — 맥스는 보스 첫 타입, 레이드는 공격 타입들 */
  types: string[];
}

/** 보스 이름이 다이맥스 · 거다이맥스로 시작하면 맥스 배틀, 아니면 레이드 (참전 가능한 풀이 다르다) */
export const bossKindOf = (name: string): BossKind => (/^(거다이맥스|다이맥스)\s/.test(name) ? 'max' : 'raid');

const toRef = (row: { sprite: number; name: string; en: string; types: readonly string[] }): MonRef =>
  ({ sprite: row.sprite, name: row.name, en: row.en, types: row.types });

/**
 * 보스(종류 · 타입) → 추천 후보 `limit` 마리. 없으면 null — 빈 카드를 세우지 않는다.
 * 레이드 후보는 종 중복을 뺀다 — 같은 종의 메가 · 섀도우 · 일반이 세 줄을 다 먹지 않게
 */
export function bossCounters(kind: BossKind, bossTypes: readonly string[], src: CounterSource, limit = 5): BossCounters | null {
  if (!bossTypes.length) return null;
  const ko = (type: string) => src.typeKo[type] ?? type;
  if (kind === 'max') {
    // 딜러 표는 보스 타입 하나 기준이다 — 두 타입 보스(불·비행 거다이맥스 리자몽)는 두 표를 합쳐 다른 타입의 상성을 곱해 다시 세운다.
    // 불 표 1위가 땅 기술이면 비행에 ×0.39 라 내려가고, 바위 기술은 ×1.6 이라 올라간다 (Codex, PR #361)
    const seen = new Map<string, { row: DmaxRow; score: number }>();
    for (const [table, other] of (bossTypes.length > 1 ? [[bossTypes[0]!, bossTypes[1]!], [bossTypes[1]!, bossTypes[0]!]] : [[bossTypes[0]!, undefined]]) as [string, string | undefined][]) {
      for (const row of maxVisible(src.dmax?.[table], { join: src.showJoin ?? false, now: true })) {
        const mult = other ? (src.chart[row.charged]?.[other] ?? 1) : 1;
        const score = (row.score ?? 0) * mult;
        const had = seen.get(row.name);
        if (!had || had.score < score) seen.set(row.name, { row, score });
      }
    }
    const rows = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((one) => toRef(one.row));
    if (!rows.length) return null;
    const typeLabel = bossTypes.map(ko).join('·');
    return {
      kind, rows, types: [...bossTypes],
      sub: '맥스 배틀 추천 후보 — 다이맥스·거다이맥스와 다이맥스 없이 참가하는 전설만 참전',
      foot: `${typeLabel} 속성 맥스 배틀 보스 기준 · 메가·원시·섀도우는 맥스 배틀에 참전할 수 없어 제외`,
    };
  }
  const attackTypes = counterTypes(src.chart, src.typeKo as Record<string, string>, bossTypes, 2);
  if (!attackTypes.length) return null;
  // **시트를 먼저 본다** (v3 raidDealerRows) — 그 속성 최강 대비 %(score)라 타입이 달라도 견줄 수 있다.
  //   자체 계산(PVE_DATA)은 같은 보스 가정의 절대 점수라 역시 타입 사이 비교가 된다. 둘을 섞지는 않는다
  const useSheet = attackTypes.every((type) => Array.isArray(src.sheet?.[type]) && src.sheet![type]!.length > 0);
  const source: Readonly<Record<string, readonly { sprite: number; name: string; en: string; types: readonly string[]; score?: number }[]>> | undefined =
    useSheet ? src.sheet : src.pve;
  const merged = attackTypes.flatMap((type) => (source?.[type] ?? []).slice(0, 15));
  merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const seen = new Set<string | number>();
  const rows: MonRef[] = [];
  for (const row of merged) {
    const key = dexNoOf(row.sprite, src.dexTable) ?? row.name;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(toRef(row));
    if (rows.length >= limit) break;
  }
  if (!rows.length) return null;
  const typeLabel = attackTypes.map(ko).join('·');
  return {
    kind, rows, types: attackTypes,
    sub: `레이드 추천 후보 — ${typeLabel} 딜러`,
    foot: `일반·전설·메가 레이드는 전체 포켓몬 참전 · ${typeLabel} 타입 레이드 성능표 상위 (종 중복 제거)`,
  };
}
