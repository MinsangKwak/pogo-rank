// ─────────────────────────────────────────────────────────────────────────────
// PvP 탭
//
// 무엇을 보여주나
//   - 리그 세그먼트(리틀·슈퍼·하이퍼·마스터) + 속성 칩으로 걸러 본 PvPoke 랭킹.
//   - 점수는 PvPoke 시뮬레이션 결과(100점 만점)를 그대로 쓴다. 자체 계산이 아니다.
//   - 속성 칩을 고르면 그 속성만 남기고 다시 1위부터 번호를 붙이므로, 보조줄에
//     원래 전체 순위(rank)를 함께 적어 준다. '전체'일 때는 번호가 곧 전체 순위라 생략한다.
//   - 속성 칩은 그 리그 랭킹에 실제로 등장하는 속성만 만든다 (아무도 없는 칩을 없애기 위해).
//
// 어떤 데이터를 읽나
//   - PVP_DATA[리그id] : PvPoke 기준 랭킹 배열 (score · rank · types · 기술)
//   - LEAGUES (data.js) : 리그 목록과 CP 상한
//   - state.league(선택 리그) · state.pvpType(선택 속성, 'all' = 전체)
//
// 제공하는 전역: renderPvp (app.js가 탭 렌더러로 호출)
//   2026-09-07 v2.16.0 리그 세그먼트 오른쪽 🃏 PvP 덱 짜기 버튼(state.pvpTool) → views/ifsolo.js renderPvpDeck
// ─────────────────────────────────────────────────────────────────────────────

// PvP 탭: 리그별 PvPoke 랭킹 + 속성 필터
function renderPvp() {
  const leagueSeg = seg(LEAGUES.map((leagueOption) => ({ id: leagueOption.id, label: leagueOption.name })), state.league,
    (id) => {
      state.league = id;
      render();
    });
  // 2026-09-07 v2.16.0 오른쪽 도구 버튼: 🃏 PvP 덱 짜기 (옛 IF 탭). 리그는 위 세그먼트를 그대로 쓴다
  $controls.append(el('div', { class: 'controls__row' }, leagueSeg, toolButton('🃏 덱 짜기', state.pvpTool === 'deck', () => {
    state.pvpTool = state.pvpTool === 'deck' ? null : 'deck';
    track('tool_pvpdeck', { on: state.pvpTool ? 1 : 0 });
    render();
  })));
  if (state.pvpTool === 'deck') return renderPvpDeck();
  const leagueRanking = PVP_DATA[state.league];
  // 이 리그 랭킹에 한 마리라도 있는 속성만 칩으로 만든다
  const presentTypes = new Set(leagueRanking.flatMap((pokemon) => pokemon.types));
  const typeItems = [{ id: 'all', label: '전체' }, ...Object.keys(TYPE_KO).filter((typeKey) => presentTypes.has(typeKey)).map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  const typeChips = chips(typeItems, state.pvpType, (id) => {
    state.pvpType = id;
    render();
  });
  $controls.append(typeChips);

  const league = LEAGUES.find((leagueOption) => leagueOption.id === state.league);
  const items = state.pvpType === 'all' ? leagueRanking : leagueRanking.filter((pokemon) => pokemon.types.includes(state.pvpType));  // 2026-09-03 v2.2.0 보유만 필터 제거
  const title = state.pvpType === 'all' ? `${league.name}리그 전체 순위` : `${league.name}리그 · ${TYPE_KO[state.pvpType]} 타입`;
  $content.append(
    el('div', { class: 'row-head' }, el('h2', {}, title), el('span', { class: 'meta' }, `CP ${league.cp} · 상위 ${leagueRanking.length} 기준`)),
    // 속성으로 걸렀을 때만 보조줄에 원래 전체 순위를 덧붙인다 (앞 번호는 속성 내 순위이므로)
    list(`pvp-${state.league}-${state.pvpType}`, items, (pokemon, index) => row(
      pokemon, String(index + 1), el('span', { class: 'row__score' }, pokemon.score.toFixed(1)),
      state.pvpType === 'all' ? null : el('span', { class: 'row__sub' }, `전체 ${pokemon.rank}위`),
    )),
  );
  $note.textContent = 'PvPoke 시뮬레이션 점수(100점 만점). 속성 필터 안의 순위는 해당 속성 내 순위이며 전체 순위를 함께 표시합니다.';
}
