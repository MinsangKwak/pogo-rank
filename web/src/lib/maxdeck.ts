// ─────────────────────────────────────────────────────────────────────────────
// lib/maxdeck.ts — D-MAX 덱 짜기의 셈 (v3 views/maxdeck.js 이식)
//
// **새로 만드는 데이터가 없다.** 이미 있는 두 표를 읽기만 한다 —
//   DMAX_DATA[보스타입]  딜러 순위 (맥스 피해 dmg · 내구 bulk)
//   DMAX_TANK[보스타입]  탱커 순위 (EHP · 받는 배율 mult)
//
// 지어내지 않는 것 — 맥스가드·맥스스피릿(방어·회복 역할)은 파이프라인에 데이터가 없다.
// 그래서 세 번째 칸을 '탱커' 라고만 부르고 '힐러' 라고 쓰지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import type { DmaxRow, MaxBundle } from '../types/data';

export const MAX_DECK_SIZE = 3;

/**
 * 칸마다 무엇을 고르는 자리인지 — 앞 둘은 딜러, 마지막은 탱커.
 * 이 순서는 화면에 보이는 순서일 뿐이고 누굴 먼저 내보내는지를 뜻하지 않는다.
 */
export const MAX_DECK_SLOTS: readonly { role: 'dealer' | 'tank'; label: string }[] = [
  { role: 'dealer', label: '딜러' },
  { role: 'dealer', label: '딜러' },
  { role: 'tank', label: '탱커' },
];

export type MaxDeck = (number | null)[];

function tableOf(max: MaxBundle, slotIndex: number, bossType: string): DmaxRow[] {
  const role = MAX_DECK_SLOTS[slotIndex]?.role ?? 'dealer';
  return (role === 'tank' ? max.DMAX_TANK?.[bossType] : max.DMAX_DATA?.[bossType]) ?? [];
}

/**
 * 그 칸에 넣을 수 있는 후보. 이미 다른 칸에 들어간 종은 뺀다 —
 * 같은 종을 두 칸에 넣는 덱은 맥스 배틀에서 뜻이 없다.
 * 미구현(데이터만 있고 게임에 없는 개체)도 후보가 아니다 — 덱은 **지금 데려갈 수 있는** 것만 담는다.
 */
export function maxDeckCandidates(max: MaxBundle, slotIndex: number, bossType: string, deck: MaxDeck, dynaOnly: boolean): DmaxRow[] {
  const taken = new Set(deck.filter((sprite, index) => sprite != null && index !== slotIndex).map(Number));
  return tableOf(max, slotIndex, bossType).filter((row) => {
    if (taken.has(Number(row.sprite))) return false;
    if (dynaOnly && row.gmax) return false;
    if (row.unrel) return false;
    return true;
  });
}

/** 세 칸을 자동으로 채운다 — 각 칸의 후보 1위. 뒤 칸은 앞이 가져간 종을 피한다 */
export function maxDeckAutoFill(max: MaxBundle, bossType: string, dynaOnly: boolean): MaxDeck {
  const deck: MaxDeck = [null, null, null];
  for (let index = 0; index < MAX_DECK_SIZE; index += 1) {
    deck[index] = maxDeckCandidates(max, index, bossType, deck, dynaOnly)[0]?.sprite ?? null;
  }
  return deck;
}

/** 스프라이트 id 로 그 칸의 표에서 행을 찾는다 (후보에서 빠진 뒤에도 찾게 표 전체를 본다) */
export function maxDeckRowOf(max: MaxBundle, slotIndex: number, bossType: string, sprite: number | null): DmaxRow | null {
  if (sprite == null) return null;
  return tableOf(max, slotIndex, bossType).find((row) => Number(row.sprite) === Number(sprite)) ?? null;
}

/** 그 칸의 근거 한 줄 — 지어낸 등급이 아니라 표에 있는 숫자 그대로다 */
export function maxDeckWhy(slotIndex: number, row: DmaxRow | null, bossType: string): string {
  if (!row) return '';
  if (MAX_DECK_SLOTS[slotIndex]?.role === 'tank') {
    return bossType === 'overall'
      ? `EHP ${row.ehp} · 체력 ${row.hp} · 방어 ${row.def}`
      : `EHP ${row.ehp} · 보스 기술을 ×${row.mult} 로 받음`;
  }
  return `맥스 피해 ${row.dmg} · 내구 ${row.bulk}`;
}
