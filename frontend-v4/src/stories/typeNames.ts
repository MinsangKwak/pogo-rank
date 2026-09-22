// ─────────────────────────────────────────────────────────────────────────────
// stories/typeNames.ts — 타입 한글 이름 18개
//
// **backend/build.py 의 TYPE_KO 를 그대로 옮긴 것이다.** 지어낸 이름이 아니다 (CLAUDE.md §3).
// 앱은 이 표를 빌드 데이터(`useDex().data.TYPE_KO`)로 받는다 — 스토리북에는 그 데이터가
// 없으므로 도면용으로만 한 벌 둔다. 원본이 바뀌면 여기도 같이 고친다.
// ─────────────────────────────────────────────────────────────────────────────
import type { TypeName } from '../ds';

export const TYPE_KO: Record<TypeName, string> = {
  normal: '노말',
  fire: '불꽃',
  water: '물',
  grass: '풀',
  electric: '전기',
  ice: '얼음',
  fighting: '격투',
  poison: '독',
  ground: '땅',
  flying: '비행',
  psychic: '에스퍼',
  bug: '벌레',
  rock: '바위',
  ghost: '고스트',
  dragon: '드래곤',
  dark: '악',
  steel: '강철',
  fairy: '페어리',
};
