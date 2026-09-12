// ─────────────────────────────────────────────────────────────────────────────
// components/search.js — 헤더의 전역 포켓몬 검색과, 여러 화면이 공유하는 검색 필터
//
// 제공하는 전역
//   buildSearchIndex()             검색 대상 목록을 만들어 캐시해 두고 돌려준다
//   monNorm(text)                  검색용 정규화 (공백 제거 + 소문자)
//   monSearch(candidates, query, limit)  후보 목록에서 이름으로 걸러 정확도순으로 돌려준다
//   initSearch()                   헤더 검색창에 동작을 붙인다 (파일 끝에서 바로 한 번 실행)
//   searchTypePool(types)          검색 색인에서 그 타입 조합만 골라 돌려준다
//   searchSubmit()                 지금 입력한 조건으로 도감(#/dex?q=…&t=…) 으로 간다
//   _searchIndex                   buildSearchIndex의 캐시 (이 파일 내부용)
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · openDetail (components/detail.js)
//   빌드 주입 데이터: PVP_DATA · PVE_DATA · PVE_EASY · DMAX_DATA · DMAX_TIER ·
//                    SHEET_DATA · VALUE_DATA · BOSS_LIST · DEX_DATA
//
// monSearch는 헤더 검색뿐 아니라 IF 탭(보스 고르기·내 덱 짜기)과 도감 페이지도 쓴다.
// 검색 결과 순서가 화면마다 달라지지 않게 필터는 반드시 이 함수 하나만 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-02 전역 포켓몬 검색: 이름 일부 입력 → 후보 선택 → 상세 팝업
// 검색 대상 = 모든 랭킹에 등장한 폼 포함 이름 + 도감(진화 계보)의 기본 종

// 검색 색인 캐시. 만드는 데 데이터 전체를 훑어야 하므로 처음 검색할 때 한 번만 만든다
let _searchIndex = null;

// 검색 대상 목록을 만든다.
//   반환값  [{ sprite, name, en, types }, …] — 이름 기준으로 중복이 제거된 배열
// 빌드가 주입하는 데이터들의 모양이 리그별·보스별·티어별로 제각각이라, 구조를 일일이
// 따라가는 대신 전체를 재귀로 훑으면서 "sprite와 name을 가진 객체"를 모두 긁어모은다.
function buildSearchIndex() {
  if (_searchIndex) return _searchIndex;
  // 같은 포켓몬이 여러 랭킹에 나오므로 이름을 키로 삼아 먼저 만난 것만 남긴다
  const byName = new Map();
  const add = (pokemon) => {
    if (pokemon?.name && pokemon.sprite != null && !byName.has(pokemon.name)) {
      byName.set(pokemon.name, {
        sprite: pokemon.sprite,
        name: pokemon.name,
        en: pokemon.en ?? '',
        types: pokemon.types ?? [],
      });
    }
  };
  // 배열이면 원소마다, 객체면 값마다 파고든다. 포켓몬처럼 생긴 객체는 담고,
  // 담은 뒤에도 그 안을 계속 훑는다 (추천 덱처럼 객체 안에 또 목록이 있는 경우가 있다)
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if ('sprite' in value && 'name' in value) add(value);
      Object.values(value).forEach(walk);
    }
  };
  // 데이터 조각은 빌드 단계에 따라 없을 수도 있으므로 typeof로 먼저 확인한다
  // (없으면 false가 배열에 들어가고, 아래 forEach가 걸러낸다)
  [typeof PVP_DATA !== 'undefined' && PVP_DATA, typeof PVE_DATA !== 'undefined' && PVE_DATA,
   typeof PVE_EASY !== 'undefined' && PVE_EASY, typeof DMAX_DATA !== 'undefined' && DMAX_DATA,
   typeof DMAX_TIER !== 'undefined' && DMAX_TIER, typeof SHEET_DATA !== 'undefined' && SHEET_DATA,
   typeof VALUE_DATA !== 'undefined' && VALUE_DATA,
   typeof BOSS_LIST !== 'undefined' && BOSS_LIST].forEach((dataset) => dataset && walk(dataset));  // 2026-09-03 빌드 보스 목록(메가·섀도우 1,586종)도 검색 대상
  // 랭킹에 한 번도 안 나온 종도 검색되게 도감 이름표를 덧붙인다.
  // 도감 키는 문자열 도감번호라서 스프라이트 id로 쓸 때 +로 숫자로 바꾼다
  for (const [dexNumber, name] of Object.entries(DEX_DATA.names ?? {})) {
    if (!byName.has(name)) {
      byName.set(name, { sprite: +dexNumber, name, en: '', types: DEX_DATA.forms[dexNumber]?.types ?? [] });
    }
  }
  _searchIndex = [...byName.values()];
  return _searchIndex;
}

// 2026-09-03 공용 검색 필터: 공백 무시·부분 일치·정확도순 정렬 (전역 검색·IF 탭 공유)
// 검색어와 이름을 같은 규칙으로 다듬어 비교하려고 양쪽 모두 이 함수를 통과시킨다
function monNorm(text) {
  return text.replace(/\s/g, '').toLowerCase();
}

// 후보 목록에서 검색어에 맞는 것만 골라 정확도순으로 돌려준다.
//   candidates  검색 대상 배열 ({ name, en, … } 객체들)
//   query       사용자가 입력한 검색어
//   limit       돌려줄 최대 개수 (기본 8 — 자동완성 목록이 너무 길어지지 않게)
//   반환값      조건에 맞는 항목 배열. 검색어가 비면 빈 배열
function monSearch(candidates, query, limit = 8) {
  const normalizedQuery = monNorm(query);
  if (!normalizedQuery) return [];
  // 한글 이름 또는 영문 이름에 검색어가 들어 있으면 후보로 본다
  const hits = candidates.filter((pokemon) => monNorm(pokemon.name).includes(normalizedQuery)
    || (pokemon.en && monNorm(pokemon.en).includes(normalizedQuery)));
  // 정확도 = 검색어가 이름의 얼마나 앞쪽에서 시작하는지 (앞에서 걸린 쪽이 위).
  // 시작 위치가 같으면 이름이 짧은 쪽을 먼저 보여준다
  hits.sort((left, right) => monNorm(left.name).indexOf(normalizedQuery) - monNorm(right.name).indexOf(normalizedQuery)
    || left.name.length - right.name.length);
  return hits.slice(0, limit);
}

// ── 2026-09-06 v2.12.0 전역 검색 = 이름 + 타입 ────────────────────────────────
// 상성 검색 페이지의 "타입 칩 → 그 조합의 포켓몬" 이 쓸 만해서 헤더 검색에도 붙였다. 한 입력창으로 셋을 처리한다.
//   (1) 이름:            "메타그로스"          → 지금까지처럼 이름 후보
//   (2) 타입:            칩 [물][풀] 또는 "물 풀" → 그 조합의 포켓몬 목록 (searchTypePool)
//   (3) 이름 + 타입:     칩 [물] + "메가"        → 물 타입 중 이름에 '메가'가 든 것
// 타입은 칩으로 골라도 되고 글자로 쳐도 된다 — "물 풀", "물·풀", "물타입" 전부 같다. 최대 2개.
// 패널은 조건을 받는 곳이다. 결과는 도감에서 본다 (2026-09-12 v3.10.0, searchSubmit).

const SEARCH_TYPES = [];          // 칩으로 고른 타입 (최대 2)
let _searchTrackKey = '';         // 같은 타입 조합을 입력할 때마다 GA 를 찍지 않기 위한 마지막 기록

// 2026-09-12 v3.9.0 (버그) 타입 칩이 목록을 거르지 않았다.
// 후보를 고르는 자리가 `typeMonList(types)` 를 부르고 있었는데, 그 함수를 들고 있던 상성 검색 화면을
// v2.63.0 에 접으면서 함수도 같이 사라졌다. `typeof … === 'function'` 으로 감싸 둔 탓에 오류도 안 나고
// 조용히 색인 전체로 되돌아갔다 — 칩을 눌러도 목록은 그대로였고 "물 타입 2,614마리" 라고 적혔다.
// 색인 항목이 이미 types 를 들고 있으니 여기서 직접 거른다. 고른 타입을 **모두** 가진 것만 남긴다
// (물+비행 = 물이면서 비행, 둘 중 하나가 아니다 — 상성 검색이 쓰던 규칙 그대로다)
function searchTypePool(types) {
  if (!types.length) return buildSearchIndex();
  return buildSearchIndex().filter((pokemon) => types.every((typeKey) => pokemon.types?.includes(typeKey)));
}

// 2026-09-12 v3.9.0 검색 결과는 도감에서 본다 · v3.10.0 패널에서는 아예 안 그린다.
// v3.9.0 은 여덟 줄을 패널에 그리고 나머지를 도감으로 넘겼는데, 그러면 같은 목록을 두 곳에서
// 그리는 셈이고 정작 패널에 뜬 여덟 줄이 "결과" 처럼 보여 도감까지 가지 않게 된다.
// 이제 패널은 조건을 받는 곳이고, 결과는 도감 한 곳에서만 그린다 (pages.js renderDexPage)
function searchSubmit() {
  const $input = document.getElementById('psearch');
  const { types: typedTypes, query } = parseSearchQuery($input.value);
  const types = activeSearchTypes(typedTypes);
  if (!query && !types.length) return;
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (types.length) params.set('t', types.join(','));
  track('search_submit', { q: query.slice(0, 20), t: types.join(',') });  // GA4: 도감까지 간 검색
  // navigateHash 가 열려 있는 검색 패널을 닫고 그 히스토리 항목을 대체한다 (components/history.js)
  navigateHash(`#/dex?${params}`);
}

// 검색어에서 타입 이름 토큰을 떼어 낸다. "물 풀 메가" → { types: ['water','grass'], query: '메가' }
function parseSearchQuery(text) {
  const koToType = Object.fromEntries(Object.entries(TYPE_KO).map(([typeKey, korean]) => [korean, typeKey]));
  const types = [];
  const words = [];
  for (const token of text.trim().split(/[\s·,/]+/).filter(Boolean)) {
    const typeKey = koToType[token.replace(/타입$/, '')];
    if (typeKey && !types.includes(typeKey) && types.length < 2) types.push(typeKey);
    else words.push(token);
  }
  return { types, query: words.join(' ') };
}

// 칩 선택 + 글자로 친 타입을 합쳐 최대 2개
function activeSearchTypes(parsedTypes) {
  return [...new Set([...SEARCH_TYPES, ...parsedTypes])].slice(0, 2);
}

function renderSearchTypeChips() {
  const $chips = document.getElementById('psearch-types');
  if (!$chips) return;
  $chips.replaceChildren(...Object.keys(TYPE_KO).map((typeKey) => el('button', {
    class: 'chips__item', 'aria-pressed': String(SEARCH_TYPES.includes(typeKey)),
    onclick: () => {
      const index = SEARCH_TYPES.indexOf(typeKey);
      if (index >= 0) SEARCH_TYPES.splice(index, 1);
      else { SEARCH_TYPES.push(typeKey); if (SEARCH_TYPES.length > 2) SEARCH_TYPES.shift(); }
      renderSearchTypeChips();
      renderSearchResults();
    },
  }, el('span', { class: 'dot', style: `--c: var(--t-${typeKey})` }), TYPE_KO[typeKey])));
}

// 2026-09-10 v2.47.0 결과 한 줄을 함수로 뺐다 — 헤더 검색 패널과 플래너의 [개체 추가] 창이
// 같은 줄을 쓴다. 두 곳에 같은 마크업을 따로 두면 한쪽만 고쳐지는 날이 온다.
//   pokemon  { sprite, name, types?, unrel? }
//   onclick  줄을 눌렀을 때
//   extras   이름 오른쪽에 덧붙일 것 (활용 뱃지 · 순위 등). 없으면 안 붙는다
function monSuggestRow(pokemon, onclick, ...extras) {
  return el('button', {
    class: `sugg__item${pokemon.unrel ? ' is-unreleased' : ''}`,
    onclick,
  }, sprite(pokemon.sprite),
    el('span', { class: 'sugg__main' },
      el('span', { class: 'sugg__name' }, nameNode(pokemon.name),  // 2026-09-06 v2.10.0 폼 라벨 뱃지
        pokemon.unrel ? el('span', { class: 'tag dex__unrel' }, '미구현') : ''),
      el('span', { class: 'sugg__meta' },
        ...(pokemon.types ?? []).map((typeName) => el('span', { class: 'dex__type', style: `--c: var(--t-${typeName})` },
          el('i', { class: 'dot', 'aria-hidden': 'true' }),
          el('b', {}, TYPE_KO[typeName] ?? typeName))),
        pokemon.sprite != null ? el('span', { class: 'dex__no sugg__no' }, `#${String(pokemon.sprite).padStart(4, '0')}`) : '')),
    ...extras,
    el('span', { class: 'sugg__go', 'aria-hidden': 'true' }, '›'));
}

function renderSearchResults() {
  const $input = document.getElementById('psearch');
  const $sugg = document.getElementById('psearch-sugg');
  $sugg.textContent = '';
  const { types: typedTypes, query } = parseSearchQuery($input.value);
  const types = activeSearchTypes(typedTypes);
  if (!query && !types.length) {
    $sugg.append(el('p', { class: 'sugg__hint' }, '예: "메타그로스" · 타입 칩 [물][풀] · 칩 [물] + "메가"'));  // v2.12.1 빈 상태 안내
    // 2026-09-07 v2.16.0 활용처 탭을 검색에 녹임 — 비어 있을 때 "어디서나 잘하는 포켓몬" 순위를 보여 준다 (views/usage.js)
    if (typeof usageTopNodes === 'function') $sugg.append(...usageTopNodes());
    return;
  }
  // 후보군: 타입이 있으면 그 조합의 포켓몬, 없으면 전체 색인
  const candidates = searchTypePool(types);
  // 2026-09-12 v3.9.0 먼저 **전부** 찾고 나서 여덟 줄을 자른다.
  // 전에는 monSearch(…, 8) 로 여덟 개만 받아 와 `"메타" 8마리` 처럼 잘린 수를 진짜 수인 양 적었다.
  // 색인은 수천 줄이라 전부 훑어도 한 번의 입력에서 티가 나지 않는다
  const found = query ? monSearch(candidates, query, Infinity) : candidates;
  const hits = found;   // 2026-09-12 v3.10.0 자를 이유가 없어졌다 — 여기서는 수만 적는다
  if (types.length) {
    const label = types.map((typeKey) => TYPE_KO[typeKey]).join('·');
    const key = types.join(',');
    if (key !== _searchTrackKey) { _searchTrackKey = key; track('search_type', { t: key }); }
    $sugg.append(el('div', { class: 'sugg__head' },
      el('b', {}, `${label} 타입 ${candidates.length}마리`),
      query ? el('span', {}, `중 "${query}" ${found.length}마리`) : '',
      searchAllChip(found.length),
      // v2.12.1 칩을 다 풀어 주는 지우기 — 글자로 친 타입은 입력창을 지우면 된다
      el('button', { class: 'row__why-more', onclick: () => { SEARCH_TYPES.length = 0; renderSearchTypeChips(); renderSearchResults(); } }, '타입 지우기')));
  } else {
    $sugg.append(el('div', { class: 'sugg__head' }, el('b', {}, `"${query}" ${found.length}마리`), searchAllChip(found.length)));
  }
  if (!hits.length) {
    $sugg.append(el('span', { class: 'sugg__none' }, types.length ? '이 타입 조합에 맞는 포켓몬이 없어요' : '검색 결과가 없어요'));
    if (query) track('search_none', { q: query.slice(0, 20), t: types.join(',') });  // 2026-09-06 v2.9.0 GA4: 못 찾은 검색어 — 별칭·표기 보강 근거
    return;
  }
  // 결과는 도감에서 본다. 여기서는 "몇 마리인지" 와 "보러 가기" 만 준다 —
  // 좁은 패널 안에 여덟 줄을 그려 봐야 나머지는 못 보고, 같은 목록을 두 곳에서 그릴 이유도 없다
  $sugg.append(el('button', { class: 'sugg__all-row', onclick: searchSubmit }, '포켓몬 도감에서 보기 ›'));
}

// 결과 머리의 [도감에서 보기] — 검색의 기본 행동이다 (입력칸에서 Enter 를 쳐도 같은 곳으로 간다).
// 한 마리도 없으면 데려갈 곳이 없으므로 만들지 않는다
function searchAllChip(total) {
  return total ? uchip('도감에서 보기', searchSubmit, { class: 'sugg__all' }) : '';
}

// 검색 패널 열기/닫기 (헤더 🔍 · 패널 ✕). 닫을 때 입력과 칩을 비워 다음에 깨끗하게 연다
function toggleSearchPanel(open) {
  const dialog = document.getElementById('search-dialog');
  if (!dialog) return;
  const willOpen = open ?? !dialog.open;
  if (!willOpen) { closeSearchDialog(); return; }
  closeDrawer({ silent: true });
  closeModal({ silent: true });
  document.querySelector('.search').hidden = false;
  if (!dialog.open) dialog.showModal();
  syncScrollLock();
  document.getElementById('search-toggle').setAttribute('aria-expanded', 'true');
  renderSearchResults();
  document.getElementById('psearch').focus();
  pushOverlayEntry();
}

function closeSearchDialog(silent = false) {
  const dialog = document.getElementById('search-dialog');
  if (!dialog?.open) return;
  dialog.close();
  document.getElementById('search-toggle').setAttribute('aria-expanded', 'false');
  syncScrollLock();
  if (!silent) releaseOverlayEntry(false);
}

// 헤더 검색창(#psearch)에 입력 → 후보 목록(#psearch-sugg) 갱신 동작을 붙인다
function initSearch() {
  const $input = document.getElementById('psearch');
  if (!$input) return;
  renderSearchTypeChips();
  $input.addEventListener('input', renderSearchResults);
  // 2026-09-12 v3.9.0 Enter = 도감으로. 검색창에서 Enter 는 "이 검색을 실행해라" 라는 오랜 약속인데
  // 여기서는 아무 일도 일어나지 않았다 (입력 이벤트로만 돌던 패널이라 칠 때마다 이미 갱신돼 있었다)
  $input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;   // 한글 조합 중의 Enter 는 글자를 확정하는 키다
    event.preventDefault();
    searchSubmit();
  });
  document.getElementById('psearch-close')?.addEventListener('click', () => toggleSearchPanel(false));
}
initSearch();
