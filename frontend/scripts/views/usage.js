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
// 제공하는 전역: placeLabel · usageTopNodes (2026-09-12 v3.12.0 부터 서비스 홈이 부른다)
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

// 활용처 순위. 홈의 한 구역이라 처음 여섯 마리만 — 그 아래 기능 타일을 밀어내지 않는 선이다 (v3.21.0)
let _usageShown = 6;
function usageTopNodes() {
  const items = (typeof VALUE_DATA !== 'undefined' ? VALUE_DATA.usage : null) ?? [];
  if (!items.length) return [];
  const box = el('div', { class: 'search__results usage__top' });
  const draw = () => {
    box.replaceChildren(
      // 2026-09-13 v3.21.0 제목을 "무엇인지" 로 바꿨다 — '활용처 순위' 는 이 서비스 안에서만 통하는 말이라
      // 처음 온 사람에게는 무슨 값인지 읽히지 않았다. 산식(Σ(31 − 순위))도 홈에서 설명할 값이 아니다
      el('div', { class: 'sugg__head' },
        el('b', {}, '🏆 두루 쓰이는 포켓몬'),
        el('span', {}, `하나 키우면 여러 곳에서 써요 · ${items.length}종`)),
      ...items.slice(0, _usageShown).map((pokemon, index) => {
        const bestPlaces = [...pokemon.places].sort((first, second) => first.rank - second.rank).slice(0, 2);
        return el('button', { class: 'sugg__item usage__item', onclick: () => {
          track('usage_pick', { mon: pokemon.name, rank: index + 1 });
          openDetail(pokemon, false, 'usage');
        } },
          el('span', { class: 'usage__rank' }, String(index + 1)),
          sprite(pokemon.sprite),
          // 2026-09-13 v3.21.0 이름과 활용처를 **두 줄**로 가른다 — 한 줄에 몰아 두니 좁은 화면에서
          // "격투 맥스 2위" 같은 꼬리가 제멋대로 접혔다. 이름이 먼저 읽히고 근거가 그 아래 붙는다
          el('span', { class: 'usage__body' },
            el('span', { class: 'usage__name' }, nameNode(pokemon.name)),
            el('span', { class: 'usage__where' }, ...bestPlaces.flatMap((place, placeIndex) => [placeLabel(place), placeIndex < bestPlaces.length - 1 ? ' · ' : '']))),
          el('span', { class: 'usage__count' }, `${pokemon.count}곳`));
      }),
      _usageShown < items.length
        ? el('button', { class: 'sugg__more', onclick: () => { _usageShown += 12; draw(); } }, `더보기 (${Math.min(_usageShown, items.length)}/${items.length})`)
        : el('span', { class: 'sugg__hint' }, '포켓몬을 누르면 어디에 쓰이는지 전부 볼 수 있어요'));
  };
  draw();
  return [box];
}
