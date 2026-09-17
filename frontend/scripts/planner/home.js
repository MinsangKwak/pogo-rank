// ─────────────────────────────────────────────────────────────────────────────
// planner/home.js — 🎒 내 포켓몬 (2026-09-17 v3.61.0)
//
// 2026-09-17 v3.61.0 화면을 갈아엎었다. 전에는 '🌱 육성 플래너' 와 '🎒 내 포켓몬' 두 화면이었고,
// 이 파일은 그중 앞의 것(육성 현황 요약 · 다음 걸음 다섯 · 최근 개체 넷)이었다.
//
// 왜 갈아엎었나
//   두 화면이 같은 것을 묻고 있었다 — "내가 담아 둔 것이 뭔가". 그리고 걸음 다섯 중 넷이
//   이미 자식 화면 하나를 가리키고 있었다(v2.65.0 에 한 번 줄였는데도 그랬다).
//   더 근본적으로는 **개체 기록의 값이 비용을 못 넘었다.** 일곱 번 입력해서 얻는 것이
//   CP·리그 도달·유사백인데, 셋 다 계산기가 저장 없이도 알려 준다. 게다가 게임과 동기화되지
//   않아 사탕을 먹이는 순간 틀린 값이 된다. ★ 담기는 탭 한 번에 📣 일정을 돌려준다.
//
// 그래서 순서가 이렇다 — **일정이 먼저, 목록이 나중**
//   (1) 📣 다가오는 소식   담아 둔 종에 잡힌 일정. 이 화면의 주인공이다
//   (2) ★ 담아 둔 포켓몬   ★ 목록. 소식이 있는 줄에는 D-day 가 붙는다
//   (3) 🎒 내 개체         PLAN_MONS_ENABLED 가 켜졌을 때만 (지금은 꺼짐)
//
//   v3.4.0 에 ★ 를 걷어낸 이유가 "★ 목록 화면이 도감을 이름순으로 거른 것과 다르지 않아서" 였다.
//   그래서 (2)가 맨 위면 안 된다. 목록은 주인공이 아니고 **일정이 주인공**이다.
//
// 제공하는 전역
//   renderPlanHome()
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode (components/name.js) · routeHash (router.js)
//   AUTH · authEnabled · favEnabled · isFav · toggleFav (components/auth.js)
//   favNewsEnabled · favNewsList · favNewsFor · favNewsWhen · favNewsMonName · favNewsCardNode (components/favnews.js)
//   PLAN_MONS_ENABLED · renderPlanCollection (planner/collection.js)
//   $content · $note (app.js)
// ─────────────────────────────────────────────────────────────────────────────

// 담아 둔 도감번호 — 번호순. AUTH.favs 는 Set 이라 순서가 들어간 순이다(사람에게는 뜻이 없다)
function planFavDex() {
  return AUTH.favs instanceof Set ? [...AUTH.favs].map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];
}

// ★ 목록의 한 줄. 소식이 걸린 줄에는 D-day 를, 아닌 줄에는 아무것도 붙이지 않는다 —
// "없음" 을 적으면 없는 줄이 있는 줄보다 눈에 띈다
function planFavRow(dex) {
  const rows = typeof favNewsFor === 'function' ? favNewsFor(dex) : [];
  const soon = rows[0];
  const off = el('button', { class: 'plan__fav-off', 'aria-label': `${favNewsMonName(dex)} 즐겨찾기에서 빼기`,
    onclick: async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await toggleFav(dex, '내 포켓몬');
      // renderPlanHome() 을 바로 부르면 안 된다 — $content 를 비우지 않아 화면이 한 벌 더 쌓인다
      // (실측: 줄 10개가 19개가 됐다). 화면을 다시 그리는 일은 app.js render() 가 맡는다
      render();
    } }, '★');
  return el('div', { class: 'plan__fav-row' },
    el('a', { class: 'plan__fav-go', href: `#/mon/${dex}` },
      sprite(dex),
      el('span', { class: 'plan__fav-name' }, nameNode(favNewsMonName(dex))),
      soon ? el('span', { class: `tag plan__fav-when${soon.days <= 0 ? ' is-now' : ''}` }, favNewsWhen(soon)) : ''),
    off);
}

// 덩이 하나 — 제목 줄 + 내용. 비어 있을 때 할 말이 있어야 빈 칸이 안내가 된다
function planSection(icon, title, desc, body) {
  return el('section', { class: 'plan__card plan__sec' },
    el('div', { class: 'plan__guide-head' },
      el('span', { class: 'plan__guide-ico', 'aria-hidden': 'true' }, icon),
      el('div', {}, el('b', {}, title), el('span', { class: 'plan__summary-desc' }, desc))),
    body);
}

function renderPlanHome() {
  const favDex = planFavDex();
  const news = typeof favNewsList === 'function' ? favNewsList() : [];

  // (0) 히어로 — 이 화면이 무엇인지 + 주 동작 하나(담으러 가기)
  $content.append(el('section', { class: 'plan__hero' },
    el('div', { class: 'plan__hero-head' },
      el('span', { class: 'plan__hero-ico', 'aria-hidden': 'true' }, '🎒'),
      el('h2', {}, '담아 둔 포켓몬의 일정을 챙겨 드려요')),
    el('p', { class: 'plan__hero-desc' }, '포켓몬 상세에서 ★ 를 누르면 여기에 쌓여요. 그 포켓몬이 커뮤니티 데이·스포트라이트 아워·레이드 보스에 뜨면 아래 소식 칸에 먼저 알려 드려요.'),
    el('a', { class: 'plan__hero-go', href: routeHash('dex') },
      el('span', { class: 'plan__hero-go-ico', 'aria-hidden': 'true' }, '＋'),
      '도감에서 담을 포켓몬 찾기',
      el('span', { class: 'plan__hero-go-arrow', 'aria-hidden': 'true' }, '›'))));

  // (1) 📣 다가오는 소식 — 이 화면의 주인공
  $content.append(planSection('📣', '다가오는 소식', '담아 둔 포켓몬에 잡힌 일정이에요. 가까운 것부터 보여 드려요.',
    news.length
      ? el('div', { class: 'favnews__list' }, ...news.map(favNewsCardNode))
      : el('p', { class: 'empty' }, favDex.length
        ? '담아 둔 포켓몬에 잡힌 일정이 아직 없어요. 새 일정이 올라오면 여기에 떠요.'
        : '아직 담아 둔 포켓몬이 없어요. 도감에서 ★ 를 눌러 담아 보세요.')));

  // (2) ★ 담아 둔 포켓몬 — 목록은 일정 다음이다
  $content.append(planSection('★', `담아 둔 포켓몬 ${favDex.length}마리`, '★ 를 다시 누르면 빠져요. 이름을 누르면 상세가 열려요.',
    favDex.length
      ? el('div', { class: 'plan__fav-list' }, ...favDex.map(planFavRow))
      : el('p', { class: 'empty' }, '위 [도감에서 담을 포켓몬 찾기] 로 첫 포켓몬을 담아 보세요.')));

  // (3) 🎒 내 개체 — 스위치가 켜졌을 때만 (지금은 꺼짐, planner/collection.js PLAN_MONS_ENABLED)
  if (typeof PLAN_MONS_ENABLED !== 'undefined' && PLAN_MONS_ENABLED && typeof renderPlanCollection === 'function') {
    renderPlanCollection();
  }

  $note.textContent = '포켓몬 상세의 ★ 로 담고, 담아 둔 포켓몬의 커뮤니티 데이·스포트라이트 아워·레이드 일정을 여기서 챙겨요. 로그인한 분만 담을 수 있어요.';
}
