// ─────────────────────────────────────────────────────────────────────────────
// components/home.js — 서비스 홈 (2026-09-07 v2.20.0 · 2026-09-08 v2.22.0 아이콘 통일)
//
// 기능의 주 진입점을 한 화면에 모은다. 해시가 없을 때(첫 진입·로고 탭)만 보인다.
//
// 아이콘은 앱이 이미 쓰던 이모지를 그대로 쓴다 — 탭 줄·드로어·상세와 같은 그림이어야
// "같은 서비스"로 읽힌다 (v2.22.0 전에는 홈만 기하 기호 ◒ ▤ ◇ ✦ 를 써서 따로 놀았다).
//   🎒 내 포켓몬 · 📕 도감 · 🧭 상성 · 🌱 플래너 · 📅 일정 · ⚔️ 보스는 다른 화면과 같은 짝
// 2026-09-08 v2.25.0 ⚔️ 레이드 보스 · 🥚 알 부화 추가 (🥚 는 이 화면이 처음 쓰는 아이콘)
//
// 제공하는 전역
//   renderServiceHome()
//
// 의존하는 전역
//   el (dom.js) · $content · $note (app.js)
// ─────────────────────────────────────────────────────────────────────────────

function renderServiceHome() {
  // [번호, 제목, 한 줄 설명, 주소, 아이콘]
  const features = [
    ['01', '내 포켓몬', '내 개체를 기록하고 비교해요', '#/plan/collection', '🎒'],
    ['02', '포켓몬 도감', '능력치부터 기술·진화까지', '#/dex', '📕'],
    ['03', '타입 & 상성', '약점과 추천 타입을 찾아요', '#/types', '🧭'],
    ['04', 'D-MAX', '맥스 배틀의 딜러와 탱커', routeHash('dmax'), '✨'],
    ['05', '레이드 · PvE', '추천 딜러와 솔플 계산기', routeHash('pve'), '⚔️'],
    ['06', '배틀 · PvP', '리그별 순위와 덱 구성', routeHash('pvp'), '🃏'],
    ['07', '육성 플래너', '내 포켓몬의 육성 현황', '#/plan', '🌱'],
    ['08', '이벤트 일정', '다가오는 레이드와 이벤트', '#/schedule', '📅'],
    ['09', '레이드 보스', '지금 도는 보스와 약점', '#/raids', '⚔️'],
    ['10', '알 부화', '거리별로 뭐가 나오나', '#/eggs', '🥚'],
  ];
  const grid = el('div', { class: 'home__grid' }, ...features.map(([number, title, desc, route, icon]) =>
    el('a', { class: 'home__tile', href: route },
      el('div', { class: 'home__tile-top' },
        el('span', { class: 'home__icon', 'aria-hidden': 'true' }, icon),
        el('span', { class: 'home__number' }, number)),
      el('strong', {}, title),
      el('span', { class: 'home__desc' }, desc),
      el('span', { class: 'home__arrow', 'aria-hidden': 'true' }, '↗'))));
  $content.append(
    el('section', { class: 'home__intro' },
      el('span', { class: 'home__eyebrow' }, 'YOUR POKÉMON COMPANION'),
      el('h2', {}, '오늘의 모험,', el('br'), '여기서 준비하세요.'),
      el('p', {}, '찾고, 비교하고, 키우는 즐거움. 필요한 기능으로 바로 시작해요.')),
    el('section', { class: 'home__features', 'aria-label': '서비스 기능' },
      el('div', { class: 'home__section' }, el('h3', {}, '무엇을 해볼까요?'), el('span', {}, 'EXPLORE')),
      grid));
  $note.textContent = '도감과 상성에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 확인하세요. 내 포켓몬과 플래너에서 육성 현황을 관리할 수 있습니다.';
}
