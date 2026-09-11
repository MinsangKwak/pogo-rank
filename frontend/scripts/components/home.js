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
  // [번호, 제목, 한 줄 설명, 라우트 id] — 주소와 아이콘은 라우터 표(router.js ROUTES)에서 가져온다.
  // 2026-09-09 v2.40.0 아이콘을 여기 적어 두지 않는다: ☰ 메뉴도 같은 그림을 쓰게 되면서 표가 두 벌이 됐다
  // 2026-09-10 v2.47.0 '내 포켓몬' 타일과 '육성 플래너' 타일을 하나로 합쳤다 —
  // 둘은 같은 화면의 두 탭인데 홈에도 ☰ 메뉴에도 문이 두 개씩 있어, 어느 쪽을 눌러야 하는지가
  // 매번 질문이 됐다. 문은 하나로 두고, 안에서 탭이 가른다
  const features = [
    ['01', '육성 플래너', '내 개체를 기록하고 비교해요', 'planner'],
    ['02', '포켓몬 도감', '능력치부터 기술·진화까지', 'dex'],
    ['03', '타입 & 상성', '약점과 추천 타입을 찾아요', 'types'],
    ['04', 'D-MAX', '맥스 배틀의 딜러와 탱커', 'dmax'],
    ['05', '레이드 · PvE', '추천 딜러와 솔플 계산기', 'pve'],
    ['06', '배틀 · PvP', '리그별 순위와 덱 구성', 'pvp'],
    ['07', '이벤트 일정', '다가오는 레이드와 이벤트', 'schedule'],
    ['08', '레이드 보스', '지금 도는 보스와 약점', 'raids'],
    ['09', '알 부화', '거리별로 뭐가 나오나', 'eggs'],
    // 2026-09-11 v2.58.0 ☰ 메뉴에도 같은 줄이 있다 — 같은 화면인데 문이 한쪽에만 있으면
    // 메뉴를 안 여는 사람은 이 화면이 있는 줄도 모른다
    ['10', '검색식 만들기', '게임 검색창에 붙여 넣을 식', 'finder'],
  ].map(([number, title, desc, id]) => [number, title, desc, routeHash(id), routeIcon(id), id]);
  const grid = el('div', { class: 'home__grid' }, ...features.map(([number, title, desc, route, icon, id]) =>
    // 2026-09-10 v2.47.0 육성 플래너 타일은 로그인해야 열린다 — id 를 달아 두면 syncLockedNav 가 갱신한다
    el('a', { class: 'home__tile', href: route, 'data-route': id, ...(id === 'planner' ? { id: 'home-tile-planner' } : {}) },
      el('div', { class: 'home__tile-top' },
        el('span', { class: 'home__icon', 'aria-hidden': 'true' }, icon),
        el('span', { class: 'home__number' }, number)),
      el('strong', {}, title),
      el('span', { class: 'home__desc' }, desc),
      el('span', { class: 'home__arrow', 'aria-hidden': 'true' }, '↗'))));
  // 타일을 만든 직후 잠금 표시를 한 번 맞춘다 (로그인 상태는 이미 정해져 있다)
  if (typeof syncLockedNav === 'function') queueMicrotask(syncLockedNav);
  // 잠긴 타일은 그 화면으로 보내지 않고 로그인 유도 팝업을 연다 — ☰ 메뉴의 잠긴 줄과 같은 처방
  grid.addEventListener('click', (event) => {
    const tile = event.target.closest('a');
    if (!tile || tile.getAttribute('aria-disabled') !== 'true') return;
    event.preventDefault();
    openLoginInvite(tile.querySelector('strong')?.textContent || '');
  });
  $content.append(
    el('section', { class: 'home__intro' },
      el('span', { class: 'home__eyebrow' }, 'YOUR POKÉMON COMPANION'),
      el('h2', {}, '오늘의 모험,', el('br'), '여기서 준비하세요.'),
      el('p', {}, '찾고, 비교하고, 키우는 즐거움. 필요한 기능으로 바로 시작해요.')),
    el('section', { class: 'home__features', 'aria-label': '서비스 기능' },
      el('div', { class: 'home__section' }, el('h3', {}, '무엇을 해볼까요?'), el('span', {}, 'POGO PLAN과 함께하는 포켓몬 라이프')),
      grid));
  $note.textContent = '뭘 키울지 여기서 정해요. 도감과 상성으로 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.';
}
