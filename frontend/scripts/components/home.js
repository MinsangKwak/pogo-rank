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
// 2026-09-16 design 기획·디자인 시안 02 (Notion '02. moncamp 기획·디자인') — 첫 화면의 대표 행동을 바로 잇는다.
//   소개·대표 버튼(다이맥스 티어표 보기 · 맥스 배틀 덱 짜기) → 목적별 기능 세 카드 → 용도별 상위 포켓몬.
//   '모험을 시작하는 세 가지 방법' 바로가기 셋은 뺐다 — 제목은 다이맥스 티어표인데 첫 클릭은 도감·일정이었다.
//   오늘의 일정 요약은 후속(데이터 연동 뒤)이다. 큰 그림은 D-MAX 티어표 상위 둘의 실제 스프라이트다.
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
// 2026-09-16 design hint 는 실제 정렬 지표를 말한다 — 전에는 '레이드 전체 딜량 순' 이라 적었는데 2위 DPS 가 1위보다 높았다.
// 종합 점수는 DPS 와 버팀(TDO)을 함께 본 값이라 DPS 만으로는 순서가 안 맞는다
const HOME_PICKS = [
  {
    key: 'dmax', route: 'dmax', title: '다이맥스', hint: '다이맥스 배틀에서 활약하는 포켓몬',
    // 미구현(데이터만 등록된 개체)은 뺀다 — 홈은 '지금 센 셋' 을 보여 주는 자리다
    rows: () => ((typeof DMAX_TIER !== 'undefined' ? DMAX_TIER.overall : null) ?? []).filter((pokemon) => !pokemon.unrel),
    // 티어표는 공격 종족값 × 맥스무브 위력 × 자속 기준이라 내구가 안 들어간다 — 그래서 티어와 맥스무브 속성을 적는다
    meta: (pokemon) => [`${pokemon.tier} 티어 · ${TYPE_KO[pokemon.charged] ?? ''} 맥스`],
  },
  {
    key: 'pve', route: 'pve', title: '레이드', hint: '종합 점수 순 · DPS 와 버팀(TDO)을 함께 봐요',
    rows: () => (typeof PVE_DATA !== 'undefined' ? PVE_DATA.overall : null) ?? [],
    meta: (pokemon) => [`DPS ${pokemon.dps} · 버팀 ${pokemon.tdo}`],
  },
  {
    key: 'usage', route: null, title: '다양한 활용처', hint: '여러 순위표에 이름을 올린 포켓몬',
    rows: () => (typeof VALUE_DATA !== 'undefined' ? VALUE_DATA.usage : null) ?? [],
    // 가장 높은 순위 한 곳만 적는다 — 한 줄에 둘을 넣으면 좁은 화면에서 접힌다 (views/usage.js placeLabel)
    meta: (pokemon) => {
      const best = [...(pokemon.places ?? [])].sort((first, second) => first.rank - second.rank)[0];
      return [`순위표 ${pokemon.count}곳`, ...(best && typeof placeLabel === 'function' ? [' · ', placeLabel(best)] : [])];
    },
  },
];
const HOME_PICK_TOP = 3;   // 덩이마다 몇 마리인가

function homePickOpen(pick, pokemon, index) {
  track('home_pick', { kind: pick.key, mon: pokemon.name, rank: index + 1 });
  if (typeof openDetail === 'function') openDetail(pokemon, false, `home_${pick.key}`);
}

// 줄 하나 — [순위] [이름] [한 줄 근거]
function homePickRow(pick, pokemon, index) {
  return el('li', {}, el('button', { class: 'pick__row', type: 'button', onclick: () => homePickOpen(pick, pokemon, index) },
    el('span', { class: 'pick__rank' }, String(index + 1)),
    el('span', { class: 'pick__body' },
      el('span', { class: 'pick__name' }, nameNode(pokemon.name)),
      el('span', { class: 'pick__meta' }, ...pick.meta(pokemon)))));
}

// 덩이 하나 — [머리: 이름·설명·전체 보기] [1위 큰 그림 | 1~3위 줄].
// 표가 비었거나(옛 빌드) 그 화면이 잠겨 있으면 통째로 빠진다 — 잠긴 화면의 순위를 홈에서 미리 보여 주면 잠금이 잠금이 아니게 된다
function homePickGroup(pick) {
  const rows = pick.rows().slice(0, HOME_PICK_TOP);
  if (!rows.length) return null;
  if (pick.route && typeof routeLocked === 'function' && routeLocked(pick.route)) return null;
  if (pick.key === 'usage') {
    return el('button', { class: 'pick__discover', type: 'button', onclick: () => {
      track('home_usage_all');
      openModal(el('div', { class: 'pick-usage' },
        el('h2', {}, '다양한 활용처'),
        el('p', {}, '여러 순위표에 이름을 올린 포켓몬이에요. 이름을 누르면 상세 정보를 볼 수 있어요.'),
        el('ol', { class: 'pick__list' }, ...pick.rows().map((pokemon, index) => homePickRow(pick, pokemon, index)))));
    } },
      el('span', { class: 'pick__discover-kicker' }, '다양한 활용처'),
      el('strong', {}, '한 마리로', el('br'), '여러 배틀을.'),
      el('span', { class: 'pick__discover-copy' }, '레이드부터 PvP까지, 두루 쓰이는 포켓몬'),
      el('span', { class: 'pick__discover-action' }, '전체 보기', el('span', { 'aria-hidden': 'true' }, '↗')));
  }
  const first = rows[0];
  return el('section', { class: `pick__group pick__group--${pick.key}`, 'aria-label': pick.title },
    el('div', { class: 'pick__head' },
      el('h4', {}, el('span', { class: 'pick__crown', 'aria-hidden': 'true' }, '👑'), pick.title),
      el('p', { class: 'pick__hint' }, pick.hint),
      ...(pick.route ? [el('a', { class: 'pick__all', href: routeHash(pick.route) }, '전체 보기 ', pxIcon('↗') ?? '↗')] : [])),
    el('div', { class: 'pick__grid' },
      el('button', { class: 'pick__hero', type: 'button', 'aria-label': `1위 ${first.name}`, onclick: () => homePickOpen(pick, first, 0) },
        el('span', { class: 'pick__spotlight', 'aria-hidden': 'true' }, 'NO.01'),
        sprite(first.sprite),
        el('span', { class: 'pick__inspect', 'aria-hidden': 'true' }, '상세 보기 ↗')),
      el('ol', { class: 'pick__list' }, ...rows.map((pokemon, index) => homePickRow(pick, pokemon, index)))));
}

// 타일 한 장 — 주소·이름·아이콘은 전부 라우터 표(router.js ROUTES)에서 온다.
// 2026-09-12 v2.66.0 글을 여기 적지 않는다: 홈 타일과 화면 머리가 두 벌이 되면 한쪽만 늙는다
// 2026-09-16 design 설명 한 줄은 뺀다 — 갈래 카드가 설명을 맡고, 타일은 [아이콘] 이름 [›] 한 줄이다 (title 로는 남긴다)
function homeTile(route) {
  return el('a', {
    class: 'home__tile', href: routeHash(route.id), 'data-route': route.id, title: routeDesc(route.id),
    // 2026-09-10 v2.47.0 육성 플래너 타일은 로그인해야 열린다 — id 를 달아 두면 syncLockedNav 가 갱신한다
    ...(route.id === 'planner' ? { id: 'home-tile-planner' } : {}),
  },
    // 2026-09-12 v3.6.0 도트 아이콘 (components/pxicon.js)
    el('span', { class: 'home__icon', 'aria-hidden': 'true' }, pxIcon(routeIcon(route.id)) ?? routeIcon(route.id)),
    el('strong', {}, route.nav),
    el('span', { class: 'home__arrow', 'aria-hidden': 'true' }, '›'));
}

// 대표 버튼 — 눌린 것을 세어 홈 → 티어표/덱 이동률을 본다 (시안의 완료 기준)
function homeCta(routeId, label, primary) {
  return el('a', { class: `home__btn${primary ? ' home__btn--primary' : ''}`, href: routeHash(routeId),
    onclick: () => track('home_cta', { to: routeId }) },
    label, primary ? el('span', { 'aria-hidden': 'true' }, ' →') : '');
}

function renderServiceHome() {
  // 소개와 주요 버튼만 배치해 첫 화면에서 서비스 기능까지 확인할 수 있게 한다.
  const hero = el('section', { class: 'home__welcome', 'aria-label': '소개' },
    el('div', { class: 'home__intro' },
      el('span', { class: 'home__eyebrow' }, el('span', { class: 'home__eyebrow-dot', 'aria-hidden': 'true' }), 'DYNAMAX · RAID · PVP'),
      el('h2', {}, '맥스 배틀에 데려갈 포켓몬,', el('br'), '여기서 골라요.'),
      el('p', {}, '다이맥스 티어표와 추천 덱을 비교하고, 레이드·PvP까지 확인하세요.')),
    el('img', { class: 'home__pixel-mascot', src: 'sprites/25.png', alt: '', 'aria-hidden': 'true', width: 96, height: 96 }),
    el('div', { class: 'home__cta' },
        homeCta('dmax', '다이맥스 티어표 보기', true),
        homeCta('dmax-deck', '맥스 배틀 덱 짜기', false)));

  // ── 목적별 기능 세 카드 — ☰ 메뉴와 **같은 차례**여야 같은 서비스의 같은 목록으로 읽힌다 (router.js ROUTE_GROUPS).
  // 부모가 있는 화면(내 포켓몬)은 홈에 올리지 않는다 — 홈은 "어디로 갈까" 의 첫 갈림길이다
  const groups = ROUTE_GROUPS
    .map(([group, label, desc, icon]) => [label, desc, icon, ROUTES.filter((route) => route.nav && !route.parent && (route.group || 'mine') === group)])
    .filter(([, , , routes]) => routes.length);
  const features = el('section', { class: 'home__features', 'aria-label': '서비스 기능' },
    el('div', { class: 'home__section' }, el('h3', {}, '무엇이 필요한가요?'), el('span', {}, '목적에 맞는 화면으로 바로 가요')),
    el('div', { class: 'home__service-grid' }, ...groups.map(([label, desc, icon, routes]) =>
      el('section', { class: 'home__service-group' },
        el('div', { class: 'home__group-head' },
          el('span', { class: 'home__group-icon', 'aria-hidden': 'true' }, pxIcon(icon) ?? icon),
          el('h4', { class: 'home__group' }, label),
          el('p', { class: 'home__group-desc' }, desc)),
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

  // ── 용도별 상위 포켓몬 — 평가 조건과 기준일을 같이 읽게 한다 (시안 "순위 참고")
  const pickGroups = HOME_PICKS.map(homePickGroup).filter(Boolean);
  const dataDate = typeof DATA_FETCHED !== 'undefined' && DATA_FETCHED ? DATA_FETCHED : '';
  // ── 게임 업데이트 주요 소식 (2026-09-16 v3.51.0) — 글이 없으면 빈 문자열이라 자리도 안 만든다
  // 홈 맨 아래에 둔다: 소개와 추천 순위, 기능 안내를 먼저 확인한다.
  // 소식은 이미 쓰는 사람이 마지막에 훑는 것이라 자리를 앞에서 뺏으면 안 된다
  const updates = typeof homeUpdatesNode === 'function' ? homeUpdatesNode() : '';
  $content.append(el('div', { class: 'home-dashboard' },
    hero,
    ...(pickGroups.length ? [el('section', { class: 'home__picks', 'aria-label': '용도별 상위 포켓몬' },
      el('div', { class: 'home__section' },
        el('h3', {}, '용도별 상위 포켓몬'),
        el('span', {}, '평가 조건에 따라 추천이 달라져요', dataDate ? el('span', { class: 'home__date' }, ' · ', `기준일 ${dataDate}`) : '')),
      el('div', { class: 'home__pick-grid' }, ...pickGroups),
      el('span', { class: 'pick__foot' }, '이름을 누르면 종족값·상성·활용처를 전부 볼 수 있어요'))] : []),
    features,
    updates));
  $note.textContent = '뭘 키울지 여기서 정해요. 도감에서 포켓몬을 알아보고, 랭킹에서 추천 개체를 고른 뒤, 육성 플래너에 내 개체를 기록하면 돼요.';   // v3.13.0 '상성' 화면은 v2.63.0 에 접었다
}
