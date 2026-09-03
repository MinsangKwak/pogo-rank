// 2026-09-03 전체 페이지 뷰 + 해시 라우팅 (#/release 패치노트 · #/schedule 일정표)
// 해시를 쓰므로 브라우저·폰 제스처 뒤로가기가 그대로 동작하고, 링크 공유·북마크도 된다

// 패치노트 페이지: 팝업 대신 전체 화면, 날짜별 전부 펼침
function renderReleasePage() {
  markReleaseSeen();
  return el('div', { class: 'page-body' },
    ...RELEASE_NOTES.map((g, i) => el('section', { class: 'rel-sec' },
      el('h2', {}, g.date, i === 0 ? el('span', { class: 'tag gmax' }, 'NEW') : ''),
      el('ul', {}, ...g.items.map((t) => el('li', {}, t))))));
}

// 일정표 페이지: 달력 + 이번 달 전체 일정 목록 (분류별)
function scheduleMonthList() {
  const secs = [];
  for (const [cat, c] of Object.entries(SCHEDULE_CATS)) {
    const items = SCHEDULE_ITEMS.filter((it) => it.cat === cat);
    if (!items.length) continue;
    secs.push(el('p', { class: 'schedule-sec' }, c.name));
    secs.push(...items.map((it) => el('p', { class: 'schedule-item' },
      el('span', { class: 'dot', style: `background:${c.color}` }),
      el('b', { class: 'sched-date' }, `9/${it.s}${it.e !== it.s ? `–${it.e}` : ''}`), ` ${it.label}`)));
  }
  return el('div', {}, ...secs);
}
function renderSchedulePage() {
  return el('div', { class: 'page-body' },
    buildScheduleCal(),
    el('h2', { class: 'page-sec' }, '이번 달 전체 일정'),
    scheduleMonthList());
}

// 2026-09-03 CP 계산기: 포켓몬 + 레벨 + 개체값 → CP (게임마스터 CPM 사용)
function cpmAt(level) {
  const a = DEX_DATA.cpms;
  const i = Math.floor(level) - 1;
  return level % 1 === 0 ? a[i] : Math.sqrt((a[i] ** 2 + a[i + 1] ** 2) / 2);  // 반레벨 보간
}
function calcCp(f, lv, ia, idf, ih) {
  const m = cpmAt(lv);
  return Math.max(10, Math.floor((f.atk + ia) * Math.sqrt(f.def + idf) * Math.sqrt(f.hp + ih) * m * m / 10));
}


// 2026-09-03 도감 페이지: 넘버링순 전 종 목록 → 누르면 상세 팝업 (능력치·CP 계산기 포함)
const DEX_GENS = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];
function dexEntries() {
  // 2026-09-03 [미구현]: 포켓몬 GO에 아직 안 나온 종 표시 (PvPoke released 기준)
  const rel = new Set(DEX_DATA.rel ?? []);
  return Object.keys(DEX_DATA.names).map(Number).sort((a, b) => a - b)
    .map((d) => ({ dex: d, name: DEX_DATA.names[d], sprite: d, types: DEX_DATA.forms[d]?.types ?? [], unrel: rel.size > 0 && !rel.has(d) }));
}
function renderDexPage() {
  const all = dexEntries();
  let list = all, shown = 100;
  // 2026-09-03 레이아웃 토글: 1열 목록 ↔ 2열 격자 (선택 기억)
  let cols2 = false;
  try { cols2 = localStorage.getItem('pogo_dex_cols') === '2'; } catch { /* 저장 불가 환경 */ }
  const $list = el('div', { class: `dex-list${cols2 ? ' grid2' : ''}` });
  const $more = el('button', { class: 'boss-more', onclick: () => { shown += 200; draw(); } });
  const draw = () => {
    $list.replaceChildren(...list.slice(0, shown).map((e) =>
      el('button', { class: `dex-row${e.unrel ? ' unrel' : ''}`, onclick: () => openDetailByDex(e.dex, true) },  // 2026-09-03 도감 모드
        el('span', { class: 'dex-no' }, `#${String(e.dex).padStart(4, '0')}`),
        sprite(e.sprite),
        e.unrel ? el('span', { class: 'tag dex-unrel' }, '미구현') : '',
        el('b', {}, e.name),
        el('span', { class: 'dex-types' }, ...e.types.map((t) => el('span', { class: 'dot', style: `background: var(--t-${t})` }))),
        // 2026-09-03 v2.2.0 즐겨찾기 ★ — 로그인·승인된 사용자만 저장됨 (비로그인 클릭 시 로그인 유도)
        authEnabled() ? favBtn(e.dex, 'dex-fav') : '')));
    $more.textContent = shown < list.length ? `더보기 (${Math.min(shown, list.length)}/${list.length})` : `전체 ${list.length}종`;
    $more.disabled = shown >= list.length;
  };
  const $input = el('input', { class: 'boss-search', placeholder: '이름 검색 또는 번호 (예: 팬텀, 94)' });
  $input.addEventListener('input', () => {
    const q = $input.value.trim();
    list = !q ? all : /^\d+$/.test(q) ? all.filter((e) => String(e.dex).includes(q)) : monSearch(all, q, 999);
    shown = 100; draw();
  });
  const $layout = el('button', { class: 'uchip dex-layout', onclick: () => {
    cols2 = !cols2;
    $list.classList.toggle('grid2', cols2);
    $layout.textContent = cols2 ? '☰ 1열' : '⊞ 2열';
    try { localStorage.setItem('pogo_dex_cols', cols2 ? '2' : '1'); } catch { /* 저장 불가 환경 */ }
  } }, cols2 ? '☰ 1열' : '⊞ 2열');
  // 2026-09-03 v2.2.0 즐겨찾기만 보기 칩 (승인된 사용자) / 비로그인 안내
  const favChip = AUTH.status === 'ok'
    ? el('button', { class: 'uchip fav-chip', onclick: () => {
        $input.value = ''; list = all.filter((e) => isFav(e.dex)); shown = 999; draw();
      } }, `★ 즐겨찾기 ${AUTH.favs.size}`)
    : '';
  const genChips = el('div', { class: 'tchips' }, $layout, favChip, ...DEX_GENS.map(([a, b], i) =>
    el('button', { class: 'uchip', onclick: () => {
      $input.value = ''; list = all.filter((e) => e.dex >= a && e.dex <= b); shown = 999; draw();
    } }, `${i + 1}세대`)));
  const loginHint = authEnabled() && AUTH.status !== 'ok'
    ? el('p', { class: 'dex-hint' },
        AUTH.status === 'pending' ? '⏳ 승인 대기 중 — 승인되면 ★로 내 포켓몬을 도감에 채울 수 있어요.' : '로그인하면 ★를 눌러 내 포켓몬을 도감에 채울 수 있어요. ',
        AUTH.status === 'anon' ? el('button', { class: 'uchip', onclick: signIn }, 'Google로 로그인') : '')
    : '';
  draw();
  return el('div', { class: 'page-body' }, loginHint, $input, genChips, $list, $more,
    el('p', { class: 'd-foot' }, '미구현 = 포켓몬 GO에 아직 출시되지 않은 종 (PvPoke 출시 목록 기준, 데이터는 게임마스터 선등록분). 메가·섀도우·리전 폼은 🔍 전역 검색으로 찾을 수 있어요.'));
}

const PAGES = {
  release: { title: '🎉 패치노트', render: renderReleasePage },
  schedule: { title: `📅 ${SCHEDULE_YM.m}월 일정표`, render: renderSchedulePage },
  dex: { title: '📕 도감', render: renderDexPage },  // 2026-09-03 CP 계산기 페이지 대체
};

function currentPageId() {
  const m = location.hash.match(/^#\/(\w+)/);
  return m && PAGES[m[1]] ? m[1] : null;
}
function openPage(id) {
  track('page_open', { page: id });  // 2026-09-03 GA4: 도감·일정표·패치노트 사용량
  if (currentPageId() === id) renderPage();
  else location.hash = `#/${id}`;
}
function goBack() {
  // 히스토리가 있으면 브라우저 뒤로가기와 동일하게, 링크로 바로 들어왔으면 메인으로
  if (currentPageId()) (history.length > 1 ? history.back() : (location.hash = ''));
}
function renderPage() {
  const id = currentPageId();
  const $page = document.getElementById('page');
  const $wrap = document.querySelector('.wrap');
  if (!id) { $page.hidden = true; $page.replaceChildren(); $wrap.hidden = false; return; }
  closeDrawer(); closeModal();
  $wrap.hidden = true;
  $page.hidden = false;
  $page.replaceChildren(
    el('div', { class: 'page-bar' },
      el('button', { class: 'icon-btn', onclick: goBack, 'aria-label': '뒤로' }, '←'),
      el('b', {}, PAGES[id].title)),
    PAGES[id].render());
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', renderPage);
renderPage();  // #/schedule 같은 링크로 바로 들어온 경우
