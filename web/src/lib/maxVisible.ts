// ─────────────────────────────────────────────────────────────────────────────
// lib/maxVisible.ts — 맥스 표에서 보일 줄을 거르는 한 군데 (2026-10-06)
//
// 두 가지 줄이 기본으로는 안 보인다.
//   unrel — 데이터만 있고 게임에 없는 미구현 줄. 실험 깃발(beta) + [미구현] 체크가 켜져야 보인다
//   join  — '맥스 참가'(다이맥스 없이 맥스 배틀에 참가하는 검왕 자시안 · 방패왕 자마젠타 · 무한다이노).
//           다이맥스 · 거다이맥스만 보고 싶은 사람이 있어 [맥스 참가 가능 다른 유닛] 체크가 켜져야 보인다 (주인 결정)
// 거르는 곳을 여기 하나로 둔다 — 순위표 · 보스 아코디언 · 홈 미리보기 · 덱 짜기 · 팝업 추천이 같은 규칙을 쓴다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export interface MaxShow { unrel?: boolean; join?: boolean }

export function maxVisible<T extends { unrel?: boolean; join?: boolean }>(rows: readonly T[] | undefined, show: MaxShow = {}): T[] {
  return (rows ?? []).filter((row) => (show.unrel || !row.unrel) && (show.join || !row.join));
}
