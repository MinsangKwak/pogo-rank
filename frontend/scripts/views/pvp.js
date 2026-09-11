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
  // 2026-09-12 v2.63.0 🧬 개체값 순위를 그 옆에 붙였다 — 메뉴에 따로 두지 않는다.
  // "이 리그에서 뭐가 센가" 를 보다가 "그럼 내 개체는 몇 위지" 가 떠오르는 자리라,
  // 화면을 옮기지 않고 그 자리에서 펼치는 것이 맞다 (덱 짜기와 같은 문법)
  // 2026-09-12 v2.66.0 도구를 켜는 일이 곧 화면 이동이다 — 주소가 바뀌므로 뒤로가기로 랭킹에
  // 돌아오고, 링크를 보내면 상대도 같은 도구를 본다. 전에는 셋 다 #/pvp 한 주소였다
  const tool = (id) => () => {
    track(id === 'deck' ? 'tool_pvpdeck' : 'tool_ivrank', { on: state.pvpTool === id ? 0 : 1 });
    navigateHash(state.pvpTool === id ? routeHash('pvp') : routeHash(id === 'deck' ? 'pvp-deck' : 'ivrank'));
  };
  // 2026-09-12 v2.64.0 읽는 순서대로 놓는다. 이 화면에 온 사람은
  //   ① 리그를 고르고 → ② 타입으로 좁히고 → ③ 덱을 짜거나 내 개체 순위를 본다.
  // 전에는 도구 버튼이 리그 줄에 얹혀 있어, 리그를 고르기도 전에 "덱 짜기" 가 먼저 눈에 띄고
  // 좁은 화면에서는 그 줄이 두 줄로 접혀 타입 필터를 아래로 밀어냈다
  // 2026-09-12 v2.66.0 개체값 순위는 왼쪽(리그에 딸린 정보), 덱 짜기는 오른쪽(리그와 상관없는 다른 일).
  // 둘을 나란히 붙여 두니 "리그를 고른 다음 무엇을 볼까" 와 "이제 다른 걸 해 볼까" 가 한 덩이로 읽혔다
  const toolRow = el('div', { class: 'controls__row controls__row--tools' },
    toolButton('🧬 개체값 순위', state.pvpTool === 'ivrank', tool('ivrank')),
    toolButton('🃏 덱 짜기', state.pvpTool === 'deck', tool('deck')));
  $controls.append(el('div', { class: 'controls__row' }, leagueSeg));
  if (state.pvpTool === 'deck') { $controls.append(toolRow); return renderPvpDeck(); }
  // 페이지 렌더러가 돌려주는 본문을 그대로 얹는다 (#/ivrank 주소로도 같은 화면이 열린다)
  if (state.pvpTool === 'ivrank') { $controls.append(toolRow); $content.append(renderIvRankPage()); return; }
  const leagueRanking = PVP_DATA[state.league];
  // 이 리그 랭킹에 한 마리라도 있는 속성만 칩으로 만든다
  const presentTypes = new Set(leagueRanking.flatMap((pokemon) => pokemon.types));
  const typeItems = [{ id: 'all', label: '전체' }, ...Object.keys(TYPE_KO).filter((typeKey) => presentTypes.has(typeKey)).map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  const typeChips = chips(typeItems, state.pvpType, (id) => {
    state.pvpType = id;
    render();
  });
  $controls.append(typeChips, toolRow);

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
  $note.textContent = 'PvPoke 시뮬레이션 점수(100점 만점). 속성 필터 안의 순위는 그 속성 안에서의 순위라, 전체 순위를 옆에 같이 적어요.';
}
