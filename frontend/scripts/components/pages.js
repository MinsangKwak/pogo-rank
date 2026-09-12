// 2026-09-03 전체 페이지 뷰 + 해시 라우팅 (#/release 패치노트 · #/schedule 일정표)
// 해시를 쓰므로 브라우저·폰 제스처 뒤로가기가 그대로 동작하고, 링크 공유·북마크도 된다
//
// [라우팅 방식]
// 주소의 해시(#/dex · #/schedule · #/release)가 곧 현재 페이지다.
// - PAGES 에 등록된 id 만 유효한 페이지로 인정한다 (currentPageId 참고)
// - 해시가 바뀌면 hashchange 이벤트 → renderPage() 가 화면을 다시 그린다
// - 해시가 없거나 모르는 id 면 페이지를 감추고 메인 화면(.wrap)을 되살린다
// - 그래서 서버 라우팅이 필요 없고, 링크로 특정 페이지에 바로 들어올 수도 있다
//   (파일 맨 아래에서 renderPage() 를 한 번 호출하는 이유)
//
// [이 파일이 제공하는 전역]
// - PAGES           : { id: { title, render } } 페이지 레지스트리
// - currentPageId() : 현재 해시가 가리키는 페이지 id (없으면 null)
// - openPage(id)    : 해당 페이지로 이동 (index.html 의 메뉴 · auth.js 에서 호출)
// - goBack()        : 페이지 상단 ← 버튼
// - renderPage()    : 현재 해시에 맞춰 화면을 다시 그린다 (auth.js 로그인 상태 변화 시에도 호출)
// - renderReleasePage / renderSchedulePage / renderDexPage / scheduleMonthList / dexEntries / DEX_GENS
// - cpmAt(level) · calcCp(form, level, atkIv, defIv, hpIv) : CP 계산 (detail.js 의 CP 계산기가 사용)
//
// [의존하는 전역 · 데이터]
// - el() (dom.js) · sprite() (components/sprite.js) · track() (track.js)
// - closeDrawer() (components/drawer.js) · closeModal() (components/modal.js)
// - openDetailByDex() (components/detail.js) · monSearch() (components/search.js)
// - RELEASE_NOTES · markReleaseSeen() (components/release.js)
// - SCHEDULE_CATS · SCHEDULE_ITEMS · SCHEDULE_YM · buildScheduleCal(cat) · buildScheduleTimeline(cat) (components/schedule.js)
// - chips() (components/chips.js) — 일정 분류 칩 (v2.13.1)
// - AUTH · authEnabled() · favBtn() · isFav() · signIn() (components/auth.js)
// - renderRaidsPage() · renderEggsPage() (components/gameday.js) — v2.25.0 레이드 보스 · 알 부화
// - DEX_DATA (data.js): names / forms / cpms / rel

// 패치노트 페이지: 팝업 대신 전체 화면, 날짜별 전부 펼침
// 맨 위(가장 최신) 날짜에만 NEW 태그를 달고, 들어온 순간 "읽음" 처리한다.
function renderReleasePage() {
  markReleaseSeen();
  // 2026-09-08 v2.29.0 패치노트는 한국어로 뒀었다 — 쌓인 기록을 번역하면 원문과 어긋난 채로 굳는다는 이유였다.
  // 2026-09-12 v3.11.0 영어로 볼 때는 영문판을 쓴다 (i18n-release-en.js). 원문과 어긋나는 문제는
  // 통째로 짝지어 두는 방식으로 푼다 — 날짜 키가 같아야 짝이 맞고, 짝이 없으면 한국어가 그대로 나간다.
  // 남은 한국어가 하나도 없으면 "여긴 한국어" 안내도 띄우지 않는다
  return el('div', { class: 'page__body' },
    releaseHasKoreanLeft() ? i18nKoOnlyNote() : '',
    ...RELEASE_NOTES.map((group, groupIndex) => el('section', { class: 'release__sec' },
      el('h2', {}, group.date, groupIndex === 0 ? el('span', { class: 'tag tag--gmax' }, 'NEW') : ''),
      el('ul', {}, ...releaseItems(group).map(releaseItemNode)))));
}

// 일정표 페이지: 분류 칩 + 달력 + 기간 막대 타임라인 + 이번 달 전체 일정 목록 (분류별)
// SCHEDULE_CATS 에 정의된 분류 순서대로 묶고, 그 분류에 일정이 없으면 소제목도 만들지 않는다.
// 날짜는 '9/12' 처럼, 여러 날 이어지는 일정은 '9/12–15' 처럼 표시한다 (달은 SCHEDULE_YM 기준).
function scheduleMonthList(cat) {
  const sections = [];
  for (const [catKey, category] of Object.entries(SCHEDULE_CATS)) {
    if (cat && cat !== 'all' && cat !== catKey) continue;  // 2026-09-07 v2.13.1 분류 필터
    const items = SCHEDULE_ITEMS.filter((item) => item.cat === catKey);
    if (!items.length) continue;
    sections.push(el('p', { class: 'schedule__sec' }, category.name));
    sections.push(...items.map((item) => el('p', { class: 'schedule__item' },
      el('span', { class: 'dot', style: `background:${category.color}` }),
      el('b', { class: 'schedule__date' }, `${SCHEDULE_YM.m}/${item.s}${item.e !== item.s ? `–${item.e}` : ''}`), ` ${item.label}`)));  // 2026-09-07 v2.13.0 (QA-20) 달 하드코딩 제거
  }
  return el('div', {}, ...sections);
}
// 2026-09-07 v2.13.1 일정표 가독성 — 달력 점만으로는 "무엇이 언제부터 언제까지"가 안 읽혔다.
//   (1) 분류 칩(전체·이벤트·5성·메가·D-MAX·아워·섀도우)으로 달력 점·타임라인·목록을 한꺼번에 거른다
//   (2) 기간 막대 타임라인(buildScheduleTimeline) — 한 줄에 일정 하나, 시작~종료를 분류 색 막대로 잇는다
//   드로어(좁은 폭)는 그대로 달력 점만 두고, 이 페이지("자세히 보기")에서만 구현한다. 고른 분류는 기억한다(localStorage)
const SCHED_CAT_KEY = 'pogo_sched_cat';
function renderSchedulePage() {
  let cat = 'all';
  try { cat = localStorage.getItem(SCHED_CAT_KEY) || 'all'; } catch {}
  if (cat !== 'all' && !SCHEDULE_CATS[cat]) cat = 'all';
  const $cal = el('div', {});
  const $timeline = el('div', {});
  const $list = el('div', {});
  const $chips = el('div', { class: 'page__filters' });   // v2.66.0 머리·필터와 본문을 가르는 선이 이 줄 아래에 온다
  const draw = () => {
    $chips.replaceChildren(chips(
      [{ id: 'all', label: '전체' }, ...Object.entries(SCHEDULE_CATS).map(([id, category]) => ({ id, label: category.name, color: category.type }))],
      cat,
      (id) => {
        cat = id;
        try { localStorage.setItem(SCHED_CAT_KEY, cat); } catch {}
        track('sched_cat', { cat });  // GA4: 어떤 분류를 따로 보는지
        draw();
      }));
    $cal.replaceChildren(buildScheduleCal(cat));
    $timeline.replaceChildren(buildScheduleTimeline(cat));
    $list.replaceChildren(scheduleMonthList(cat));
  };
  draw();
  // 2026-09-08 v2.29.0 일정표는 한국 서버 공지를 그대로 옮긴 콘텐츠라 한국어로 둔다.
  // 영어로 볼 때는 "한국 서버(KST) 기준" 을 먼저 밝힌다 — 이벤트 날짜는 지역마다 다르고,
  // 자기 지역 일정으로 오해하면 실제로 이벤트를 놓친다
  // 2026-09-12 v2.66.0 달력과 ⚔️ 레이드 보스 화면의 역할을 갈라 적는다.
  //   달력은 손으로 적은 공지(SCHEDULE_ITEMS)라 "언제" 가 정확하고,
  //   레이드 보스 화면은 자동 수집(GAMEDAY)이라 "지금 무엇이" 가 정확하다.
  // 둘 다 5성·메가 보스 이름을 말하므로, 어느 쪽이 무엇을 말하는지 밝히지 않으면
  // 수집이 하루 늦거나 공지가 갱신되지 않았을 때 두 화면이 서로 다른 보스를 가리킨다
  const bossBridge = el('p', { class: 'note schedule__bridge' },
    '이 달력은 ', el('b', {}, '언제'), ' 무엇이 열리는지를 봐요. ',
    el('b', {}, '지금'), ' 실제로 도는 보스는 ',
    el('a', { href: routeHash('raids') }, '⚔️ 레이드 보스'), ' 에서 봐요.');
  return el('div', { class: 'page__body schedule__page' }, i18nKoOnlyNote('kst'),
    $chips,
    bossBridge,
    $cal,
    el('h2', { class: 'page__sec' }, '기간 한눈에'),
    $timeline,
    el('h2', { class: 'page__sec' }, '이번 달 전체 일정'),
    $list);
}

// 2026-09-03 CP 계산기: 포켓몬 + 레벨 + 개체값 → CP (게임마스터 CPM 사용)
// DEX_DATA.cpms 는 Lv1 부터의 정수 레벨 CPM 배열 (인덱스 0 = Lv1)
function cpmAt(level) {
  const cpms = DEX_DATA.cpms;
  const index = Math.floor(level) - 1;
  return level % 1 === 0 ? cpms[index] : Math.sqrt((cpms[index] ** 2 + cpms[index + 1] ** 2) / 2);  // 반레벨 보간
}
// CP = floor((공격+공격IV) × √(방어+방어IV) × √(체력+체력IV) × CPM² / 10), 최소 10
function calcCp(form, level, atkIv, defIv, hpIv) {
  const multiplier = cpmAt(level);
  return Math.max(10, Math.floor((form.atk + atkIv) * Math.sqrt(form.def + defIv) * Math.sqrt(form.hp + hpIv) * multiplier * multiplier / 10));
}


// 2026-09-03 도감 페이지: 넘버링순 전 종 목록 → 누르면 상세 팝업 (능력치·CP 계산기 포함)
// 세대별 도감번호 구간 (1세대 #0001–0151 … 9세대 #0906–1025) — 세대 칩 필터에 쓴다
const DEX_GENS = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];
// 도감 목록 데이터: 도감번호 오름차순 전 종. unrel = 아직 포켓몬 GO 미출시(= [미구현] 태그 대상)
function dexEntries() {
  // 2026-09-03 [미구현]: 포켓몬 GO에 아직 안 나온 종 표시 (PvPoke released 기준)
  // rel 목록 자체가 비어 있는 빌드에서는 전부 출시된 것으로 취급(태그를 달지 않는다)
  const rel = new Set(DEX_DATA.rel ?? []);
  return Object.keys(DEX_DATA.names).map(Number).sort((a, b) => a - b)
    .map((dexNumber) => ({ dex: dexNumber, name: DEX_DATA.names[dexNumber], sprite: dexNumber, types: DEX_DATA.forms[dexNumber]?.types ?? [], unrel: rel.size > 0 && !rel.has(dexNumber) }));
}
// 도감 페이지 조립.
// 목록은 한 번에 다 그리지 않고 청크로 나눠 그린다 — 처음 100종, [더보기] 를 누를 때마다 +200종.
// (전 1,025종을 한 번에 렌더하면 스프라이트 img 가 너무 많아져 첫 화면이 느려진다)
// 검색·세대 칩·즐겨찾기 칩은 표시할 목록(list)과 청크 개수(shown)를 바꾼 뒤 draw() 를 다시 부른다.
// 필터를 걸 때는 shown = 999 로 두어 결과를 한 번에 다 보여준다.
// 2026-09-10 v2.46.0 도감 줄의 보조 정보 — 몇 세대인지, 100% 개체의 만렙 CP 가 얼마인지.
// 둘 다 이미 있는 데이터로 계산한다(도감번호 구간 · 게임마스터 CPM). 값이 없으면 그 칸을 아예 안 만든다 —
// 빈 칸을 남겨 두면 "없는 것"과 "0" 이 같아 보인다
// 2026-09-12 v3.9.0 spriteId 를 따로 받는다 — 검색 결과에는 메가·리전 폼이 섞인다.
// 세대는 원종 도감번호로 정하고(폼 id 는 10000 번대라 구간에 안 맞는다), CP 는 그 폼의 종족값으로 낸다
function dexRowStats(dexNumber, spriteId = dexNumber) {
  const genIndex = DEX_GENS.findIndex(([genStart, genEnd]) => dexNumber >= genStart && dexNumber <= genEnd);
  const form = DEX_DATA.forms?.[spriteId] ?? DEX_DATA.forms?.[dexNumber];
  const cpm = DEX_DATA.cpm;
  const cp = form && cpm && typeof cpOf === 'function' ? cpOf(form, cpm.l50) : null;
  const cells = [];
  // 값에 '세대' 를 또 붙이지 않는다 — 제목이 이미 '세대' 라 "세대 / 1세대" 가 된다
  if (genIndex >= 0) cells.push(el('span', { class: 'dex__stat dex__stat--gen' }, el('em', {}, '세대'), el('b', {}, String(genIndex + 1))));
  if (cp) cells.push(el('span', { class: 'dex__stat dex__stat--cp' }, el('em', {}, 'CP 100%'), el('b', {}, cp.toLocaleString())));
  return cells.length ? el('span', { class: 'dex__stats' }, ...cells) : '';
}

// 2026-09-12 v3.9.0 헤더 검색이 주소로 넘겨준 조건(#/dex?q=…&t=…)을 도감 줄로 바꾼다.
// dexEntries() 가 아니라 **전역 검색 색인**을 쓴다 — 도감번호 목록에는 종만 있어서
// '메가 리자몽' · '섀도우 뮤츠' 로 찾으면 한 마리도 안 나온다
function dexSearchEntries(query, types) {
  const rel = new Set(DEX_DATA.rel ?? []);
  const pool = typeof searchTypePool === 'function' ? searchTypePool(types) : [];
  const hits = query && typeof monSearch === 'function' ? monSearch(pool, query, Infinity) : pool;
  return hits.map((pokemon) => {
    const dex = typeof dexOf === 'function' ? dexOf(pokemon.sprite) : null;
    return {
      dex,
      sprite: pokemon.sprite,
      name: pokemon.name,
      types: pokemon.types?.length ? pokemon.types : (DEX_DATA.forms[pokemon.sprite]?.types ?? []),
      unrel: dex != null && rel.size > 0 && !rel.has(dex),
    };
  });
}

// 검색 조건을 사람이 읽는 한 줄로. '물·풀 타입' · '"메타"' · '물 타입 중 "메가"'
function dexSearchLabel(query, types) {
  const typeText = types.length ? `${types.map((typeKey) => TYPE_KO[typeKey] ?? typeKey).join('·')} 타입` : '';
  if (typeText && query) return `${typeText} 중 "${query}"`;
  return typeText || `"${query}"`;
}

function renderDexPage() {
  // 2026-09-12 v3.9.0 검색 결과를 여기서 보여 준다. 헤더 검색은 여덟 줄짜리 패널이라
  // 그 아래를 볼 길이 없었다 — 조건을 주소에 실어 오면 도감의 목록·그리드로 전부 그린다
  const params = (typeof routeOf === 'function' ? routeOf()?.params : null) ?? new URLSearchParams();
  let searchTypes = (params.get('t') ?? '').split(',').filter((typeKey) => TYPE_KO[typeKey]).slice(0, 2);
  const species = dexEntries();   // 전 종 — 검색을 지웠을 때 돌아올 자리
  let searchQuery = (params.get('q') ?? '').trim();
  let searching = !!(searchQuery || searchTypes.length);
  let all = searching ? dexSearchEntries(searchQuery, searchTypes) : species;
  let list = all;
  // 검색해서 들어왔으면 나눠 그리지 않는다 — 찾으러 온 것이 [더보기] 뒤에 숨으면 안 찾은 것과 같다
  let shown = searching ? Infinity : 100;
  // 2026-09-03 레이아웃 토글: 리스트 ↔ 그리드 (선택 기억, localStorage 'pogo_dex_cols')
  // 2026-09-09 v2.37.0 즐겨찾기·레이드 보스·알 부화도 같은 토글을 쓰게 되며 components/ui.js 로 뺐다 —
  // 키 이름·값('1'|'2')은 이미 나간 값이라 그대로 잇는다(layoutInitial/layoutToggle)
  const cols2 = layoutInitial('pogo_dex_cols');
  const $list = el('div', { class: `dex__list dex-catalog${cols2 ? ' is-grid' : ''}` });
  const $more = el('button', { class: 'boss__more', onclick: () => {
    shown += 200;
    draw();
  } });
  // 현재 list · shown 상태로 목록과 [더보기] 버튼 문구를 다시 그린다
  const draw = () => {
    $list.replaceChildren(...list.slice(0, shown).map((entry) =>
      // 2026-09-12 v3.9.0 openDetailByDex → openDetail. 검색 결과에는 폼(메가·섀도우·리전)이 섞이는데
      // 도감번호로 열면 전부 원종이 뜬다. entry 가 이미 {sprite, name, types} 를 들고 있으므로
      // 종이든 폼이든 같은 한 줄로 연다 (종은 sprite === dex 라 전과 똑같이 동작한다)
      el('button', { class: `dex__row${entry.unrel ? ' is-unreleased' : ''}`, onclick: () => openDetail(entry, true) },  // 2026-09-03 도감 모드
        el('span', { class: 'dex__no' }, entry.dex != null ? `#${String(entry.dex).padStart(4, '0')}` : ''),
        sprite(entry.sprite),
        entry.unrel ? el('span', { class: 'tag dex__unrel' }, '미구현') : '',
        el('b', {}, entry.name),
        // 2026-09-10 v2.42.0 점 대신 이름이 적힌 알약 — 점만으로는 색을 외운 사람만 읽을 수 있었다.
        // 좁은 화면은 자리가 없어 지금처럼 점으로 둔다(CSS 가 글자를 감춘다, components/pc-theme.css)
        // 2026-09-10 v2.46.0 줄 모드는 이름과 타입 사이가 텅 비어 있었다 — 목업(내 포켓몬 목록)처럼
        // 그 자리에 **읽을 값**을 넣는다. 세대와 CP 100% 기준 둘 다 이미 가진 데이터로 계산한다:
        // 세대는 도감번호 구간(DEX_GENS), CP 는 상세 팝업이 맨 위에 보여 주는 그 값(cpOf · DEX_DATA.cpm.l50).
        // 지어낸 값은 하나도 없다. 카드 모드에서는 자리가 없어 CSS 가 감춘다 (pc-theme.css)
        entry.dex != null ? dexRowStats(entry.dex, entry.sprite) : '',
        el('span', { class: 'dex__types' }, ...entry.types.map((typeName) =>
          el('span', { class: 'dex__type', style: `--c: var(--t-${typeName})` },
            el('i', { class: 'dot', 'aria-hidden': 'true' }),
            el('b', {}, TYPE_KO[typeName] || typeName)))),
        // 2026-09-03 v2.2.0 즐겨찾기 ★ — 로그인·승인된 사용자만 저장됨 (비로그인 클릭 시 로그인 유도)
        '')));   // 2026-09-12 v3.4.0 ★ 자리 — 즐겨찾기를 걷어내며 비웠다 (다시 만들 때 여기로 돌아온다)
    // 남은 종이 있으면 "더보기 (지금까지/전체)", 다 봤으면 총 개수를 보여주고 버튼을 잠근다
    $more.textContent = shown < list.length ? `더보기 (${Math.min(shown, list.length)}/${list.length})` : `전체 ${list.length}종`;
    $more.disabled = shown >= list.length;
    // 검색 결과는 한 번에 다 그리므로 [전체 N종] 만 남아 누를 데가 없다 — 감추고, 수는 머리 줄이 말한다.
    // 머리 줄의 수도 여기서 갱신한다 — 세대 칩으로 더 좁히면 "232마리" 가 거짓말이 된다
    $more.hidden = searching;
    $head.hidden = !searching;
    $none.hidden = !searching || list.length > 0;
    if (searching) $found.textContent = `${dexSearchLabel(searchQuery, searchTypes)} ${list.length}마리`;
  };
  // 2026-09-12 v3.5.0 화면 안 검색 칸을 뺐다. v2.66.0 에 안내 문구로 성격을 갈라 놓았지만
  // (헤더는 "어디로든 데려가는" 검색, 이 칸은 "이 목록을 거르는" 칸) 생김새가 같은 입력칸 둘이
  // 한 화면에 있는 것 자체가 문제였다 — 헤더 검색은 어차피 포켓몬을 찾아 상세로 데려간다.
  // 세대 칩은 그대로 남아 목록을 거른다
  // 2026-09-08 v2.29.2 라벨을 "열 개수"에서 "보기 방식"으로 바꿨다.
  //   - 열 개수는 화면 폭에 따라 2·3·4열로 달라져 "2열" 이 넓은 화면에서는 그냥 틀린 말이었다
  //   - 버튼은 **지금 어떤 보기인지**를 말한다 (그리드 ↔ 리스트). 누르면 무엇이 되는지는 aria-label 로 밝힌다
  // .dex__layout 클래스는 그대로 둔다 — 회귀 검사(tests/e2e/shell.js)가 이 클래스로 버튼을 찾는다
  const $layout = layoutToggle('pogo_dex_cols', cols2, (grid) => $list.classList.toggle('is-grid', grid), 'dex__layout');
  // 칩 줄: [1세대] … [9세대]
  // 2026-09-09 v2.40.0 보기 방식(리스트/그리드)은 이 줄에서 뺐다 — 세대는 "무엇을 보여줄지"(거르기)고
  // 보기 방식은 "그걸 어떻게 보여줄지"라 성격이 다르다. 둘을 한 줄에 섞으니 토글이 칩 하나로 묻혔다
  // 2026-09-12 v2.66.0 [★ 즐겨찾기 N] 칩을 뺐다 — 같은 줄의 세대 칩은 그 자리에서 목록을 거르는데
  // 이 칩만 다른 화면(#/favs)으로 보냈다. 모양이 같으면 하는 일도 같아야 한다.
  // 2026-09-12 v3.4.0 즐겨찾기 기능을 통째로 걷어냈다 (components/favs.js 머리말)
  // 세대 칩은 **지금 보고 있는 목록** 을 거른다 — 검색해서 들어왔으면 그 결과 안에서 1세대만 남긴다.
  // (all 이 검색 모드에서는 검색 결과다)
  const genChips = el('div', { class: 'tchips' }, ...DEX_GENS.map(([genStart, genEnd], genIndex) =>
    el('button', { class: 'uchip', onclick: () => {
      list = all.filter((entry) => entry.dex >= genStart && entry.dex <= genEnd);
      shown = 999;
      draw();
    } }, `${genIndex + 1}세대`)));
  // 검색 결과 머리: 무엇으로 걸렀는지와 몇 마리인지, 그리고 전 종으로 돌아가는 길.
  // 화면 안에 입력칸을 다시 두지는 않는다 (v3.5.0 에 뺀 이유가 그대로다 — 헤더 검색과 생김새가 같은
  // 입력칸 둘이 한 화면에 있으면 어느 쪽에 친 글자가 진짜인지가 흐려진다)
  const $found = el('b', {});
  const $none = el('p', { class: 'dex__hint' }, '검색 결과가 없어요. 이름 일부만 쳐도 찾아요 — 예: "메타", "리자".');
  // 2026-09-12 v3.10.0 화면 안 검색 칸을 되살렸다.
  // v3.5.0 에 뺀 이유는 "헤더 검색과 생김새가 같은 입력칸 둘" 이었는데, 그 헤더 패널이 이제
  // 결과를 그리지 않는다(조건만 받아 여기로 보낸다). 결과가 한 곳에 모였으니 그 결과를 좁히는
  // 칸도 그 곁에 있어야 한다 — 한 글자 지우자고 헤더 팝업을 다시 열 수는 없다.
  // 입력할 때마다 화면을 다시 그리지 않는다: 주소만 replaceState 로 갈아 끼우고(hashchange 가
  // 안 뜨므로 renderPage 가 안 돈다) 목록만 draw() 로 고쳐 그린다 — 커서가 안 빠진다
  const $search = el('input', {
    class: 'boss__search dex__search', id: 'dex-search', type: 'search', autocomplete: 'off',
    placeholder: '이 도감에서 찾기 (예: 메타그로스, 섀도우 뮤츠)', 'aria-label': '포켓몬 이름으로 도감 찾기',
  });
  $search.value = searchQuery;
  let searchTimer = 0;
  const runSearch = () => {
    searchQuery = $search.value.trim();
    searching = !!(searchQuery || searchTypes.length);
    all = searching ? dexSearchEntries(searchQuery, searchTypes) : species;
    list = all;
    shown = searching ? Infinity : 100;
    // 주소를 결과에 맞춘다 — 그대로 보내면 상대도 같은 화면을 연다
    const next = new URLSearchParams();
    if (searchQuery) next.set('q', searchQuery);
    if (searchTypes.length) next.set('t', searchTypes.join(','));
    const query = next.toString();
    try { history.replaceState(history.state, '', `#/dex${query ? `?${query}` : ''}`); } catch { /* 주소 못 바꾸는 환경 */ }
    draw();
  };
  $search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 200);   // 한 글자마다 1,800줄을 훑지 않게 한 박자 쉰다
  });
  // 2026-09-12 v3.12.0 타입 칩이 헤더 패널에서 여기로 왔다 — 패널을 걷어냈고, 무엇보다
  // "무엇을 걸러 이 목록이 나왔는지" 는 목록 옆에서 읽혀야 한다. 최대 두 개(두 타입을 다 가진 것).
  // 평소에는 접어 둔다 — 열여덟 칸이라 펼쳐 두면 목록이 그만큼 아래로 밀린다
  const $typeChips = el('div', { class: 'chips dex__types-filter' });
  const drawTypeChips = () => {
    $typeChips.replaceChildren(...Object.keys(TYPE_KO).map((typeKey) => el('button', {
      class: 'chips__item', 'aria-pressed': String(searchTypes.includes(typeKey)),
      onclick: () => {
        const at = searchTypes.indexOf(typeKey);
        if (at >= 0) searchTypes.splice(at, 1);
        else { searchTypes.push(typeKey); if (searchTypes.length > 2) searchTypes.shift(); }
        drawTypeChips();
        runSearch();
      },
    }, el('span', { class: 'dot', style: `--c: var(--t-${typeKey})` }), TYPE_KO[typeKey])));
  };
  drawTypeChips();
  const $typeBox = el('details', { class: 'filter-box dex__type-box' },
    el('summary', {}, '타입으로 좁히기'), $typeChips);
  if (searchTypes.length) $typeBox.open = true;   // 켜 둔 칩이 있으면 접어 두지 않는다
  // Enter 는 기다리지 않고 바로 — 치자마자 결과를 보려는 손이다
  $search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    clearTimeout(searchTimer);
    runSearch();
  });
  const $head = el('div', { class: 'dex__found' }, $found,
    uchip('전체 도감 보기', () => {
      $search.value = '';
      searchTypes.length = 0;   // 칩도 같이 푼다 — "전체" 라고 해 놓고 타입이 남아 있으면 거짓말이다
      drawTypeChips();
      runSearch();
    }, { class: 'dex__found-clear' }));
  const loginHint = authEnabled() && AUTH.status !== 'ok'
    ? el('p', { class: 'dex__hint' },
        AUTH.status === 'pending' ? '⏳ 승인 대기 중 — 승인되면 ★로 내 포켓몬을 도감에 채울 수 있어요.' : '로그인하면 ★를 눌러 내 포켓몬을 도감에 채울 수 있어요. ',
        AUTH.status === 'anon' ? uchip('Google로 로그인', signIn) : '')
    : '';
  draw();
  // 2026-09-10 v2.42.0 거르기(세대·즐겨찾기)와 보기 방식을 한 줄에 좌우로 — 성격은 달라도 둘 다
  // "목록을 어떻게 볼지" 라 목록 바로 위 한 줄에 모아 두는 편이 눈이 덜 움직인다.
  // 좁은 화면은 CSS 가 위아래로 쌓는다 (한 줄에 넣으면 칩이 잘린다)
  return el('div', { class: 'page__body dex-page' }, loginHint, $search, $typeBox, $head,
    el('div', { class: 'dex__toolbar page__filters' }, genChips, $layout), $list, $none, $more,
    footNote('미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분). 메가·섀도우·리전 폼은 🔍 검색으로 찾으면 이 목록에 함께 나와요.'));
}

// 해시 라우팅 대상 페이지들. 여기 없는 id 는 유효한 페이지로 보지 않는다.
const PAGES = {
  release: { title: '🎉 패치노트', render: renderReleasePage },
  schedule: { title: `📅 ${SCHEDULE_YM.m}월 일정표`, render: renderSchedulePage },
  dex: { title: '📕 도감', render: renderDexPage },  // 2026-09-03 CP 계산기 페이지 대체
  changes: { title: '⚔️ 기술 변경', render: renderMoveChangesPage },  // 2026-09-04 시즌 기술 조정 안내
  privacy: { title: '🔒 개인정보처리방침', render: renderPrivacyPage },  // 2026-09-04 로그인 시 수집하는 개인정보 안내
  terms: { title: '📜 이용약관', render: renderTermsPage },  // 2026-09-07 v2.18.0 (공개 준비 2)
  raids: { title: '⚔️ 레이드 보스', render: renderRaidsPage },  // 2026-09-08 v2.25.0 지금 도는 티어별 보스 (components/gameday.js)
  eggs: { title: '🥚 알 부화', render: renderEggsPage },                 // 2026-09-08 v2.25.0 거리별 부화 풀 (components/gameday.js)
  finder: { title: '🔎 검색식 만들기', render: renderFinderPage },
  settings: { title: '🛠 설정', render: renderSettingsPage },                 // 2026-09-12 v3.11.0 화면 테마 · 계정 저장        // 2026-09-11 v2.58.0 게임 검색창에 붙여 넣을 식 (백로그 QA-57)
};

// 현재 해시가 가리키는 전체 페이지 id. 페이지가 아니면 null = 메인 화면.
// 2026-09-08 v2.30.0 주소 해석은 router.js 한 곳이 한다 — 여기서 정규식을 또 쓰지 않는다
function currentPageId() {
  const found = routeOf();
  return found && found.route.kind === 'page' && PAGES[found.route.id] ? found.route.id : null;
}
function openPage(id, from = 'menu') {
  track('page_open', { page: id, from });  // 2026-09-03 GA4: 도감·일정표·패치노트 사용량 · 2026-09-06 from: menu/tabbar/card 진입 경로
  // 2026-09-06 v2.11.0 navigateHash: 팝업·드로어가 열려 있으면 닫고 그 히스토리 항목을 대체한다(뒤로가기 한 번에 원래 화면).
  // 이미 그 페이지면 hashchange 를 직접 쏴서 다시 그린다
  navigateHash(`#/${id}`);
}
function goBack() {
  // 히스토리가 있으면 브라우저 뒤로가기와 동일하게, 링크로 바로 들어왔으면 메인으로
  if (currentPageId()) (history.length > 1 ? history.back() : (location.hash = ''));
}
// 현재 해시에 맞춰 #page(전체 페이지)와 .wrap(메인 화면) 중 하나만 보이게 한다
function renderPage() {
  const id = currentPageId();
  const $page = document.getElementById('page');
  const $wrap = document.querySelector('.layout');
  // 2026-09-06 v2.9.0 상세 딥링크 #/mon/<스프라이트 id> — 메인 화면을 보인 채 그 포켓몬 상세 팝업을 연다.
  // 상세 팝업은 GA에서 1순위 상호작용(detail_open)인데 링크가 없어 친구에게 "이거 봐"를 못 했다.
  // 팝업을 여닫을 때 해시는 replaceState로만 바꾸므로(detail.js·modal.js) 뒤로가기 동작은 그대로다
  // 2026-09-07 v2.15.0 (QA-53) #/plan · #/plan/<탭> — 전체 페이지가 아니라 메인 셸(.wrap)의 플래너 모드다.
  // 해시가 곧 모드라서 딥링크·뒤로가기가 그대로 동작한다. 첫 로드에서는 app.js 가 applyPlanRoute → render 를 직접 부르므로
  // 그 전에 도착한 hashchange(없음)만 아니면 여기서 다시 그린다
  if (typeof planRouteFromHash === 'function' && planRouteFromHash()) {
    $page.hidden = true;
    $page.replaceChildren();
    $wrap.hidden = false;
    if (typeof _planShellReady !== 'undefined' && _planShellReady) {  // 첫 로드는 app.js 가 직접 그린다
      closeDrawer({ silent: true });
      closeModal({ silent: true });
      NAV.open = false;
      applyPlanRoute();
      render();
      window.scrollTo(0, 0);
    }
    return;
  }
  const monRoute = routeOf();
  if (monRoute?.route.kind === 'detail' && /^\d+$/.test(monRoute.rest)) {
    $page.hidden = true;
    $page.replaceChildren();
    $wrap.hidden = false;
    if (typeof openDetailBySprite === 'function') openDetailBySprite(+monRoute.rest, 'link');
    return;
  }
  // 페이지가 아니면: 페이지 영역을 비우고 감춘 뒤 메인 화면 복귀
  if (!id) {
    $page.hidden = true;
    $page.replaceChildren();
    $wrap.hidden = false;
    // 2026-09-07 v2.15.0 (QA-53) 플래너(#/plan)에서 뒤로가기로 해시가 비면 도감 모드로 되돌린다
    // 첫 로드(app.js 실행 전)에는 state 가 TDZ 라 만질 수 없다 — 셸 준비 플래그로 거른다 (planner/shell.js)
    if (typeof _planShellReady !== 'undefined' && _planShellReady) {
      applyPlanRoute();
      render();
    }
    return;
  }
  // 페이지로 넘어갈 때는 열려 있던 서랍·모달을 먼저 닫는다 (히스토리는 해시 이동이 이미 처리했으므로 silent)
  closeDrawer({ silent: true });
  closeModal({ silent: true });
  NAV.open = false;
  $wrap.hidden = true;
  $page.hidden = false;
  // 2026-09-08 v2.30.0 측정용 표식 — 어느 화면인지 DOM 만 보고 알 수 있게 (GA·히트맵)
  $page.dataset.route = id;
  // 2026-09-10 v2.48.1 로그인해야 쓰는 화면은 본문 대신 잠금 카드를 그린다 (router.js ROUTES.locked).
  // 메뉴에서 잠가 두는 것만으로는 주소로 들어오는 길이 열려 있다 — 화면 자체가 막혀야 잠근 것이다
  const body = routeLocked(id)
    ? lockedCardNode(PAGES[id].title.replace(/^[^가-힣A-Za-z]+/, ''))
    : PAGES[id].render();
  // 화면마다 본문에 id 를 단다. 이미 pageBody(id) 로 단 화면은 그대로 둔다
  if (body && body.nodeType === 1 && !body.id) {
    body.id = `page-${id}`;
    body.dataset.route = id;
  }
  $page.replaceChildren(
    // 상단 바: ← 뒤로 + 페이지 제목 (넓은 화면에서는 .page-head 가 대신하므로 CSS 가 감춘다)
    el('div', { class: 'page__bar' },
      iconBtn('←', '뒤로', goBack),
      el('b', {}, PAGES[id].title),
      uchip('홈', () => navigateHash(''), { label: '서비스 홈' })),
    body,
    // 2026-09-07 v2.18.0 IP 고지문은 전체 페이지에서도 상시 노출 (.wrap 의 푸터가 숨겨지므로)
    id === 'terms' || id === 'privacy' ? '' : ipNoticeNode());
  liftViewToggle(id);
  window.scrollTo(0, 0);
}
// 2026-09-12 v3.1.0 보기 전환(.view-toggle)을 본문에서 화면 머리로 **옮긴다**.
// 복제가 아니라 이동이라 onclick·aria-pressed·저장 키가 붙어 있는 그 노드가 그대로 간다 —
// 화면마다 토글을 따로 만들 필요도, 각 화면 렌더러가 머리를 알 필요도 없다.
// 스타일 가이드는 예외다: 거기 있는 .view-toggle 는 "이렇게 생겼다" 를 보여 주는 견본이라 옮기면 안 된다
function liftViewToggle(id) {
  // 스타일 가이드의 .view-toggle 는 "이렇게 생겼다" 를 보여 주는 견본이라 옮기지 않는다
  const toggle = id === 'styleguide' ? null : document.querySelector('#page .page__body .view-toggle');
  setPageHeadAction(toggle);
}
window.addEventListener('hashchange', renderPage);
renderPage();  // #/schedule 같은 링크로 바로 들어온 경우
