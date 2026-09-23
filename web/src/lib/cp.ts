// ─────────────────────────────────────────────────────────────────────────────
// lib/cp.ts — CP 계산 (v3 components/pages.js · detail.js 의 식 그대로)
//
// 게임의 포획 개체 규칙 — 레벨과 개체값 하한이 잡는 경로마다 정해져 있다:
//   레이드 보상   Lv20, 날씨 부스트면 Lv25. 개체값 하한 10/10/10
//   맥스 배틀     Lv20 고정 · 하한 10/10/10. **날씨 부스트가 없다** = Lv25 가 존재하지 않는다
//   야생 스폰     Lv1~30, 부스트 Lv6~35. 하한 0/0/0 이라 '최저 CP' 가 뜻이 없다
//   만렙          Lv50
// 그래서 레이드·맥스 배틀만 '최저(10) ~ 최고(15)' 구간을 함께 보여 준다.
// ─────────────────────────────────────────────────────────────────────────────
import type { DexForm } from '../types/data';

/** Lv1 부터의 정수 레벨 CPM 배열(인덱스 0 = Lv1). 반레벨은 제곱평균으로 보간한다 (v3 cpmAt) */
export function cpmAt(cpms: readonly number[], level: number): number {
  const index = Math.floor(level) - 1;
  const here = cpms[index] ?? 0;
  if (level % 1 === 0) return here;
  const next = cpms[index + 1] ?? here;
  return Math.sqrt((here ** 2 + next ** 2) / 2);
}

/** CP = floor(공격 × √방어 × √체력 × CPM² / 10), 최소 10 */
export function cpFrom(form: DexForm, cpm: number, atkIv: number, defIv: number, hpIv: number): number {
  return Math.max(10, Math.floor(
    (form.atk + atkIv) * Math.sqrt(form.def + defIv) * Math.sqrt(form.hp + hpIv) * cpm * cpm / 10,
  ));
}

/** 세 개체값이 같을 때 (포획 CP 표가 쓰는 모양) */
export function cpAtIv(form: DexForm, cpm: number, iv: number): number {
  return cpFrom(form, cpm, iv, iv, iv);
}

/** 개체값 100%(15/15/15) CP */
export function cpOf(form: DexForm, cpm: number): number {
  return cpAtIv(form, cpm, 15);
}

/** 레벨로 계산 (계산기·개체값 순위가 쓴다) */
export function calcCp(form: DexForm, cpms: readonly number[], level: number, atkIv: number, defIv: number, hpIv: number): number {
  return cpFrom(form, cpmAt(cpms, level), atkIv, defIv, hpIv);
}
