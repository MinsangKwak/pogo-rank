// ─────────────────────────────────────────────────────────────────────────────
// lib/sprite.ts — 포켓몬 그림 주소
//
// 그림은 v3 빌드가 만든 것을 그대로 쓴다 (2,000장이 넘어 두 벌 둘 것이 아니다).
// 배포가 v3 dist 의 sprites · sprites-anim 만 이 앱 옆에 옮겨 놓는다 (deploy-dev.yml).
//
// **'../sprites/' 로 적지 않는다.** 그건 이 앱이 /react/ 밑에 살던 때 한 겹 위를 가리키던 말이고,
// 루트로 올라온 지금은 사이트 밖(/../sprites/)을 가리킨다. BASE 뒤에 바로 붙인다.
// ─────────────────────────────────────────────────────────────────────────────
import { BASE as ASSETS } from './base';

const BASE = `${ASSETS}sprites/`;
const ANIM = `${ASSETS}sprites-anim/`;

export function spriteSrc(id: number, ids: ReadonlySet<number>): string | null {
  return ids.has(Number(id)) ? `${BASE}${id}.png` : null;
}

export function spriteAnimSrc(id: number, ids: ReadonlySet<number>): string | null {
  return ids.has(Number(id)) ? `${ANIM}${id}.gif` : null;
}
