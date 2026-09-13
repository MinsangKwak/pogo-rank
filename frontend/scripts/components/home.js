// ─────────────────────────────────────────────────────────────────────────────
// components/home.js — 서비스 홈 (2026-09-07 v2.20.0 · 2026-09-08 v2.22.0 아이콘 통일)
//
// 기능의 주 진입점을 한 화면에 모은다. 해시가 없을 때(첫 진입·로고 탭)만 보인다.
//
// 아이콘은 앱이 이미 쓰던 이모지를 그대로 쓴다 — 탭 줄·드로어·상세와 같은 그림이어야
// "같은 서비스"로 읽힌다 (v2.22.0 전에는 홈만 기하 기호 ◒ ▤ ◇ ✦ 를 써서 따로 놀았다).
//
// 2026-09-13 v3.21.0 읽는 순서를 바꿨다 — 인사 → **두루 쓰이는 포켓몬** → 기능 타일.
//   전에는 인사(187px) + 타일 아홉(725px) 뒤에야 활용처 순위가 나와, 홈에 온 사람이
//   "지금 뭘 키우지" 의 답을 보려면 화면을 한 번 넘겨야 했다. 타일은 **어디로 갈까**의 갈림길이고
//   활용처 순위는 **무엇을 키울까**의 답이다 — 답이 갈림길보다 먼저 보이는 게 맞다.
//   타일은 번호(01~09) 대신 라우터 표의 세 갈래(ROUTE_GROUPS)로 묶었다. 번호는 순서를 암시하는데
//   실제로는 순서가 아니었고, 아홉이 한 덩이로 놓이면 무엇부터 볼지가 매번 질문이 됐다.
//
// 제공하는 전역
//   renderServiceHome()
//
// 의존하는 전역
//   el (dom.js) · $content · $note (app.js) · ROUTES · ROUTE_GROUPS · routeDesc · routeHash · routeIcon (router.js)
//   usageTopNodes (views/usage.js) · syncLockedNav (components/app-shell.js) · openLoginInvite (components/auth.js)
// ─────────────────────────────────────────────────────────────────────────────

// 타일 한 장 — 주소·이름·설명·아이콘은 전부 라우터 표(router.js ROUTES)에서 온다.
// 2026-09-12 v2.66.0 글을 여기 적지 않는다: 홈 타일과 화면 머리가 두 벌이 되면 한쪽만 늙는다
function homeTile(route) {
  return el('a', {
    class: 'home__tile', href: routeHash(route.id), 'data-route': route.id,
    // 2026-09-10 v2.47.0 육성 플래너 타일은 로그인해야 열린다 — id 를 달아 두면 syncLockedNav 가 갱신한다
    ...(route.id === 'planner' ? { id: 'home-tile-planner' } : {}),
  },
    // 2026-09-12 v3.6.0 도트 아이콘 (components/pxicon.js)
    el('span', { class: 'home__icon', 'aria-hidden': 'true' }, pxIcon(routeIcon(route.id)) ?? routeIcon(route.id)),
    el('strong', {}, route.nav),
    el('span', { class: 'home__desc' }, routeDesc(route.id)),
    el('span', { class: 'home__arrow', 'aria-hidden': 'true' }, pxIcon('↗') ?? '↗'));
}

function renderServiceHome() {
  // 세 갈래로 묶는다 — ☰ 메뉴와 **같은 차례**여야 같은 서비스의 같은 목록으로 읽힌다 (router.js ROUTE_GROUPS).
  // 부모가 있는 화면(내 포켓몬)은 홈에 올리지 않는다 — 홈은 "어디로 갈까" 의 첫 갈림길이다
  const groups = ROUTE_GROUPS
    .map(([group, label]) => [label, ROUTES.filter((route) => route.nav && !route.parent && (route.group || 'mine') === group)])
    .filter(([, routes]) => routes.length);
  const features = el('section', { class: 'home__features', 'aria-label': '서비스 기능' },
    el('div', { class: 'home__section' }, el('h3', {}, '무엇을 해볼까요?'), el('span', {}, 'POGO PLAN과 함께하는 포켓몬 라이프')),
    ...groups.flatMap(([label, routes]) => [
      el('h4', { class: 'home__group' }, label),
      el('div', { class: 'home__grid' }, ...routes.map(homeTile)),
    ]));
  // 타일을 만든 직후 잠금 표시를 한 번 맞춘다 (로그인 상태는 이미 정해져 있다)
  if (typeof syncLockedNav === 'function') queueMicrotask(syncLockedNav);
  // 잠긴 타일은 그 화면으로 보내지 않고 로그인 유도 팝업을 연다 — ☰ 메뉴의 잠긴 줄과 같은 처방.
  // 그리드가 갈래마다 하나씩이라 리스너는 그 위 구역에 한 번만 건다
  features.addEventListener('click', (event) => {
    const tile = event.target.closest('a');
    if (!tile || tile.getAttribute('aria-disabled') !== 'true') return;
    event.preventDefault();
    openLoginInvite(tile.querySelector('strong')?.textContent || '');
  });
  $content.append(
    el('section', { class: 'home__intro' },
      el('span', { class: 'home__eyebrow' }, 'YOUR POKÉMON COMPANION'),
      el('h2', {}, '오늘의 모험,', el('br'), '여기서 준비하세요.')),
    // 2026-09-12 v3.12.0 활용처 순위가 헤더 검색 패널의 빈 상태에 살고 있었다 — 패널을 걷어내며 홈으로 옮겼다.
    // 2026-09-13 v3.21.0 타일 뒤에서 타일 **앞**으로. 홈에서 가장 먼저 얻을 답이 여기 있다 (views/usage.js)
    ...(typeof usageTopNodes === 'function' ? (() => {
      const nodes = usageTopNodes();
      return nodes.length ? [el('section', { class: 'home__usage', 'aria-label': '두루 쓰이는 포켓몬' }, ...nodes)] : [];
    })() : []),
    features);
  $note.textContent = '뭘 키울지 여기서 정해요. 도감에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.';   // v3.13.0 '상성' 화면은 v2.63.0 에 접었다
}
