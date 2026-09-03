// 포켓몬 스프라이트 (없으면 몬스터볼 자리표시)
// 2026-09-03 v2.0.0: 기본은 개별 png(dist/sprites/) lazy 로딩, 미리보기용 인라인 모드(SPRITES 맵)도 지원
let _spriteIds = null;
function spriteSrc(id) {
  if (typeof SPRITES !== 'undefined' && SPRITES && SPRITES[id]) return SPRITES[id];
  if (typeof SPRITE_IDS === 'undefined') return null;
  if (!_spriteIds) _spriteIds = new Set(SPRITE_IDS);
  return _spriteIds.has(Number(id)) ? `sprites/${id}.png` : null;
}
function sprite(id) {
  const src = spriteSrc(id);
  if (src) return el('img', { class: 'sprite', src, alt: '', loading: 'lazy', decoding: 'async' });
  const ph = el('span', { class: 'sprite empty' });
  ph.innerHTML = '<svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">'
    + '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2.5"/>'
    + '<path d="M6 20h9.5M24.5 20H34" stroke="currentColor" stroke-width="2.5"/>'
    + '<circle cx="20" cy="20" r="4.5" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  return ph;
}
