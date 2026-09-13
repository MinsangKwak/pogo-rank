// ─────────────────────────────────────────────────────────────────────────────
// components/sprite.js — 포켓몬 스프라이트 이미지 조각
//
// 제공하는 전역
//   spriteSrc(spriteId)     스프라이트 이미지 경로(또는 data URL). 없으면 null
//   spriteAnimSrc(spriteId) 움직이는 그림 경로. 없으면 null
//   spriteAnimate(img, id)  정지 그림 <img> 를 다 받은 뒤 움직이는 그림으로 갈아 끼운다
//   spriteAnimEnabled()     움직이는 그림을 쓰는가 — 설정 화면(pogo_sprite_anim)이 정한다. 기본 켬 (v3.18.0)
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

// ── 2026-09-12 v2.67.0 움직이는 그림 ─────────────────────────────────────────
// GIF 한 장이 정지 png 의 13배(평균 54KB)다. v2.67.0 에는 그래서 상세 화면에만 썼는데,
// 2026-09-12 v3.18.0 부터 **모든 그림이 기본으로 움직인다** — 정지본을 먼저 띄우고 GIF 를 받은 뒤 갈아 끼우므로
// 화면이 비는 일은 없고, 무거우면 설정 화면에서 끌 수 있다(pogo_sprite_anim = 'off').
// 움직임을 줄여 달라고 한 기기(prefers-reduced-motion)에서는 설정과 무관하게 정지본이다.
// 1,172종 중 949종에만 있다(6세대 이후·폼 변형 상당수 없음) — 없으면 null 을 돌려주고
// 부르는 쪽이 지금까지처럼 정지 png 를 쓴다
let _spriteAnimIds = null;
const SPRITE_ANIM_KEY = 'pogo_sprite_anim';   // 'off' 면 정지본만. 없으면 켬
// 2026-09-13 v3.20.0 움직이는 그림은 출처가 둘이라 원본 크기가 제각각이다 — 23×19 부터 201×166 까지.
// 상자에 맞추기만 하면 작은 종이 3배 넘게 늘어나 뭉개지고, 종끼리 크기가 뒤죽박죽이었다.
// 도트 그림은 **정수배**로 키울 때만 선명하므로 2배를 한도로 두고, 남는 자리는 padding 으로 비운다
// (img 크기를 직접 줄이면 목록 줄 높이가 그림마다 달라진다 — border-box + padding 이라 자리는 그대로다)
//
// 상자 크기는 화면마다 다르고(줄 42px · 카드 128px · 상세 72px) 보기 전환으로 바뀌므로, 한 번 계산하고 끝내지 않고
// ResizeObserver 로 상자가 바뀔 때마다 다시 맞춘다 — padding 을 바꿔도 border-box 크기는 그대로라 저를 다시 부르지 않는다
const SPRITE_MAX_ZOOM = 2;
const animZoomWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver((entries) => { for (const entry of entries) fitAnimZoom(entry.target); })
  : null;

function fitAnimZoom(image) {
  const natural = Math.max(Number(image.dataset.animW) || 0, Number(image.dataset.animH) || 0);
  if (!natural) return;
  // 화면이 원래 주던 여백(티어표 카드·비교 카드의 0.8rem)은 지키고 그 위에 한도를 얹는다 —
  // 처음 한 번 인라인 padding 을 비워 CSS 값을 읽어 둔다
  if (image.dataset.animPad === undefined) {
    image.style.padding = '';
    image.dataset.animPad = String(parseFloat(getComputedStyle(image).paddingTop) || 0);
  }
  const base = Number(image.dataset.animPad);
  const box = Math.min(image.clientWidth, image.clientHeight);   // border-box 라 padding 을 포함한 상자 크기
  if (!box) return;
  const room = Math.max(0, box - base * 2);
  const want = Math.min(natural * SPRITE_MAX_ZOOM, room);
  image.style.padding = `${Math.max(base, Math.round((box - want) / 2))}px`;
  // 줄일 때는 부드럽게, 키울 때는 도트 그대로 — 도트를 줄이면 계단이 지고(v2.7.2 sprite--hd 와 같은 이유),
  // 정수배로 키우면 오히려 또렷하다
  image.style.imageRendering = natural > room ? 'auto' : '';
}
function spriteAnimEnabled() {
  try { return localStorage.getItem(SPRITE_ANIM_KEY) !== 'off'; } catch { return true; }
}
// 2026-09-12 v3.19.0 설정을 body.sprite-anim-off 로도 알린다 — 움직이는 그림이 없는 종을 흔드는 CSS(list.css sprite-idle)가 읽는다
function syncSpriteAnimClass() {
  document.body?.classList.toggle('sprite-anim-off', !spriteAnimEnabled());
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncSpriteAnimClass);
else syncSpriteAnimClass();
function spriteAnimSrc(spriteId) {
  if (typeof SPRITE_ANIM_IDS === 'undefined') return null;
  if (!_spriteAnimIds) _spriteAnimIds = new Set(SPRITE_ANIM_IDS);
  return _spriteAnimIds.has(Number(spriteId)) ? `sprites-anim/${spriteId}.gif` : null;
}

// 정지 그림으로 만든 <img> 를 움직이는 그림으로 바꿔 끼운다.
// 정지본을 먼저 띄운 뒤 GIF 를 받아 갈아 끼우는 이유 — GIF 를 바로 src 에 넣으면
// 받는 동안(54KB) 자리가 비어 상세 화면이 빈 칸으로 열린다. 받기에 실패하면 정지본 그대로 둔다
function spriteAnimate(image, spriteId) {
  // 움직임을 줄여 달라고 한 사람에게는 갈아 끼우지 않는다 — GIF 는 재생을 멈출 방법이 없다
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return image;
  const animUrl = spriteAnimSrc(spriteId);
  if (!animUrl || !(image instanceof HTMLImageElement)) return image;
  const loader = new Image();
  loader.onload = () => {
    image.src = animUrl;
    image.classList.add('sprite--anim');
    image.dataset.animW = String(loader.naturalWidth);
    image.dataset.animH = String(loader.naturalHeight);
    fitAnimZoom(image);
    animZoomWatch?.observe(image, { box: 'border-box' });
  };
  loader.src = animUrl;
  return image;
}

// 스프라이트 요소를 만든다.
//   spriteId  스프라이트 번호
//   반환값    <img class="sprite">, 이미지가 없으면 몬스터볼 아이콘이 든 <span class="sprite empty">
function sprite(spriteId) {
  const spriteUrl = spriteSrc(spriteId);
  if (!spriteUrl) return spritePlaceholder();
  // 2026-09-05 v2.7.2 저장소 배정 번호(90000번대, sprite.py LOCAL_FORMS)는 픽셀 스프라이트가 아니라
  // 게임 내 3D 렌더 아이콘이라 pixelated 로 축소하면 계단이 진다 — sprite--hd 로 부드럽게 그린다
  const hd = Number(spriteId) >= 90000;
  // 2026-09-07 v2.16.1 첫 화면에서 그림이 안 뜨고 새로고침해야 나오던 문제 — 원인은 cloneNode.
  //   D-MAX 티어표 행(views/max.js expandableRow)과 내 덱(ifsolo.js)은 row() 결과를 cloneNode 로 복제하는데, 복제본에는
  //   이미지의 load 리스너가 없어 v2.14.0 스켈레톤(.is-loading)이 영영 안 벗겨졌다. 새로고침하면 캐시된 이미지가 생성 시점에
  //   이미 완료 상태라 아래 complete 검사로 벗겨져 정상처럼 보였다. 그래서 load/error 처리를 요소가 아니라 문서 캡처 리스너로
  //   옮겼다(아래) — 복제돼도 동작한다. 함께 (1) loading="lazy" 제거(평균 1KB, 동적 lazy 이미지가 안 받아지는 브라우저 회피),
  //   (2) 실패 시 캐시 우회 주소(?r=n)로 2회 재시도, (3) app.js 가 첫 화면 이미지가 다 뜰 때까지 가림막 유지(waitForSprites)
  const image = el('img', { class: hd ? 'sprite sprite--hd is-loading' : 'sprite is-loading', alt: '', decoding: 'async', 'data-src': spriteUrl });
  image.src = spriteUrl;
  if (image.complete && image.naturalWidth > 0) image.classList.remove('is-loading');
  // 2026-09-12 v3.18.0 기본으로 움직인다 — 정지본이 자리를 잡은 뒤 GIF 로 갈아 끼운다
  if (spriteAnimEnabled()) spriteAnimate(image, spriteId);
  return image;
}

// 문서 캡처 리스너 — load/error 는 버블링하지 않지만 캡처 단계에서는 문서에서 받을 수 있다. 복제된 이미지에도 적용된다
document.addEventListener('load', (event) => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.classList.contains('sprite')) image.classList.remove('is-loading');
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
      const pending = document.querySelectorAll('img.sprite.is-loading').length;
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
