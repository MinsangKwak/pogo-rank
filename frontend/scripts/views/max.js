// ─────────────────────────────────────────────────────────────────────────────
// D-MAX 탭
//
// 화면 구성 (위 → 아래) — 2026-09-07 v2.14.0 (QA-52) [전체 | 딜러 | 탱커] 세그먼트 + 하위 메뉴(속성 칩) 구조
//   1) 이번 주 보스 아코디언 (#boss-acc) — 탭 컨트롤 위에 붙는다. 일정표에서 이번 주 D-MAX
//      보스를 찾아, 그 보스 속성을 상대할 추천 딜러를 딜량순으로 5개씩 "더보기" 하며 보여준다.
//   2) [전체 | 딜러 | 탱커] 세그먼트 (state.maxAxis)
//   3) 하위 메뉴: 라벨(맥스무브 속성 / 보스 속성) + 속성 칩 (전체 + 18타입, state.maxBoss)
//   4) 축별 표 하나
//      전체 → D-MAX 티어표. 칩이 '전체'가 아니면 "그 타입 맥스무브를 쓰는 딜러"만 모은 표다.
//             즉 포켓몬의 자체 속성이 아니라 charged(맥스무브) 속성 기준으로 묶인다.
//             행을 누르면 그 아래로 "선정 근거"(점수 분해 + 1위 대비 %) 가 펼쳐진다.
//      딜러 → 그 속성 보스를 상대할 맥스 어태커 순위 — 티어표와 달리 상성·내구를 반영한다.
//      탱커 → 그 속성 보스 앞에서 오래 버티는 순위 (EHP).
//
// 어떤 데이터를 읽나
//   - DMAX_TIER[타입] : 티어표용 목록. pogomate와 같은 기준으로 계산된 score/tier를 갖는다.
//                       (공격 종족값 × 맥스무브 위력 × 자속 보정, 내구 미반영)
//   - DMAX_DATA[타입] : 그 속성 보스를 상대할 때 강한 맥스 어태커 목록 (맥스 피해 dmg·내구 bulk 포함)
//   - DMAX_TANK[타입] : 그 속성 보스 앞에서 오래 버티는 탱커 목록 (EHP·받는 배율 mult) — v2.13.0 QA-43, [탱커] 세그먼트·파티 카드
//   - SCHEDULE_ITEMS / SCHEDULE_YM (components/schedule.js) : 이번 주 D-MAX 보스 주차를 찾는 데 쓴다
//   - TYPE_KO, state.maxBoss(선택한 속성 칩), state.bossShow(추천 딜러 표시 개수)
//
// 제공하는 전역: maxRow · tankRow · whyText · tierRowNode · expandableRow · bossRecNodes · partyCardNode ·
//                MAX_AXES · maxSubmenu · renderBossAcc · renderMaxTier · renderMaxDealer · renderMaxTank · renderMax (app.js가 탭 렌더러로 호출)
// ※ 티어별로 묶어 그리는 renderTierList는 views/tier.js에 있다.
// ─────────────────────────────────────────────────────────────────────────────

// 다이맥스 탭: 위에는 그 속성 다이맥스 포켓몬 티어표, 아래에 보스 상대 맥스 어태커

// 하단 "보스 상대 맥스 어태커" 한 행: 점수 칸에 맥스 피해(dmg), 보조줄에 내구(bulk)를 적는다.
function maxRow(pokemon, rankText) {
  return row(
    pokemon, rankText, el('span', { class: 'row__score' }, String(pokemon.dmg)),
    el('span', { class: 'row__sub' }, `맥스 피해 · 내구 ${pokemon.bulk}`),
    [pokemon.fast, `${TYPE_KO[pokemon.charged]} 타입`],
    // 2026-09-06 v2.10.0 (QA-44) G-MAX/D-MAX 뱃지 제거 — 이름 자체가 '거다이맥스 X'/'다이맥스 X' 가 되어 폼 라벨 뱃지로 보인다
  );
}

// 2026-09-02 티어 근거 인라인 펼침 행 (1B) — pogomate 기준 공식으로 갱신
// 티어가 왜 그렇게 나왔는지 한 줄로 풀어 준다. 두 부분으로 이뤄진다.
//   formula    : 점수 = 공격 종족값 × 맥스무브 위력 (× 자속 1.2). 점수의 계산 과정 그대로다.
//   comparison : 같은 맥스무브 속성 목록의 1위와 비교한 백분율. 자기가 1위면 "1위"라고만 적는다.
//                (이름이 같아도 다이맥스/거다이맥스는 별개 항목이라 name과 gmax를 함께 본다)
function whyText(pokemon) {
  const topOfType = (DMAX_TIER[pokemon.charged] ?? [])[0];
  const percentOfTop = topOfType ? Math.round(pokemon.score / topOfType.score * 100) : null;
  const formula = `점수 ${pokemon.score.toLocaleString()} = 공격 ${pokemon.atk} × 위력 ${pokemon.power}${pokemon.stab ? ' × 자속 1.2' : ''}`;
  const comparison = percentOfTop == null ? '' : topOfType.name === pokemon.name && topOfType.gmax === pokemon.gmax ? ` · ${TYPE_KO[pokemon.charged]} 1위` : ` · ${TYPE_KO[pokemon.charged]} 1위 ${topOfType.name} 대비 ${percentOfTop}%`;
  return `${pokemon.tier} 근거 — ${formula}${comparison}`;
}

// 2026-09-02 티어표 행: pogomate 기준 % 표시 (내구 미반영)
// 점수 칸은 절대 점수가 아니라 "이 목록 1위(topScore) 대비 %"다.
function tierRowNode(pokemon, rankText, topScore) {
  return row(pokemon, rankText,
    el('span', { class: 'row__score' }, `${Math.round(pokemon.score / topScore * 100)}%`),
    el('span', { class: 'row__sub' }, `공격 ${pokemon.atk} · 위력 ${pokemon.power}${pokemon.stab ? ' · 자속' : ''}`),
    [pokemon.fast, `${TYPE_KO[pokemon.charged]} 타입`]);  // 2026-09-06 v2.10.0 G-MAX/D-MAX 뱃지는 이름의 폼 라벨로 대체
}

// 티어표 행 + 그 아래 접혀 있는 "선정 근거" 줄을 한 묶음(fragment)으로 만든다.
// 행을 누르면 근거 줄이 열리고 닫힌다(.open 토글). 그래서 행의 원래 클릭 동작(상세 팝업)은
// cloneNode로 지워 버리고, 상세 팝업은 근거 줄 안의 "포켓몬 상세 ▸" 버튼으로 따로 열게 했다.
function expandableRow(pokemon, rankText, topScore) {
  const rowNode = tierRowNode(pokemon, rankText, topScore).cloneNode(true);  // cloneNode로 팝업 클릭 리스너 제거
  // 2026-09-02 가안 B: 근거 아래 "얘가 보스면?" 카운터 한 줄
  // 이 포켓몬의 첫 번째 속성을 보스 속성으로 보고, 그 보스를 잡을 딜러 상위 5마리를 곁들인다.
  const counterType = pokemon.types?.[0];
  const counters = counterType ? (DMAX_DATA[counterType] ?? []).slice(0, 5) : [];
  // 2026-09-10 v2.43.0 근거 줄을 두 칸으로 나눴다 — 왼쪽은 "왜 이 티어인가"(계산식), 오른쪽은
  // "이 포켓몬이 보스로 나오면 누구를 데려가나". 성격이 다른 두 정보가 한 문단에 이어져 있어
  // 어디까지가 계산식인지 눈이 못 잘랐다. 칸마다 제목을 달아 무엇을 읽는 중인지 밝힌다
  const whyNode = el('li', { class: 'row__why' },
    el('div', { class: 'row__why-col' },
      el('b', { class: 'row__why-title' }, '📊 티어 점수 산정 방식'),
      el('p', { class: 'row__why-line' }, whyText(pokemon)),
      el('button', {
        class: 'row__why-more',
        onclick: (event) => {
          event.stopPropagation();  // 행 클릭(= 근거 접기)까지 번지지 않게 막는다
          openDetail(pokemon);
        }
      }, '포켓몬 상세 보기 →')),
    counters.length ? el('div', { class: 'row__why-col' },
      el('b', { class: 'row__why-title' }, '🛡 얘가 보스라면 데려갈 딜러'),
      el('div', { class: 'row__why-chips' },
        ...counters.map((counter) => el('button', {
          class: 'row__why-chip',
          onclick: (event) => {
            event.stopPropagation();
            openDetail(counter);
          }
        }, counter.name)))) : '');
  // 2026-09-10 v2.52.0 한 번에 하나만 연다 (아코디언).
  // 전에는 카드마다 따로 토글해서, 넷을 차례로 누르면 근거 넷이 한꺼번에 펼쳐진 채 쌓였다.
  // 근거는 카드 뒤에 가로폭을 다 쓰고 붙으므로(order, pc-theme.css) 여러 개가 열리면
  // 어느 카드의 근거인지 짝지을 수 없다 — 화면에 근거가 하나면 그 질문 자체가 없다.
  // 같은 카드를 다시 누르면 닫힌다(끄는 길을 남긴다)
  rowNode.addEventListener('click', () => {
    const willOpen = !whyNode.classList.contains('is-open');
    for (const other of document.querySelectorAll('.row__why.is-open')) other.classList.remove('is-open');
    if (!willOpen) return;
    whyNode.classList.add('is-open');
    // 열린 근거가 화면 밖이면 끌어온다. block: 'nearest' 라 이미 보이면 화면이 움직이지 않는다
    whyNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  const fragment = document.createDocumentFragment();
  fragment.append(rowNode, whyNode);
  return fragment;
}

// 2026-09-02 이번 주 보스 아코디언: 탭 위로 이동, 추천 딜러 딜량순 5개씩 더보기
// 보스 속성(typeKey)을 상대할 딜러를 앞에서 count마리만 잘라 스프라이트 버튼으로 만든다.
function bossRecNodes(typeKey, count) {
  return (DMAX_DATA[typeKey] ?? []).slice(0, count).map((pokemon, index) =>
    el('button', {
      class: 'boss__rec',
      onclick: (event) => {
        event.stopPropagation();  // 아코디언이 접히지 않게
        openDetail(pokemon);
      }
    }, sprite(pokemon.sprite), el('span', {}, `${index + 1} `, nameNode(pokemon.name))));  // 2026-09-06 v2.10.0 폼 라벨 뱃지
}

// 2026-09-07 v2.13.0 (QA-43) 파티 카드: 이 보스에 "딜러 상위 2 + 탱커 상위 1" — 친구들 질문("뭘 데려가?")에 가장 가까운 답.
// 탱커는 딜러와 같은 종이 겹치지 않게 고른다. 탱커 데이터가 없는 빌드에서는 빈 문자열(카드 없음)
function partyCardNode(typeKey) {
  const dealers = (DMAX_DATA[typeKey] ?? []).slice(0, 2);
  const tanks = typeof DMAX_TANK !== 'undefined' ? (DMAX_TANK?.[typeKey] ?? []) : [];
  const dealerNames = new Set(dealers.map((pokemon) => pokemon.name));
  const tank = tanks.find((pokemon) => !dealerNames.has(pokemon.name));
  if (!dealers.length || !tank) return '';
  const member = (pokemon, role, why) => el('button', { class: 'boss__rec', onclick: (event) => { event.stopPropagation(); openDetail(pokemon); } },
    sprite(pokemon.sprite), el('span', {}, nameNode(pokemon.name)), el('small', { class: 'row__sub' }, `${role} · ${why}`));
  return el('div', { class: 'party-card' },
    el('p', { class: 'schedule__sec' }, `🧩 추천 파티 — 딜러 2 + 탱커 1`),
    el('div', { class: 'boss__recs recs-wrap' },
      ...dealers.map((pokemon) => member(pokemon, '딜러', `맥스 피해 ${pokemon.dmg}`)),
      member(tank, '탱커', `EHP ${tank.ehp}${typeKey === 'overall' ? '' : ` · 받는 배율 ×${tank.mult}`}`)),
    footNote('딜러는 맥스 피해 × √내구 순위, 탱커는 체력 × 방어 ÷ 받는 배율(EHP) 순위의 1위. 탱커 전체 순위는 [탱커] 세그먼트에서'));
}

// 이번 주 보스 아코디언을 채운다.
// 보스를 고르는 순서
//   1) 오늘이 걸쳐 있는 dmax 일정 (= 이번 주 보스)
//   2) 없으면(맥스 먼데이 휴식 주) 앞으로 올 dmax 일정 중 가장 빠른 것을 "다음 보스"로
//   3) 그것도 없으면 아코디언 자체를 숨긴다
function renderBossAcc() {
  const accordion = document.getElementById('boss-acc');
  const titleEl = document.getElementById('boss-acc-title');
  const bodyEl = document.getElementById('boss-acc-body');
  const now = new Date();
  // 2026-09-07 v2.13.0 (QA-20) 일정표가 다루는 달이 오늘 달이 아니면(다음 달 데이터 미등재로 지난 달에 폴백한 상태)
  // 지난 달 보스를 "이번 주"로 내밀지 않고 아코디언을 숨긴다
  const isCurrentMonth = now.getFullYear() === SCHEDULE_YM.y && now.getMonth() + 1 === SCHEDULE_YM.m;
  if (!isCurrentMonth) {
    accordion.style.display = 'none';
    accordion.classList.remove('is-on');
    return;
  }
  const todayDayOfMonth = now.getDate();
  let bossItem = SCHEDULE_ITEMS.find(item => item.cat === 'dmax' && item.t && todayDayOfMonth >= item.s && todayDayOfMonth <= item.e);
  let prefix = '⚔️ 이번 주 보스 · ';
  if (!bossItem) {
    bossItem = SCHEDULE_ITEMS.filter(item => item.cat === 'dmax' && item.t && item.s > todayDayOfMonth).sort((first, second) => first.s - second.s)[0];
    prefix = '⚔️ 이번 주 맥스 먼데이 휴식 · 다음 보스 ';
  }
  if (!bossItem) {
    accordion.style.display = 'none';
    accordion.classList.remove('is-on');
    return;
  }
  accordion.style.display = '';
  // 2026-09-12 v3.5.0 보이는 동안만 표식 — 아래 컨트롤 줄을 8px 로 붙이는 규칙이 이걸 본다 (list.css)
  accordion.classList.add('is-on');
  // 일정 label에서 보스 이름만 뽑는다: 괄호 설명을 떼고 'D-MAX ' 접두어도 지운다
  const bossName = bossItem.label.split(' (')[0].replace('D-MAX ', '');
  titleEl.textContent = `${prefix}${bossName} (${TYPE_KO[bossItem.t]}) · ${SCHEDULE_YM.m}/${bossItem.s}–${bossItem.e}`;  // 2026-09-07 v2.13.0 (QA-20) 달 하드코딩 제거
  const total = (DMAX_DATA[bossItem.t] ?? []).length;
  const grid = el('div', { class: 'boss__recs recs-wrap' }, ...bossRecNodes(bossItem.t, state.bossShow));
  bodyEl.replaceChildren(
    partyCardNode(bossItem.t),  // 2026-09-07 v2.13.0 (QA-43) "딜러 2 + 탱커 1" 파티 카드
    el('p', { class: 'schedule__sec' }, `${TYPE_KO[bossItem.t]} 보스 추천 딜러 (딜량순)`),
    grid,
    // 아래 줄: 5개씩 더보기(전부 나왔으면 안내 문구로 대체) + 그 속성 칩으로 이동
    el('div', { class: 'boss__foot' },
      state.bossShow < total
        ? el('button', {
            class: 'boss__more',
            onclick: () => {
              state.bossShow += 5;
              renderBossAcc();       // 아코디언 본문만 다시 그린다 (탭 전체 렌더링 아님)
              accordion.open = true; // 다시 그리면서 닫히지 않도록 열린 상태를 되돌린다
            }
          }, `더보기 +5 (${Math.min(state.bossShow, total)}/${total})`)
        : el('span', { class: 'meta' }, `전체 ${total}종 표시됨`),
      el('button', {
        class: 'boss__more',
        onclick: () => {
          state.maxBoss = bossItem.t;  // 아래 표를 이 보스 속성으로 맞춘다
          state.maxAxis = 'dealer';    // 2026-09-07 v2.14.0 (QA-52) 보스 상대 딜러 표는 [딜러] 축에 있다
          render();
        }
      }, `${TYPE_KO[bossItem.t]} 보스 딜러 순위 ▸`)));
}

// 2026-09-07 v2.13.0 (QA-43) 탱커 한 행: 점수 칸에 EHP, 보조줄에 받는 배율과 체력·방어
//   EHP = 체력 × 방어 ÷ 1000 ÷ 받는 배율 (backend/value_build.py tank_rank). 배율은 보스가 자기 타입 자속 기술로 때린다고 가정
function tankRow(pokemon, rankText, bossType) {
  return row(
    pokemon, rankText, el('span', { class: 'row__score' }, String(pokemon.ehp)),
    el('span', { class: 'row__sub' }, bossType === 'overall' ? `EHP · 체력 ${pokemon.hp} × 방어 ${pokemon.def}` : `EHP · 받는 배율 ×${pokemon.mult} · 체력 ${pokemon.hp} × 방어 ${pokemon.def}`),
    pokemon.types.map((typeName) => `${TYPE_KO[typeName]} 타입`));
}

// 2026-09-07 v2.13.0 (QA-43) 보스 속성별 탱커 목록 (탭 세그먼트 '탱커')
function renderMaxTank(selectedType) {
  const tanks = (typeof DMAX_TANK !== 'undefined' ? DMAX_TANK[selectedType] : null) ?? [];
  const title = selectedType === 'overall' ? 'D-MAX 탱커 (중립 · 순수 내구)' : `${TYPE_KO[selectedType]} 보스 상대 D-MAX 탱커`;
  $content.append(
    el('div', { class: 'row-head' }, el('h2', {}, title), el('span', { class: 'meta' }, `상위 ${tanks.length}`)),
    list(`maxtank-${selectedType}`, tanks, (pokemon, index) => tankRow(pokemon, String(index + 1), selectedType)));
  $note.textContent = '탱커 순위: EHP = 체력 × 방어 ÷ 1000 ÷ (보스 타입 기술을 받는 배율). 레벨 40 실전 능력치 기준이고, 보스는 자기 타입 자속 기술로 때린다고 가정해요(복합 타입 보스는 상세 팝업의 타입 상성을 함께 보세요). 출시된 다이맥스·거다이맥스만 포함. 포켓몬을 누르면 상세 정보가 열려요.';
}

// 2026-09-07 v2.14.0 (QA-52) D-MAX 탭 = [전체 | 딜러 | 탱커] 세그먼트 + 그 아래 하위 메뉴(속성 칩).
//   전체 : D-MAX 티어표 — pogomate 기준, 칩은 "맥스무브 속성"으로 묶는다 (행을 누르면 근거)
//   딜러 : 보스 속성 상대 맥스 어태커 — 맥스 피해 × √내구, 칩은 "보스 속성"
//   탱커 : 보스 속성 앞에서 오래 버티는 개체 — EHP, 칩은 "보스 속성"
// 예전엔 [딜러 | 탱커] 둘뿐이고 딜러 화면에 티어표와 어태커 표가 같이 실려 길었다 — 축마다 표 하나씩으로 나눴다
const MAX_AXES = [
  { id: 'all', label: '전체', chipLabel: '맥스무브 속성' },
  { id: 'dealer', label: '딜러', chipLabel: '보스 속성' },
  { id: 'tank', label: '탱커', chipLabel: '보스 속성' },
];

// 하위 메뉴 한 줄: 왼쪽 라벨 + 가로 스크롤 속성 칩 (chips 재사용)
function maxSubmenu(axis) {
  const bossItems = [{ id: 'overall', label: '전체' }, ...Object.keys(TYPE_KO).map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  const bossChips = chips(bossItems, state.maxBoss, (id) => {
    state.maxBoss = id;
    render();
  });
  return el('div', { class: 'submenu' }, el('span', { class: 'submenu__label' }, axis.chipLabel), bossChips);
}

// 전체: 티어표 (맥스무브 속성 기준)
// 티어표 한 덩이(머리글 + 티어별 목록)를 $content 에 붙인다.
// 2026-09-11 v2.55.0 [전체] 탭과 [딜러] 탭이 같이 쓰므로 따로 뗐다 — 두 곳에 같은 코드를 두면
// 한쪽만 고쳐 놓고 다른 쪽이 옛 모양으로 남는다
//
// 여기서 "그 속성"은 맥스무브(charged) 속성 기준이다 — 그 타입 맥스무브를 쓰는 개체 목록.
// 점수 칸의 %는 이 목록 1위(tierItems[0].score) 대비 값이고, 행을 누르면 근거가 펼쳐진다.
function maxTierBlock(selectedType) {
  const tierItems = DMAX_TIER[selectedType] ?? [];
  const tierTitle = selectedType === 'overall' ? 'D-MAX 티어표 (전체)' : `${TYPE_KO[selectedType]} 맥스무브 D-MAX 티어표`;
  $content.append(el('div', { class: 'row-head' },
    el('h2', {}, tierTitle), el('span', { class: 'meta' }, `${tierItems.length}종`)));
  if (tierItems.length) renderTierList(tierItems, (pokemon, index) => expandableRow(pokemon, String(index + 1), tierItems[0].score));  // 2026-09-02 1B·pogomate %
  return tierItems.length;
}

function renderMaxTier(selectedType) {
  maxTierBlock(selectedType);
  // 속성을 골랐으면 "이 속성 보스를 상대할" 표는 딜러 탭에 있다고 안내 — 예전엔 같은 화면 아래에 붙어 있었다
  if (selectedType !== 'overall') {
    $content.append(el('p', { class: 'detail__foot axis-hint' }, `${TYPE_KO[selectedType]} 보스를 상대할 딜러·탱커 순위는 `,
      el('button', { class: 'row__why-more', onclick: () => { state.maxAxis = 'dealer'; track('sub_max_dealer'); render(); } }, '[딜러]'), ' · ',
      el('button', { class: 'row__why-more', onclick: () => { state.maxAxis = 'tank'; track('sub_max_tank'); render(); } }, '[탱커]'), ' 에서'));
  }
  $note.textContent = '티어표 행을 누르면 선정 근거가 펼쳐져요. 티어표는 pogomate와 같은 기준: 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영, 다이맥스·거다이맥스는 별도 항목이며 %는 그 목록 1위 대비예요. 속성 칩은 그 타입 맥스무브를 쓰는 개체를 모아요(포켓몬 자체 타입이 아님). 출시된 다이맥스 139종 · 거다이맥스 17종만 포함(미출시 리전 폼 제외). 포켓몬을 누르면 상세 정보가 열려요.';
}

// 딜러: 보스 속성 상대 맥스 어태커 (상성·내구 반영)
//
// 2026-09-11 v2.55.0 티어표를 위, 딜러를 아래로 쌓는다.
// 타입을 고르고 [딜러] 로 들어오면 "이 타입으로 뭘 키워야 하나" 와 "이 타입 보스를 뭘로 때리나"
// 둘 다 궁금한데, 전에는 뒤엣것만 보여 주고 앞엣것은 [전체] 탭으로 되돌아가야 했다.
//
// **두 표에서 고른 타입의 뜻이 다르다** — 위(티어표)는 *그 타입 맥스무브를 쓰는* 개체이고,
// 아래(딜러)는 *그 타입 보스를 상대할* 개체다. 같은 '에스퍼' 라도 위는 에스퍼 맥스무브를 쓰는 쪽,
// 아래는 에스퍼 보스에게 강한 쪽이라 명단이 겹치지 않는 게 정상이다.
// 그래서 두 머리글이 그 차이를 글자로 말한다 ("… 맥스무브 티어표" / "… 보스 상대 딜러").
// 머리글을 짧게 줄이면 두 표가 같은 것의 두 벌처럼 읽히므로 줄이지 않는다.
function renderMaxDealer(selectedType) {
  maxTierBlock(selectedType);
  const attackers = DMAX_DATA[selectedType] ?? [];
  const title = selectedType === 'overall' ? 'D-MAX 딜러 (중립 · 맥스 피해 × √내구)' : `${TYPE_KO[selectedType]} 보스 상대 D-MAX 딜러`;
  $content.append(
    el('div', { class: 'row-head' }, el('h2', {}, title), el('span', { class: 'meta' }, `상위 ${attackers.length}`)),
    list(`max-${selectedType}`, attackers, (pokemon, index) => maxRow(pokemon, String(index + 1))));
  $note.textContent = '위는 티어표(그 타입 맥스무브를 쓰는 개체), 아래는 딜러(그 타입 보스를 상대할 개체) — 같은 타입을 골라도 보는 각도가 달라 명단이 달라요. 티어표는 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영이고 행을 누르면 근거가 펼쳐져요. 딜러 순위는 맥스어택 3레벨(위력 350) 또는 거다이맥스 3레벨(위력 450) 1회 피해 × √내구 기준이며, 보스 속성을 고르면 그 속성 보스를 때릴 때의 상성이 반영돼요(전체는 중립). 출시된 다이맥스·거다이맥스만 포함. 포켓몬을 누르면 상세 정보가 열려요.';
}

function renderMax() {
  renderBossAcc();  // 2026-09-02 탭 위 보스 아코디언
  // 2026-09-07 v2.14.0 (QA-52) [전체 | 딜러 | 탱커] 세그먼트 — 탱커 데이터가 없는 빌드에서는 탱커 버튼을 뺀다
  const hasTank = typeof DMAX_TANK !== 'undefined' && Object.keys(DMAX_TANK ?? {}).length > 0;
  const axes = hasTank ? MAX_AXES : MAX_AXES.filter((axis) => axis.id !== 'tank');
  if (!axes.some((axis) => axis.id === state.maxAxis)) state.maxAxis = 'all';
  // 2026-09-12 v3.2.0 이 세그먼트는 화면 머리 오른쪽으로 간다 (app.js render → setPageHeadAction).
  // [전체 | 딜러 | 탱커] 는 목록 하나를 거르는 값이 아니라 **이 화면이 무엇을 보여 주는가** 자체다 —
  // 셋은 서로 다른 순위표다. 그래서 필터 줄이 아니라 제목과 같은 높이에 놓는다.
  // 표식만 달아 두고 옮기는 일은 render() 가 한다: 뷰는 지금까지처럼 $controls 에 붙이기만 하면 된다
  const axisSeg = seg(axes.map(({ id, label }) => ({ id, label })), state.maxAxis, (id) => {
    state.maxAxis = id;
    track('sub_max_' + id);  // GA4: 서브탭 사용량 (sub_pve_* 와 같은 규칙)
    render();
  });
  axisSeg.classList.add('js-head-action');
  $controls.append(axisSeg);
  // 2026-09-12 v3.5.0 보기 전환을 축 세그먼트 옆에 나란히 — 넓은 화면에서 티어표가 카드 격자로
  // 그려지는데(pc-theme.css .row-list) 줄로 되돌릴 방법이 여기만 없었다 (레이드 · PvE 와 같은 규칙)
  const maxGrid = layoutInitial(MAX_COLS_KEY);
  const maxLayout = layoutToggle(MAX_COLS_KEY, maxGrid, applyMaxLayout);
  maxLayout.classList.add('js-head-action');
  $controls.append(maxLayout);
  const axis = axes.find((entry) => entry.id === state.maxAxis);
  $controls.append(maxSubmenu(axis));
  const selectedType = state.maxBoss;
  if (axis.id === 'tank') { renderMaxTank(selectedType); return applyMaxLayout(maxGrid); }
  if (axis.id === 'dealer') { renderMaxDealer(selectedType); return applyMaxLayout(maxGrid); }
  renderMaxTier(selectedType);
  applyMaxLayout(maxGrid);
}

// 2026-09-12 v3.5.0 D-MAX 보기 전환 — 넓은 화면의 카드 격자(.row-list)를 줄로 되돌린다.
// 도감·레이드 PvE 와 같은 규칙의 별도 키다 (화면마다 선택이 섞이지 않게)
const MAX_COLS_KEY = 'pogo_max_cols';
function applyMaxLayout(grid) {
  rowListLayout(grid);   // 2026-09-12 v3.9.1 레이드 · PvE 와 같은 일이라 components/ui.js 한 곳으로 뺐다
}
