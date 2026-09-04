// ─────────────────────────────────────────────────────────────────────────────
// components/sprite.js — 포켓몬 스프라이트 이미지 조각
//
// 제공하는 전역
//   spriteSrc(spriteId)   스프라이트 이미지 경로(또는 data URL). 없으면 null
//   sprite(spriteId)      화면에 넣을 이미지 요소. 이미지가 없으면 몬스터볼 자리표시
//   _spriteIds            SPRITE_IDS를 Set으로 바꿔 둔 캐시 (이 파일 내부용)
//
// 의존하는 전역
//   el (dom.js) · SPRITES · SPRITE_IDS (둘 다 빌드 주입 데이터, 없을 수도 있다)
// ─────────────────────────────────────────────────────────────────────────────

// 포켓몬 스프라이트 (없으면 몬스터볼 자리표시)
// 2026-09-03 v2.0.0: 기본은 개별 png(dist/sprites/) lazy 로딩, 미리보기용 인라인 모드(SPRITES 맵)도 지원

// SPRITE_IDS(배열)를 Set으로 바꾼 캐시. 있는지 확인하는 호출이 목록마다 수십 번씩
// 일어나므로 처음 필요할 때 한 번만 만들어 둔다
let _spriteIds = null;

// 스프라이트 id로 이미지 주소를 찾는다.
//   spriteId  빌드가 붙여 준 스프라이트 번호 (도감 번호 기반)
//   반환값    인라인 data URL 또는 'sprites/<id>.png' 경로, 이미지가 없으면 null
function spriteSrc(spriteId) {
  // 미리보기 빌드에서는 이미지가 SPRITES 맵에 base64로 실려 온다 — 이게 있으면 우선한다
  if (typeof SPRITES !== 'undefined' && SPRITES && SPRITES[spriteId]) return SPRITES[spriteId];
  // 배포 빌드에는 "png로 뽑힌 id 목록"만 들어온다. 목록 자체가 없으면 이미지도 없다
  if (typeof SPRITE_IDS === 'undefined') return null;
  if (!_spriteIds) _spriteIds = new Set(SPRITE_IDS);
  // 목록은 숫자로 담겨 있어 문자열 id가 들어와도 맞도록 Number로 맞춘다
  return _spriteIds.has(Number(spriteId)) ? `sprites/${spriteId}.png` : null;
}

// 스프라이트 요소를 만든다.
//   spriteId  스프라이트 번호
//   반환값    <img class="sprite">, 이미지가 없으면 몬스터볼 아이콘이 든 <span class="sprite empty">
function sprite(spriteId) {
  const spriteUrl = spriteSrc(spriteId);
  // 목록이 길어 스크롤로 내려가야 보이는 이미지가 많으므로 lazy·async로 받는다.
  // 이름은 옆 텍스트에 이미 있으니 alt는 빈 문자열(장식 이미지)로 둔다
  if (spriteUrl) {
    return el('img', { class: 'sprite', src: spriteUrl, alt: '', loading: 'lazy', decoding: 'async' });
  }
  // 자리표시용 몬스터볼. currentColor로 그려 두면 테마 색을 그대로 따라간다
  const placeholder = el('span', { class: 'sprite empty' });
  placeholder.innerHTML = '<svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">'
    + '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2.5"/>'
    + '<path d="M6 20h9.5M24.5 20H34" stroke="currentColor" stroke-width="2.5"/>'
    + '<circle cx="20" cy="20" r="4.5" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  return placeholder;
}
