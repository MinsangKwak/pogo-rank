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
//
// 의존하는 전역
//   el (dom.js)
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
