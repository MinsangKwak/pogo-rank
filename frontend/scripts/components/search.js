// 2026-09-02 전역 포켓몬 검색: 이름 일부 입력 → 후보 선택 → 상세 팝업
// 검색 대상 = 모든 랭킹에 등장한 폼 포함 이름 + 도감(진화 계보)의 기본 종
let _searchIndex = null;
function buildSearchIndex() {
  if (_searchIndex) return _searchIndex;
  const byName = new Map();
  const add = (p) => { if (p?.name && p.sprite != null && !byName.has(p.name)) byName.set(p.name, { sprite: p.sprite, name: p.name, en: p.en ?? '', types: p.types ?? [] }); };
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') { if ('sprite' in v && 'name' in v) add(v); Object.values(v).forEach(walk); }
  };
  [typeof PVP_DATA !== 'undefined' && PVP_DATA, typeof PVE_DATA !== 'undefined' && PVE_DATA,
   typeof PVE_EASY !== 'undefined' && PVE_EASY, typeof DMAX_DATA !== 'undefined' && DMAX_DATA,
   typeof DMAX_TIER !== 'undefined' && DMAX_TIER, typeof SHEET_DATA !== 'undefined' && SHEET_DATA,
   typeof VALUE_DATA !== 'undefined' && VALUE_DATA,
   typeof BOSS_LIST !== 'undefined' && BOSS_LIST].forEach((d) => d && walk(d));  // 2026-09-03 빌드 보스 목록(메가·섀도우 1,586종)도 검색 대상
  for (const [d, name] of Object.entries(DEX_DATA.names ?? {})) {
    if (!byName.has(name)) byName.set(name, { sprite: +d, name, en: '', types: DEX_DATA.forms[d]?.types ?? [] });
  }
  _searchIndex = [...byName.values()];
  return _searchIndex;
}

// 2026-09-03 공용 검색 필터: 공백 무시·부분 일치·정확도순 정렬 (전역 검색·IF 탭 공유)
function monNorm(s) { return s.replace(/\s/g, '').toLowerCase(); }
function monSearch(list, q, limit = 8) {
  const n = monNorm(q);
  if (!n) return [];
  const hits = list.filter((p) => monNorm(p.name).includes(n) || (p.en && monNorm(p.en).includes(n)));
  hits.sort((a, b) => monNorm(a.name).indexOf(n) - monNorm(b.name).indexOf(n) || a.name.length - b.name.length);
  return hits.slice(0, limit);
}

function initSearch() {
  const $input = document.getElementById('psearch');
  const $sugg = document.getElementById('psearch-sugg');
  if (!$input) return;
  $input.addEventListener('input', () => {
    $sugg.textContent = '';
    if (!$input.value.trim()) return;
    const hits = monSearch(buildSearchIndex(), $input.value);  // 2026-09-03 공용 필터
    for (const p of hits) {
      $sugg.append(el('button', { class: 'sugg-item', onclick: () => { $input.value = ''; $sugg.textContent = ''; openDetail(p); } },
        sprite(p.sprite), el('span', {}, p.name)));
    }
    if (!hits.length) $sugg.append(el('span', { class: 'sugg-none' }, '검색 결과가 없어요'));
  });
}
initSearch();
