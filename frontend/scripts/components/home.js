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
  // 2026-09-12 v2.65.0 ☰ 메뉴와 **같은 차례**로 놓는다 (router.js ROUTE_GROUPS).
  // 홈 타일과 메뉴가 서로 다른 순서면 같은 서비스의 같은 목록으로 읽히지 않는다.
  //   ① 지금 뭐 하지 — 시간에 매인 것   ② 뭘 데려갈까 — 고르려고 보는 것   ③ 내 포켓몬 — 내 박스
  //
  // 2026-09-12 v2.66.0 이름·설명을 여기 적지 않는다. 아이콘과 순서는 이미 표(ROUTES) 한 곳에서
  // 가져오면서 글만 두 벌이었다 — 홈 타일에 한 벌, routeDesc 에 또 한 벌. 그래서 말투를 정리한
  // v2.60.0 에서 화면 머리만 바뀌고 홈 타일은 옛 문장 그대로 남았다. 이제 표가 유일한 원본이다.
  // 부모가 있는 화면(내 포켓몬)은 홈에 올리지 않는다 — 홈은 "어디로 갈까" 의 첫 갈림길이다
  const features = ROUTE_GROUPS
    .flatMap(([group]) => ROUTES.filter((route) => route.nav && !route.parent && (route.group || 'mine') === group))
    .map((route, index) => [String(index + 1).padStart(2, '0'), route.nav, routeDesc(route.id), routeHash(route.id), routeIcon(route.id), route.id]);
  const grid = el('div', { class: 'home__grid' }, ...features.map(([number, title, desc, route, icon, id]) =>
    // 2026-09-10 v2.47.0 육성 플래너 타일은 로그인해야 열린다 — id 를 달아 두면 syncLockedNav 가 갱신한다
    el('a', { class: 'home__tile', href: route, 'data-route': id, ...(id === 'planner' ? { id: 'home-tile-planner' } : {}) },
      el('div', { class: 'home__tile-top' },
        // 2026-09-12 v3.6.0 도트 아이콘 (components/pxicon.js)
        el('span', { class: 'home__icon', 'aria-hidden': 'true' }, pxIcon(icon) ?? icon),
        el('span', { class: 'home__number' }, number)),
      el('strong', {}, title),
      el('span', { class: 'home__desc' }, desc),
      el('span', { class: 'home__arrow', 'aria-hidden': 'true' }, pxIcon('↗') ?? '↗'))));
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
      grid),
    // 2026-09-12 v3.12.0 활용처 순위가 헤더 검색 패널의 빈 상태에 살고 있었다 — 패널을 걷어내며
    // 갈 곳이 없어졌다. 지우지 않고 홈으로 옮긴다: "여러 순위표에서 두루 상위권" 은 어느 화면을
    // 열지 정하기 전에 보는 값이라, 갈림길인 홈이 원래 자리에 가깝다 (views/usage.js)
    ...(typeof usageTopNodes === 'function' ? (() => {
      const nodes = usageTopNodes();
      return nodes.length ? [el('section', { class: 'home__usage', 'aria-label': '활용처 순위' }, ...nodes)] : [];
    })() : []));
  $note.textContent = '뭘 키울지 여기서 정해요. 도감에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.';   // v3.13.0 '상성' 화면은 v2.63.0 에 접었다
}
