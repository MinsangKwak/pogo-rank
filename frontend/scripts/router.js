// ─────────────────────────────────────────────────────────────────────────────
// router.js — 주소(해시) 하나를 여러 곳이 따로 해석하던 것을 표 하나로 모은다 (2026-09-08 v2.30.0)
//
// 왜 필요한가
//   같은 주소를 네 곳이 각자 정규식으로 읽고 있었다.
//     pages.js         /^#\/(\w+)/            전체 페이지인가
//     planner/shell.js /^#\/plan(?:\/(\w+))?/ 플래너인가
//     app.js           '#/rank/' + id         랭킹 탭 이동
//     app-shell.js     APP_DESTINATIONS       메뉴 라벨
//   주소 체계를 한 줄만 바꿔도 네 곳을 같이 고쳐야 했고, 한 곳을 놓치면
//   "화면은 바뀌는데 제목만 안 맞는" 식으로 어긋났다. 이제 ROUTES 한 표가 원본이다.
//
// 주소 = 메뉴 구조
//   경로가 메뉴 이름과 1:1이라 주소만 봐도 어느 화면인지 안다 (#/pve · #/dmax · #/planner/collection).
//   측정도 이 id 로 한다 — GA 에서 화면을 셀 때 정규식으로 주소를 다시 파싱하지 않는다.
//
// 옛 주소는 버리지 않는다
//   #/rank/pve · #/plan 처럼 이미 공유·북마크된 주소는 legacy 로 남겨 두고 새 주소로 돌린다.
//   돌리는 것은 replace 라 뒤로가기 기록에 옛 주소가 쌓이지 않는다.
//
// 제공하는 전역
//   ROUTES              라우트 표 (배열 순서 = 메뉴 순서)
//   routeOf(hash?)      { route, rest, params } | null — 모르는 주소면 null
//   routeIdOf(hash?)    현재 라우트 id (모르면 'unknown', 홈은 'home')
//   routeHash(id, rest) 라우트 id → 해시 문자열 (홈은 '')
//   routeCanonical(hash) 옛 주소면 새 주소, 아니면 null
//   ROUTE_NAV           [해시, 메뉴 라벨] 쌍 (app-shell.js 이동 목록)
//
// 의존하는 전역
//   없다 — 표와 순수 함수뿐이라 SCRIPTS 어디에 놓아도 된다 (지금은 i18n 바로 뒤)
// ─────────────────────────────────────────────────────────────────────────────

// kind 가 화면을 그리는 방식을 가른다
//   'shell'  메인 셸(.layout)의 탭 — tab 이 state.tab 이 된다
//   'plan'   플래너 모드(.layout) — tab 이 state.planTab 이 된다
//   'page'   전체 페이지(#page) — PAGES[id] 가 제목과 렌더를 가진다
//   'detail' 딥링크 (#/mon/<스프라이트 id>)
// nav 가 있으면 그 순서대로 메뉴(이동 목록)에 오른다.
// legacy 는 이 라우트가 물려받은 옛 경로 — 들어오면 새 경로로 돌린다.
const ROUTES = [
  { id: 'home', path: '', kind: 'shell', tab: 'home', title: '서비스 홈' },

  // ── 이동 목록(메뉴)에 오르는 순서 그대로 ────────────────────────────────
  // 2026-09-09 v2.40.0 icon: 화면을 가리키는 이모지. 서비스 홈 타일(components/home.js)과 ☰ 메뉴가
  // 같은 그림을 써야 해서(같은 화면인데 그림이 다르면 다른 곳으로 읽힌다) 표 한 곳에 둔다 — 예전엔
  // home.js 안에만 있어 메뉴에는 아이콘을 못 붙였다
  { id: 'planner', path: 'planner', kind: 'plan', tab: 'home', nav: '육성 플래너', icon: '🌱', group: 'main', locked: true, legacy: ['plan'] },
  // 2026-09-12 v2.63.0 '타입 & 상성' 화면을 접고 도감으로 넘긴다 — 타입 상성은 상세 팝업이
  // 이미 같은 표를 보여 준다. 공유된 #/types?t=… 링크가 죽지 않게 legacy 로 잇는다
  { id: 'dex', path: 'dex', kind: 'page', nav: '포켓몬 도감', icon: '📕', group: 'main', legacy: ['types'] },
  { id: 'dmax', path: 'dmax', kind: 'shell', tab: 'max', nav: 'D-MAX', icon: '✨', group: 'main', legacy: ['rank/max'] },
  { id: 'pve', path: 'pve', kind: 'shell', tab: 'pve', nav: '레이드 · PvE', icon: '⚔️', group: 'main', locked: true, legacy: ['rank/pve'] },
  { id: 'pvp', path: 'pvp', kind: 'shell', tab: 'pvp', nav: '배틀 · PvP', icon: '🃏', group: 'main', locked: true, legacy: ['rank/pvp'] },
  { id: 'schedule', path: 'schedule', kind: 'page', nav: '이벤트 일정', icon: '📅', locked: true },
  { id: 'raids', path: 'raids', kind: 'page', nav: '레이드 보스', icon: '⚔️', locked: true },
  { id: 'eggs', path: 'eggs', kind: 'page', nav: '알 부화', icon: '🥚', locked: true },
  // 2026-09-11 v2.58.0 백로그 QA-57. 다른 잠긴 화면과 같은 규칙으로 로그인해야 열린다 —
  // 만든 검색식이 이 브라우저에 남는 개인 설정이라, 계정을 가진 사람의 것으로 다룬다
  { id: 'finder', path: 'finder', kind: 'page', nav: '검색식 만들기', icon: '🔎', locked: true },

  // ── 메뉴에는 없지만 주소가 있는 화면 ──────────────────────────────────────
  // 2026-09-12 v2.63.0 PvP 개체값 순위 — 배틀 · PvP 의 [🧬 개체값 순위] 버튼으로 연다.
  // 메뉴에 따로 두지 않는 이유: PvP 순위를 보다가 "이 개체가 몇 위지" 가 떠오르는 화면이라,
  // 그 자리에서 이어지는 것이 맞다 (nav 없이 path 만 두면 메뉴에는 안 뜨고 주소는 산다)
  { id: 'ivrank', path: 'ivrank', kind: 'page', icon: '🧬', locked: true },
  // 2026-09-10 v2.47.0 메뉴에서 내렸다 — '내 포켓몬' 과 '육성 플래너' 가 메뉴에 따로 있어
  // 같은 곳으로 가는 문이 둘로 보였다. 지금은 육성 플래너 한 줄이고, 두 화면은 그 안의 탭 줄이 가른다.
  // 주소는 그대로 살려 둔다 — 저장해 둔 링크·상세 팝업의 ➕(planAddFromDetail)가 이 주소를 쓴다
  { id: 'planner-collection', path: 'planner/collection', kind: 'plan', tab: 'collection', title: '내 포켓몬', locked: true, legacy: ['plan/collection'] },
  { id: 'favs', path: 'favs', kind: 'page' },
  { id: 'release', path: 'release', kind: 'page' },
  { id: 'changes', path: 'changes', kind: 'page' },
  { id: 'privacy', path: 'privacy', kind: 'page' },
  { id: 'terms', path: 'terms', kind: 'page' },
  { id: 'mon', path: 'mon', kind: 'detail' },
];

// 메뉴에 오르는 것만 [해시, 라벨, 아이콘, 덩이] 로 (app-shell.js 이동 목록 · PC 사이드바)
// 2026-09-12 v2.64.0 group — 메뉴가 열 줄을 넘어가며 "늘 쓰는 것" 과 "가끔 쓰는 것" 이 한 덩이에
// 섞여 눈이 매번 처음부터 훑어야 했다. group: 'main' 인 다섯(육성 플래너 · 도감 · D-MAX ·
// 레이드 PvE · 배틀 PvP)이 주요 기능이고, 적지 않은 나머지가 부가 기능이다
const ROUTE_NAV = ROUTES.filter((route) => route.nav)
  .map((route) => [`#/${route.path}`, route.nav, route.icon || '', route.group || 'extra']);

// 화면 아이콘 — 서비스 홈 타일(components/home.js)이 이 표를 읽는다. 모르는 id 면 빈 문자열
// 2026-09-10 v2.48.1 로그인해야 쓰는 화면인가 (ROUTES 의 locked).
// 로그인 기능이 꺼진 빌드(FIREBASE_CONFIG 비어 있음)에서는 잠그지 않는다 —
// 로그인할 방법이 없는데 잠그면 그 빌드에서는 영영 못 여는 화면이 된다.
// 실제 데이터 차단은 Firestore 규칙이 하고, 여기서 하는 것은 화면을 여닫는 일이다
function routeLocked(id) {
  const route = ROUTES.find((entry) => entry.id === id);
  if (!route?.locked) return false;
  return typeof authEnabled === 'function' && authEnabled() && AUTH.status !== 'ok';
}

function routeIcon(id) {
  return (ROUTES.find((route) => route.id === id) || {}).icon || '';
}

// 2026-09-10 v2.42.0 화면 한 줄 설명 — 넓은 화면의 제목 아래에 붙는다(components/app-shell.js).
// 홈 타일 설명(components/home.js)과 뜻이 겹치지만 자리가 달라 문장 길이가 다르다 — 타일은 한 줄 요약,
// 여기는 "이 화면에서 무엇을 하는지". 표를 한 곳에 둬 화면이 늘 때 빠뜨리지 않게 한다
const ROUTE_DESC = {
  home: '찾고, 비교하고, 키우는 즐거움. 필요한 화면으로 바로 가요.',
  'planner-collection': '내 개체를 기록하고 같은 종끼리 비교해요.',
  dex: '포켓몬을 찾아 종족값과 상성을 봐요.',
  dmax: '거대한 힘을 지닌 포켓몬의 티어를 봐요.',
  pve: '레이드 추천 딜러와 솔플 가능 여부를 계산해요.',
  pvp: '리그별 순위와 덱 구성을 봐요.',
  planner: '내 포켓몬의 육성 현황을 한눈에 정리해요.',
  schedule: '다가오는 레이드와 이벤트 일정이에요.',
  raids: '지금 도는 레이드 보스와 약점이에요.',
  eggs: '거리별로 무엇이 부화하는지 봐요.',
  ivrank: '내 개체가 그 리그에서 몇 위인지 봐요.',
  finder: '조건을 눌러 게임 검색창에 붙여 넣을 식을 만들어요.',
  // 2026-09-12 v2.64.0 메뉴에 없는 화면에도 부제를 단다 — 제목만 있는 화면은
  // 주소로 바로 들어온 사람에게 "여기가 어디인지" 를 말해 주지 않는다
  release: '무엇이 언제 바뀌었는지 적어 둬요.',
  changes: '이번 시즌에 위력·에너지가 바뀌는 기술이에요.',
  privacy: '어떤 정보를 받고 어떻게 다루는지 알려 드려요.',
  terms: '이 서비스를 쓸 때의 약속이에요.',
  // mon 은 적지 않는다 — kind:'detail' 이라 화면 머리가 아니라 팝업 안에 이름이 뜬다
  favs: '★ 로 담은 포켓몬을 갈래별로 봐요.',
  styleguide: 'POGO PLAN 을 이루는 조각을 한자리에서 봐요. 화면을 새로 만들 때 여기서 가져다 써요.',
};
function routeDesc(id) {
  return ROUTE_DESC[id] || '';
}

// 옛 경로 → 새 경로. 표를 손으로 두 번 적지 않도록 legacy 에서 뒤집어 만든다
const ROUTE_LEGACY = new Map();
for (const route of ROUTES) for (const old of route.legacy ?? []) ROUTE_LEGACY.set(old, route.path);

// '#/types?t=water,dark' → { path: 'types', params: URLSearchParams }
function routeSplit(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  const cut = raw.indexOf('?');
  const pathPart = cut < 0 ? raw : raw.slice(0, cut);
  return { path: pathPart.replace(/^\/+|\/+$/g, ''), params: new URLSearchParams(cut < 0 ? '' : raw.slice(cut + 1)) };
}

// 현재(또는 주어진) 해시가 가리키는 라우트. 모르는 주소면 null 이다.
// 긴 경로를 먼저 잡는다 — 'planner/collection' 이 'planner' 에 먹히면 안 된다
function routeOf(hash) {
  const { path, params } = routeSplit(hash ?? location.hash);
  let best = null;
  for (const route of ROUTES) {
    if (!route.path) {
      if (!path) best = { route, rest: '', params };
      continue;
    }
    const exact = path === route.path;
    const under = path.startsWith(route.path + '/');
    if (!exact && !under) continue;
    if (best && best.route.path.length >= route.path.length) continue;
    best = { route, rest: exact ? '' : path.slice(route.path.length + 1), params };
  }
  return best;
}

// 측정용 id. 홈은 'home', 모르는 주소는 'unknown' — 빈 값을 GA 에 보내지 않는다
function routeIdOf(hash) {
  return routeOf(hash)?.route.id ?? 'unknown';
}

// 라우트 id → 해시. 홈은 빈 문자열이다 (navigateHash('') 가 홈으로 가는 기존 약속)
function routeHash(id, rest = '') {
  const route = ROUTES.find((entry) => entry.id === id);
  if (!route) return '';
  const path = route.path + (rest ? `/${rest}` : '');
  return path ? `#/${path}` : '';
}

// 옛 주소면 새 주소를 돌려준다. 아니면 null (바꿀 것이 없다는 뜻)
function routeCanonical(hash) {
  const { path, params } = routeSplit(hash);
  let mapped = ROUTE_LEGACY.get(path);
  if (mapped === undefined) {
    // 'plan/collection' 처럼 옛 경로 아래로 더 들어간 주소도 같이 옮긴다
    for (const [old, next] of ROUTE_LEGACY) {
      if (path.startsWith(`${old}/`)) {
        mapped = `${next}/${path.slice(old.length + 1)}`;
        break;
      }
    }
  }
  if (mapped === undefined) return null;
  const query = params.toString();
  return `#/${mapped}${query ? `?${query}` : ''}`;
}

// 옛 주소로 들어오면 새 주소로 돌린다. replace 라 뒤로가기에 옛 주소가 쌓이지 않는다.
// 이 파일이 SCRIPTS 앞줄에 있어 이 listener 가 가장 먼저 돈다 — 화면을 그리기 전에 주소가 정리된다
function routeRedirect() {
  const canonical = routeCanonical(location.hash);
  if (!canonical || canonical === location.hash) return false;
  location.replace(canonical);
  return true;
}
routeRedirect();
window.addEventListener('hashchange', routeRedirect);
