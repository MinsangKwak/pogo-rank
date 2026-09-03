// "SAS" 같은 평가 등급을 글자별 색상으로 (DPS·TDO·종합 순)
function gradeNode(tier) {
  return el('span', { class: 'grade' }, ...[...tier].map((ch) => el('b', { class: `g-${ch}` }, ch)));
}

// 이벤트 메모를 뱃지 문구로: "2026년 9월 5일 메가피날레" → "메가피날레(2026한정)"
function eventLabel(note) {
  const m = note.match(/^(\d{4})년\s*(?:\d+월\s*)?(?:\d+일\s*)?(.+)$/);
  return m ? `${m[2]}(${m[1]}한정)` : note;
}

// PvE 탭: 시트 기반 속성별 레이드 성능 + 자체 계산 폴백
function renderPve() {
  const sheet = SHEET_DATA.pve ?? {};
  const hasSheet = Object.keys(sheet).length > 0;
  // 시트가 있으면 시트에 있는 속성만 칩으로 (시트는 어태커 기술 타입 기준, 노말은 없음). 전체는 자체 계산
  const typeKeys = hasSheet ? Object.keys(TYPE_KO).filter((t) => Array.isArray(sheet[t]) && sheet[t].length) : Object.keys(TYPE_KO);
  if (hasSheet && state.boss !== 'overall' && !typeKeys.includes(state.boss)) state.boss = typeKeys[0];
  const bossItems = [{ id: 'overall', label: '전체' }, ...typeKeys.map((t) => ({ id: t, label: TYPE_KO[t], color: t }))];
  const bossChips = chips(bossItems, state.boss, (id) => { state.boss = id; render(); });
  $controls.append(bossChips);
  const useSheet = hasSheet && Array.isArray(sheet[state.boss]) && sheet[state.boss].length > 0;
  const items = useSheet ? sheet[state.boss] : PVE_DATA[state.boss];
  const title = state.boss === 'overall' ? (useSheet ? '레이드 어태커 전체' : '레이드 어태커 전체 (자체 계산)') : `${TYPE_KO[state.boss]} 타입 레이드 성능`;
  $content.append(
    el('div', { class: 'list-head' }, el('h2', {}, title), el('span', { class: 'meta' }, useSheet ? '속성별 레이드 성능표 기준' : `자체 계산 · 상위 ${items.length}`)),
    list(`pve-${state.boss}-${useSheet ? 's' : 'c'}`, items, (p, i) => useSheet
      ? row(p, String(p.rank ?? i + 1),
          el('span', { class: 'score' }, p.score != null ? p.score.toFixed(1) : (p.tier || '')),
          el('span', { class: 'sub' },
            ...(p.tier ? [gradeNode(p.tier), ' · '] : []),
            [p.er != null ? `ER ${p.er.toFixed(1)}` : '', p.dps != null ? `DPS ${p.dps}` : '', p.tdo != null ? `TDO ${Math.round(p.tdo)}` : ''].filter(Boolean).join(' · ')),
          [p.fast, p.charged, state.boss === 'overall' && p.type ? `${TYPE_KO[p.type]} 타입` : ''],
          p.note ? el('span', { class: 'tag' }, eventLabel(p.note)) : null)
      : row(p, String(i + 1), el('span', { class: 'score' }, p.dps.toFixed(1)), el('span', { class: 'sub' }, `DPS · TDO ${p.tdo}`))),
  );
  if (useSheet) {
    $content.append(el('div', { class: 'legend' },
      ...[
        ['DPS', '매 초당 가하는 평균 피해량'],
        ['TDO', '쓰러질 때까지 가하는 누적 피해량'],
        ['ER', 'DPS와 TDO를 함께 반영한 종합 효율 지표'],
        ['점수', '종합(%) — 최강 어태커 대비 백분위'],
        ['평가', 'DPS·TDO·종합 순서의 등급, S > A > B > C (예: SAS)'],
        ['*', '레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득'],
      ].map(([k, v]) => el('span', { class: 'legend-item' }, el('b', {}, k), `: ${v}`))));
  }
  $note.textContent = useSheet
    ? '출처: hawaii 「속성별 레이드 성능표」(구글 시트, 매일 00시 자동 수집). 같은 포켓몬이 두 번 나오면 기술 조합이 다른 것. 포켓몬을 누르면 상세 정보가 열립니다.'
    : '자체 계산: 레벨 40, 개체값 15/15/15, 보스 방어 200·초당 피해 30 가정. 정렬은 DPS³×TDO 종합 점수 기준, 표시는 DPS. 포켓몬을 누르면 상세 정보가 열립니다.';
}
