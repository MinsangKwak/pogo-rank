// One persistent app bar for every route. Native dialogs own focus and Escape.
const APP_DESTINATIONS = [
  ['#/plan/collection', '내 포켓몬'], ['#/dex', '포켓몬 도감'],
  ['#/types', '타입 & 상성'], ['#/rank/max', 'D-MAX'],
  ['#/rank/pve', '레이드 · PvE'], ['#/rank/pvp', '배틀 · PvP'],
  ['#/plan', '육성 플래너'], ['#/schedule', '이벤트 일정'],
];
const appHeader = document.querySelector('header');
document.body.insertBefore(appHeader, document.querySelector('.wrap'));
appHeader.className = 'app-bar';
const oldHeading = appHeader.querySelector('h1');
const version = oldHeading.querySelector('.app-ver').textContent;
const appTitle = el('h1', { id: 'app-title', tabindex: '-1' }, 'POGO PLAN');
const backButton = el('button', { class: 'icon-btn', 'aria-label': '이전 화면', onclick: () => {
  if (history.state?.appEntry) history.back();
  else navigateHash('');
}}, '←');
const homeButton = el('a', { class: 'app-home', href: '#', 'aria-label': '서비스 홈' }, '홈');
const actions = appHeader.querySelector('.header-actions');
appHeader.replaceChildren(el('div', { class: 'app-heading' }, backButton, appTitle), actions);
actions.prepend(homeButton);
const searchButton = document.getElementById('search-toggle');
searchButton.textContent = '검색';
searchButton.setAttribute('aria-haspopup', 'dialog');
searchButton.setAttribute('aria-expanded', 'false');
searchButton.setAttribute('aria-controls', 'search-dialog');
const menuButton = document.getElementById('menu-toggle');
menuButton.textContent = '메뉴';
menuButton.setAttribute('aria-haspopup', 'dialog');
menuButton.setAttribute('aria-expanded', 'false');
menuButton.setAttribute('aria-controls', 'drawer-backdrop');
// Account actions remain in the menu, so the app bar has stable geometry.
const accountButton = document.getElementById('account-toggle');
accountButton.classList.add('shell-account');
const panel = document.querySelector('.psearch');
const typeRow = panel.querySelector('.psearch-row');
const typeFilters = el('details', { class: 'screen-filters search-filters' }, el('summary', {}, '타입으로 좁히기'));
typeRow.before(typeFilters);
typeFilters.append(typeRow);
const searchDialog = el('dialog', { id: 'search-dialog', 'aria-label': '포켓몬 검색' }, panel);
document.body.append(searchDialog);
searchDialog.addEventListener('cancel', (event) => { event.preventDefault(); closeSearchDialog(); });
searchDialog.addEventListener('click', (event) => { if (event.target === searchDialog) closeSearchDialog(); });
document.getElementById('psearch').setAttribute('aria-label', '포켓몬 이름 또는 타입');
const drawer = document.querySelector('.drawer');
drawer.querySelector('#schedule-body').closest('details').hidden = true;
const destinations = el('nav', { class: 'service-menu', 'aria-label': '서비스 이동' },
  el('a', { href: '#', class: 'drawer-item' }, '서비스 홈'),
  ...APP_DESTINATIONS.map(([href, title]) => el('a', { href, class: 'drawer-item' }, title)));
destinations.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  navigateHash(link.getAttribute('href'));
});
drawer.querySelector('.drawer-head').after(destinations);
drawer.append(el('p', { class: 'drawer-meta' }, 'POGO PLAN · ' + version));
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
  appTitle.textContent = home ? 'POGO PLAN' : title;
  document.title = (home ? 'POGO PLAN' : title + ' — POGO PLAN');
  backButton.hidden = home;
  homeButton.hidden = home;
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
    if (group.querySelectorAll('.chip').length < 8) continue;
    const details = el('details', { class: 'screen-filters' },
      el('summary', {}, '타입 필터 · 선택하기'));
    details.open = !!state.filtersOpen;
    details.addEventListener('toggle', () => { state.filtersOpen = details.open; });
    group.before(details);
    details.append(group);
  }
}
