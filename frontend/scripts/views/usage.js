// ─────────────────────────────────────────────────────────────────────────────
// 활용처 탭
//
// 무엇을 보여주나
//   - "이 포켓몬이 어느 순위표에서 상위권인가"를 한 줄로 모아 보여준다.
//     한 마리가 PvP 리그·PvE 속성 보스·D-MAX 여러 곳에 동시에 이름을 올릴 수 있으므로,
//     그중 순위가 가장 높은 3곳만 목록에 요약하고 나머지는 "외 N곳 →"으로 접어 둔다.
//   - 점수 칸은 이름을 올린 곳의 개수(count), 보조줄은 활용 점수(score)다.
//     활용 점수 = Σ(31 − 순위) — 각 순위표 상위 30위 안에 든 것만 세므로, 1위면 30점씩 쌓인다.
//     즉 "여러 곳에서 높은 순위일수록" 커지는 값이다.
//
// 어떤 데이터를 읽나
//   - VALUE_DATA.usage : 포켓몬별 { count, score, places[] } 목록.
//       places 한 건은 { place: '<종류>:<키>', rank } 꼴이고 종류는 pvp / pve / (그 외 = D-MAX)다.
//       예) 'pvp:great' → 슈퍼리그, 'pve:fire' → 불꽃 보스, 'max:overall' → 맥스 전체
//   - LEAGUE_KO · TYPE_KO : place 키를 한국어 이름으로 바꾸는 데 쓴다
//
// 제공하는 전역: placeLabel · renderUsage (app.js가 탭 렌더러로 호출)
// ─────────────────────────────────────────────────────────────────────────────

// 활용처 탭: 포켓몬 하나가 어디에서 상위권인지
// 목록에는 가장 잘하는 3곳만 요약하고, 전체 목록은 상세 팝업에서 그룹별로 보여준다

// 활용처 한 곳을 "슈퍼리그 3위" 같은 노드로
// place는 '<종류>:<키>' 형태다. 종류가 pvp도 pve도 아니면 D-MAX 쪽으로 본다(마지막 분기).
function placeLabel({ place, rank }) {
  const [kind, key] = place.split(':');
  const where = kind === 'pvp' ? `${LEAGUE_KO[key]}리그`
    : kind === 'pve' ? (key === 'overall' ? '레이드 전체' : `${TYPE_KO[key]} 보스`)
    : (key === 'overall' ? '맥스 전체' : `${TYPE_KO[key]} 맥스`);
  return el('span', {}, `${where} `, el('b', {}, `${rank}위`));
}

function renderUsage() {
  // 2026-09-03 '★ 보유만' 필터는 지금 단계에서 제외 (PvP 탭에는 유지)
  const items = VALUE_DATA.usage ?? [];
  $content.append(
    el('div', { class: 'list-head' }, el('h2', {}, '어디에 쓰이나'), el('span', { class: 'meta' }, `${items.length}종 · 각 순위표 상위 30 기준`)),
    list('value-usage', items, (pokemon, index) => {
      // 원본 places를 건드리지 않게 복사해서 순위 오름차순으로 정렬한 뒤 상위 3곳만 남긴다
      const bestPlaces = [...pokemon.places].sort((first, second) => first.rank - second.rank).slice(0, 3);
      const restCount = pokemon.places.length - bestPlaces.length;
      return row(
        pokemon, String(index + 1), el('span', { class: 'score' }, `${pokemon.count}곳`),
        el('span', { class: 'sub' }, `활용 점수 ${pokemon.score}`),
        // 남은 곳이 있으면 "외 N곳 →" — 행을 누르면 열리는 상세 팝업에서 전체를 볼 수 있다
        el('div', { class: 'places' }, ...bestPlaces.map(placeLabel),
          restCount > 0 ? el('span', { class: 'places-more' }, `외 ${restCount}곳 →`) : ''),
      );
    }),
  );
  $note.textContent = '순위표 상위 30위 안에 든 곳 중 가장 잘하는 3곳만 표시합니다. 포켓몬을 누르면 전체 활용처가 열립니다. 전설·메가·섀도우 포함, 활용 점수 = Σ(31 − 순위).';
}
