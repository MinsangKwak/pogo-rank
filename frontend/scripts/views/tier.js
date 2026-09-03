// PvP 일반 · PvE 일반: 전설·환상·울트라비스트·메가·섀도우를 뺀 일반 개체 티어표
const TIER_ORDER = ['S', 'A', 'B', 'C'];

function renderTierList(items, toRow) {
  for (const t of TIER_ORDER) {
    const group = items.filter((p) => p.tier === t);
    if (!group.length) continue;
    $content.append(el('div', { class: 'tier-head' },
      el('b', { class: `tier-badge g-${t}` }, t),
      el('span', { class: 'meta' }, `${group.length}종`)));
    const ul = el('ul', { class: 'rows' });
    group.forEach((p, i) => ul.append(toRow(p, i)));
    $content.append(ul);
  }
}

// PvE 일반: PvE 전체와 같은 속성 칩 구성, 속성별 일반 개체 티어표 (자체 계산)
function renderPveEasy() {
  const bossItems = [{ id: 'overall', label: '전체' }, ...Object.keys(TYPE_KO).map((t) => ({ id: t, label: TYPE_KO[t], color: t }))];
  const bossChips = chips(bossItems, state.easyBoss, (id) => { state.easyBoss = id; render(); });
  $controls.append(bossChips);
  const items = PVE_EASY[state.easyBoss] ?? [];
  const title = state.easyBoss === 'overall' ? '레이드 일반 티어표 (전체)' : `${TYPE_KO[state.easyBoss]} 타입 일반 티어표`;
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, title),
    el('span', { class: 'meta' }, `${items.length}종 · 전설·환상·메가·섀도우 제외`)));
  renderTierList(items, (p, i) => row(
    p, String(i + 1),
    el('span', { class: 'score' }, `${p.ratio}점`),
    el('span', { class: 'sub' }, `DPS ${p.dps} · TDO ${p.tdo}`)));
  $note.textContent = '구하기 쉬운 일반 개체만 모은 레이드 티어표 (자체 계산). 속성 탭은 그 속성 포켓몬만 표시. 점수는 같은 속성 최강 어태커(전설·메가 포함) 대비 %, 티어는 목록 안 상대 등급. 포켓몬을 누르면 상세 정보가 열립니다.';
}
