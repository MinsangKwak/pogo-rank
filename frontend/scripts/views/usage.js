// 활용처 탭: 포켓몬 하나가 어디에서 상위권인지
// 목록에는 가장 잘하는 3곳만 요약하고, 전체 목록은 상세 팝업에서 그룹별로 보여준다

// 활용처 한 곳을 "슈퍼리그 3위" 같은 노드로
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
    list('value-usage', items, (p, i) => {
      const best = [...p.places].sort((a, b) => a.rank - b.rank).slice(0, 3);
      const rest = p.places.length - best.length;
      return row(
        p, String(i + 1), el('span', { class: 'score' }, `${p.count}곳`),
        el('span', { class: 'sub' }, `활용 점수 ${p.score}`),
        el('div', { class: 'places' }, ...best.map(placeLabel),
          rest > 0 ? el('span', { class: 'places-more' }, `외 ${rest}곳 →`) : ''),
      );
    }),
  );
  $note.textContent = '순위표 상위 30위 안에 든 곳 중 가장 잘하는 3곳만 표시합니다. 포켓몬을 누르면 전체 활용처가 열립니다. 전설·메가·섀도우 포함, 활용 점수 = Σ(31 − 순위).';
}