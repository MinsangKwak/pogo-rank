// ─────────────────────────────────────────────────────────────────────────────
// components/gameday.js — ⚔️ 레이드 보스(#/raids) · 🥚 알 부화(#/eggs) (2026-09-08 v2.25.0)
//
// 무엇을 하나
//   빌드가 구운 GAMEDAY(backend/gameday_build.py)를 티어·거리로 묶어 보여 준다.
//   목록만 옮겨 놓으면 다른 사이트를 보는 것과 같으므로, 두 화면 모두 **내 것과 교차**한다.
//     줄을 누르면 상세가 열려 약점·추천 딜러·종족값으로 이어지고,
//     즐겨찾기에 든 종에는 ★ 를 붙여 "지금 도는 풀에 내가 노리던 게 있나"를 한눈에 본다.
//
// 왜 dex__row 를 쓰나
//   도감 목록과 같은 성격의 줄(그림 + 이름 + 뱃지 + ★)이라 같은 모양이어야 한다.
//   새 블록을 파면 같은 서비스 안에 비슷한 줄이 두 벌 생긴다 (docs/DEVELOPMENT.md 2.18).
//
// 제공하는 전역
//   renderRaidsPage() · renderEggsPage() · gamedayHas(kind)
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode (components/name.js)
//   openDetailByDex (components/detail.js) · authEnabled · favBtn (components/auth.js)
//   GAMEDAY · TYPE_KO (data.js)
// ─────────────────────────────────────────────────────────────────────────────

// 데이터가 아예 없을 수 있다 — 수집이 실패해도 배포는 계속되므로(fetch_data.sh) 화면 쪽에서 막는다
function gamedayHas(kind) {
  const data = typeof GAMEDAY !== 'undefined' && GAMEDAY ? GAMEDAY[kind] : null;
  return !!data && Object.keys(data).length > 0;
}

// 수집일 각주 — 원본이 언제 기준인지 밝힌다. 게임 안 실제 로테이션과 어긋날 수 있다
function gamedayFoot(lead) {
  const fetched = (typeof GAMEDAY !== 'undefined' && GAMEDAY && GAMEDAY.fetched) || '';
  return el('p', { class: 'detail__foot' },
    `${lead} 출처 LeekDuck(ScrapedDuck)${fetched ? ` · ${fetched} 수집` : ''} · 지역과 이벤트에 따라 실제와 다를 수 있어요`);
}

// 한 줄: 그림 + 이름 + 조건 뱃지 + ★. 누르면 상세가 열린다
// 2026-09-08 v2.31.0 이름과 조건 문구를 한 줄에 나란히 뒀더니 좁은 화면에서 "레지락" 같은
// 짧은 이름도 중간에서 줄바꿈됐다 — fav__main(favs.js)과 같은 모양으로 이름 아래에 문구를
// 내려 세로로 쌓는다 (pages.css .gameday__main)
function gamedayRow(entry, notes) {
  return el('button', { class: 'dex__row gameday__row', onclick: () => openDetailByDex(entry.sprite, true) },
    sprite(entry.sprite),
    el('div', { class: 'gameday__main' },
      el('b', {}, typeof nameNode === 'function' ? nameNode(entry.name) : entry.name),
      notes.length ? el('span', { class: 'meta gameday__note' }, notes.join(' · ')) : ''),
    '');   // 2026-09-12 v3.4.0 ★ 자리 — 즐겨찾기를 걷어내며 비웠다
}

// 티어·거리 묶음 하나 = 소제목 + 줄 목록.
// 2026-09-09 v2.37.0 그리드 여부를 인자로 받는다 — 화면 하나(레이드 보스 전체)에 이 묶음이 여러 개
// 생기는데(티어별), 토글 버튼 하나가 전부를 같이 바꿔야 해서 각 묶음이 wideCards() 를 따로 묻지 않는다.
// $list 를 함께 돌려줘야 호출부가 그 목록들을 모아 토글 콜백에서 한꺼번에 바꿀 수 있다
function gamedaySection(heading, list, toNotes, grid) {
  const $list = el('div', { class: `dex__list${grid ? ' is-grid' : ''}` }, ...list.map((entry) => gamedayRow(entry, toNotes(entry))));
  const node = el('section', { class: 'gameday__sec' },
    el('h2', { class: 'page__sec' }, heading, el('span', { class: 'meta' }, ` ${list.length}종`)),
    $list);
  return { node, $list };
}

function gamedayEmpty(what) {
  return el('div', { class: 'page__body' },
    el('p', { class: 'empty' }, `${what} 정보를 아직 받지 못했어요. 다음 빌드에서 채워져요.`));
}

// ── ⚔️ 레이드 보스 ────────────────────────────────────────────────────────────
// 티어별로 묶는다. 줄마다 타입 · CP 범위 · 부스트 날씨 · 색이 다른 모습 가능 여부를 적는다.
function renderRaidsPage() {
  if (!gamedayHas('raids')) return gamedayEmpty('레이드 보스');
  const notes = (boss) => {
    const parts = [];
    if (boss.types && boss.types.length) parts.push(boss.types.map((typeName) => TYPE_KO[typeName] || typeName).join('·'));
    if (boss.cp && boss.cp.min) parts.push(`CP ${boss.cp.min}–${boss.cp.max}`);
    if (boss.weather && boss.weather.length) parts.push(`${boss.weather.join('·')} 부스트`);
    if (boss.shiny) parts.push('✨');
    return parts;
  };
  // 2026-09-09 v2.37.0 도감·즐겨찾기처럼 리스트로 되돌릴 수 있는 토글 (localStorage 'pogo_raids_cols').
  // 티어마다 목록이 따로 있어(sections) 토글 하나가 전부를 같이 바꾼다
  const grid = layoutInitial('pogo_raids_cols', true);
  const sections = Object.entries(GAMEDAY.raids).map(([tier, list]) => gamedaySection(`${tier} 레이드`, list, notes, grid));
  const $layout = layoutToggle('pogo_raids_cols', grid, (next) => sections.forEach(({ $list }) => $list.classList.toggle('is-grid', next)));
  // 2026-09-09 v2.39.0 토글 버튼을 안내 문구 왼쪽 줄과 같은 줄, 오른쪽 끝으로 — 왼쪽에 홀로 떠 있어
  // 안내문과 순서가 뒤섞여 읽히던 것을 "설명은 왼쪽, 이 화면을 어떻게 볼지는 오른쪽"으로 gameday__intro 에서 가른다
  return el('div', { class: 'page__body' },
    el('div', { class: 'gameday__intro page__filters' },
      el('p', { class: 'note' }, '보스를 누르면 약점과 추천 딜러가 열려요. 혼자 잡을 수 있는지는 ',
        // 2026-09-12 v3.6.1 이모지를 도트 아이콘으로 (components/pxicon.js) — 문단 한가운데
        // 기기가 그린 컬러 이모지가 끼면 그 줄만 결이 튄다. 글자는 이름만 남겨 사전(i18n-en.js)이 찾게 둔다
        el('a', { href: routeHash('pve-solo') }, pxIcon('🧮') ?? '🧮', ' 솔플 계산기'), ' 에서, 앞으로의 일정은 ',
        el('a', { href: routeHash('schedule') }, pxIcon('📅') ?? '📅', ' 이벤트 일정'), ' 에서 봐요.'),
      $layout),
    ...sections.map(({ node }) => node),
    gamedayFoot('이 화면은 지금 도는 로테이션만 말해요 — 앞으로의 일정은 달력이 맡아요.'));
}

// ── 🥚 알 부화 ────────────────────────────────────────────────────────────────
// 2026-09-10 v2.53.0 거리만으로 묶지 않는다 — 같은 거리라도 알을 어디서 얻었는지에 따라
// 나오는 종이 아예 다르기 때문이다. 전에는 거리로만 여섯 칸을 만들어서, 걸어서 깐 5km 알에
// 절대 나올 수 없는 어드벤처 싱크 전용 5종이 같은 칸에 섞여 있었다 (3종인데 8종처럼 보였다).
// 10km 도 같고(7종인데 12종), 7km 는 친구 선물과 루트 선물 풀이 서로 다른데 한 칸이었다.
// 그래서 "지금 나오는 애들과 다르다" 가 된다 — 목록이 틀린 게 아니라 남의 칸이 섞여 있었다.
const EGG_SOURCES = [
  // [칸 이름 꼬리표, 이 칸에 들어갈 조건]
  ['어드벤처 싱크 보상', (egg) => egg.sync],
  // 7km 는 둘로 갈린다. 업스트림의 gift 표시가 루트 선물 쪽이다 (원본 구획과 9칸 모두 대조해 확인)
  ['루트 선물', (egg, distance) => distance === '7km' && egg.gift],
  ['친구 선물', (egg, distance) => distance === '7km'],
];

// 거리는 숫자로 센다 — 글자로 세면 '10km' 가 '2km' 앞에 서고, 원본이 준 순서대로 두면 1km 가 맨 뒤로 간다
function eggDistanceOrder(distance) {
  return parseInt(distance, 10) || 0;
}

function renderEggsPage() {
  if (!gamedayHas('eggs')) return gamedayEmpty('알 부화');
  const notes = (egg) => {
    const parts = [];
    if (egg.cp && egg.cp.min) parts.push(egg.cp.min === egg.cp.max ? `CP ${egg.cp.min}` : `CP ${egg.cp.min}–${egg.cp.max}`);
    if (egg.shiny) parts.push('✨');
    if (egg.regional) parts.push('지역한정');
    // 어드벤처 싱크·선물 표시는 이제 칸 이름이 말해 준다 — 줄마다 또 적으면 같은 말을 두 번 한다
    return parts;
  };
  // 2026-09-09 v2.37.0 도감·즐겨찾기처럼 리스트로 되돌릴 수 있는 토글 (localStorage 'pogo_eggs_cols')
  const grid = layoutInitial('pogo_eggs_cols', true);
  const buckets = [];
  for (const [distance, list] of Object.entries(GAMEDAY.eggs)) {
    // 한 마리는 한 칸에만 들어간다 — 위에서부터 먼저 맞는 조건을 쓰고, 아무 데도 안 걸리면 기본 칸이다
    const rest = [];
    for (const egg of list) {
      const hit = EGG_SOURCES.find(([, match]) => match(egg, distance));
      if (hit) {
        const found = buckets.find((b) => b.distance === distance && b.tail === hit[0]);
        if (found) found.list.push(egg);
        else buckets.push({ distance, tail: hit[0], list: [egg] });
      } else rest.push(egg);
    }
    if (rest.length) buckets.unshift({ distance, tail: '', list: rest });
  }
  buckets.sort((a, b) => eggDistanceOrder(a.distance) - eggDistanceOrder(b.distance)
    || (a.tail ? 1 : 0) - (b.tail ? 1 : 0));
  const sections = buckets.map(({ distance, tail, list }) =>
    gamedaySection(tail ? `${distance} 알 · ${tail}` : `${distance} 알`, list, notes, grid));
  const $layout = layoutToggle('pogo_eggs_cols', grid, (next) => sections.forEach(({ $list }) => $list.classList.toggle('is-grid', next)));
  return el('div', { class: 'page__body' },
    el('div', { class: 'gameday__intro page__filters' },
      el('p', { class: 'note' }, '★ 를 누르면 즐겨찾기에 담겨요. 이름을 누르면 종족값과 상성을 볼 수 있어요.'),
      $layout),
    ...sections.map(({ node }) => node),
    gamedayFoot('지금 도는 알 부화 풀.'));
}
