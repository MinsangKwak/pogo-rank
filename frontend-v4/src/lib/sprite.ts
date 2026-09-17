// ─────────────────────────────────────────────────────────────────────────────
// lib/sprite.ts — 포켓몬 그림 주소
//
// 미리보기는 dev.moncamp.kr/react/ 에 얹히고 그림은 루트의 v3 배포본에 있다.
// 40MB 를 두 벌 두지 않으려고 '../sprites/' 로 그쪽을 그대로 가리킨다.
// 정식 전환 때는 v3 처럼 자기 dist 안에 둔다.
// ─────────────────────────────────────────────────────────────────────────────
const BASE = `${import.meta.env.BASE_URL}../sprites/`;
const ANIM = `${import.meta.env.BASE_URL}../sprites-anim/`;

export function spriteSrc(id: number, ids: ReadonlySet<number>): string | null {
  return ids.has(Number(id)) ? `${BASE}${id}.png` : null;
}

export function spriteAnimSrc(id: number, ids: ReadonlySet<number>): string | null {
  return ids.has(Number(id)) ? `${ANIM}${id}.gif` : null;
}
