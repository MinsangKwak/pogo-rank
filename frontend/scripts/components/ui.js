// ─────────────────────────────────────────────────────────────────────────────
// components/ui.js — 화면마다 손으로 다시 적던 작은 조각들 (2026-09-08 v2.30.0)
//
// 왜 만드나
//   같은 모양을 만드는 el(...) 호출이 파일마다 흩어져 있었다. 예를 들어
//     el('button', { class: 'uchip', onclick: fn }, '라벨')          40곳 남짓
//     el('button', { class: 'icon-btn', 'aria-label': '뒤로' }, '←')  6곳
//     el('p', { class: 'detail__foot' }, '…')                        20곳 남짓
//   클래스 이름을 한 글자 고치려면 스무 곳을 찾아 다녀야 했고, 실제로 v2.24.0 BEM
//   리네이밍에서 그렇게 놓친 곳이 나왔다. 조각을 함수로 두면 고칠 곳이 한 곳이 된다.
//
// 이름을 왜 footNote · hintNote 로 지었나
//   짧게 foot · hint 로 뒀더니 detail.js 의 지역 변수 `const foot = [...]` 이 그대로 가려 버렸다.
//   번들이 한 <script> 라 전역 함수는 어디서든 보이지만, **같은 이름의 지역 변수가 있으면 그 함수 안에서는 진다.**
//   전역에 흔한 낱말을 두지 않는다 — 이름 하나로 다른 파일이 조용히 깨진다.
//
// 무엇을 넣고 무엇을 안 넣나
//   **두 곳 이상에서 똑같이 쓰이고, 모양이 클래스 하나로 끝나는 것만** 넣는다.
//   한 화면에서만 쓰는 조립은 그 화면에 둔다 — 여기로 올리면 이 파일이 두 번째 app.js 가 된다.
//
// 제공하는 전역
//   uchip(label, onclick, opts)   테두리 칩 버튼 (필터·도구·작은 동작)
//   iconBtn(icon, label, onclick) 정사각 아이콘 버튼 (44px, aria-label 필수)
//   pageBody(id, ...children)     전체 페이지 본문 래퍼 (측정용 id 를 함께 단다)
//   sectionTitle(text, meta)      페이지 안 소제목 줄
//   footNote(...parts)            각주 (출처·계산 기준)
//   hintNote(...parts)            안내·빈 상태 문구
//   metaText(...parts)            보조 문구 한 조각
//   layoutInitial(storageKey)     그리드/리스트 초기값(저장된 선택 → 없으면 wideCards() 기본값)
//   layoutToggle(storageKey, grid, onToggle)   그리드 ↔ 리스트 보기 세그먼트 컨트롤 (2026-09-09 v2.40.0)
//
// 의존하는 전역
//   el (dom.js) · wideCards (dom.js) · translateTree (i18n.js, 선택)
// ─────────────────────────────────────────────────────────────────────────────

// 테두리 칩 버튼. opts.on 이면 눌린 표시(aria-pressed + is-on), opts.label 은 스크린리더용 이름
function uchip(label, onclick, opts = {}) {
  const attrs = { class: `uchip${opts.on ? ' is-on' : ''}${opts.class ? ` ${opts.class}` : ''}` };
  if (onclick) attrs.onclick = onclick;
  if (opts.on !== undefined) attrs['aria-pressed'] = String(!!opts.on);
  if (opts.label) attrs['aria-label'] = opts.label;
  if (opts.title) attrs.title = opts.title;
  return el('button', attrs, label);
}

// 정사각 아이콘 버튼. 아이콘만으로는 뜻이 안 읽히므로 aria-label 을 반드시 받는다
function iconBtn(icon, label, onclick, opts = {}) {
  const attrs = { class: `icon-btn${opts.class ? ` ${opts.class}` : ''}`, 'aria-label': label };
  if (onclick) attrs.onclick = onclick;
  if (opts.id) attrs.id = opts.id;
  return el('button', attrs, icon);
}

// 전체 페이지 본문. id 는 측정용이다 — GA·히트맵에서 화면을 셀 때 주소를 다시 파싱하지 않아도 된다
function pageBody(id, ...children) {
  return el('div', { class: 'page__body', id: `page-${id}`, 'data-route': id }, ...children);
}

function sectionTitle(text, meta) {
  return el('h2', { class: 'page__sec' }, text, meta ? el('span', { class: 'meta' }, ` ${meta}`) : '');
}

// 각주 — 출처·계산 기준처럼 "이 숫자를 어디서 얻었나"를 밝히는 줄
function footNote(...parts) {
  return el('p', { class: 'detail__foot' }, ...parts);
}

// 안내·빈 상태 — 사용자가 다음에 무엇을 하면 되는지 알려 주는 줄
function hintNote(...parts) {
  return el('p', { class: 'dex__hint' }, ...parts);
}

function metaText(...parts) {
  return el('span', { class: 'meta' }, ...parts);
}

// 2026-09-09 v2.37.0 그리드 ↔ 리스트 보기 전환 — 도감(#/dex)에서만 쓰던 것을 즐겨찾기·레이드 보스·
// 알 부화에도 쓸 수 있게 뗐다. storageKey 를 화면마다 다르게 줘서 선택이 서로 안 섞이게 한다.
// 저장 값은 도감이 쓰던 관례 그대로 '1'(리스트)|'2'(그리드) — 이미 나간 키(pogo_dex_cols)의 뜻을 그대로 잇는다

// 초기 그리드 여부 — 저장된 선택이 있으면 그쪽, 없으면 wideCards() 기본값(PC=그리드)
function layoutInitial(storageKey, defaultGrid = wideCards()) {
  let grid = defaultGrid;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) grid = saved === '2';
  } catch { /* 저장 불가 환경(사생활 모드 등) */ }
  return grid;
}
// 2026-09-09 v2.40.0 누를 때마다 뜻이 뒤집히는 버튼 하나 → 두 보기를 나란히 놓고 고르는 세그먼트 컨트롤.
// 버튼 하나였을 때는 라벨이 "지금 보기"인지 "누르면 될 보기"인지가 글자만으로 안 갈렸고(v2.29.2 에서
// 한 번 고쳐 쓴 문제), 좁은 화면에서 안내문 아래 홀로 떠 있어 눈에도 안 띄었다. 둘 다 보이면 고를 것이
// 무엇이고 지금 어느 쪽인지가 한눈에 읽힌다.
//   storageKey   localStorage 키
//   grid         지금 그리드인지 (초기값)
//   onToggle(grid)  보기가 바뀔 때 불린다 — 호출부가 목록 class(is-grid)를 이 값으로 맞춘다
//   extraClass   도감의 .dex__layout 처럼 화면별로 더 붙일 클래스 (회귀 검사가 이 클래스로 찾는다)
function layoutToggle(storageKey, grid, onToggle, extraClass = '') {
  const $wrap = el('div', { class: `seg-view${extraClass ? ' ' + extraClass : ''}`, role: 'group', 'aria-label': '보기 방식' });
  // [이 칸이 그리드인가, 아이콘, 라벨] — 순서가 곧 화면 순서다
  const views = [[false, '☰', '리스트'], [true, '⊞', '그리드']];
  const buttons = views.map(([isGrid, icon, label]) => el('button', {
    'aria-pressed': String(grid === isGrid),
    onclick: () => pick(isGrid),
  }, el('span', { class: 'seg-view__ico', 'aria-hidden': 'true' }, icon), label));
  function pick(next) {
    if (next === grid) return;   // 이미 그 보기다 — 저장도 다시 그리기도 하지 않는다
    grid = next;
    buttons.forEach(($button, index) => $button.setAttribute('aria-pressed', String(views[index][0] === grid)));
    try { localStorage.setItem(storageKey, grid ? '2' : '1'); } catch { /* 저장 불가 환경 */ }
    onToggle(grid);
  }
  $wrap.append(...buttons);
  return $wrap;
}
