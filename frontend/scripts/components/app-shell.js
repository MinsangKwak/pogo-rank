// ─────────────────────────────────────────────────────────────────────────────
// components/app-shell.js — 모든 화면에 계속 떠 있는 상단 바 (2026-09-07 v2.21.0)
//
// 화면 전환마다 헤더를 다시 만들지 않는다. <header> 를 .wrap 밖으로 꺼내 고정 막대로 쓰고,
// 제목·뒤로가기만 해시에 맞춰 갱신한다. 팝업·검색·메뉴는 네이티브 <dialog> 라 포커스와
// Esc 를 브라우저가 맡는다.
//
// 2026-09-08 v2.22.0 디자인 통일
//   헤더 버튼을 텍스트("홈"·"검색"·"메뉴")에서 앱이 원래 쓰던 이모지 아이콘(🔍 👤 ☰)으로
//   되돌렸다. 텍스트 버튼만 파란 글씨·테두리 없음이라 옆의 ← 아이콘 버튼과 따로 놀았다.
//   접근성은 aria-label 로 유지된다 (이름은 스크린리더에 그대로 읽힌다).
//   '홈' 버튼은 뺐다 — 드로어 맨 위 "서비스 홈" 과 같은 곳으로 가는 중복 진입점이라
//   v2.15.1 "화면 하나에 버튼 하나" 원칙에 맞춰 하나만 남긴다.
// ─────────────────────────────────────────────────────────────────────────────
const APP_DESTINATIONS = [
  ['#/plan/collection', '내 포켓몬'], ['#/dex', '포켓몬 도감'],
  ['#/types', '타입 & 상성'], ['#/rank/max', 'D-MAX'],
  ['#/rank/pve', '레이드 · PvE'], ['#/rank/pvp', '배틀 · PvP'],
  ['#/plan', '육성 플래너'], ['#/schedule', '이벤트 일정'],
  ['#/raids', '레이드 보스'], ['#/eggs', '알 부화'],   // 2026-09-08 v2.25.0
];
const appHeader = document.querySelector('header');
document.body.insertBefore(appHeader, document.querySelector('.layout'));
appHeader.className = 'app-bar';
const oldHeading = appHeader.querySelector('h1');
const version = oldHeading.querySelector('.app-bar__version').textContent;
const appTitle = el('h1', { id: 'app-title', tabindex: '-1' }, 'POGO PLAN');
const backButton = el('button', { class: 'icon-btn', 'aria-label': '이전 화면', onclick: () => {
  if (history.state?.appEntry) history.back();
  else navigateHash('');
}}, '←');
const actions = appHeader.querySelector('.app-bar__actions');
appHeader.replaceChildren(el('div', { class: 'app-bar__head' }, backButton, appTitle), actions);
// 🔍 · 👤 · ☰ 아이콘은 index.html 의 것을 그대로 쓴다 (aria-label 이 이미 붙어 있다)
const searchButton = document.getElementById('search-toggle');
searchButton.setAttribute('aria-haspopup', 'dialog');
searchButton.setAttribute('aria-expanded', 'false');
searchButton.setAttribute('aria-controls', 'search-dialog');
// 2026-09-08 v2.29.0 KR/EN 전환 — 헤더 👤 를 비운 자리. 버튼 글자는 "지금 누르면 갈 언어"다
// (한국어로 보고 있으면 EN, 영어로 보고 있으면 KR). 상태 표시가 아니라 행동 표시라 눌러야 할 것이 분명하다
const langButton = document.getElementById('lang-toggle');
// 이 버튼의 글자는 사전을 타지 않는다 (data-i18n="off") — 두 언어 표기를 여기서 직접 정한다.
// 사전에 맡기면 '한국어로 보기' 가 다시 영어로 번역돼 뜻이 뒤집힌다
langButton.dataset.i18n = 'off';
function syncLangButton() {
  langButton.textContent = LANG === 'en' ? 'KR' : 'EN';
  langButton.setAttribute('aria-label', LANG === 'en' ? 'View in Korean (한국어로 보기)' : 'View in English (영어로 보기)');
}
langButton.addEventListener('click', () => {
  setLang(LANG === 'en' ? 'ko' : 'en');
  syncLangButton();
});
syncLangButton();
i18nWatch();   // 그려지는 것을 지켜보다 자동으로 번역한다 (i18n.js)

const menuButton = document.getElementById('menu-toggle');
menuButton.setAttribute('aria-haspopup', 'dialog');
menuButton.setAttribute('aria-expanded', 'false');
menuButton.setAttribute('aria-controls', 'drawer-backdrop');
const panel = document.querySelector('.search');
const typeRow = panel.querySelector('.search__row');
const typeFilters = el('details', { class: 'filter-box filter-box--search' }, el('summary', {}, '타입으로 좁히기'));
typeRow.before(typeFilters);
typeFilters.append(typeRow);
const searchDialog = el('dialog', { id: 'search-dialog', 'aria-label': '포켓몬 검색' }, panel);
document.body.append(searchDialog);
searchDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeSearchDialog(); });
searchDialog.addEventListener('click', (event) => { if (event.target === searchDialog) closeSearchDialog(); });
document.getElementById('psearch').setAttribute('aria-label', '포켓몬 이름 또는 타입');
const drawer = document.querySelector('.drawer__panel');
drawer.querySelector('#schedule-body').closest('details').hidden = true;
const destinations = el('nav', { class: 'nav-menu', 'aria-label': '서비스 이동' },
  el('a', { href: '#', class: 'drawer__item' }, '서비스 홈'),
  ...APP_DESTINATIONS.map(([href, title]) => el('a', { href, class: 'drawer__item' }, title)));
destinations.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href');
  if (href === '#') goHome();  // 열린 것을 닫고 서비스 홈으로 (app.js) — GA 'home' 이벤트도 여기서
  else navigateHash(href);
});
// 2026-09-08 v2.23.0 PC 레이아웃 — 넓은 화면에서는 같은 목록을 드로어가 아니라 왼쪽 고정 사이드바에 둔다.
// 목록을 복제하지 않고 옮기기만 한다 (랜드마크·aria-current 가 두 벌이 되지 않게)
const sideNav = el('aside', { class: 'app-nav', id: 'app-nav' });
document.querySelector('.layout').before(sideNav);
// 2026-09-08 v2.26.0 화면별 헤더 — 넓은 화면에서는 상단 바가 서비스 이름(로고) 자리를 지키고,
// 지금 보고 있는 화면의 이름은 본문 맨 위 헤더가 맡는다. 좁은 화면은 지금까지처럼 상단 바가 겸한다.
// .layout 과 #page 중 하나만 보이므로 헤더도 하나만 두고 글자만 바꾼다.
const pageHead = el('header', { class: 'page-head', id: 'page-head', hidden: true }, el('h2', {}, ''));
document.querySelector('.layout').before(pageHead);
const wideScreen = window.matchMedia('(min-width: 1024px)');
function placeDestinations() {
  if (wideScreen.matches) sideNav.append(destinations);
  else drawer.querySelector('.drawer__head').after(destinations);
}
// 2026-09-08 v2.28.0 폭이 바뀌면 화면도 다시 그린다 — 목록이 줄이 될지 카드가 될지가 폭에 달렸다(wideCards)
wideScreen.addEventListener('change', () => { placeDestinations(); syncAppShell(); if (typeof render === 'function') render(); });
placeDestinations();
drawer.append(el('p', { class: 'drawer__meta' }, 'POGO PLAN · ' + version));
const skip = el('a', { class: 'skip-link', href: '#content', onclick: (event) => {
  event.preventDefault();
  const main = document.getElementById('page').hidden ? document.getElementById('content') : document.getElementById('page');
  main.focus();
}}, '본문으로 건너뛰기');
document.body.prepend(skip);
for (const id of ['content', 'page']) {
  const main = document.getElementById(id);
  main.setAttribute('tabindex', '-1');
  main.setAttribute('role', 'main');
}
let previousRoute = location.hash;
function syncAppShell(moveFocus = false) {
  const hash = location.hash;
  const home = !hash || hash === '#';
  const pageId = currentPageId();
  const title = APP_DESTINATIONS.find(([route]) => route === hash.split('?')[0])?.[1]
    || (pageId ? PAGES[pageId].title.replace(/^[^가-힣A-Za-z]+/, '') : 'POGO PLAN');
  // 넓은 화면: 상단 바는 늘 서비스 이름, 화면 이름은 본문 헤더로 내린다
  const wide = wideScreen.matches;
  appTitle.textContent = home || wide ? 'POGO PLAN' : title;
  pageHead.hidden = home || !wide;
  pageHead.firstChild.textContent = home ? '' : title;
  document.title = (home ? 'POGO PLAN' : title + ' — POGO PLAN');
  backButton.hidden = home;
  document.body.dataset.screen = home ? 'home' : 'detail';
  destinations.querySelectorAll('a').forEach(a => {
    if (a.getAttribute('href') === (home ? '#' : hash)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (moveFocus && !document.querySelector('dialog[open]')) {
    window.scrollTo(0, 0);
    appTitle.focus({ preventScroll: true });
  }
}
window.addEventListener('hashchange', () => {
  // Hash navigation has a same-app predecessor; directly loaded links do not.
  if (location.hash !== previousRoute && !history.state?.appEntry) {
    history.replaceState({ ...history.state, appEntry: true }, '');
  }
  previousRoute = location.hash;
  syncAppShell(true);
});
syncAppShell();

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  const dialog = dialogs.at(-1);
  if (!dialog) return;
  const targets = [...dialog.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex="0"]')]
    .filter(node => !node.disabled && node.getClientRects().length);
  const first = targets[0], last = targets.at(-1);
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
});

function compactScreenFilters() {
  const controls = document.getElementById('controls');
  for (const group of [...controls.children]) {
    if (group.querySelectorAll('.chips__item').length < 8) continue;
    const details = el('details', { class: 'filter-box' },
      el('summary', {}, '타입 필터 · 선택하기'));
    details.open = !!state.filtersOpen;
    details.addEventListener('toggle', () => { state.filtersOpen = details.open; });
    group.before(details);
    details.append(group);
  }
}
