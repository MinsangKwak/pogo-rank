// ─────────────────────────────────────────────────────────────────────────────
// components/search.js — 헤더의 전역 포켓몬 검색과, 여러 화면이 공유하는 검색 필터
//
// 제공하는 전역
//   buildSearchIndex()             검색 대상 목록을 만들어 캐시해 두고 돌려준다
//   monNorm(text)                  검색용 정규화 (공백 제거 + 소문자)
//   monSearch(candidates, query, limit)  후보 목록에서 이름으로 걸러 정확도순으로 돌려준다
//   initSearch()                   헤더 검색창에 동작을 붙인다 (파일 끝에서 바로 한 번 실행)
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

// 2026-09-06 v2.9.0 검색 후보 옆 "어디 몇 위" 한 줄 — 즐겨찾기 페이지와 같은 근거(ROLES).
// 폼 단위 키('도감번호|폼라벨')를 먼저 보고, 없으면 종 단위 최고 순위(autoRoleOf)로 되돌아간다
function searchRankText(spriteId) {
  if (typeof ROLES === 'undefined' || !ROLES || typeof roleWhereLabel !== 'function') return '';
  const dex = dexOf(spriteId);
  if (dex == null) return '';
  const label = DEX_DATA.forms?.[spriteId]?.name ?? '';
  const formKey = `${dex}|${label}`;
  const pve = ROLES.pve?.[formKey] ?? ROLES.dexPve?.[String(dex)] ?? null;
  const pvp = ROLES.pvp?.[formKey] ?? ROLES.dexPvp?.[String(dex)] ?? null;
  const parts = [];
  if (pve) parts.push(`${roleWhereLabel('pve', pve[0])} ${pve[1]}위`);
  if (pvp) parts.push(`${roleWhereLabel('pvp', pvp[0])} ${pvp[1]}위`);
  return parts.join(' · ');
}

// ── 2026-09-06 v2.12.0 전역 검색 = 이름 + 타입 ────────────────────────────────
// 상성 검색 페이지의 "타입 칩 → 그 조합의 포켓몬" 이 쓸 만해서 헤더 검색에도 붙였다. 한 입력창으로 셋을 처리한다.
//   (1) 이름:            "메타그로스"          → 지금까지처럼 이름 후보
//   (2) 타입:            칩 [물][풀] 또는 "물 풀" → 그 조합의 포켓몬 목록 (typesearch.js typeMonList)
//   (3) 이름 + 타입:     칩 [물] + "메가"        → 물 타입 중 이름에 '메가'가 든 것
// 타입은 칩으로 골라도 되고 글자로 쳐도 된다 — "물 풀", "물·풀", "물타입" 전부 같다. 최대 2개.
// 타입만 고른 목록은 12마리까지 보여 주고, 전부 보려면 "상성 검색 ▸" 로 넘긴다.

const SEARCH_TYPES = [];          // 칩으로 고른 타입 (최대 2)
let _searchTrackKey = '';         // 같은 타입 조합을 입력할 때마다 GA 를 찍지 않기 위한 마지막 기록

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
    class: 'chip', 'aria-pressed': String(SEARCH_TYPES.includes(typeKey)),
    onclick: () => {
      const index = SEARCH_TYPES.indexOf(typeKey);
      if (index >= 0) SEARCH_TYPES.splice(index, 1);
      else { SEARCH_TYPES.push(typeKey); if (SEARCH_TYPES.length > 2) SEARCH_TYPES.shift(); }
      renderSearchTypeChips();
      renderSearchResults();
    },
  }, el('span', { class: 'dot', style: `--c: var(--t-${typeKey})` }), TYPE_KO[typeKey])));
}

function renderSearchResults() {
  const $input = document.getElementById('psearch');
  const $sugg = document.getElementById('psearch-sugg');
  $sugg.textContent = '';
  const { types: typedTypes, query } = parseSearchQuery($input.value);
  const types = activeSearchTypes(typedTypes);
  if (!query && !types.length) return;
  // 후보군: 타입이 있으면 그 조합의 포켓몬(출시 → 미출시, 도감번호순), 없으면 전체 색인
  const candidates = types.length && typeof typeMonList === 'function' ? typeMonList(types) : buildSearchIndex();
  const hits = query ? monSearch(candidates, query, 8) : candidates.slice(0, 12);
  if (types.length) {
    const label = types.map((typeKey) => TYPE_KO[typeKey]).join('·');
    const key = types.join(',');
    if (key !== _searchTrackKey) { _searchTrackKey = key; track('search_type', { t: key }); }
    $sugg.append(el('div', { class: 'sugg-head' },
      el('b', {}, `${label} 타입 ${candidates.length}마리`),
      query ? el('span', {}, `중 "${query}"`) : '',
      el('button', { class: 'row-why-more', onclick: () => { openTypeSearch(types, null, 'search'); } }, '상성 검색에서 전부 보기 ▸')));
  }
  for (const pokemon of hits) {
    // 후보를 고르면 검색창과 목록을 함께 비우고 상세 팝업을 띄운다
    // (팝업 뒤에 후보 목록이 남아 있으면 닫았을 때 지저분해 보인다)
    $sugg.append(el('button', {
      class: `sugg-item${pokemon.unrel ? ' unrel' : ''}`,
      onclick: () => {
        track('search_pick', { mon: pokemon.name, t: types.join(',') });  // 2026-09-06 v2.9.0 GA4: 검색으로 고른 포켓몬 · v2.12.0 t: 타입 필터
        $input.value = '';
        $sugg.textContent = '';
        openDetail(pokemon, false, 'search');
      },
    }, sprite(pokemon.sprite), el('span', {}, nameNode(pokemon.name)),  // 2026-09-06 v2.10.0 폼 라벨 뱃지
      pokemon.unrel ? el('span', { class: 'tag dex-unrel' }, '미구현') : '',
      (() => { const rank = searchRankText(pokemon.sprite); return rank ? el('span', { class: 'sugg-rank' }, rank) : ''; })()));
  }
  if (!hits.length) {
    $sugg.append(el('span', { class: 'sugg-none' }, types.length ? '이 타입 조합에 맞는 포켓몬이 없어요' : '검색 결과가 없어요'));
    if (query) track('search_none', { q: query.slice(0, 20), t: types.join(',') });  // 2026-09-06 v2.9.0 GA4: 못 찾은 검색어 — 별칭·표기 보강 근거
  }
}

// 헤더 검색창(#psearch)에 입력 → 후보 목록(#psearch-sugg) 갱신 동작을 붙인다
function initSearch() {
  const $input = document.getElementById('psearch');
  if (!$input) return;
  renderSearchTypeChips();
  $input.addEventListener('input', renderSearchResults);
}
initSearch();
