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
// 제공하는 전역: maxRow · tankRow · whyFormula · whyGrade · DMAX_TIER_INFO · tierRowNode · expandableRow · bossRecNodes · partyCardNode ·
//                MAX_AXES · maxSubmenu · renderBossAcc · renderMaxTier · renderMaxDealer · renderMaxTank · renderMax (app.js가 탭 렌더러로 호출)
// ※ 티어별로 묶어 그리는 renderTierList는 views/tier.js에 있다.
// ─────────────────────────────────────────────────────────────────────────────

// 다이맥스 탭: 위에는 그 속성 다이맥스 포켓몬 티어표, 아래에 보스 상대 맥스 어태커

// 하단 "보스 상대 맥스 어태커" 한 행: 점수 칸에 맥스 피해(dmg), 보조줄에 내구(bulk)를 적는다.
function maxRow(pokemon, rank) {
  return row(
    pokemon, rank.text, el('span', { class: 'row__score' }, String(pokemon.dmg)),
    el('span', { class: 'row__sub' }, `맥스 피해 · 내구 ${pokemon.bulk}`),
    [pokemon.fast, `${TYPE_KO[pokemon.charged]} 타입`],
    rank.tag,   // 2026-09-16 v3.49.0 가상 순위에서 밀린 줄의 [지금 N위]
    // 2026-09-06 v2.10.0 (QA-44) G-MAX/D-MAX 뱃지 제거 — 이름 자체가 '거다이맥스 X'/'다이맥스 X' 가 되어 폼 라벨 뱃지로 보인다
  );
}

// 티어 근거 인라인 펼침 행. 2026-09-14 v3.30.0 부터 두 줄로 나눈다 —
// 한 줄에 몰아넣었더니 영문 사전 패턴이 잡아야 할 조각이 열 개를 넘어 번역이 통째로 포기됐다
// (i18n 엔진의 치환자는 $1~$9 뿐이다). 줄을 가르면 각 줄이 아홉 개 안에 들어온다.
//   whyFormula : 점수의 계산 과정 그대로. 자속이 없으면 ×1 로 적는다 — 항목을 빼지 않아야
//                문장 모양이 하나로 고정되고, 그래야 영문 패턴 하나로 덮인다.
//   whyGrade   : 등급이 왜 그 글자인지. 등급은 **전 종 기준**(절대)이고 순위는 **그 탭 안**이라,
//                둘을 한 줄에 적어 두 숫자가 서로 다른 질문에 답한다는 것을 보이게 한다.
//                (이름이 같아도 다이맥스/거다이맥스는 별개 항목이라 name과 gmax를 함께 본다)
// 2026-09-15 v3.36.0 순위는 **출시분끼리만** 센다. 미구현 줄(데이터만 있고 게임에 없는 개체)이
// 사이에 끼어도 그 아래 출시분의 번호가 밀리지 않는다. 미구현 줄에는 번호 대신 '–' 를 둔다 —
// 번호를 주면 지금 쓸 수 있는 자리처럼 읽힌다
// 같은 개체인가 — 빌드가 탭마다 행을 **복사**해서 넣으므로 객체 동일성으로는 못 찾는다.
// (전체 탭에서 펼친 행을 그 타입 탭 목록에서 찾을 때 늘 어긋났다) 이름과 거다이 여부로 본다 —
// 한 목록 안에서 이 둘이 같은 행은 하나뿐이다
function sameMaxEntry(left, right) {
  return left === right || (left.name === right.name && left.gmax === right.gmax);
}
// 지금 표에 미구현 줄이 실제로 끼어 있는가 — 순위 셈법이 여기서 갈린다
function maxUnrelShown() {
  return state.maxShowUnrel && maxUnrelAllowed();
}
// 출시분끼리 센 순위 (= 오늘 실제로 겨루는 자리)
function releasedRank(list, pokemon) {
  let rank = 0;
  for (const entry of list) {
    if (entry.unrel) continue;
    rank += 1;
    if (sameMaxEntry(entry, pokemon)) return rank;
  }
  return 0;
}
// 2026-09-16 v3.49.0 **[미구현] 을 켜면 표가 "만약 이들이 나온다면" 의 가상 순위가 된다.**
//   v3.36.0~v3.48.2 는 미구현 줄에 '–' 를 주고 출시분 번호를 그대로 뒀다. 끼어든 줄이 순위에
//   아무 영향이 없는 것처럼 읽혀서, 정작 이 화면이 답해야 할 질문("나오면 판이 어떻게 바뀌나")에
//   답하지 못했다 — 제보: "미구현된 포켓몬이 나온다면 이라는 취지로 랭킹 순위도 바뀌는 게 좋겠다".
//   이제 미구현도 번호를 받고, 그 위에 낀 만큼 아래 출시분이 밀린다 (지금 1위가 5위가 되는 식).
//   밀린 줄에는 [지금 N위] 딱지를 달아 **무엇이 바뀌었는지**를 줄에서 바로 읽게 한다.
//   목록은 빌드가 이미 점수순으로 섞어 두므로(미구현 포함) 보이는 차례가 곧 가상 순위다.
//   체크가 꺼져 있으면 표에 미구현이 한 줄도 없어 두 셈법이 같은 값이 된다 — 예전 화면 그대로다.
//   반환값 { text, tag } — text 는 순위 칸, tag 는 이름 위 뱃지 줄로 간다
function maxRank(list, pokemon) {
  let shown = 0;
  let released = 0;
  for (const entry of list) {
    shown += 1;
    if (!entry.unrel) released += 1;
    if (!sameMaxEntry(entry, pokemon)) continue;
    // 미구현 줄에는 '지금' 이 없다 — 오늘 겨루는 자리가 아예 없으니 딱지도 없다
    const moved = !entry.unrel && shown !== released;
    return { text: String(shown), tag: moved ? el('span', { class: 'tag tag--now', title: `미구현이 없으면 ${released}위 — 이 표는 미구현이 나왔다고 가정한 순위예요` }, `지금 ${released}위`) : null };
  }
  return { text: '0', tag: null };
}
// 표 제목 옆 [가상 순위] — 이 표 전체가 가정이라는 것을 한 눈에. 켜져 있을 때만 붙는다
function maxHypoBadge() {
  return maxUnrelShown() ? el('span', { class: 'tag tag--hypo', title: '미구현이 나왔다고 가정하고 매긴 순위예요 — 실제 순위는 [미구현] 을 끄면 나와요' }, '가상 순위') : '';
}

// 2026-09-15 v3.40.0 미구현은 **관리자에게만** 보인다 (v3.38.0 에는 로그인한 사람 전부였다).
// 아직 안 나온 것을 미리 보는 값이라 운영하는 사람의 몫으로 둔다 —
// 관리자가 아니면 체크 자체를 안 그리고, 목록에서도 늘 걸러진다.
// 관리자는 둘이다: 루트(ADMIN_UID) · 위임(allowlist 문서의 admin: true, 루트가 화면에서 지정).
//
// ⚠️ 이건 **화면을 가리는 것**이지 데이터를 막는 것이 아니다. 순위표는 빌드가 dist/index.html 에
//   통째로 심어 두는 공개 값이라, 개발자 도구를 열면 흐린 줄의 내용도 그대로 보인다
//   (components/auth.js 머리말의 "접근 제어의 주체는 이 화면 코드가 아니다" 와 같은 전제).
//   정말로 막아야 한다면 미구현 줄을 빌드에서 빼고 로그인 뒤 Firestore 에서 받아 와야 한다 — 별도 작업이다.
function maxUnrelAllowed() {
  return typeof AUTH !== 'undefined' && AUTH.admin === true;
}

// 2026-09-15 v3.37.0 [미구현] 체크가 꺼져 있으면 흐린 줄을 아예 뺀다.
// **거르는 곳을 한 군데로 모은다** — 세 표(전체·딜러·탱커)가 모두 이 함수를 지나므로
// 체크 상태를 각 표에서 다시 따질 일이 없다. 순위 계산도 걸러진 목록을 받아 그대로 맞는다
function maxVisible(rows) {
  if (!maxUnrelShown()) return (rows ?? []).filter((row) => !row.unrel);
  // 2026-09-16 v3.49.0 가상 순위에서는 어제 대비 변동(▲▼)을 감춘다 — 그 숫자는 **실제 순위**가
  // 움직인 이야기라, 가정으로 매긴 번호 바로 아래 놓이면 한 줄에서 두 '움직임' 이 서로 다른 말을 한다.
  // 이 표에서 밀린 정도는 [지금 N위] 딱지가 말한다. 빌드가 준 행을 건드리지 않게 얕은 복사로 넘긴다
  return (rows ?? []).map((row) => (row.d ? { ...row, d: 0 } : row));
}

// 2026-09-15 v3.44.0 **추천은 체크와 무관하게 출시분만.**
//   maxVisible() 은 "표에 무엇을 보일까" 라 [미구현] 체크를 따른다. 이건 다르다 —
//   이번 주 보스의 추천 파티·추천 딜러는 "오늘 무엇을 데려갈까" 에 답하는 자리다.
//   데이터만 있고 게임에 없는 개체를 여기 올리면 그건 답이 아니라 거짓말이다.
//   덱 짜기(maxDeckCandidates)·상세 추천 칩·솔플 후보가 이미 같은 규칙이다.
//
//   (제보 — "미구현된 애들로 보스 덱을 짜주면 어떡해". v3.36.0 이 DMAX_DATA·DMAX_TANK 에
//    미구현 행을 넣을 때 이 아코디언만 거르는 곳이 없어 1~5위가 전부 미구현으로 찼다)
function maxReleased(rows) {
  return (rows ?? []).filter((row) => !row.unrel);
}

function whyFormula(pokemon) {
  return `점수 ${pokemon.score.toLocaleString()} = 공격 ${pokemon.atk} × 위력 ${pokemon.power} × 자속 ${pokemon.stab ? '1.2' : '1'} × 내구 보정 ${pokemon.bulkMul ?? 1}`;
}
function whyGrade(pokemon, topScore) {
  const list = DMAX_TIER[pokemon.charged] ?? [];
  // 2026-09-15 v3.36.0 비교 상대도 순위도 **출시분** 기준이다 — 아직 못 쓰는 개체를 1위로 두면
  // 대비 % 가 실제로 겨룰 상대와 무관한 숫자가 된다.
  // 2026-09-16 v3.49.0 단, [미구현] 이 켜져 있으면 표가 가상 순위이므로 여기도 같은 판으로 센다 —
  // 근거 줄이 표를 설명하는 자리라, 표에 5위라고 적힌 줄이 근거에서 1위가 되면 둘 다 못 믿는다.
  // 점수 칸의 %(pokemon.pct)는 빌드가 **출시분 1위** 대비로 계산해 둔 절대 기준이라 건드리지 않는다:
  // 등급 글자(S/A/B/C)가 그 값에서 나오므로, 여기서 기준을 바꾸면 등급과 숫자가 어긋난다
  const pool = maxUnrelShown() ? list : list.filter((entry) => !entry.unrel);
  const topOfType = pool[0];
  const typeLabel = TYPE_KO[pokemon.charged] ?? '';
  const isTop = topOfType && sameMaxEntry(topOfType, pokemon);
  const versus = topOfType ? ` (1위 ${topOfType.name} 대비 ${Math.round(pokemon.score / topOfType.score * 100)}%)` : '';
  const rank = pool.findIndex((entry) => sameMaxEntry(entry, pokemon)) + 1;
  const place = !topOfType ? '' : isTop ? `${typeLabel} 1위` : `${typeLabel} ${rank}위${versus}`;
  return `${pokemon.tier} 등급 — 전 종 1위 대비 ${pokemon.pct ?? Math.round(pokemon.score / topScore * 100)}%${place ? ` · ${place}` : ''}`;
}
// 2026-09-14 v3.30.0 등급·점수가 무슨 뜻인지 한 번에 밝히는 안내. 제목 옆 ⓘ 에 달린다 —
// 티어 글자는 탭이 아니라 전 종 기준이고, 점수에는 내구가 약하게 섞여 있다는 두 가지가 핵심이다
const DMAX_TIER_INFO = '등급은 이 탭이 아니라 전 종을 통틀어 매깁니다 — 전 종 최고 점수 대비 90% 이상 S, 80% 이상 A, 70% 이상 B, 그 아래 C. 그래서 탭을 옮겨도 글자가 바뀌지 않아요. 순위는 이 탭 안에서만 셉니다. 점수 = 공격 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2 × 내구 보정(방어 × 체력 ÷ 1000 의 네제곱근). 내구를 약하게 섞는 이유는 화력만 보면 진화 단계가 짧은 개체가 앞서기 때문이에요 — 맥스 배틀은 버티면서 맥스 페이즈를 여러 번 도는 싸움이라 내구가 실제로 값을 합니다.'

// 2026-09-02 티어표 행: pogomate 기준 % 표시 (내구 미반영)
// 점수 칸은 절대 점수가 아니라 "이 목록 1위(topScore) 대비 %"다.
// 2026-09-14 v3.30.0 점수 칸의 % 를 **전 종 1위 대비**(pct)로 바꿨다 — 전에는 그 탭 1위 대비라,
// 절대 기준으로 매긴 등급 글자와 숫자가 서로 다른 말을 했다(바위 탭 1위라 100% 인데 등급은 A).
// 탭 안에서의 비교는 펼친 근거 줄(whyGrade)이 맡는다
function tierRowNode(pokemon, rank, topScore) {
  return row(pokemon, rank.text,
    el('span', { class: 'row__score' }, `${pokemon.pct ?? Math.round(pokemon.score / topScore * 100)}%`),
    el('span', { class: 'row__sub' }, `공격 ${pokemon.atk} · 위력 ${pokemon.power}${pokemon.stab ? ' · 자속' : ''} · 내구 ${pokemon.bulk ?? 0}`),
    [pokemon.fast, `${TYPE_KO[pokemon.charged]} 타입`],   // 2026-09-06 v2.10.0 G-MAX/D-MAX 뱃지는 이름의 폼 라벨로 대체
    rank.tag);
}

// 티어표 행 + 그 아래 접혀 있는 "선정 근거" 줄을 한 묶음(fragment)으로 만든다.
// 행을 누르면 근거 줄이 열리고 닫힌다(.open 토글). 그래서 행의 원래 클릭 동작(상세 팝업)은
// cloneNode로 지워 버리고, 상세 팝업은 근거 줄 안의 "포켓몬 상세 ▸" 버튼으로 따로 열게 했다.
function expandableRow(pokemon, rank, topScore) {
  const rowNode = tierRowNode(pokemon, rank, topScore).cloneNode(true);  // cloneNode로 팝업 클릭 리스너 제거
  // 2026-09-02 가안 B: 근거 아래 "얘가 보스면?" 카운터 한 줄
  // 이 포켓몬의 첫 번째 속성을 보스 속성으로 보고, 그 보스를 잡을 딜러 상위 5마리를 곁들인다.
  const counterType = pokemon.types?.[0];
  const counters = counterType ? (DMAX_DATA[counterType] ?? []).filter((entry) => !entry.unrel).slice(0, 5) : [];   // 미구현은 추천 칩에 넣지 않는다
  // 2026-09-10 v2.43.0 근거 줄을 두 칸으로 나눴다 — 왼쪽은 "왜 이 티어인가"(계산식), 오른쪽은
  // "이 포켓몬이 보스로 나오면 누구를 데려가나". 성격이 다른 두 정보가 한 문단에 이어져 있어
  // 어디까지가 계산식인지 눈이 못 잘랐다. 칸마다 제목을 달아 무엇을 읽는 중인지 밝힌다
  const whyNode = el('li', { class: 'row__why tier-report' },
    el('div', { class: 'row__why-col' },
      el('b', { class: 'row__why-title' }, `${pokemon.name} · 티어 평가 리포트`),
      el('div', { class: 'tier-report__summary' },
        el('strong', {}, `${pokemon.tier} 등급`),
        el('span', {}, el('b', {}, `${pokemon.pct ?? Math.round(pokemon.score / topScore * 100)}%`), ' 전 종 1위 대비')),
      el('p', { class: 'row__why-line' }, whyFormula(pokemon)),
      el('p', { class: 'row__why-line' }, whyGrade(pokemon, topScore)),
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
        }, sprite(counter.sprite), el('span', {}, counter.name))))) : '');
  // 2026-09-10 v2.52.0 한 번에 하나만 연다 (아코디언).
  // 전에는 카드마다 따로 토글해서, 넷을 차례로 누르면 근거 넷이 한꺼번에 펼쳐진 채 쌓였다.
  // 근거는 카드 뒤에 가로폭을 다 쓰고 붙으므로(order, pc-theme.css) 여러 개가 열리면
  // 어느 카드의 근거인지 짝지을 수 없다 — 화면에 근거가 하나면 그 질문 자체가 없다.
  // 같은 카드를 다시 누르면 닫힌다(끄는 길을 남긴다)
  rowNode.addEventListener('click', () => {
    const willOpen = !whyNode.classList.contains('is-open');
    for (const other of document.querySelectorAll('.row__why.is-open')) other.classList.remove('is-open');
    for (const selected of document.querySelectorAll('.row.is-report-selected')) {
      selected.classList.remove('is-report-selected');
      selected.setAttribute('aria-expanded', 'false');
    }
    if (!willOpen) return;
    rowNode.classList.add('is-report-selected');
    rowNode.setAttribute('aria-expanded', 'true');
    whyNode.classList.add('is-open');
  });
  const fragment = document.createDocumentFragment();
  fragment.append(rowNode, whyNode);
  return fragment;
}

// 2026-09-02 이번 주 보스 아코디언: 탭 위로 이동, 추천 딜러 딜량순 5개씩 더보기
// 보스 속성(typeKey)을 상대할 딜러를 앞에서 count마리만 잘라 스프라이트 버튼으로 만든다.
function bossRecNodes(typeKey, count) {
  return maxReleased(DMAX_DATA[typeKey]).slice(0, count).map((pokemon, index) =>
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
  const dealers = maxReleased(DMAX_DATA[typeKey]).slice(0, 2);
  const tanks = maxReleased(typeof DMAX_TANK !== 'undefined' ? DMAX_TANK?.[typeKey] : []);
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
  const total = maxReleased(DMAX_DATA[bossItem.t]).length;   // 세는 것도 출시분만 — '전체 41종' 이 실제로 볼 수 있는 수와 달라지면 안 된다
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
function tankRow(pokemon, rank, bossType) {
  return row(
    pokemon, rank.text, el('span', { class: 'row__score' }, String(pokemon.ehp)),
    el('span', { class: 'row__sub' }, bossType === 'overall' ? `EHP · 체력 ${pokemon.hp} × 방어 ${pokemon.def}` : `EHP · 받는 배율 ×${pokemon.mult} · 체력 ${pokemon.hp} × 방어 ${pokemon.def}`),
    pokemon.types.map((typeName) => `${TYPE_KO[typeName]} 타입`),
    rank.tag);
}

// 2026-09-07 v2.13.0 (QA-43) 보스 속성별 탱커 목록 (탭 세그먼트 '탱커')
function renderMaxTank(selectedType) {
  const tanks = maxVisible(typeof DMAX_TANK !== 'undefined' ? DMAX_TANK[selectedType] : null);
  const title = selectedType === 'overall' ? 'D-MAX 탱커 (중립 · 순수 내구)' : `${TYPE_KO[selectedType]} 보스 상대 D-MAX 탱커`;
  $content.append(
    el('div', { class: 'row-head' }, el('div', { class: 'row-head__title' }, el('h2', {}, title), maxHypoBadge()), el('span', { class: 'meta' }, `상위 ${tanks.length}`)),
    list(`maxtank-${selectedType}`, tanks, (pokemon) => tankRow(pokemon, maxRank(tanks, pokemon), selectedType)));
  $note.textContent = '탱커 순위: EHP = 체력 × 방어 ÷ 1000 ÷ (보스 타입 기술을 받는 배율). 레벨 40 실전 능력치 기준이고, 보스는 자기 타입 자속 기술로 때린다고 가정해요(복합 타입 보스는 상세 팝업의 타입 상성을 함께 보세요). 출시된 다이맥스·거다이맥스만 포함. 포켓몬을 누르면 상세 정보가 열려요.';
  maxNoteUnrelTail();
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
  const tierItems = maxVisible(DMAX_TIER[selectedType]);
  const tierTitle = selectedType === 'overall' ? 'D-MAX 티어표 (전체)' : `${TYPE_KO[selectedType]} 맥스무브 D-MAX 티어표`;
  // ⓘ 는 제목과 한 묶음(.row-head__title)으로 감싼다 — .row-head 가 space-between 이라
  // 맨몸으로 두면 제목과 '9종' 사이 한가운데로 밀려나고, 휴대폰(row-head 가 block)에서는 제 줄로 떨어진다
  // 휴대폰은 hover 가 없어 title 툴팁이 안 뜬다 — 누르면(Enter 포함) 같은 글을 제목 아래에 펼친다
  const $note = el('p', { class: 'info-note', hidden: '' }, DMAX_TIER_INFO);
  const $dot = el('span', { class: 'info-dot', tabindex: '0', role: 'button', 'aria-expanded': 'false', title: DMAX_TIER_INFO }, 'ⓘ');
  const toggleNote = () => { $note.hidden = !$note.hidden; $dot.setAttribute('aria-expanded', String(!$note.hidden)); };
  $dot.addEventListener('click', toggleNote);
  $dot.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleNote(); } });
  $content.append(el('div', { class: 'row-head' },
    el('div', { class: 'row-head__title' }, el('h2', {}, tierTitle), $dot, maxHypoBadge()),
    el('span', { class: 'meta' }, `${tierItems.length}종`)), $note);
  // 2026-09-14 v3.30.1 순위 배지는 탭 전체 순위다 — renderTierList 가 넘기는 index 는 티어 묶음 안 순번이라
  // 등급이 절대 기준이 된 뒤로는 B 티어 첫 카드가 '1' 로 찍혀 근거의 '땅 2위' 와 어긋났다
  if (tierItems.length) renderTierList(tierItems, (pokemon) => expandableRow(pokemon, maxRank(tierItems, pokemon), tierItems[0].score));  // 2026-09-02 1B·pogomate %
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
  $note.textContent = '티어표 행을 누르면 선정 근거가 펼쳐져요. 티어표는 pogomate와 같은 기준: 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영, 다이맥스·거다이맥스는 별도 항목이며 %는 그 목록 1위 대비예요. 속성 칩은 그 타입 맥스무브를 쓰는 개체를 모아요(포켓몬 자체 타입이 아님). 출시된 다이맥스·거다이맥스만 포함. 포켓몬을 누르면 상세 정보가 열려요.';
  maxNoteUnrelTail();
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
  const attackers = maxVisible(DMAX_DATA[selectedType]);
  const title = selectedType === 'overall' ? 'D-MAX 딜러 (중립 · 맥스 피해 × √내구)' : `${TYPE_KO[selectedType]} 보스 상대 D-MAX 딜러`;
  $content.append(
    el('div', { class: 'row-head' }, el('div', { class: 'row-head__title' }, el('h2', {}, title), maxHypoBadge()), el('span', { class: 'meta' }, `상위 ${attackers.length}`)),
    list(`max-${selectedType}`, attackers, (pokemon) => maxRow(pokemon, maxRank(attackers, pokemon))));
  $note.textContent = '위는 티어표(그 타입 맥스무브를 쓰는 개체), 아래는 딜러(그 타입 보스를 상대할 개체) — 같은 타입을 골라도 보는 각도가 달라 명단이 달라요. 티어표는 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영이고 행을 누르면 근거가 펼쳐져요. 딜러 순위는 맥스어택 3레벨(위력 350) 또는 거다이맥스 3레벨(위력 450) 1회 피해 × √내구 기준이며, 보스 속성을 고르면 그 속성 보스를 때릴 때의 상성이 반영돼요(전체는 중립). 출시된 다이맥스·거다이맥스만 포함. 포켓몬을 누르면 상세 정보가 열려요.';
  maxNoteUnrelTail();
}

function renderMax() {
  // 2026-09-15 v3.32.0 도구가 켜져 있으면 그 화면이다 — PvP 와 같은 규칙(주소가 도구를 정한다).
  // 덱 짜기는 순위표가 아니라 다른 화면이라 세그먼트·칩·보기 전환을 그리지 않는다
  if (state.maxTool === 'deck') {
    const backButton = maxDeckToolButton();
    backButton.classList.add('js-head-action');   // D-MAX 화면과 같은 자리에 둔다 — 버튼이 움직이면 같은 버튼으로 안 읽힌다
    $controls.append(backButton);
    return renderMaxDeck();
  }
  // [미구현] 체크는 기기에 남은 값을 매 렌더 다시 읽는다 — 보기 전환(layoutInitial)과 같은 방식이라
  // 따로 초기화 훅이 필요 없고, 다른 탭에서 바꾼 값도 돌아오면 그대로 따라온다
  state.maxShowUnrel = maxUnrelInitial();
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
  axisSeg.classList.add('js-screen-tab');   // v3.35.0 탭은 화면 설명 아래 제 줄로 (이번 주 보스보다 위)
  $controls.append(axisSeg);
  // 2026-09-15 v3.33.0 차례를 [전체|딜러|탱커] → 🧩 덱 짜기 → 보기 전환 으로.
  // 앞 둘은 **무엇을 볼지**, 마지막은 **어떻게 볼지** 라 성격이 같은 것끼리 붙는다.
  // 머리 슬롯은 .js-head-action 을 만난 차례대로 담으므로 여기 붙이는 차례가 곧 화면의 차례다
  // 2026-09-15 v3.37.0 [미구현] 체크가 맨 왼쪽 — **무엇을 볼지**(목록의 범위)를 정하는 값이라
  // 도구(덱 짜기)·보기 전환보다 앞이다. 표에 미구현이 한 줄도 없는 탭에서는 아예 안 그린다
  if (maxUnrelAllowed() && maxHasUnreleased(state.maxBoss)) {
    const unrelCheck = maxUnrelCheckbox();
    unrelCheck.classList.add('js-head-action');
    $controls.append(unrelCheck);
  }
  const deckButton = maxDeckToolButton();
  deckButton.classList.add('js-head-action');
  $controls.append(deckButton);
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

// 2026-09-15 v3.37.0 [미구현] 체크 — 데이터만 있고 아직 못 쓰는 줄을 보일지 정한다.
// 기본은 꺼짐: 처음 들어온 사람에게 표는 **지금 쓸 수 있는 것**이어야 한다. 켜면 흐린 줄이 끼어든다.
// 선택은 이 기기에 남는다 (보기 전환과 같은 규칙 — 화면마다 따로 기억한다)
const MAX_UNREL_KEY = 'pogo_max_unrel';
// 체크를 볼 수 있는 사람에게만 붙는 한 문장. $note 에 **따로 붙인다** —
// 본문에 이어 붙이면 문장 전체가 사전의 새 열쇠가 돼 세 안내마다 영문을 새로 맞춰야 한다.
// 조각으로 두면 기존 세 열쇠는 그대로고 이 한 줄만 사전에 더하면 된다
const MAX_UNREL_NOTE = '머리의 [미구현] 을 켜면 데이터만 등록되고 아직 게임에 나오지 않은 개체도 함께 봐요 — 왼쪽에 빨간 막대가 서고, 순위는 그것들이 나왔다고 가정한 가상 판으로 다시 매겨져요(밀린 줄에는 [지금 N위]). 관리자만 보이는 값이에요.';
function maxNoteUnrelTail() {
  if (!maxUnrelAllowed() || !maxHasUnreleased(state.maxBoss)) return;
  // 표식을 달아 둔다 — 로그인이 늦게 끝나면 syncMaxUnrelControl() 이 이 조각만 나중에 붙이거나 뗀다
  $note.append(el('span', { class: 'js-unrel-note' }, ' ' + MAX_UNREL_NOTE));
}
function maxUnrelInitial() {
  try { return localStorage.getItem(MAX_UNREL_KEY) === '1'; } catch { return false; }   // 저장 불가 환경(사생활 모드 등)
}
// 지금 보는 탭에 미구현이 있기는 한가 — 없으면 체크박스를 그리지 않는다.
// 늘 그려 두면 "눌러도 아무 일도 없는 칸" 이 되고, 그 자리는 화면 머리라 값이 비싸다
function maxHasUnreleased(selectedType) {
  const tables = [
    typeof DMAX_TIER !== 'undefined' ? DMAX_TIER?.[selectedType] : null,
    typeof DMAX_DATA !== 'undefined' ? DMAX_DATA?.[selectedType] : null,
    typeof DMAX_TANK !== 'undefined' ? DMAX_TANK?.[selectedType] : null,
  ];
  return tables.some((rows) => (rows ?? []).some((row) => row.unrel));
}
// 2026-09-15 v3.39.0 로그인 결과는 첫 렌더보다 **늦게** 온다 (Firebase SDK 지연 로드).
// 그렇다고 화면을 통째로 다시 그리면 그 사이 사람이 펼쳐 둔 근거 줄·고른 칩이 날아간다 —
// 회귀에서 실제로 터졌다(눌러 둔 티어 근거가 사라져 nav.js 가 떨어졌다).
// 그래서 머리의 체크 **한 조각만** 갈아 끼운다. 자격이 사라진 경우에만 예외로 다시 그린다
function syncMaxUnrelControl() {
  if (state.tab !== 'max' || state.maxTool === 'deck') return;
  const slot = document.getElementById('page-head-actions');
  if (!slot) return;
  const drawn = slot.querySelector('.check-toggle');
  const want = maxUnrelAllowed() && maxHasUnreleased(state.maxBoss);
  if (want === !!drawn) return;
  if (want) {
    slot.prepend(maxUnrelCheckbox());
    maxNoteUnrelTail();   // 안내의 붙임말도 같이 (없는 값을 설명하지 않듯, 생긴 값은 설명한다)
    return;
  }
  drawn.remove();
  $note.querySelector('.js-unrel-note')?.remove();
  // 로그아웃처럼 자격이 사라졌는데 흐린 줄이 켜져 있으면 그때는 목록을 다시 그려야 한다
  if (state.maxShowUnrel) render();
}

function maxUnrelCheckbox() {
  const box = el('input', { type: 'checkbox', class: 'check-toggle__box' });
  box.checked = state.maxShowUnrel;
  const label = el('label', {
    class: `check-toggle${state.maxShowUnrel ? ' is-on' : ''}`,
    title: '게임 파일에 데이터는 있지만 아직 못 쓰는 개체를 함께 봐요 — 왼쪽에 빨간 막대가 서고, 순위는 그것들이 나왔다고 가정한 가상 판이 돼요',
    onchange: () => {
      state.maxShowUnrel = box.checked;
      try { localStorage.setItem(MAX_UNREL_KEY, box.checked ? '1' : '0'); } catch { /* 저장 불가 환경 */ }
      track('max_unrel_' + (box.checked ? 'on' : 'off'));   // GA4: 이 값을 켜는 사람이 얼마나 되는지
      render();
    },
  }, box, el('span', { class: 'check-toggle__text' }, '미구현'));
  return label;
}

// 2026-09-12 v3.5.0 D-MAX 보기 전환 — 넓은 화면의 카드 격자(.row-list)를 줄로 되돌린다.
// 도감·레이드 PvE 와 같은 규칙의 별도 키다 (화면마다 선택이 섞이지 않게)
// 2026-09-15 v3.32.0 D-MAX 화면과 덱 짜기를 오가는 버튼 하나. 두 화면이 같은 버튼을 쓴다 —
// 켜져 있으면 눌러서 순위표로 돌아오고, 꺼져 있으면 눌러서 덱 짜기로 간다
function maxDeckToolButton() {
  const on = state.maxTool === 'deck';
  return toolButton('🧩 덱 짜기', on, () => {
    track('tool_dmaxdeck', { on: on ? 0 : 1 });
    navigateHash(on ? routeHash('dmax') : routeHash('dmax-deck'));
  });
}

const MAX_COLS_KEY = 'pogo_max_cols';
function applyMaxLayout(grid) {
  rowListLayout(grid);   // 2026-09-12 v3.9.1 레이드 · PvE 와 같은 일이라 components/ui.js 한 곳으로 뺐다
}
