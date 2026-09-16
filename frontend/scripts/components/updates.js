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
// 상태 두 축 — 뜻이 서로 다르므로 한 줄에 섞지 않는다.
//   근거     무엇으로 확인했는가        공식 발표인가, 관찰인가
//   게임 적용 게임에서 언제 적용되는가   발표만 된 것과 이미 적용된 것은 다르다
// 2026-09-16 v3.52.0 'moncamp 반영' 축을 걷어냈다 — 읽는 사람에게 필요한 것은 우리 쪽 작업 상태가 아니라
// **그래서 뭘 하면 되는지** 다. 같은 자리에 'moncamp 는 이렇게 추천해요' 한 문단을 둔다 (moncampAdvice)
const UPDATE_EVIDENCE = { official: '공식 확인', observed: '관찰 보고', pending: '확인 대기' };
const UPDATE_ROLLOUT = { planned: '적용 예정', rolling: '순차 적용', live: '적용 확인', withdrawn: '철회', unknown: '시점 미확인' };

// 목록 화면의 상태 — 상세를 보고 뒤로 왔을 때 검색·분류·기간·스크롤이 그대로여야 한다.
// 라우터가 화면을 다시 그리므로(renderPage) 상태를 DOM 밖에 둔다
const UPDATE_UI = { query: '', cat: '', period: '', scroll: 0, shown: 0 };

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
// 이 글을 "언제 일" 로 볼지 — 적용일 > 발표일 > 우리가 확인한 날.
// 공식 릴리스 노트·알려진 문제는 날짜를 적지 않아서, 그 글은 확인일이 유일한 시간 기준이다
function updateDateOf(article) {
  return article.effectiveAt || article.announcedAt || article.checkedAt || '';
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
  // 발표일·적용일이 없는 글(공식 릴리스 노트)은 확인일을 대신 보인다 — 목록에서도 "언제 것" 을 알 수 있게.
  // 상세에서는 발표일이 있든 없든 확인일을 늘 적는다 (마지막으로 원문을 본 날)
  if ((withChecked || !parts.length) && article.checkedAt) parts.push(one(parts.length ? '마지막 확인' : '확인', article.checkedAt));
  if (!parts.length) parts.push(el('span', { class: 'upd__date' }, el('em', {}, '날짜 미확인')));
  return el('div', { class: 'upd__dates' }, ...parts);
}

// 미리보기 그림 주소 → 썸네일 크기로.
// 공식 페이지의 og:image 는 원본 그대로라 무겁다 — 실측 2.7MB GIF · 208KB PNG.
// 구글 이미지 호스트(lh3)는 주소 뒤 옵션으로 크기·형식을 바꿔 준다:
//   w320-h180-c  320×180 으로 잘라 맞춤 (카드 썸네일 비율 16:9)
//   -no          움직임 제거 (GIF 한 장으로)
//   -rj          JPEG 로 (2.7MB GIF → 25KB · 208KB PNG → 30KB, 실측)
// 다른 호스트의 그림은 손대지 않고 그대로 쓴다
function sourceThumbUrl(url) {
  if (!/^https:\/\/lh3\.googleusercontent\.com\//.test(url) || url.includes('=')) return url;
  return `${url}=w320-h180-c-no-rj`;
}

// 출처 링크 카드 — 원문 미리보기 그림 + 제목 + 주소.
// 그림은 공식 페이지의 og:image 를 **그대로 가리킨다** (우리 저장소로 복사하지 않는다).
// 못 받는 경우(차단·주소 변경)가 있으므로 실패하면 그림 자리를 접는다 — 깨진 그림을 남기지 않는다
function sourceCard(source) {
  const $thumb = source.image
    ? el('img', { class: 'upd__source-img', src: sourceThumbUrl(source.image), alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' })
    : '';
  if ($thumb) $thumb.addEventListener('error', () => $thumb.remove());
  let host = '';
  try { host = new URL(source.url).host; } catch { host = source.url; }
  return el('a', { class: 'upd__source', href: source.url, target: '_blank', rel: 'noopener noreferrer' },
    $thumb,
    el('span', { class: 'upd__source-body' },
      el('b', {}, source.label),
      el('span', { class: 'upd__source-meta' },
        el('span', { class: 'upd__source-lang' }, source.lang === 'ko' ? '한국어' : '영어'),
        el('span', { class: 'upd__source-host' }, host),
        el('span', { class: 'upd__source-go', 'aria-hidden': 'true' }, '↗'))));
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
  // 한 번에 보이는 글 수. [더보기] 를 누를 때마다 이만큼씩 늘어난다 —
  // 글이 쌓이는 화면이라 처음부터 전부 그리면 스크롤만 길어지고, 과거는 누를 때 온다
  const PAGE = 5;
  const $more = el('button', { class: 'upd__more' });
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
    // 남은 수보다 많이 펼쳐 달라고 해도 목록 길이에서 자른다(되돌리지 않는다) —
    // 되돌리면 마지막 [더보기] 가 첫 장으로 돌아가 5↔10 을 오간다. 조건이 바뀔 때 첫 장으로 가는 일은 reset() 이 맡는다.
    // 그린 수를 되적는 것도 필요하다: 처음(0)일 때 첫 [더보기] 가 0+5=5 가 되어 제자리걸음을 하지 않게
    const shown = Math.min(Math.max(UPDATE_UI.shown, PAGE), rows.length);
    UPDATE_UI.shown = shown;
    $list.replaceChildren(...(rows.length
      ? rows.slice(0, shown).map((article) => updateCard(article))
      : [hintNote('조건에 맞는 글이 없어요. 검색어나 분류를 바꿔 보세요.')]));
    const rest = rows.length - shown;
    $more.hidden = rest <= 0;
    $more.textContent = rest > 0 ? `지난 소식 더 보기 (${rest}건 남음)` : '';
    for (const button of $cats.children) button.setAttribute('aria-pressed', String(button.dataset.cat === UPDATE_UI.cat));
    for (const button of $periods.children) button.setAttribute('aria-pressed', String(button.dataset.period === UPDATE_UI.period));
  };

  $more.addEventListener('click', () => { UPDATE_UI.shown += PAGE; draw(); });
  // 검색·분류·기간을 바꾸면 펼친 만큼은 되돌린다 (새 조건의 첫 장부터 읽는다)
  const reset = () => { UPDATE_UI.shown = PAGE; };
  $search.addEventListener('input', () => { UPDATE_UI.query = $search.value; reset(); draw(); });
  const catButton = (key, label) => {
    const button = uchip(label, () => { UPDATE_UI.cat = UPDATE_UI.cat === key ? '' : key; reset(); draw(); }, { on: false });
    button.dataset.cat = key;
    return button;
  };
  $cats.append(catButton('', '전체 분류'), ...Object.entries(UPDATE_CATS).map(([key, label]) => catButton(key, label)));
  $periods.append(...PERIODS.map(([key, label]) => {
    const button = uchip(label, () => { UPDATE_UI.period = key; reset(); draw(); }, { on: false });
    button.dataset.period = key;
    return button;
  }));

  draw();   // 첫 그림 — 이걸 빼면 목록이 빈 채로 뜬다 (칩을 눌러야만 채워졌다)
  // 기사 본문은 공식 공지를 한국어로 요약한 글이라 사전을 태우지 않는다 — 일정표와 같은 규칙 (i18n.js)
  if (typeof i18nKoOnlyNote === 'function') $body.append(i18nKoOnlyNote('ko'));
  $body.append(sectionTitle('전체 소식'),
    el('div', { class: 'upd__tools' }, $search, $cats, $periods, $count),
    $list, $more,
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

  // moncamp 는 이렇게 추천해요 — 이 변경을 두고 우리 화면으로 무엇을 하면 되는지 한 문단
  if (article.moncampAdvice) {
    $body.append(section('moncamp 는 이렇게 추천해요', el('div', { class: 'upd__advice' }, el('p', {}, article.moncampAdvice))));
  }

  if (article.related?.length) {
    $body.append(section('관련 화면', el('div', { class: 'upd__related' }, ...article.related.map((routeId) =>
      uchip(`${routeIcon(routeId)} ${updateRouteName(routeId)}`.trim(), () => navigateHash(routeHash(routeId)))))));
  }

  $body.append(section('공식 원문', article.sources?.length
    ? el('div', { class: 'upd__sources' }, ...article.sources.map(sourceCard))
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
