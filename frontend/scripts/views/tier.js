// ─────────────────────────────────────────────────────────────────────────────
// 티어표 공통 렌더러 + PvE '일반' 서브탭
//
// 1) renderTierList — 항목의 tier 값(S/A/B/C)으로 묶어 그리는 공통 함수.
//    D-MAX 티어표(views/max.js)와 PvE 일반 티어표가 함께 쓴다.
//    티어 경계: S > A > B > C 네 단계이며 순서는 TIER_ORDER가 정한다.
//    티어 등급은 절대 기준이 아니라 "그 목록 안에서의 상대 등급"이다 — 같은 포켓몬도
//    어떤 목록에 들어가느냐에 따라 등급이 달라질 수 있다. 빈 티어는 머리글까지 건너뛴다.
//
// 2) renderPveEasy — PvE 탭의 '일반' 서브탭.
//    '전체'(views/pve.js)와의 차이:
//      · 전체 : 제한 없음. 외부 시트(hawaii 속성별 레이드 성능표)가 있으면 시트 기준,
//               없으면 자체 계산으로 폴백. 순위 목록 형태.
//      · 일반 : 전설·환상·울트라비스트·메가·섀도우를 뺀, 누구나 구하기 쉬운 개체만.
//               전부 자체 계산이고 S/A/B/C 티어로 묶어 보여준다.
//    점수(ratio)는 같은 속성 최강 어태커(전설·메가 포함) 대비 %라서,
//    "일반 개체만 모았는데도 최강 대비 몇 %인지"를 알 수 있다.
//
// 어떤 데이터를 읽나: PVE_EASY[타입] (자체 계산 · ratio/dps/tdo/tier), TYPE_KO, state.easyBoss
// 제공하는 전역: TIER_ORDER · renderTierList (max.js도 사용) · renderPveEasy (app.js 호출)
// ─────────────────────────────────────────────────────────────────────────────

// PvP 일반 · PvE 일반: 전설·환상·울트라비스트·메가·섀도우를 뺀 일반 개체 티어표
const TIER_ORDER = ['S', 'A', 'B', 'C'];

// items를 티어별로 묶어 $content에 붙인다.
// toRow(pokemon, index)는 호출한 쪽이 넘기는 행 생성 함수이고, index는 "그 티어 그룹 안의 번호"다.
// (전체 목록 통산 순위가 아니라 그룹 내 순번이라는 점에 주의)
function renderTierList(items, toRow) {
  for (const tier of TIER_ORDER) {
    const group = items.filter((pokemon) => pokemon.tier === tier);
    if (!group.length) continue;  // 그 티어에 아무도 없으면 머리글도 만들지 않는다
    $content.append(el('div', { class: 'tier-head' },
      el('b', { class: `tier-badge g-${tier}` }, tier),
      el('span', { class: 'meta' }, `${group.length}종`)));
    const rowsList = el('ul', { class: 'rows' });
    group.forEach((pokemon, index) => rowsList.append(toRow(pokemon, index)));
    $content.append(rowsList);
  }
}

// PvE 일반: PvE 전체와 같은 속성 칩 구성, 속성별 일반 개체 티어표 (자체 계산)
function renderPveEasy() {
  // 칩 구성은 '전체' 서브탭과 달리 시트 여부를 보지 않고 항상 18타입 전부를 만든다
  const bossItems = [{ id: 'overall', label: '전체' }, ...Object.keys(TYPE_KO).map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  const bossChips = chips(bossItems, state.easyBoss, (id) => {
    state.easyBoss = id;
    render();
  });
  $controls.append(bossChips);
  const items = PVE_EASY[state.easyBoss] ?? [];
  const title = state.easyBoss === 'overall' ? '레이드 일반 티어표 (전체)' : `${TYPE_KO[state.easyBoss]} 타입 일반 티어표`;
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, title),
    el('span', { class: 'meta' }, `${items.length}종 · 전설·환상·메가·섀도우 제외`)));
  // 점수 칸의 ratio는 같은 속성 최강 어태커(전설·메가 포함) 대비 % 값이다
  renderTierList(items, (pokemon, index) => row(
    pokemon, String(index + 1),
    el('span', { class: 'score' }, `${pokemon.ratio}점`),
    el('span', { class: 'sub' }, `DPS ${pokemon.dps} · TDO ${pokemon.tdo}`)));
  $note.textContent = '구하기 쉬운 일반 개체만 모은 레이드 티어표 (자체 계산). 속성 탭은 그 속성 포켓몬만 표시. 점수는 같은 속성 최강 어태커(전설·메가 포함) 대비 %, 티어는 목록 안 상대 등급. 포켓몬을 누르면 상세 정보가 열립니다.';
}
