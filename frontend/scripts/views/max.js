// ─────────────────────────────────────────────────────────────────────────────
// D-MAX 탭
//
// 화면 구성 (위 → 아래)
//   1) 이번 주 보스 아코디언 (#boss-acc) — 탭 컨트롤 위에 붙는다. 일정표에서 이번 주 D-MAX
//      보스를 찾아, 그 보스 속성을 상대할 추천 딜러를 딜량순으로 5개씩 "더보기" 하며 보여준다.
//   2) 속성 칩 (전체 + 18타입)
//   3) D-MAX 티어표 — 속성 칩이 '전체'가 아니면 "그 타입 맥스무브를 쓰는 딜러"만 모은 표다.
//      즉 포켓몬의 자체 속성이 아니라 charged(맥스무브) 속성 기준으로 묶인다.
//      행을 누르면 그 아래로 "선정 근거"(점수 분해 + 1위 대비 %) 가 펼쳐진다.
//   4) (속성 칩 선택 시) 그 속성 보스를 상대할 맥스 어태커 순위 — 티어표와 달리 내구를 반영한다.
//
// 어떤 데이터를 읽나
//   - DMAX_TIER[타입] : 티어표용 목록. pogomate와 같은 기준으로 계산된 score/tier를 갖는다.
//                       (공격 종족값 × 맥스무브 위력 × 자속 보정, 내구 미반영)
//   - DMAX_DATA[타입] : 그 속성 보스를 상대할 때 강한 맥스 어태커 목록 (맥스 피해 dmg·내구 bulk 포함)
//   - SCHEDULE_ITEMS / SCHEDULE_YM (components/schedule.js) : 이번 주 D-MAX 보스 주차를 찾는 데 쓴다
//   - TYPE_KO, state.maxBoss(선택한 속성 칩), state.bossShow(추천 딜러 표시 개수)
//
// 제공하는 전역: maxRow · whyText · tierRowNode · expandableRow · bossRecNodes ·
//                renderBossAcc · renderMax (app.js가 탭 렌더러로 호출)
// ※ 티어별로 묶어 그리는 renderTierList는 views/tier.js에 있다.
// ─────────────────────────────────────────────────────────────────────────────

// 다이맥스 탭: 위에는 그 속성 다이맥스 포켓몬 티어표, 아래에 보스 상대 맥스 어태커

// 하단 "보스 상대 맥스 어태커" 한 행: 점수 칸에 맥스 피해(dmg), 보조줄에 내구(bulk)를 적는다.
function maxRow(pokemon, rankText) {
  return row(
    pokemon, rankText, el('span', { class: 'score' }, String(pokemon.dmg)),
    el('span', { class: 'sub' }, `맥스 피해 · 내구 ${pokemon.bulk}`),
    [pokemon.fast, `${TYPE_KO[pokemon.charged]} 타입`],
    el('span', { class: `tag${pokemon.gmax ? ' gmax' : ''}` }, pokemon.gmax ? 'G-MAX' : 'D-MAX'  /* 2026-09-02 영문 라벨 */),
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
    el('span', { class: 'score' }, `${Math.round(pokemon.score / topScore * 100)}%`),
    el('span', { class: 'sub' }, `공격 ${pokemon.atk} · 위력 ${pokemon.power}${pokemon.stab ? ' · 자속' : ''}`),
    [pokemon.fast, `${TYPE_KO[pokemon.charged]} 타입`],
    el('span', { class: `tag${pokemon.gmax ? ' gmax' : ''}` }, pokemon.gmax ? 'G-MAX' : 'D-MAX'));
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
  const whyNode = el('li', { class: 'row-why' },
    el('p', { class: 'why-line' }, whyText(pokemon) + '  ',
      el('button', {
        class: 'row-why-more',
        onclick: (event) => {
          event.stopPropagation();  // 행 클릭(= 근거 접기)까지 번지지 않게 막는다
          openDetail(pokemon);
        }
      }, '포켓몬 상세 ▸')),
    counters.length ? el('p', { class: 'why-line' }, '🛡 얘가 보스면 → ',
      ...counters.flatMap((counter, index) => [
        el('button', {
          class: 'row-why-more',
          onclick: (event) => {
            event.stopPropagation();
            openDetail(counter);
          }
        }, counter.name),
        index < counters.length - 1 ? ' · ' : ''])) : '');
  rowNode.addEventListener('click', () => whyNode.classList.toggle('open'));
  const fragment = document.createDocumentFragment();
  fragment.append(rowNode, whyNode);
  return fragment;
}

// 2026-09-02 이번 주 보스 아코디언: 탭 위로 이동, 추천 딜러 딜량순 5개씩 더보기
// 보스 속성(typeKey)을 상대할 딜러를 앞에서 count마리만 잘라 스프라이트 버튼으로 만든다.
function bossRecNodes(typeKey, count) {
  return (DMAX_DATA[typeKey] ?? []).slice(0, count).map((pokemon, index) =>
    el('button', {
      class: 'boss-rec',
      onclick: (event) => {
        event.stopPropagation();  // 아코디언이 접히지 않게
        openDetail(pokemon);
      }
    }, sprite(pokemon.sprite), el('span', {}, `${index + 1} ${pokemon.name}`)));
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
  // 일정표가 다루는 달이 아니면 todayDayOfMonth가 0이 되고, 자연히 "다음 보스" 쪽으로 넘어간다
  const isCurrentMonth = now.getFullYear() === SCHEDULE_YM.y && now.getMonth() + 1 === SCHEDULE_YM.m;
  const todayDayOfMonth = isCurrentMonth ? now.getDate() : 0;
  let bossItem = SCHEDULE_ITEMS.find(item => item.cat === 'dmax' && item.t && todayDayOfMonth >= item.s && todayDayOfMonth <= item.e);
  let prefix = '⚔️ 이번 주 보스 · ';
  if (!bossItem) {
    bossItem = SCHEDULE_ITEMS.filter(item => item.cat === 'dmax' && item.t && item.s > todayDayOfMonth).sort((first, second) => first.s - second.s)[0];
    prefix = '⚔️ 이번 주 맥스 먼데이 휴식 · 다음 보스 ';
  }
  if (!bossItem) {
    accordion.style.display = 'none';
    return;
  }
  accordion.style.display = '';
  // 일정 label에서 보스 이름만 뽑는다: 괄호 설명을 떼고 'D-MAX ' 접두어도 지운다
  const bossName = bossItem.label.split(' (')[0].replace('D-MAX ', '');
  titleEl.textContent = `${prefix}${bossName} (${TYPE_KO[bossItem.t]}) · 9/${bossItem.s}–${bossItem.e}`;
  const total = (DMAX_DATA[bossItem.t] ?? []).length;
  const grid = el('div', { class: 'boss-recs wrap-recs' }, ...bossRecNodes(bossItem.t, state.bossShow));
  bodyEl.replaceChildren(
    el('p', { class: 'schedule-sec' }, `${TYPE_KO[bossItem.t]} 보스 추천 딜러 (딜량순)`),
    grid,
    // 아래 줄: 5개씩 더보기(전부 나왔으면 안내 문구로 대체) + 그 속성 칩으로 이동
    el('div', { class: 'boss-foot' },
      state.bossShow < total
        ? el('button', {
            class: 'boss-more',
            onclick: () => {
              state.bossShow += 5;
              renderBossAcc();       // 아코디언 본문만 다시 그린다 (탭 전체 렌더링 아님)
              accordion.open = true; // 다시 그리면서 닫히지 않도록 열린 상태를 되돌린다
            }
          }, `더보기 +5 (${Math.min(state.bossShow, total)}/${total})`)
        : el('span', { class: 'meta' }, `전체 ${total}종 표시됨`),
      el('button', {
        class: 'boss-more',
        onclick: () => {
          state.maxBoss = bossItem.t;  // 아래 티어표를 이 보스 속성으로 맞춘다
          render();
        }
      }, `${TYPE_KO[bossItem.t]} 칩으로 이동 ▸`)));
}

function renderMax() {
  const bossItems = [{ id: 'overall', label: '전체' }, ...Object.keys(TYPE_KO).map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  renderBossAcc();  // 2026-09-02 탭 위 보스 아코디언
  const bossChips = chips(bossItems, state.maxBoss, (id) => {
    state.maxBoss = id;
    render();
  });
  $controls.append(bossChips);
  const selectedType = state.maxBoss;

  // 티어별 포켓몬 (속성 탭 = 그 속성 다이맥스 포켓몬만)
  // 여기서 "그 속성"은 맥스무브(charged) 속성 기준이다 — 그 타입 맥스무브를 쓰는 딜러 목록.
  // 점수 칸의 %는 이 목록 1위(tierItems[0].score) 대비 값이고, 행을 누르면 근거가 펼쳐진다.
  const tierItems = DMAX_TIER[selectedType] ?? [];
  const tierTitle = selectedType === 'overall' ? 'D-MAX 티어표 (전체)' : `${TYPE_KO[selectedType]} 타입 D-MAX 티어표`;
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, tierTitle), el('span', { class: 'meta' }, `${tierItems.length}종`)));
  if (tierItems.length) renderTierList(tierItems, (pokemon, index) => expandableRow(pokemon, String(index + 1), tierItems[0].score));  // 2026-09-02 1B·pogomate %

  // 하단: 보스 속성 상대 맥스 어태커
  // 위 티어표와 목적이 다르다 — 이쪽은 "그 속성 보스를 때릴 때" 기준이라 상성과 내구가 반영된다.
  if (selectedType !== 'overall') {
    const attackers = DMAX_DATA[selectedType] ?? [];
    $content.append(
      el('div', { class: 'list-head' }, el('h2', {}, `${TYPE_KO[selectedType]} 보스 상대 맥스 어태커`), el('span', { class: 'meta' }, `상위 ${attackers.length}`)),
      list(`max-${selectedType}`, attackers, (pokemon, index) => maxRow(pokemon, String(index + 1))),
    );
  }
  $note.textContent = '티어표 행을 누르면 선정 근거가 펼쳐집니다. 티어표는 pogomate와 같은 기준: 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영, 다이맥스·거다이맥스는 별도 항목이며 %는 그 목록 1위 대비입니다. 위는 그 속성 다이맥스 포켓몬의 티어표(중립 기준, 목록 안 상대 등급), 아래는 그 속성 보스를 상대할 때 강한 맥스 어태커 순위입니다. 맥스어택 3레벨(위력 350) 또는 거다이맥스 3레벨(위력 450) 1회 피해 × √내구 기준. 출시된 다이맥스 138종 · 거다이맥스 17종만 포함. 포켓몬을 누르면 상세 정보가 열립니다.';
}
