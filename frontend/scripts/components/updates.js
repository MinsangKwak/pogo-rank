// ─────────────────────────────────────────────────────────────────────────────
// components/updates.js — 📢 게임 업데이트 (2026-09-16 v3.51.0)
//
// [역할]
// Pokémon GO 쪽에서 무엇이 바뀌었는지, 그게 나에게 어떤 영향인지를 한곳에서 읽는 화면.
// 목록(#/game-updates) 에서 결론을 읽고, 한 번 더 열면(#/game-updates/<id>) 근거까지 본다.
//
// [이 화면이 다루지 않는 것 — 이름이 비슷한 화면이 셋이라 경계를 적어 둔다]
//   📢 게임 업데이트   게임의 시스템·밸런스·오류가 바뀐 일          ← 이 파일
//   📅 이벤트 일정     언제 무엇이 열리는가 (components/schedule.js)
//   🎉 패치노트        moncamp 이 바뀐 일 (components/release.js)
// 게임 쪽 변경과 moncamp 버전은 따로 센다. 서버에서 조용히 바뀌는 값도 있어 게임 버전을 강제하지 않는다.
//
// [글은 어디서 오나]
// backend/config/game_updates.json 이 편집 원본이고, 빌드가 검증한 뒤 editorialStatus='published'
// 인 것만 GAME_UPDATES 로 싣는다 (backend/build.py load_game_updates). 확인 대기 글은 빌드에 아예
// 없으므로 이 화면에서 열 방법도 없다 — 거르는 자리를 화면이 아니라 빌드에 둔 이유다.
//
// [이 파일이 제공하는 전역]
// - renderGameUpdatesPage()  : 목록 또는 상세 (주소의 뒷자리로 갈린다) — PAGES 에 등록된다
// - gameUpdates()            : 공개된 기사 목록 (최신 발표일 순)
// - gameUpdateById(id)       : id 로 한 건
// - homeUpdatesNode()        : 홈의 "주요 소식" 덩이 (최대 3건 + 전체 보기) — components/home.js 가 부른다
//
// [의존하는 전역]
// - el() (dom.js) · pageBody · uchip · footNote · hintNote · sectionTitle (components/ui.js)
// - navigateHash() (components/history.js) · routeHash() · routeOf() (router.js) · track() (track.js)
// - GAME_UPDATES (data.js, 선택) — 옛 빌드에는 없어 typeof 로 막는다
// ─────────────────────────────────────────────────────────────────────────────

// 분류 — backend/build.py GAME_UPDATE_CATEGORIES 와 키가 같아야 한다 (빌드가 값을 검사한다)
const UPDATE_CATS = {
  gym: '체육관',
  raid: '레이드·맥스',
  pvp: 'PvP',
  catch: '포획·육성',
  reward: '보상·편의',
  bugfix: '오류 수정',
};
// 상태 세 축 — 뜻이 서로 다르므로 한 줄에 섞지 않는다.
//   근거     무엇으로 확인했는가        공식 발표인가, 관찰인가
//   게임 적용 게임에서 언제 적용되는가   발표만 된 것과 이미 적용된 것은 다르다
//   반영     moncamp 계산에 들어왔는가   기사를 썼다고 순위가 다시 계산되는 것은 아니다
const UPDATE_EVIDENCE = { official: '공식 확인', observed: '관찰 보고', pending: '확인 대기' };
const UPDATE_ROLLOUT = { planned: '적용 예정', rolling: '순차 적용', live: '적용 확인', withdrawn: '철회', unknown: '시점 미확인' };
const UPDATE_IMPACT = { none: '반영 해당 없음', check: 'moncamp 점검 필요', done: 'moncamp 반영 완료' };

// 목록 화면의 상태 — 상세를 보고 뒤로 왔을 때 검색·분류·기간·스크롤이 그대로여야 한다.
// 라우터가 화면을 다시 그리므로(renderPage) 상태를 DOM 밖에 둔다
const UPDATE_UI = { query: '', cat: '', period: '', scroll: 0 };

// 라우트 id → 메뉴 이름. router.js 에는 routeIcon 만 있고 이름을 꺼내는 함수가 없다 —
// ROUTES 의 nav(메뉴 이름)를 먼저 보고, 메뉴에 없는 화면은 title 을 쓴다
function updateRouteName(id) {
  const route = typeof ROUTES !== 'undefined' ? ROUTES.find((entry) => entry.id === id) : null;
  return route?.nav || route?.title || id;
}

function gameUpdates() {
  return typeof GAME_UPDATES !== 'undefined' && Array.isArray(GAME_UPDATES) ? GAME_UPDATES : [];
}
function gameUpdateById(id) {
  return gameUpdates().find((article) => article.id === id) ?? null;
}
// 발표일·적용일 중 이 글을 "언제 일" 로 볼지 — 적용일이 있으면 그쪽이 사람이 찾는 날짜다
function updateDateOf(article) {
  return article.effectiveAt || article.announcedAt || '';
}
// 오늘로부터 며칠 전 글인가 (날짜가 없으면 null — 기간 거르기에서 빠진다)
function updateDaysAgo(article) {
  const date = updateDateOf(article);
  if (!date) return null;
  const then = new Date(`${date}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

// 상태 알약 하나. 색은 뜻이 있을 때만 — '확인 대기'·'철회'·'점검 필요' 처럼 사람이 한 번 더 봐야 하는 값만 칠한다
function updateBadge(text, kind = '') {
  return el('span', { class: `upd__badge${kind ? ' upd__badge--' + kind : ''}` }, text);
}
function updateBadges(article) {
  const badges = [];
  const evidence = UPDATE_EVIDENCE[article.evidenceStatus];
  if (evidence) badges.push(updateBadge(evidence, article.evidenceStatus === 'official' ? 'ok' : 'warn'));
  const rollout = UPDATE_ROLLOUT[article.rolloutStatus];
  if (rollout) badges.push(updateBadge(rollout, article.rolloutStatus === 'live' ? 'ok' : article.rolloutStatus === 'withdrawn' ? 'warn' : ''));
  if (article.moncampImpact && article.moncampImpact !== 'none') {
    badges.push(updateBadge(UPDATE_IMPACT[article.moncampImpact], article.moncampImpact === 'check' ? 'warn' : 'ok'));
  }
  return el('div', { class: 'upd__badges' }, ...badges);
}
function updateCatChips(article) {
  return el('div', { class: 'upd__cats' }, ...(article.category ?? []).map((key) =>
    el('span', { class: 'upd__cat' }, UPDATE_CATS[key] ?? key)));
}
// 날짜 줄 — 발표일과 적용일은 다른 뜻이라 라벨을 붙여 따로 적는다
function updateDates(article, withChecked = false) {
  // 라벨은 제 노드에 둔다 — '발표 ' 처럼 공백이 붙은 글자는 사전(i18n)이 키를 못 찾는다
  const one = (label, date) => el('span', { class: 'upd__date' }, el('em', {}, label), el('b', {}, date));
  const parts = [];
  if (article.announcedAt) parts.push(one('발표', article.announcedAt));
  if (article.effectiveAt) parts.push(one('적용', article.effectiveAt));
  if (withChecked && article.checkedAt) parts.push(one('마지막 확인', article.checkedAt));
  if (!parts.length) parts.push(el('span', { class: 'upd__date' }, el('em', {}, '날짜 미확인')));
  return el('div', { class: 'upd__dates' }, ...parts);
}

function openGameUpdate(id, from = 'list') {
  track('game_update_open', { id, from });   // GA4: 어느 글을 어디서 열었나
  navigateHash(routeHash('game-updates', id));
}

// 목록 카드 — 결론형 제목 · 2줄 요약 · 분류 · 상태 · 날짜. 장식용 그림보다 문장과 날짜를 먼저 둔다
function updateCard(article, from = 'list') {
  return el('article', { class: 'upd__card', onclick: () => openGameUpdate(article.id, from) },
    updateCatChips(article),
    el('h3', { class: 'upd__title' }, article.title),
    el('p', { class: 'upd__summary' }, article.summary),
    updateBadges(article),
    updateDates(article));
}

// 목록 화면
function renderGameUpdatesList() {
  const all = gameUpdates();
  const $body = pageBody('game-updates');
  if (!all.length) {
    $body.append(hintNote('아직 공개된 게임 업데이트 글이 없어요. 공식 발표를 확인한 글만 올라와요.'));
    return $body;
  }

  // ── 주요 변경 — 운영자가 고른 글 최대 3건.
  // 글이 적어 고른 것과 전체가 같을 때는 이 덩이를 만들지 않는다 — 같은 카드가 두 번 서면 두 배가 있는 것처럼 읽힌다
  const featured = all.filter((article) => article.featured).slice(0, 3);
  if (featured.length && featured.length < all.length) {
    $body.append(sectionTitle('주요 변경'),
      el('div', { class: 'upd__cards upd__cards--top' }, ...featured.map((article) => updateCard(article, 'top'))));
  }

  // ── 검색 · 분류 · 기간
  const $search = el('input', {
    type: 'search', class: 'upd__search', value: UPDATE_UI.query,
    placeholder: '제목·내용으로 찾기', 'aria-label': '게임 업데이트 검색',
  });
  const $cats = el('div', { class: 'upd__filter' });
  const $periods = el('div', { class: 'upd__filter' });
  const $list = el('div', { class: 'upd__cards' });
  const $count = el('p', { class: 'upd__count' });

  const PERIODS = [['', '전체'], ['7', '최근 7일'], ['30', '최근 30일']];
  const draw = () => {
    const query = UPDATE_UI.query.trim().toLowerCase();
    const rows = all.filter((article) => {
      if (UPDATE_UI.cat && !(article.category ?? []).includes(UPDATE_UI.cat)) return false;
      if (UPDATE_UI.period) {
        const days = updateDaysAgo(article);
        if (days == null || days > Number(UPDATE_UI.period)) return false;
      }
      if (!query) return true;
      // 제목·요약·핵심 요약까지 훑는다 — 본문에만 있는 말로도 찾을 수 있어야 한다
      const hay = [article.title, article.summary, ...(article.key ?? []), ...(article.playerImpact ?? [])].join(' ').toLowerCase();
      return hay.includes(query);
    });
    $count.textContent = `${rows.length}건`;
    $list.replaceChildren(...(rows.length
      ? rows.map((article) => updateCard(article))
      : [hintNote('조건에 맞는 글이 없어요. 검색어나 분류를 바꿔 보세요.')]));
    for (const button of $cats.children) button.setAttribute('aria-pressed', String(button.dataset.cat === UPDATE_UI.cat));
    for (const button of $periods.children) button.setAttribute('aria-pressed', String(button.dataset.period === UPDATE_UI.period));
  };

  $search.addEventListener('input', () => { UPDATE_UI.query = $search.value; draw(); });
  const catButton = (key, label) => {
    const button = uchip(label, () => { UPDATE_UI.cat = UPDATE_UI.cat === key ? '' : key; draw(); }, { on: false });
    button.dataset.cat = key;
    return button;
  };
  $cats.append(catButton('', '전체 분류'), ...Object.entries(UPDATE_CATS).map(([key, label]) => catButton(key, label)));
  $periods.append(...PERIODS.map(([key, label]) => {
    const button = uchip(label, () => { UPDATE_UI.period = key; draw(); }, { on: false });
    button.dataset.period = key;
    return button;
  }));

  draw();   // 첫 그림 — 이걸 빼면 목록이 빈 채로 뜬다 (칩을 눌러야만 채워졌다)
  // 기사 본문은 공식 공지를 한국어로 요약한 글이라 사전을 태우지 않는다 — 일정표와 같은 규칙 (i18n.js)
  if (typeof i18nKoOnlyNote === 'function') $body.append(i18nKoOnlyNote('ko'));
  $body.append(sectionTitle('전체 소식'),
    el('div', { class: 'upd__tools' }, $search, $cats, $periods, $count),
    $list,
    footNote('공식 발표를 확인한 글만 올려요. 모든 변경을 실시간으로 옮기지는 않고, 확인한 주요 변경을 정리해 드려요.'));
  return $body;
}

// 상세 화면 — 핵심 → 변경 전·후 → 플레이 영향 → 확인할 것 → 관련 화면 → 원문 → 정정 이력
function renderGameUpdateDetail(id) {
  const article = gameUpdateById(id);
  const $body = pageBody('game-update');
  const back = el('button', { class: 'upd__back', onclick: () => navigateHash(routeHash('game-updates')) }, '← ', '게임 업데이트');
  const koNote = typeof i18nKoOnlyNote === 'function' ? i18nKoOnlyNote('ko') : '';
  if (!article) {
    // 철회됐거나 아직 공개되지 않은 글의 주소로 들어온 경우 — 없는 것을 있는 척하지 않는다
    $body.append(back, hintNote('그 글을 찾을 수 없어요. 아직 공개되지 않았거나 내려간 글일 수 있어요.'));
    return $body;
  }
  const section = (title, node) => el('section', { class: 'upd__sec' }, el('h3', {}, title), node);
  const list = (items, className = '') => el('ul', { class: `upd__list${className ? ' ' + className : ''}` },
    ...items.map((text) => el('li', {}, text)));

  $body.append(back, koNote,
    el('header', { class: 'upd__head' },
      updateCatChips(article),
      el('h2', { class: 'upd__head-title' }, article.title),
      el('p', { class: 'upd__head-sum' }, article.summary),
      updateBadges(article),
      updateDates(article, true),
      article.effectiveNote ? footNote(article.effectiveNote) : ''));

  if (article.key?.length) $body.append(section('핵심 요약', list(article.key, 'upd__list--key')));

  if (article.beforeAfter?.length) {
    $body.append(section('변경 전 · 후', el('div', { class: 'upd__ba' }, ...article.beforeAfter.map((row) =>
      el('div', { class: 'upd__ba-row' },
        el('em', {}, row.label),
        // 이전 값을 모르면 지어내지 않고 그렇다고 적는다 (기획: "이전 값 미확인")
        el('div', { class: 'upd__ba-before' }, row.before
          ? row.before
          : el('span', { class: 'upd__ba-none' }, '이전 값 미확인')),
        el('div', { class: 'upd__ba-arrow', 'aria-hidden': 'true' }, '→'),
        el('div', { class: 'upd__ba-after' }, row.after))))));
  }

  if (article.playerImpact?.length) $body.append(section('플레이에 미치는 영향', list(article.playerImpact)));
  if (article.suggestedActions?.length) $body.append(section('확인하면 좋은 것', list(article.suggestedActions)));

  // moncamp 반영 — "기사를 썼다" 와 "계산에 들어왔다" 는 다른 일이라 따로 적는다
  if (article.moncampNote) {
    $body.append(section('moncamp 반영 상태',
      el('div', { class: `upd__impact upd__impact--${article.moncampImpact}` },
        el('b', {}, UPDATE_IMPACT[article.moncampImpact] ?? ''),
        el('p', {}, article.moncampNote))));
  }

  if (article.related?.length) {
    $body.append(section('관련 화면', el('div', { class: 'upd__related' }, ...article.related.map((routeId) =>
      uchip(`${routeIcon(routeId)} ${updateRouteName(routeId)}`.trim(), () => navigateHash(routeHash(routeId)))))));
  }

  $body.append(section('공식 원문', article.sources?.length
    ? el('ul', { class: 'upd__sources' }, ...article.sources.map((source) =>
        el('li', {}, el('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' },
          source.label, el('span', { class: 'meta' }, source.lang === 'ko' ? ' · 한국어' : ' · 영어')))))
    : hintNote('원문 링크가 없어요.')));

  if (article.revisions?.length) {
    $body.append(section('정정 이력', el('ul', { class: 'upd__list' }, ...article.revisions.map((revision) =>
      el('li', {}, el('b', {}, revision.at), ' ', revision.note)))));
  }
  $body.append(footNote('원문을 그대로 옮기지 않고 요약한 글이에요. 정확한 문구는 공식 원문에서 확인해 주세요.'));
  return $body;
}

// PAGES 가 부르는 입구 — 주소 뒷자리가 있으면 상세, 없으면 목록.
// 목록으로 돌아올 때는 떠날 때의 스크롤을 되살린다 (기획: 뒤로 가면 검색·필터·스크롤 유지)
function renderGameUpdatesPage() {
  const rest = (typeof routeOf === 'function' ? routeOf()?.rest : '') || '';
  if (rest) {
    UPDATE_UI.scroll = window.scrollY;   // 목록에서 떠나는 참이다 — 돌아올 자리를 적어 둔다
    return renderGameUpdateDetail(rest);
  }
  const node = renderGameUpdatesList();
  const top = UPDATE_UI.scroll;
  if (top) requestAnimationFrame(() => { window.scrollTo(0, top); UPDATE_UI.scroll = 0; });
  return node;
}

// 홈의 "주요 소식" — 최대 3건 + 전체 보기. 글이 없으면 아예 자리를 만들지 않는다 (빈 상자를 남기지 않는다)
function homeUpdatesNode() {
  const all = gameUpdates();
  if (!all.length) return '';
  const featured = all.filter((article) => article.featured).slice(0, 3);
  const top = featured.length ? featured : all.slice(0, 3);
  return el('section', { class: 'home-updates', 'aria-label': '게임 업데이트' },
    el('div', { class: 'home__section' },
      el('h3', {}, '게임 업데이트'),
      el('span', {}, '게임에서 무엇이 바뀌었는지 확인한 것만 적어요'),
      el('button', { class: 'home-updates__all', onclick: () => navigateHash(routeHash('game-updates')) }, '전체 보기 ›')),
    typeof i18nKoOnlyNote === 'function' ? i18nKoOnlyNote('ko') : '',
    el('div', { class: 'home-updates__list' }, ...top.map((article) =>
      el('button', { class: 'home-updates__item', onclick: () => openGameUpdate(article.id, 'home') },
        updateCatChips(article),
        el('b', {}, article.title),
        el('span', { class: 'home-updates__sum' }, article.summary),
        updateDates(article)))));
}
