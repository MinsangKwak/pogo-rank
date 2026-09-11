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
// 2026-09-08 v2.30.0 이동 목록은 라우터 표(router.js ROUTE_NAV)가 원본이다 —
// 메뉴에 화면을 하나 더 올리려면 ROUTES 에 nav 를 달면 되고, 여기는 손대지 않는다
// 2026-09-09 v2.37.0 PC 는 사이드바가 늘 보이므로 ← 뒤로가기(styles/components/app-shell.css)와
// ☰ 메뉴의 잡다한 항목(placeDrawerExtra, 아래)이 필요 없다 — 사이드바 링크 하나로 어디든 갈 수 있다
const APP_DESTINATIONS = ROUTE_NAV;
const appHeader = document.querySelector('header');
document.body.insertBefore(appHeader, document.querySelector('.layout'));
appHeader.className = 'app-bar';
const oldHeading = appHeader.querySelector('h1');
const version = oldHeading.querySelector('.app-bar__version').textContent;
// 2026-09-08 v2.30.0 로고를 누르면 서비스 홈. 좁은 화면에서도 상단 바는 늘 로고 자리이므로
// "여기가 처음으로 가는 곳" 이라는 웹의 오랜 약속을 그대로 쓴다.
// h1 은 화면 이름을 읽어 주는 자리(포커스 대상)라 그대로 두고 안쪽에 버튼을 넣는다 —
// #app-title 의 textContent 는 여전히 'POGO PLAN' 이다
const appLogo = el('button', { type: 'button', id: 'app-logo', class: 'app-bar__logo',
  onclick: () => goHome() }, 'POGO PLAN');
const appTitle = el('h1', { id: 'app-title', tabindex: '-1' }, appLogo);
const backButton = iconBtn('←', '이전 화면', () => {
  if (history.state?.appEntry) history.back();
  else navigateHash('');
});
const actions = appHeader.querySelector('.app-bar__actions');
// 2026-09-10 v2.42.0 넓은 화면 상단 바의 검색 칸 — 돋보기 아이콘 하나였을 때는 "여기서 검색한다"가
// 안 읽혔다. 입력처럼 생겼지만 실제로는 버튼이다: 누르면 늘 쓰던 검색 팝업(toggleSearchPanel)이 열린다.
// 입력을 두 벌 두면 어느 쪽에 친 글자가 진짜인지가 흐려지고, 결과 목록도 두 곳에 그려야 한다.
// 좁은 화면에서는 CSS 가 감춘다 (돋보기 버튼은 그대로 남는다)
const appSearch = el('button', { class: 'app-search', id: 'app-search', 'aria-label': '포켓몬 검색' },
  el('span', { class: 'app-search__ico', 'aria-hidden': 'true' }, '🔍'),
  el('span', { class: 'app-search__ph' }, '포켓몬, 기술, 가이드를 검색하세요…'),
  el('kbd', { class: 'app-search__key', 'aria-hidden': 'true' }, '/'));
appSearch.addEventListener('click', () => toggleSearchPanel(true));
// 슬래시 한 번으로 검색 — 글자를 치고 있던 중이면 가로채지 않는다
document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if (document.querySelector('dialog[open]')) return;
  event.preventDefault();
  toggleSearchPanel(true);
});
// 검색 칸은 로고와 액션 사이 — 넓은 화면에서 가운데를 채운다 (좁은 화면은 CSS 가 감춘다)
appHeader.replaceChildren(el('div', { class: 'app-bar__head' }, backButton, appTitle), appSearch, actions);
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
// 2026-09-09 v2.40.0 항목 한 줄 = [아이콘] 이름 [›]. 아이콘은 라우터 표(ROUTES)가 들고 있고 서비스 홈
// 타일과 같은 그림이다 — 같은 화면을 두 곳에서 다르게 그리면 다른 데로 가는 줄 안다.
// 이모지를 라벨 글자에 섞지 않고 span 으로 뗀 이유: 번역 사전(i18n-en.js)이 텍스트 노드 단위로 찾아서
// '내 포켓몬' 같은 라벨은 그대로 맞아떨어져야 한다 (이모지가 섞이면 키가 달라진다)
function navItem(href, title, icon, parent = '') {
  // 2026-09-10 v2.47.0 잠글 수 있는 항목은 라우트 id 를 달아 둔다 — 로그인 상태가 바뀔 때마다
  // syncLockedNav() 가 그 줄의 잠금 표시를 갱신한다.
  // v2.48.1 대상이 육성 플래너 하나에서 여럿(배틀 PvP · 이벤트 일정 · 레이드 보스 · 알 부화)으로
  // 늘어, id 를 하나씩 박지 않고 data-route 로 표를 따라간다
  // 2026-09-12 v2.66.0 부모가 있는 화면은 한 칸 들여 쓴다 — 나란히 두면 형제로 보인다
  const attrs = { href, class: `drawer__item${parent ? ' drawer__item--sub' : ''}` };
  const route = ROUTES.find((entry) => `#/${entry.path}` === href);
  if (route) attrs['data-route'] = route.id;
  if (route?.id === 'planner') attrs.id = 'menu-planner';   // 기존 검사·선택자 유지
  return el('a', attrs,
    el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'drawer__label' }, title));
}

// 로그인해야 쓰는 항목의 잠금 표시. onAuthChange(components/auth.js)가 로그인·로그아웃마다 부른다.
// 실제 차단은 클릭 처리(destinations)와 화면 자체(planner/shell.js renderPlan)가 한다 —
// 여기서 하는 것은 "지금 못 쓴다"를 보여 주는 일뿐이다
function syncLockedNav() {
  if (typeof routeLocked !== 'function') return;
  // ☰ 메뉴 줄 · PC 사이드바 줄 · 서비스 홈 타일 — 전부 data-route 를 달고 있다
  for (const $item of document.querySelectorAll('.nav-menu a[data-route], .home__tile[data-route]')) {
    const locked = routeLocked($item.dataset.route);
    $item.classList.toggle('is-locked', locked);
    if (locked) $item.setAttribute('aria-disabled', 'true');
    else $item.removeAttribute('aria-disabled');
    $item.title = locked ? '로그인하면 열려요' : '';
  }
  // 셸 탭 줄의 배틀 PvP — 탭은 매번 다시 그려지므로 renderTabs 가 직접 표시한다(여기서는 건드리지 않는다)
}
// 이동 목록은 덩이로 읽는다 — 열 줄이 한 덩이로 붙어 있으면 매번 처음부터 훑어야 한다.
// 덩이 이름과 순서는 router.js ROUTE_GROUPS 가 정한다 (기능의 종류가 아니라 하려는 일로 가른다).
// 서비스 홈은 어느 덩이도 아니다 — 목록의 출발점이라 맨 위에 혼자 둔다.
// 한 나눔(nav) 안에서 <h3> 로 가르므로 랜드마크는 지금처럼 하나다
const navGroup = (label, rows) => rows.length
  ? [el('h3', { class: 'nav-menu__sec' }, label), ...rows.map(([href, title, icon, , parent]) => navItem(href, title, icon, parent))]
  : [];
const destinations = el('nav', { class: 'nav-menu', 'aria-label': '서비스 이동' },
  navItem('#', '서비스 홈', '🏠'),
  ...ROUTE_GROUPS.flatMap(([id, label]) =>
    navGroup(label, APP_DESTINATIONS.filter(([, , , group]) => group === id))));
destinations.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const href = link.getAttribute('href');
  // 잠긴 항목은 그 화면으로 보내지 않는다 — 눌렀는데 아무 일도 안 일어나면 잠긴 건지 고장 난 건지 모른다.
  // 2026-09-10 v2.51.0 계정 카드로 데려다주던 것을 팝업으로 바꿨다 (components/auth.js openLoginInvite) —
  // 메뉴를 열면 일정표·기준 안내·약관 같은 줄이 함께 있어 정작 할 일이 묻혔다
  if (link.getAttribute('aria-disabled') === 'true') {
    openLoginInvite(link.querySelector('.drawer__label')?.textContent || '');
    return;
  }
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
// 2026-09-10 v2.42.0 화면 머리 = [브레드크럼] 제목 [한 줄 설명]. 브레드크럼과 설명은 넓은 화면에서만
// 보인다(CSS) — 좁은 화면은 상단 바 한 줄로 충분하고, 제목 위아래로 줄이 늘면 본문이 밀린다.
// 조각을 만들어만 두고 보이고 감추는 일은 CSS 에 맡긴다: JS 에 폭 분기를 하나 더 만들지 않는다
// 2026-09-12 v2.66.0 브레드크럼에 가운데 한 칸 — 화면 아래 화면(#/pvp/ivrank 등)은
// 부모 화면 이름을 거쳐 읽혀야 "어디서 들어왔는지" 가 남는다. 부모가 없는 화면에서는 감춘다
const pageCrumbUp = el('a', { class: 'page-head__crumb-up', href: '#' }, '');
const pageCrumbUpSep = el('span', { class: 'page-head__crumb-sep', 'aria-hidden': 'true' }, '›');
const pageCrumb = el('nav', { class: 'page-head__crumb', 'aria-label': '위치' },
  el('a', { class: 'page-head__crumb-home', href: '#' }, '🏠'),
  el('span', { class: 'page-head__crumb-sep', 'aria-hidden': 'true' }, '›'),
  pageCrumbUp, pageCrumbUpSep,
  el('span', { class: 'page-head__crumb-now' }, ''));
const pageDesc = el('p', { class: 'page-head__desc' }, '');
// 2026-09-12 v3.1.0 화면 머리의 동작 슬롯 — 그 화면을 "어떻게 볼지" 를 정하는 컨트롤 자리다.
// 리스트 · 그리드 전환이 여기로 온다 (components/pages.js renderPage 가 본문에서 옮겨 담는다).
// 왜 본문이 아니라 머리인가 — 보기 방식은 목록 하나가 아니라 **이 화면 전체**에 걸리는 설정이라,
// 목록 위 한 줄을 먹기보다 제목과 같은 높이에서 화면의 손잡이처럼 놓이는 편이 맞다
const pageHeadActions = el('div', { class: 'page-head__actions', id: 'page-head-actions' });
const pageHead = el('header', { class: 'page-head', id: 'page-head', hidden: true },
  pageCrumb, el('h2', {}, ''), pageDesc, pageHeadActions);
pageCrumb.querySelector('a').addEventListener('click', (event) => { event.preventDefault(); goHome(); });
document.querySelector('.layout').before(pageHead);
// 2026-09-09 v2.38.0 태블릿 1100px~ · PC 1440px~ 두 단계(styles/components/app-shell.css) —
// 사이드바 유무·카드/줄 갈래는 두 단계가 같으므로(크기만 다르다) 이 임계값 하나로 충분하다
const wideScreen = window.matchMedia('(min-width: 1100px)');
// 2026-09-09 v2.40.0 ☰ 메뉴는 세 덩이로 읽힌다 — 👤 마이페이지(계정) · 서비스(화면 이동) · 정보(그 밖).
// 제목은 좁은 화면에서만 단다: PC 사이드바는 이동 목록만 있는 자리라 "서비스"라고 또 적을 이유가 없다.
// 계정 카드 다음에 넣는 이유 — 메뉴를 열면 "내가 누구인지" 가 먼저고 그 다음이 갈 곳이다
const navSec = el('h2', { class: 'drawer__sec' }, '서비스');
const extraSec = el('h2', { class: 'drawer__sec' }, '정보');
function placeDestinations() {
  if (wideScreen.matches) { navSec.remove(); sideNav.append(destinations); }
  else { document.getElementById('account').after(navSec); navSec.after(destinations); }
}
// 2026-09-09 v2.37.0 PC 에서는 ☰ 메뉴에 마이페이지·기준 안내·트레이너 코드만 남긴다 — 나머지(패치노트·
// QA 제보·약관·통계 설정 등, index.html #drawer-extra)는 왼쪽 사이드바로, 알 부화(마지막 이동 항목) 아래에
// 통째로 옮긴다. 복제가 아니라 이동이라 onclick·id 등 기존 연결이 그대로 간다(destinations 와 같은 방식).
// 좁은 화면으로 되돌아가면 원래 있던 자리(트레이너 코드 바로 뒤)로 되돌린다
const drawerExtra = document.getElementById('drawer-extra');
const trainerAcc = document.getElementById('trainer-acc');
const scheduleAcc = document.getElementById('schedule-acc');
const noteAcc = document.getElementById('note-acc');
const sideExtra = el('div', { class: 'app-nav__extra' });
// 2026-09-09 v2.40.0 정보 덩이는 카드 한 장으로 묶는다 — 아코디언 둘(기준 안내·트레이너 코드)과 바깥
// 링크들이 원래 따로 놀던 형제라, 묶지 않으면 항목마다 테두리가 따로 생겨 "목록"이 아니라 "버튼 무더기"로
// 읽힌다. 버전 문구(drawer__meta)는 카드 밖 맨 아래에 남는다
const infoGroup = el('div', { class: 'drawer__group' });
const versionMeta = el('p', { class: 'drawer__meta' }, 'POGO PLAN · ' + version);
function placeDrawerExtra() {
  if (wideScreen.matches) {
    // 2026-09-09 v2.40.1 카드에 담아 뒀던 것들을 먼저 꺼내 제자리로 되돌린다 — 이 줄이 없으면
    // 좁은 화면을 거쳐 온 경우 카드(infoGroup)를 들어낼 때 그 안의 기준 안내·트레이너 코드까지
    // 딸려 나가 PC ☰ 메뉴에서 사라진다 (첫 PC 로딩에서는 카드가 빈 채라 드러나지 않던 버그)
    versionMeta.before(scheduleAcc, noteAcc, trainerAcc);
    sideExtra.append(drawerExtra);
    sideNav.append(sideExtra);
    extraSec.remove();
    infoGroup.remove();
  } else {
    // 버전 문구 앞에 끼워 넣는다 — drawer.append 로 붙이면 넓은 화면에서 돌아왔을 때 버전 뒤로 밀린다
    versionMeta.before(extraSec, infoGroup);
    // 순서를 바꾸지 않는다 — 원래 있던 차례 그대로 카드 안으로 옮겨 담기만 한다
    infoGroup.append(scheduleAcc, noteAcc, trainerAcc, drawerExtra);
  }
}
// 2026-09-08 v2.28.0 폭이 바뀌면 화면도 다시 그린다 — 목록이 줄이 될지 카드가 될지가 폭에 달렸다(wideCards)
wideScreen.addEventListener('change', () => { placeDestinations(); placeDrawerExtra(); syncAppShell(); if (typeof render === 'function') render(); });
drawer.append(versionMeta);   // 자리를 먼저 잡아 둔다 — placeDrawerExtra 가 이 앞에 카드를 끼운다
placeDestinations();
placeDrawerExtra();
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
// 화면 이름. 메뉴에 오른 화면은 메뉴 라벨을, 그렇지 않은 전체 페이지는 PAGES 제목(이모지 제외)을 쓴다.
// 이름이 없는 주소(홈 · 상세 딥링크)는 null — 그때는 화면 헤더를 띄우지 않는다
function screenTitle(found) {
  if (!found || found.route.id === 'home') return null;
  if (found.route.nav) return found.route.nav;
  // 2026-09-10 v2.47.0 메뉴에 없는 화면도 이름은 있다 — '내 포켓몬' 은 메뉴에서 내렸지만
  // 주소로 들어오면 화면 머리에 이름이 떠야 한다 (router.js 의 title)
  if (found.route.title) return found.route.title;
  if (found.route.kind === 'page' && PAGES[found.route.id]) return PAGES[found.route.id].title.replace(/^[^가-힣A-Za-z]+/, '');
  return null;
}

let previousRoute = location.hash;
function syncAppShell(moveFocus = false) {
  const hash = location.hash;
  const found = routeOf();
  const routeId = found?.route.id ?? 'unknown';
  const home = routeId === 'home';
  const title = screenTitle(found);
  // 2026-09-08 v2.30.0 좁은 화면도 넓은 화면과 같은 규칙 —
  //   상단 바 = 로고(누르면 홈) + 뒤로가기, 화면 이름 = 본문 맨 위 헤더.
  // 상단 바가 화면 이름을 겸하면 로고가 사라져 "지금 어느 서비스인지" 와 "처음으로 가는 길" 이 함께 없어졌다
  pageHead.hidden = !title;
  // firstChild 가 아니라 h2 를 집는다 — v2.42.0 에서 앞에 브레드크럼이 붙어 첫 자식이 바뀌었다
  pageHead.querySelector('h2').textContent = title ?? '';
  pageCrumb.querySelector('.page-head__crumb-now').textContent = title ?? '';
  // 부모 화면이 있으면 그 이름을 가운데에 끼워 넣는다 (🏠 › 배틀 · PvP › 개체값 순위)
  const parent = found?.route.parent ? ROUTES.find((entry) => entry.id === found.route.parent) : null;
  pageCrumbUp.textContent = parent ? (parent.nav || parent.title || '') : '';
  pageCrumbUp.href = parent ? routeHash(parent.id) : '#';
  pageCrumbUp.hidden = !parent;
  pageCrumbUpSep.hidden = !parent;
  const desc = typeof routeDesc === 'function' ? routeDesc(routeId) : '';
  pageDesc.textContent = desc;
  pageDesc.hidden = !desc;
  // 2026-09-11 v2.59.0 dev 미리보기는 제목 앞에 [dev] — 빌드가 붙여 둔 것을 화면 이동 때도 잇는다.
  // 채널을 따로 주입하지 않고 BUILD_VERSION 끝의 -dev 로 판별한다 (backend/build.py)
  const devMark = typeof BUILD_VERSION === 'string' && BUILD_VERSION.endsWith('-dev') ? '[dev] ' : '';
  document.title = devMark + (title ? `${title} — POGO PLAN` : 'POGO PLAN');
  backButton.hidden = home;
  document.body.dataset.screen = home ? 'home' : 'detail';
  // 측정용 표식 — 어느 화면인지 DOM 만 보고 알 수 있게 (GA · 히트맵 · 자동화 검사)
  document.body.dataset.route = routeId;
  pageHead.dataset.route = routeId;
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
  // 2026-09-08 v2.30.0 화면 단위 측정 — 주소를 GA 에서 다시 파싱하지 않도록 라우트 id 를 그대로 보낸다
  if (typeof track === 'function') track('route_view', { route: routeIdOf(), path: location.hash.replace(/^#\/?/, '') || 'home' });
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
