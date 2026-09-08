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
  return el('div', { class: 'page__body' },
    ...RELEASE_NOTES.map((group, groupIndex) => el('section', { class: 'release__sec' },
      el('h2', {}, group.date, groupIndex === 0 ? el('span', { class: 'tag tag--gmax' }, 'NEW') : ''),
      el('ul', {}, ...group.items.map((item) => el('li', {}, item))))));
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
  const $chips = el('div', {});
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
  return el('div', { class: 'page__body schedule__page' },
    $chips,
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
function renderDexPage() {
  const all = dexEntries();
  let list = all;
  let shown = 100;
  // 2026-09-03 레이아웃 토글: 1열 목록 ↔ 2열 격자 (선택 기억)
  // localStorage 키 'pogo_dex_cols' 에 '2' 면 2열. 저장이 막힌 브라우저(사생활 모드 등)도 있어 try 로 감싼다.
  // 2026-09-08 v2.28.0 PC 는 카드가 기본. 저장된 선택이 있으면 그쪽이 이긴다 —
  // 넓은 화면에서 굳이 1열을 골라 둔 사람의 뜻을 기본값이 덮지 않게
  let cols2 = wideCards();
  try {
    const saved = localStorage.getItem('pogo_dex_cols');
    if (saved) cols2 = saved === '2';
  } catch { /* 저장 불가 환경 */ }
  const $list = el('div', { class: `dex__list${cols2 ? ' is-grid' : ''}` });
  const $more = el('button', { class: 'boss__more', onclick: () => {
    shown += 200;
    draw();
  } });
  // 현재 list · shown 상태로 목록과 [더보기] 버튼 문구를 다시 그린다
  const draw = () => {
    $list.replaceChildren(...list.slice(0, shown).map((entry) =>
      el('button', { class: `dex__row${entry.unrel ? ' is-unreleased' : ''}`, onclick: () => openDetailByDex(entry.dex, true) },  // 2026-09-03 도감 모드
        el('span', { class: 'dex__no' }, `#${String(entry.dex).padStart(4, '0')}`),
        sprite(entry.sprite),
        entry.unrel ? el('span', { class: 'tag dex__unrel' }, '미구현') : '',
        el('b', {}, entry.name),
        el('span', { class: 'dex__types' }, ...entry.types.map((typeName) => el('span', { class: 'dot', style: `background: var(--t-${typeName})` }))),
        // 2026-09-03 v2.2.0 즐겨찾기 ★ — 로그인·승인된 사용자만 저장됨 (비로그인 클릭 시 로그인 유도)
        authEnabled() ? favBtn(entry.dex, 'dex__fav') : '')));
    // 남은 종이 있으면 "더보기 (지금까지/전체)", 다 봤으면 총 개수를 보여주고 버튼을 잠근다
    $more.textContent = shown < list.length ? `더보기 (${Math.min(shown, list.length)}/${list.length})` : `전체 ${list.length}종`;
    $more.disabled = shown >= list.length;
  };
  // 검색: 숫자만 입력하면 도감번호 부분일치, 그 외에는 이름(한글/영문) 검색
  const $input = el('input', { class: 'boss__search', placeholder: '이름 검색 또는 번호 (예: 팬텀, 94)' });
  $input.addEventListener('input', () => {
    const query = $input.value.trim();
    list = !query ? all : /^\d+$/.test(query) ? all.filter((entry) => String(entry.dex).includes(query)) : monSearch(all, query, 999);
    shown = 100;
    draw();
  });
  const $layout = el('button', { class: 'uchip dex__layout', onclick: () => {
    cols2 = !cols2;
    $list.classList.toggle('is-grid', cols2);
    $layout.textContent = cols2 ? '☰ 1열' : '⊞ 2열';
    try {
      localStorage.setItem('pogo_dex_cols', cols2 ? '2' : '1');
    } catch { /* 저장 불가 환경 */ }
  } }, cols2 ? '☰ 1열' : '⊞ 2열');
  // 2026-09-03 v2.2.0 즐겨찾기만 보기 칩 (승인된 사용자) / 비로그인 안내
  // 2026-09-05 즐겨찾기는 전용 페이지로 이동 — PvE/PvP 갈래와 근거 순위를 함께 보여 준다
  const favChip = AUTH.status === 'ok'
    ? el('button', { class: 'uchip fav-chip', onclick: () => openPage('favs') }, `★ 즐겨찾기 ${AUTH.favs.size}`)
    : '';
  // 칩 줄: [레이아웃 토글] [즐겨찾기] [1세대] … [9세대]
  const genChips = el('div', { class: 'tchips' }, $layout, favChip, ...DEX_GENS.map(([genStart, genEnd], genIndex) =>
    el('button', { class: 'uchip', onclick: () => {
      $input.value = '';
      list = all.filter((entry) => entry.dex >= genStart && entry.dex <= genEnd);
      shown = 999;
      draw();
    } }, `${genIndex + 1}세대`)));
  const loginHint = authEnabled() && AUTH.status !== 'ok'
    ? el('p', { class: 'dex__hint' },
        AUTH.status === 'pending' ? '⏳ 승인 대기 중 — 승인되면 ★로 내 포켓몬을 도감에 채울 수 있어요.' : '로그인하면 ★를 눌러 내 포켓몬을 도감에 채울 수 있어요. ',
        AUTH.status === 'anon' ? el('button', { class: 'uchip', onclick: signIn }, 'Google로 로그인') : '')
    : '';
  draw();
  return el('div', { class: 'page__body' }, loginHint, $input, genChips, $list, $more,
    el('p', { class: 'detail__foot' }, '미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분). 메가·섀도우·리전 폼은 🔍 전역 검색으로 찾을 수 있어요.'));
}

// 해시 라우팅 대상 페이지들. 여기 없는 id 는 유효한 페이지로 보지 않는다.
const PAGES = {
  release: { title: '🎉 패치노트', render: renderReleasePage },
  schedule: { title: `📅 ${SCHEDULE_YM.m}월 일정표`, render: renderSchedulePage },
  dex: { title: '📕 도감', render: renderDexPage },  // 2026-09-03 CP 계산기 페이지 대체
  changes: { title: '⚔️ 기술 변경', render: renderMoveChangesPage },  // 2026-09-04 시즌 기술 조정 안내
  privacy: { title: '🔒 개인정보처리방침', render: renderPrivacyPage },  // 2026-09-04 로그인 시 수집하는 개인정보 안내
  terms: { title: '📜 이용약관', render: renderTermsPage },  // 2026-09-07 v2.18.0 (공개 준비 2)
  favs: { title: '★ 즐겨찾기', render: renderFavsPage },  // 2026-09-05 PvE/PvP 나눠 보기
  types: { title: '🧭 상성 검색', render: renderTypeSearchPage },  // 2026-09-06 v2.10.0 (QA-44) 타입 조합 → 약점·이중약점·추천 딜러
  raids: { title: '⚔️ 레이드 보스', render: renderRaidsPage },  // 2026-09-08 v2.25.0 지금 도는 티어별 보스 (components/gameday.js)
  eggs: { title: '🥚 알 부화', render: renderEggsPage },        // 2026-09-08 v2.25.0 거리별 부화 풀 (components/gameday.js)
};

// 현재 해시(#/dex, #/schedule?… 등)에서 페이지 id 만 뽑는다. PAGES 에 없으면 null = 메인 화면.
function currentPageId() {
  const match = location.hash.match(/^#\/(\w+)/);
  return match && PAGES[match[1]] ? match[1] : null;
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
  const monMatch = location.hash.match(/^#\/mon\/(\d+)$/);
  if (monMatch) {
    $page.hidden = true;
    $page.replaceChildren();
    $wrap.hidden = false;
    if (typeof openDetailBySprite === 'function') openDetailBySprite(+monMatch[1], 'link');
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
  $page.replaceChildren(
    // 상단 바: ← 뒤로 + 페이지 제목
    el('div', { class: 'page__bar' },
      el('button', { class: 'icon-btn', onclick: goBack, 'aria-label': '뒤로' }, '←'),
      el('b', {}, PAGES[id].title),
      el('button', { class: 'uchip', onclick: () => navigateHash(''), 'aria-label': '서비스 홈' }, '홈')),
    PAGES[id].render(),
    // 2026-09-07 v2.18.0 IP 고지문은 전체 페이지에서도 상시 노출 (.wrap 의 푸터가 숨겨지므로)
    id === 'terms' || id === 'privacy' ? '' : ipNoticeNode());
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', renderPage);
renderPage();  // #/schedule 같은 링크로 바로 들어온 경우
