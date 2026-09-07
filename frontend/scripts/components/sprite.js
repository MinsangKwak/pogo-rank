// ─────────────────────────────────────────────────────────────────────────────
// components/sprite.js — 포켓몬 스프라이트 이미지 조각
//
// 제공하는 전역
//   spriteSrc(spriteId)   스프라이트 이미지 경로(또는 data URL). 없으면 null
//   sprite(spriteId)      화면에 넣을 이미지 요소. 이미지가 없으면 몬스터볼 자리표시. 받는 동안은 스켈레톤(.loading), 실패 시 2회 재시도
//   waitForSprites(maxMs) 문서의 받는 중인 스프라이트가 끝날 때까지 기다린다 (첫 화면 가림막용)
//   spritePlaceholder()   몬스터볼 자리표시 요소 (이미지가 없거나 받기 실패했을 때)
//   _spriteIds            SPRITE_IDS를 Set으로 바꿔 둔 캐시 (이 파일 내부용)
//
// 의존하는 전역
//   el (dom.js) · SPRITES · SPRITE_IDS (둘 다 빌드 주입 데이터, 없을 수도 있다)
// ─────────────────────────────────────────────────────────────────────────────

// 포켓몬 스프라이트 (없으면 몬스터볼 자리표시)
// 2026-09-03 v2.0.0: 기본은 개별 png(dist/sprites/), 미리보기용 인라인 모드(SPRITES 맵)도 지원 — 2026-09-07 v2.16.1 lazy 제거(즉시 로드)

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
  if (!spriteUrl) return spritePlaceholder();
  // 2026-09-05 v2.7.2 저장소 배정 번호(90000번대, sprite.py LOCAL_FORMS)는 픽셀 스프라이트가 아니라
  // 게임 내 3D 렌더 아이콘이라 pixelated 로 축소하면 계단이 진다 — sprite-hd 로 부드럽게 그린다
  const hd = Number(spriteId) >= 90000;
  // 2026-09-07 v2.16.1 첫 화면에서 그림이 안 뜨고 새로고침해야 나오던 문제 — 원인은 cloneNode.
  //   D-MAX 티어표 행(views/max.js expandableRow)과 내 덱(ifsolo.js)은 row() 결과를 cloneNode 로 복제하는데, 복제본에는
  //   이미지의 load 리스너가 없어 v2.14.0 스켈레톤(.loading)이 영영 안 벗겨졌다. 새로고침하면 캐시된 이미지가 생성 시점에
  //   이미 완료 상태라 아래 complete 검사로 벗겨져 정상처럼 보였다. 그래서 load/error 처리를 요소가 아니라 문서 캡처 리스너로
  //   옮겼다(아래) — 복제돼도 동작한다. 함께 (1) loading="lazy" 제거(평균 1KB, 동적 lazy 이미지가 안 받아지는 브라우저 회피),
  //   (2) 실패 시 캐시 우회 주소(?r=n)로 2회 재시도, (3) app.js 가 첫 화면 이미지가 다 뜰 때까지 가림막 유지(waitForSprites)
  const image = el('img', { class: hd ? 'sprite sprite-hd loading' : 'sprite loading', alt: '', decoding: 'async', 'data-src': spriteUrl });
  image.src = spriteUrl;
  if (image.complete && image.naturalWidth > 0) image.classList.remove('loading');
  return image;
}

// 문서 캡처 리스너 — load/error 는 버블링하지 않지만 캡처 단계에서는 문서에서 받을 수 있다. 복제된 이미지에도 적용된다
document.addEventListener('load', (event) => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.classList.contains('sprite')) image.classList.remove('loading');
}, true);
document.addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.classList.contains('sprite') || !image.dataset.src) return;
  const retries = Number(image.dataset.retry || 0);
  if (retries < 2) {
    image.dataset.retry = String(retries + 1);
    setTimeout(() => { image.src = `${image.dataset.src}?r=${retries + 1}`; }, 300 * (retries + 1));
    return;
  }
  image.replaceWith(spritePlaceholder());  // 두 번 더 받아도 안 되면 몬스터볼 자리표시
}, true);

// 2026-09-07 v2.16.1 문서에 아직 받는 중인 스프라이트(.loading)가 없어질 때까지 기다린다 — 성공하면 클래스가 벗겨지고,
// 실패하면 재시도 끝에 자리표시로 교체되므로 어느 쪽이든 끝난다. maxMs 를 넘기면 그냥 돌아온다(느린 회선 대비). 첫 화면 가림막(app.js)이 쓴다
function waitForSprites(maxMs = 2500) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const pending = document.querySelectorAll('img.sprite.loading').length;
      if (!pending || Date.now() - started >= maxMs) return resolve(pending);
      setTimeout(tick, 80);
    };
    tick();
  });
}

// 자리표시용 몬스터볼. currentColor로 그려 두면 테마 색을 그대로 따라간다
function spritePlaceholder() {
  const placeholder = el('span', { class: 'sprite empty' });
  placeholder.innerHTML = '<svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">'
    + '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="2.5"/>'
    + '<path d="M6 20h9.5M24.5 20H34" stroke="currentColor" stroke-width="2.5"/>'
    + '<circle cx="20" cy="20" r="4.5" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
  return placeholder;
}
