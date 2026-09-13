// ─────────────────────────────────────────────────────────────────────────────
// components/home.js — 서비스 홈 (2026-09-07 v2.20.0 · 2026-09-08 v2.22.0 아이콘 통일)
//
// 기능의 주 진입점을 한 화면에 모은다. 해시가 없을 때(첫 진입·로고 탭)만 보인다.
//
// 아이콘은 앱이 이미 쓰던 이모지를 그대로 쓴다 — 탭 줄·드로어·상세와 같은 그림이어야
// "같은 서비스"로 읽힌다 (v2.22.0 전에는 홈만 기하 기호 ◒ ▤ ◇ ✦ 를 써서 따로 놀았다).
//
// 2026-09-13 v3.21.0 읽는 순서를 바꿨다 — 인사 → 순위 → 기능 타일.
//   타일은 **어디로 갈까**의 갈림길이고 순위는 **무엇을 키울까**의 답이다 — 답이 먼저다.
//
// 2026-09-13 v3.22.0 순위 한 덩이(두루 쓰이는 포켓몬 여섯 줄)를 **세 덩이 아홉 장**으로 넓혔다.
//   여섯 줄은 한 기준(여러 표에 이름을 올린 횟수)만 보여 줘서, 홈에 온 사람이 "그래서 지금
//   레이드는 뭐가 세지" 를 물으면 타일을 눌러 들어가야 했다. 순위표 세 곳의 **상위 3종씩**을
//   그림 큰 카드로 편다 — D-MAX 티어표 · 레이드 어태커 · 두루 쓰이는 포켓몬.
//   카드를 누르면 그 포켓몬 상세가 열리고, 덩이 머리의 [전체 보기] 가 그 순위표로 보낸다.
//
// 제공하는 전역
//   renderServiceHome()
//
// 의존하는 전역
//   el (dom.js) · $content · $note (app.js) · ROUTES · ROUTE_GROUPS · routeDesc · routeHash · routeIcon · routeLocked (router.js)
//   sprite (components/sprite.js) · nameNode (components/name.js) · openDetail (components/detail.js) · placeLabel (views/usage.js)
//   DMAX_TIER · PVE_DATA · VALUE_DATA · TYPE_KO (data.js) · syncLockedNav (components/app-shell.js) · openLoginInvite (components/auth.js)
// ─────────────────────────────────────────────────────────────────────────────

// 홈이 펴는 순위표 셋. 한 덩이는 "어느 표인가(title) · 무엇으로 줄 세웠나(hint) · 상위 목록(rows) · 한 줄 근거(meta)" 다.
// rows·meta 를 함수로 둔 것은 data.js 전역을 이 파일이 읽는 시점(번들 실행 중)이 아니라 그릴 때 읽기 위해서다.
const HOME_PICKS = [
  {
    key: 'dmax', route: 'dmax', title: 'D-MAX 티어표', hint: '맥스 배틀에서 가장 센 셋',
    rows: () => (typeof DMAX_TIER !== 'undefined' ? DMAX_TIER.overall : null) ?? [],
    // 티어표는 공격 종족값 × 맥스무브 위력 × 자속 기준이라 내구가 안 들어간다 — 그래서 티어와 맥스무브 속성을 적는다
    meta: (pokemon) => [`${pokemon.tier} 티어 · ${TYPE_KO[pokemon.charged] ?? ''} 맥스`],
  },
  {
    key: 'pve', route: 'pve', title: '레이드 어태커', hint: '레이드 전체 딜량 순',
    rows: () => (typeof PVE_DATA !== 'undefined' ? PVE_DATA.overall : null) ?? [],
    meta: (pokemon) => [`DPS ${pokemon.dps} · 버팀 ${pokemon.tdo}`],
  },
  {
    key: 'usage', route: null, title: '두루 쓰이는 포켓몬', hint: '하나 키우면 여러 곳에서',
    rows: () => (typeof VALUE_DATA !== 'undefined' ? VALUE_DATA.usage : null) ?? [],
    // 가장 높은 순위 한 곳만 적는다 — 카드 한 줄에 둘을 넣으면 좁은 화면에서 접힌다 (views/usage.js placeLabel)
    meta: (pokemon) => {
      const best = [...(pokemon.places ?? [])].sort((first, second) => first.rank - second.rank)[0];
      return [`${pokemon.count}곳`, ...(best && typeof placeLabel === 'function' ? [' · ', placeLabel(best)] : [])];
    },
  },
];
const HOME_PICK_TOP = 3;   // 덩이마다 몇 장인가. 셋이면 좁은 화면에서도 한 줄에 들어간다

// 카드 한 장 — [순위 배지 + 그림] 위, [이름] [한 줄 근거] 아래
function homePickCard(pick, pokemon, index) {
  return el('button', { class: 'pick__card', onclick: () => {
    track('home_pick', { kind: pick.key, mon: pokemon.name, rank: index + 1 });
    if (typeof openDetail === 'function') openDetail(pokemon, false, `home_${pick.key}`);
  } },
    el('span', { class: 'pick__art' },
      el('span', { class: 'pick__rank' }, String(index + 1)),
      sprite(pokemon.sprite)),
    // 좁은 화면에서는 display:contents 라 카드의 세로 흐름 그대로고, 넓은 화면에서만 그림 옆으로 선다
    el('span', { class: 'pick__body' },
      el('span', { class: 'pick__name' }, nameNode(pokemon.name)),
      el('span', { class: 'pick__meta' }, ...pick.meta(pokemon))));
}

// 덩이 하나. 표가 비었거나(옛 빌드) 그 화면이 잠겨 있으면 통째로 빠진다 —
// 잠긴 화면의 순위를 홈에서 미리 보여 주면 잠금이 잠금이 아니게 된다 (router.js routeLocked)
function homePickGroup(pick) {
  const rows = pick.rows().slice(0, HOME_PICK_TOP);
  if (!rows.length) return null;
  if (pick.route && typeof routeLocked === 'function' && routeLocked(pick.route)) return null;
  return el('div', { class: `pick__group pick__group--${pick.key}` },
    el('div', { class: 'pick__head' },
      el('h4', {}, pick.title),
      el('span', { class: 'pick__hint' }, pick.hint),
      ...(pick.route ? [el('a', { class: 'pick__all', href: routeHash(pick.route) }, '전체 보기 ', pxIcon('↗') ?? '↗')] : [])),
    el('div', { class: 'pick__grid' }, ...rows.map((pokemon, index) => homePickCard(pick, pokemon, index))));
}

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
    el('div', { class: 'home__service-grid' }, ...groups.map(([label, routes], index) =>
      el('section', { class: 'home__service-group' },
        el('h4', { class: 'home__group' }, el('span', {}, `0${index + 1}`), label),
        el('div', { class: 'home__grid' }, ...routes.map(homeTile))))));
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
  // 2026-09-13 v3.22.0 순위 세 덩이 — 인사 바로 밑, 기능 타일 앞
  const pickGroups = HOME_PICKS.map(homePickGroup).filter(Boolean);
  $content.append(el('div', { class: 'home-dashboard' },
    el('section', { class: 'home__welcome' },
      el('div', { class: 'home__intro' },
      el('span', { class: 'home__eyebrow' }, 'YOUR POKÉMON COMPANION'),
      el('h2', {}, '다음 모험의', el('br'), '주인공을 찾아요.'),
      el('p', {}, '지금 강한 포켓몬부터 나만의 육성 계획까지.', el('br'), '트레이너의 다음 선택을 함께 준비해요.')),
      el('div', { class: 'home__quick' },
        el('span', { class: 'home__eyebrow' }, '모험을 시작하는 세 가지 방법'),
        ...['dex', 'schedule', 'raids'].map((id, index) => {
          const route = ROUTES.find((item) => item.id === id);
          return el('a', { class: 'home__quick-link', href: routeHash(id) },
            el('span', { class: 'home__quick-number' }, `0${index + 1}`),
            el('strong', {}, route.nav), el('span', { 'aria-hidden': 'true' }, '↗'));
        }))),
    ...(pickGroups.length ? [el('section', { class: 'home__picks', 'aria-label': '지금 강한 포켓몬' },
      el('div', { class: 'home__section' }, el('h3', {}, '지금 강한 포켓몬'), el('span', {}, '순위표 세 곳의 상위 3종')),
      ...pickGroups,
      el('span', { class: 'pick__foot' }, '카드를 누르면 종족값·상성·활용처를 전부 볼 수 있어요'))] : []),
    features));
  $note.textContent = '뭘 키울지 여기서 정해요. 도감에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.';   // v3.13.0 '상성' 화면은 v2.63.0 에 접었다
}
