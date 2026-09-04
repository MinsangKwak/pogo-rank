// ─────────────────────────────────────────────────────────────────────────────
// PvE 탭 — '전체' 서브탭 (레이드 어태커 순위)
//
// PvE 탭은 서브탭이 둘이고, app.js의 renderPveTab이 state.pveMode로 갈라 준다.
//   · '일반' → views/tier.js의 renderPveEasy : 전설·환상·메가·섀도우를 뺀 "구하기 쉬운 개체"만,
//              전부 자체 계산이며 S/A/B/C 티어로 묶어 보여준다.
//   · '전체' → 이 파일의 renderPve : 제한 없이 전부. 외부 시트 데이터가 있으면 그것을 쓰고,
//              없으면 자체 계산 결과로 되돌아간다(폴백).
//
// 어떤 데이터를 읽나
//   - SHEET_DATA.pve[타입] : hawaii 「속성별 레이드 성능표」(구글 시트, 매일 00시 자동 수집).
//       한 항목이 DPS·TDO·ER·점수(score)·평가(tier)·기술 조합·이벤트 메모(note)를 갖는다.
//       시트는 "어태커의 기술 타입" 기준이라 노말 타입 항목이 없다 → 칩도 시트에 있는 속성만 만든다.
//       같은 포켓몬이 두 번 나올 수 있다 (기술 조합이 다른 항목).
//   - PVE_DATA[타입]       : 시트가 없을 때 쓰는 자체 계산 결과 (dps·tdo)
//   - state.boss           : 선택한 속성 칩 ('overall' = 전체)
//
// 제공하는 전역: gradeNode · eventLabel · renderPve (app.js의 renderPveTab이 호출)
// ─────────────────────────────────────────────────────────────────────────────

// "SAS" 같은 평가 등급을 글자별 색상으로 (DPS·TDO·종합 순)
// 등급 문자열을 한 글자씩 쪼개 각각 g-S / g-A … 클래스를 입힌다.
function gradeNode(tier) {
  return el('span', { class: 'grade' }, ...[...tier].map((letter) => el('b', { class: `g-${letter}` }, letter)));
}

// 이벤트 메모를 뱃지 문구로: "2026년 9월 5일 메가피날레" → "메가피날레(2026한정)"
// 정규식은 연도(필수) · 월(있으면) · 일(있으면) 을 걷어내고 남은 이름만 취한다.
// 형식이 다르면 매칭이 실패하니 원문(note)을 그대로 보여준다.
function eventLabel(note) {
  const matched = note.match(/^(\d{4})년\s*(?:\d+월\s*)?(?:\d+일\s*)?(.+)$/);
  return matched ? `${matched[2]}(${matched[1]}한정)` : note;
}

// PvE 탭: 시트 기반 속성별 레이드 성능 + 자체 계산 폴백
function renderPve() {
  const sheet = SHEET_DATA.pve ?? {};
  const hasSheet = Object.keys(sheet).length > 0;
  // 시트가 있으면 시트에 있는 속성만 칩으로 (시트는 어태커 기술 타입 기준, 노말은 없음). 전체는 자체 계산
  const typeKeys = hasSheet ? Object.keys(TYPE_KO).filter((typeKey) => Array.isArray(sheet[typeKey]) && sheet[typeKey].length) : Object.keys(TYPE_KO);
  // 시트에 없는 속성이 선택된 상태로 들어오면(칩 구성이 바뀐 경우) 첫 속성으로 되돌린다
  if (hasSheet && state.boss !== 'overall' && !typeKeys.includes(state.boss)) state.boss = typeKeys[0];
  const bossItems = [{ id: 'overall', label: '전체' }, ...typeKeys.map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  const bossChips = chips(bossItems, state.boss, (id) => {
    state.boss = id;
    render();
  });
  $controls.append(bossChips);
  // 선택한 속성에 시트 데이터가 실제로 있을 때만 시트를 쓴다. 아니면 자체 계산(PVE_DATA)으로.
  // 목록 key 뒤의 s/c는 시트(sheet)·자체계산(calc) 구분 — 모드가 바뀌면 더보기 상태를 따로 잡는다.
  const useSheet = hasSheet && Array.isArray(sheet[state.boss]) && sheet[state.boss].length > 0;
  const items = useSheet ? sheet[state.boss] : PVE_DATA[state.boss];
  const title = state.boss === 'overall' ? (useSheet ? '레이드 어태커 전체' : '레이드 어태커 전체 (자체 계산)') : `${TYPE_KO[state.boss]} 타입 레이드 성능`;
  $content.append(
    el('div', { class: 'list-head' }, el('h2', {}, title), el('span', { class: 'meta' }, useSheet ? '속성별 레이드 성능표 기준' : `자체 계산 · 상위 ${items.length}`)),
    list(`pve-${state.boss}-${useSheet ? 's' : 'c'}`, items, (pokemon, index) => useSheet
      // 시트 행: 순위는 시트가 준 rank를 우선하고, 점수 칸은 score가 없으면 평가 등급으로 대신한다.
      // 보조줄에는 등급 뱃지 + 있는 지표(ER·DPS·TDO)만 골라 이어 붙인다.
      ? row(pokemon, String(pokemon.rank ?? index + 1),
          el('span', { class: 'score' }, pokemon.score != null ? pokemon.score.toFixed(1) : (pokemon.tier || '')),
          el('span', { class: 'sub' },
            ...(pokemon.tier ? [gradeNode(pokemon.tier), ' · '] : []),
            [pokemon.er != null ? `ER ${pokemon.er.toFixed(1)}` : '', pokemon.dps != null ? `DPS ${pokemon.dps}` : '', pokemon.tdo != null ? `TDO ${Math.round(pokemon.tdo)}` : ''].filter(Boolean).join(' · ')),
          [pokemon.fast, pokemon.charged, state.boss === 'overall' && pokemon.type ? `${TYPE_KO[pokemon.type]} 타입` : ''],
          pokemon.note ? el('span', { class: 'tag' }, eventLabel(pokemon.note)) : null)
      // 자체 계산 행: DPS만 점수 칸에 쓰고 TDO는 보조줄로 내린다
      : row(pokemon, String(index + 1), el('span', { class: 'score' }, pokemon.dps.toFixed(1)), el('span', { class: 'sub' }, `DPS · TDO ${pokemon.tdo}`))),
  );
  // 시트 지표는 이름만 보면 뜻을 알기 어려워 아래에 용어 범례를 붙인다 (자체 계산에는 없는 지표들)
  if (useSheet) {
    $content.append(el('div', { class: 'legend' },
      ...[
        ['DPS', '매 초당 가하는 평균 피해량'],
        ['TDO', '쓰러질 때까지 가하는 누적 피해량'],
        ['ER', 'DPS와 TDO를 함께 반영한 종합 효율 지표'],
        ['점수', '종합(%) — 최강 어태커 대비 백분위'],
        ['평가', 'DPS·TDO·종합 순서의 등급, S > A > B > C (예: SAS)'],
        ['*', '레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득'],
      ].map(([term, meaning]) => el('span', { class: 'legend-item' }, el('b', {}, term), `: ${meaning}`))));
  }
  $note.textContent = useSheet
    ? '출처: hawaii 「속성별 레이드 성능표」(구글 시트, 매일 00시 자동 수집). 같은 포켓몬이 두 번 나오면 기술 조합이 다른 것. 포켓몬을 누르면 상세 정보가 열립니다.'
    : '자체 계산: 레벨 40, 개체값 15/15/15, 보스 방어 200·초당 피해 30 가정. 정렬은 DPS³×TDO 종합 점수 기준, 표시는 DPS. 포켓몬을 누르면 상세 정보가 열립니다.';
}
