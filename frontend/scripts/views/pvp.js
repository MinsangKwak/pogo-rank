// PvP 탭: 리그별 PvPoke 랭킹 + 속성 필터
function renderPvp() {
  const leagueSeg = seg(LEAGUES.map((l) => ({ id: l.id, label: l.name })), state.league,
    (id) => { state.league = id; render(); });
  const all = PVP_DATA[state.league];
  const present = new Set(all.flatMap((p) => p.types));
  const typeItems = [{ id: 'all', label: '전체' }, ...Object.keys(TYPE_KO).filter((t) => present.has(t)).map((t) => ({ id: t, label: TYPE_KO[t], color: t }))];
  const typeChips = chips(typeItems, state.pvpType, (id) => { state.pvpType = id; render(); });
  $controls.append(leagueSeg, typeChips);

  const league = LEAGUES.find((l) => l.id === state.league);
  const items = state.pvpType === 'all' ? all : all.filter((p) => p.types.includes(state.pvpType));  // 2026-09-03 v2.2.0 보유만 필터 제거
  const title = state.pvpType === 'all' ? `${league.name}리그 전체 순위` : `${league.name}리그 · ${TYPE_KO[state.pvpType]} 타입`;
  $content.append(
    el('div', { class: 'list-head' }, el('h2', {}, title), el('span', { class: 'meta' }, `CP ${league.cp} · 상위 ${all.length} 기준`)),
    list(`pvp-${state.league}-${state.pvpType}`, items, (p, i) => row(
      p, String(i + 1), el('span', { class: 'score' }, p.score.toFixed(1)),
      state.pvpType === 'all' ? null : el('span', { class: 'sub' }, `전체 ${p.rank}위`),
    )),
  );
  $note.textContent = 'PvPoke 시뮬레이션 점수(100점 만점). 속성 필터 안의 순위는 해당 속성 내 순위이며 전체 순위를 함께 표시합니다.';
}
