// ─────────────────────────────────────────────────────────────────────────────
// planner/home.js — 🌱 육성 플래너 · 육성 현황 탭 (2026-09-07 v2.15.0, QA-53)
//
// 2026-09-10 v2.47.0 목업을 받아 화면을 다시 짰다. 카드 넉 장이 위에서 아래로:
//   (1) 히어로   이 화면이 무엇인지 + 주 동작 하나(개체 등록하기)
//   (2) 요약     내 포켓몬 N마리 + 상태별 수치 세 칸 + 바로가기
//   (3) 다음 걸음 지금 할 수 있는 다섯 가지 — 순서대로 따라가면 되는 흐름
//   (4) 최근     마지막에 손댄 개체 넷
//
// 다섯 걸음은 **지금 실제로 되는 것만** 적는다.
//   목업의 걸음은 "필요 자원 계산하기 · 기술 세팅하기" 처럼 아직 없는 기능을 가리킨다.
//   화면에 그렇게 적으면 눌러 보고 없다는 걸 알게 되는데, 그건 안내가 아니라 헛걸음이다.
//   그래서 걸음은 이 앱이 오늘 할 수 있는 것으로 바꿔 적고, 아직 없는 것은 아래 로드맵 한 줄에 그대로 남긴다.
//
// 제공하는 전역
//   renderPlanHome()
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode (components/name.js) · routeHash (router.js)
//   AUTH · authEnabled (components/auth.js)
//   planMons · planMonName · planMonCp · planIvPercent · planHundoLabel · PLAN_STATUSES · PLAN_STATUS_MODS (planner/collection.js)
//   $content · $note (app.js)
// ─────────────────────────────────────────────────────────────────────────────

// 상태 세 칸의 아이콘 — PLAN_STATUSES 와 같은 순서 (육성 중 · 완료 · 교환 후보)
const PLAN_STATUS_ICONS = ['🌱', '✅', '🔄'];

// 지금 할 수 있는 다섯 걸음. [아이콘, 제목, 두 줄 설명, 갈 곳]
// 갈 곳이 없는 걸음은 넣지 않는다 — 걸음은 곧 "눌러서 할 수 있는 것" 이다
function planSteps() {
  return [
    ['🎒', '개체 등록하기', '가진 포켓몬을 레벨·개체값·기술 단위로 적어 둡니다.', routeHash('planner-collection')],
    ['📊', '개체값 확인하기', '백개체와 몇 CP 차이인지 목록에서 바로 읽습니다.', routeHash('planner-collection')],
    ['⚖️', '같은 종 비교하기', '같은 종 두 마리의 [비교] 를 눌러 나란히 봅니다.', routeHash('planner-collection')],
    ['🃏', '리그 도달 보기', '비교 창에서 리틀·슈퍼·하이퍼 도달 레벨을 확인합니다.', routeHash('planner-collection')],
    ['📕', '도감에서 더 찾기', '무엇이 센지부터 보고 싶다면 도감으로 갑니다.', routeHash('dex')],
  ];
}

// 최근 카드 한 장 — 목록 줄에서 쓰는 값과 같은 값을 쓴다(다른 값을 보여 주면 같은 개체가 달라 보인다)
function planRecentCard(mon) {
  const hundo = typeof planHundoLabel === 'function' ? planHundoLabel(mon) : null;
  const statusMod = PLAN_STATUS_MODS[PLAN_STATUSES.indexOf(mon.status)] || 'a';
  return el('a', { class: 'plan__recent-item', href: routeHash('planner-collection') },
    sprite(mon.sprite),
    el('span', { class: 'plan__recent-main' },
      el('span', { class: 'plan__recent-name' },
        nameNode(planMonName(mon)),
        el('span', { class: `tag plan__status plan__status--${statusMod}` }, mon.status),
        hundo ? el('span', { class: `tag plan__hundo plan__hundo--${hundo.kind}` }, hundo.text) : ''),
      el('span', { class: 'plan__recent-sub' },
        `Lv ${mon.level} · 개체값 ${(mon.ivs ?? []).join('/')} (${planIvPercent(mon.ivs)}%) · CP ${planMonCp(mon).toLocaleString()}`),
      el('span', { class: 'plan__recent-sub' }, `${mon.fast || '스피드 모름'} · ${mon.charged || '차지 모름'}`)));
}

function renderPlanHome() {
  const loggedIn = authEnabled() && AUTH.status === 'ok';
  const mons = planMons();
  const countBy = (status) => mons.filter((mon) => mon.status === status).length;

  // (1) 히어로 — 공식 아트워크가 이 저장소에 없어 목업의 그림 자리는 빛(그라데이션)으로 채운다 (styles/components/pc-theme.css)
  const hero = el('section', { class: 'plan__hero' },
    el('div', { class: 'plan__hero-head' },
      el('span', { class: 'plan__hero-ico', 'aria-hidden': 'true' }, '🌱'),
      el('h2', {}, '플래너 — 내 개체를 어떻게 키울까')),
    el('p', { class: 'plan__hero-desc' }, '도감이 "뭐가 세나"에 답한다면, 플래너는 "내가 가진 이 개체를 지금 키워도 되나"에 답합니다. 위 탭의 내 포켓몬에서 개체를 레벨·개체값·기술 단위로 저장하면 같은 종끼리 비교할 수 있어요.'),
    el('a', { class: 'plan__hero-go', href: routeHash('planner-collection') },
      el('span', { class: 'plan__hero-go-ico', 'aria-hidden': 'true' }, '＋'),
      '내 포켓몬에서 개체 등록하기',
      el('span', { class: 'plan__hero-go-arrow', 'aria-hidden': 'true' }, '›')));

  // (2) 요약 — 로그인 상태에 따라 말이 달라진다. 숫자를 못 보여 줄 때 0 을 보여 주면 "없다"로 읽힌다
  const summary = el('section', { class: 'plan__card plan__summary' });
  if (!authEnabled()) {
    summary.append(el('div', { class: 'plan__summary-main' },
      el('span', { class: 'plan__summary-ico', 'aria-hidden': 'true' }, '🎒'),
      el('div', {}, el('b', {}, '내 포켓몬'),
        el('span', { class: 'plan__summary-desc' }, '이 빌드는 로그인 기능이 꺼져 있어 저장이 안 됩니다. 계산·조회는 할 수 있어요.'))));
  } else if (!loggedIn) {
    summary.append(el('div', { class: 'plan__summary-main' },
      el('span', { class: 'plan__summary-ico', 'aria-hidden': 'true' }, '🎒'),
      el('div', {}, el('b', {}, '내 포켓몬'),
        el('span', { class: 'plan__summary-desc' }, AUTH.status === 'pending'
          ? '⏳ 승인 대기 중 — 승인되면 개체를 계정에 저장하고 기기 간에 동기화합니다.'
          : '☰ 메뉴 맨 위 "👤 마이페이지" 에서 로그인하면 개체를 계정에 저장하고 어느 기기에서든 같은 목록을 봅니다. 로그인 없이도 CP 계산은 해 볼 수 있어요.'))));
  } else {
    summary.append(
      el('div', { class: 'plan__summary-main' },
        el('span', { class: 'plan__summary-ico', 'aria-hidden': 'true' }, '🎒'),
        el('div', {}, el('b', {}, `내 포켓몬 ${mons.length}마리`),
          el('span', { class: 'plan__summary-desc' }, mons.length
            ? '육성 중인 포켓몬들의 현황을 한눈에 확인하세요.'
            : '아직 저장한 개체가 없어요. 위 버튼으로 첫 개체를 등록해 보세요.'))),
      el('div', { class: 'plan__stats' }, ...PLAN_STATUSES.map((status, index) =>
        el('div', { class: `plan__stat plan__stat--${PLAN_STATUS_MODS[index]}` },
          el('span', { class: 'plan__stat-ico', 'aria-hidden': 'true' }, PLAN_STATUS_ICONS[index]),
          el('div', {}, el('em', {}, status), el('b', {}, String(countBy(status))))))),
      el('a', { class: 'plan__summary-go', href: routeHash('planner-collection') },
        '내 포켓몬 바로가기', el('span', { 'aria-hidden': 'true' }, '→')));
  }

  // (3) 다음 걸음 — 화살표는 걸음 사이를 잇는 장식이라 CSS 가 그린다
  const guide = el('section', { class: 'plan__card plan__guide' },
    el('div', { class: 'plan__guide-head' },
      el('span', { class: 'plan__guide-ico', 'aria-hidden': 'true' }, '🎯'),
      el('div', {}, el('b', {}, '지금 무엇을 하면 좋을까?'),
        el('span', { class: 'plan__summary-desc' }, '내 포켓몬의 상태에 맞는 다음 단계를 확인해보세요.'))),
    el('ol', { class: 'plan__steps' }, ...planSteps().map(([icon, title, desc, href], index) =>
      el('li', {},
        el('a', { class: 'plan__step', href },
          el('span', { class: 'plan__step-no' }, String(index + 1)),
          el('span', { class: 'plan__step-ico', 'aria-hidden': 'true' }, icon),
          el('span', { class: 'plan__step-main' },
            el('b', {}, title),
            el('span', { class: 'plan__step-desc' }, desc)))))));

  $content.append(hero, summary, guide);

  // (4) 최근 — 마지막에 손댄 순서(at). at 이 없는 옛 문서는 뒤로 민다
  if (loggedIn && mons.length) {
    const recent = mons.slice().sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 4);
    $content.append(el('section', { class: 'plan__card plan__recent' },
      el('div', { class: 'plan__guide-head' },
        el('span', { class: 'plan__guide-ico', 'aria-hidden': 'true' }, '🕘'),
        el('div', {}, el('b', {}, '최근 추가한 포켓몬'),
          el('span', { class: 'plan__summary-desc' }, '가장 최근에 등록한 포켓몬이에요.')),
        el('a', { class: 'plan__more', href: routeHash('planner-collection') }, '전체 보기', el('span', { 'aria-hidden': 'true' }, '›'))),
      el('div', { class: 'plan__recent-list' }, ...recent.map(planRecentCard))));
  }

  $content.append(el('p', { class: 'detail__foot plan__roadmap' }, '다음에 붙을 것: 육성 판단 카드(키울 가치·다음 행동) · 목표 자원 계산기 · 게임 검색식 생성기 · 보유 개체 기반 파티 · 내 목표 × 일정 연결'));
  $note.textContent = '육성 플래너는 내 개체(레벨 · 개체값 · 기술)를 계정에 저장하고 같은 종끼리 비교하는 화면입니다. 위 탭에서 육성 현황과 내 포켓몬 목록을 오갑니다. 저장은 승인된 로그인 사용자만, 계산은 누구나.';
}
