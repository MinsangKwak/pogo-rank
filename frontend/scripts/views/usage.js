// ─────────────────────────────────────────────────────────────────────────────
// 활용처 — 2026-09-07 v2.16.0 부터 탭이 아니라 🔍 검색 패널 안에 녹였다
//
// 무엇을 보여주나
//   - 검색 패널을 열어 아직 아무것도 치지 않았을 때: "🏆 활용처 순위" — 여러 순위표에서 상위권인 포켓몬 목록.
//     한 마리가 PvP 리그·PvE 속성 보스·D-MAX 여러 곳에 동시에 이름을 올릴 수 있으므로,
//     그중 순위가 가장 높은 2곳만 줄에 요약한다. 누르면 상세 팝업(전체 활용처 섹션)이 열린다.
//   - 검색 후보 줄에는 "활용 N곳" 뱃지(row.js usageBadge)가 붙는다.
//   - 활용 점수 = Σ(31 − 순위) — 각 순위표 상위 30위 안에 든 것만 세므로, 1위면 30점씩 쌓인다.
//
// 어떤 데이터를 읽나
//   - VALUE_DATA.usage : 포켓몬별 { count, score, places[] } 목록.
//       places 한 건은 { place: '<종류>:<키>', rank } 꼴이고 종류는 pvp / pve / (그 외 = D-MAX)다.
//   - LEAGUE_KO · TYPE_KO : place 키를 한국어 이름으로 바꾸는 데 쓴다
//
// 제공하는 전역: placeLabel · usageTopNodes (components/search.js 가 빈 상태에서 부른다)
// ─────────────────────────────────────────────────────────────────────────────

// 활용처 한 곳을 "슈퍼리그 3위" 같은 노드로
// place는 '<종류>:<키>' 형태다. 종류가 pvp도 pve도 아니면 D-MAX 쪽으로 본다(마지막 분기).
function placeLabel({ place, rank }) {
  const [kind, key] = place.split(':');
  const where = kind === 'pvp' ? `${LEAGUE_KO[key]}리그`
    : kind === 'pve' ? (key === 'overall' ? '레이드 전체' : `${TYPE_KO[key]} 보스`)
    : (key === 'overall' ? '맥스 전체' : `${TYPE_KO[key]} 맥스`);
  return el('span', {}, `${where} `, el('b', {}, `${rank}위`));
}

// 검색 패널 빈 상태의 활용처 순위. 처음 shown 마리, [더보기]로 늘린다 (패널이 화면을 다 덮지 않게 8부터)
let _usageShown = 8;
function usageTopNodes() {
  const items = (typeof VALUE_DATA !== 'undefined' ? VALUE_DATA.usage : null) ?? [];
  if (!items.length) return [];
  const box = el('div', { class: 'search__results usage__top' });
  const draw = () => {
    box.replaceChildren(
      el('div', { class: 'sugg__head' }, el('b', {}, '🏆 활용처 순위'), el('span', {}, `여러 순위표에서 상위권 · ${items.length}종 · 각 표 상위 30 기준`)),
      ...items.slice(0, _usageShown).map((pokemon, index) => {
        const bestPlaces = [...pokemon.places].sort((first, second) => first.rank - second.rank).slice(0, 2);
        return el('button', { class: 'sugg__item usage__item', onclick: () => {
          track('usage_pick', { mon: pokemon.name, rank: index + 1 });
          openDetail(pokemon, false, 'usage');
        } },
          el('span', { class: 'usage__rank' }, String(index + 1)),
          sprite(pokemon.sprite), el('span', {}, nameNode(pokemon.name)),
          el('span', { class: 'sugg__rank' }, el('b', {}, `${pokemon.count}곳`), ' · ', ...bestPlaces.flatMap((place, placeIndex) => [placeLabel(place), placeIndex < bestPlaces.length - 1 ? ' · ' : ''])));
      }),
      _usageShown < items.length
        ? el('button', { class: 'sugg__more', onclick: () => { _usageShown += 16; draw(); } }, `더보기 (${Math.min(_usageShown, items.length)}/${items.length})`)
        : el('span', { class: 'sugg__hint' }, '활용 점수 = Σ(31 − 순위). 포켓몬을 누르면 전체 활용처가 열립니다'));
  };
  draw();
  return [box];
}
