// ─────────────────────────────────────────────────────────────────────────────
// components/search.js — 헤더의 전역 포켓몬 검색과, 여러 화면이 공유하는 검색 필터
//
// 제공하는 전역
//   buildSearchIndex()             검색 대상 목록을 만들어 캐시해 두고 돌려준다
//   monNorm(text)                  검색용 정규화 (공백 제거 + 소문자)
//   monSearch(candidates, query, limit)  후보 목록에서 이름으로 걸러 정확도순으로 돌려준다
//   searchTypePool(types)          검색 색인에서 그 타입 조합만 골라 돌려준다
//   openSearch(query)              포켓몬 도감으로 가서 검색 칸을 잡는다 (🔍 · 상단 칸 · `/` 가 부른다)
//   monSuggestRow(mon, onclick, …) 결과 한 줄 (개체값 순위 · 플래너 개체 추가가 쓴다)
//   parseSearchQuery(text)         검색어에서 타입 낱말을 떼어 낸다
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

// ── 2026-09-06 v2.12.0 검색 = 이름 + 타입 ─────────────────────────────────────
// 한 입력칸으로 셋을 처리한다.
//   (1) 이름:            "메타그로스"            → 이름으로
//   (2) 타입:            칩 [물][풀] 또는 "물 풀"  → 그 조합의 포켓몬 (searchTypePool)
//   (3) 이름 + 타입:     칩 [물] + "메가"         → 물 타입 중 이름에 '메가'가 든 것
// 타입은 칩으로 골라도 되고 글자로 쳐도 된다 — "물 풀", "물·풀", "물타입" 전부 같다. 최대 2개.
// 2026-09-12 v3.12.0 칩은 도감 화면이 들고 있다 (components/pages.js) — 입력칸 옆에 있어야
// "무엇을 걸러 이 목록이 나왔는지" 가 한 자리에서 읽힌다.

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

// 2026-09-10 v2.47.0 결과 한 줄 — 개체값 순위(components/ivrank.js)와 플래너의 [개체 추가]
// (planner/collection.js)가 같은 줄을 쓴다. 두 곳에 같은 마크업을 따로 두면 한쪽만 고쳐지는 날이 온다.
// (헤더 검색 패널도 이 줄을 썼지만 v3.12.0 에 패널 자체를 걷어냈다 — 검색은 도감에서 한다)
//   pokemon  { sprite, name, types?, unrel? }
//   onclick  줄을 눌렀을 때
//   extras   이름 오른쪽에 덧붙일 것. 없으면 안 붙는다
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

// 2026-09-12 v3.12.0 전역 검색의 유일한 행동 — **포켓몬 도감으로 간다**.
// 팝업에서 결과를 보여 주던 시절에는 같은 목록을 두 곳에서 그렸고, 팝업에 뜬 여덟 줄이
// "결과" 로 보여 정작 전부가 있는 도감까지 가지 않았다. 이제 입구는 셋(🔍 · 상단 칸 · `/`)이지만
// 도착지는 하나다. 이미 도감에 있으면 화면을 다시 그리지 않고 입력칸만 잡는다.
//   query   미리 채워 둘 검색어 (없으면 지금 도감에 있는 값을 그대로 둔다)
function openSearch(query) {
  track('search_open', { from: currentPageId() ?? 'shell' });
  const focusBox = () => {
    const box = document.getElementById('dex-search');
    if (!box) return false;
    box.focus();
    box.select?.();
    return true;
  };
  if (typeof query === 'string' && query) {
    navigateHash(`#/dex?q=${encodeURIComponent(query)}`);
  } else if (currentPageId() !== 'dex') {
    navigateHash('#/dex');
  } else {
    return focusBox();   // 이미 도감이다 — 다시 그리면 치던 글자가 날아간다
  }
  // 화면이 새로 그려진 **뒤에** 잡아야 한다. renderPage 는 hashchange 로 돌므로 한 박자 뒤다
  setTimeout(focusBox, 60);
  return true;
}
