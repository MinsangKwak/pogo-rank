// ─────────────────────────────────────────────────────────────────────────────
// planner/home.js — 🌱 플래너 홈 (2026-09-07 v2.15.0, QA-53)
//
// v2.15.0 은 최소 제품이라 홈은 "이 모드가 무엇인지 + 내 포켓몬으로 가는 문 + 도감으로 돌아가는 문"만 둔다.
// 로그인·승인된 사용자에게는 저장한 개체 요약(마릿수·상태별)을 함께 보여 준다.
// 후속 버전(육성 판단 · 목표 계산기 · 검색식 · 파티 · 일정 연결)은 QA 트래커 [플래너] 백로그 순서대로 이 화면에 카드로 붙는다.
//
// 제공하는 전역
//   renderPlanHome()
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode (components/name.js) · navigateHash (components/history.js)
//   openPage (components/pages.js) · switchMode (planner/shell.js) · AUTH · authEnabled · signIn (components/auth.js)
//   planMons · planMonName · planMonCp · openPlanMonEditor (planner/collection.js) · $content · $note (app.js)
// ─────────────────────────────────────────────────────────────────────────────

function renderPlanHome() {
  const loggedIn = authEnabled() && AUTH.status === 'ok';
  const mons = loggedIn ? planMons() : [];
  const countBy = (status) => mons.filter((mon) => mon.status === status).length;

  // 소개 카드
  const intro = el('div', { class: 'plan-card plan-intro' },
    el('p', { class: 'plan-title' }, '🌱 플래너 — 내 개체를 어떻게 키울까'),
    el('p', { class: 'plan-desc' }, '도감이 "뭐가 세나"에 답한다면, 플래너는 "내가 가진 이 개체를 지금 키워도 되나, 다음에 뭘 하나"에 답합니다. 먼저 내 포켓몬을 개체 단위(레벨·개체값·기술)로 저장해 두면 같은 종끼리 비교할 수 있어요.'));

  // 내 포켓몬 카드 — 로그인 상태에 따라 세 가지
  let collectionCard;
  if (!authEnabled()) {
    collectionCard = el('div', { class: 'plan-card' },
      el('p', { class: 'plan-title' }, '🎒 내 포켓몬'),
      el('p', { class: 'plan-desc' }, '이 빌드는 로그인 기능이 꺼져 있어 저장이 안 됩니다. 계산·조회는 할 수 있어요.'),
      el('button', { class: 'drawer-item', onclick: () => navigateHash('#/plan/collection') }, '🎒 내 포켓몬 열기'));
  } else if (!loggedIn) {
    collectionCard = el('div', { class: 'plan-card' },
      el('p', { class: 'plan-title' }, '🎒 내 포켓몬'),
      el('p', { class: 'plan-desc' }, AUTH.status === 'pending'
        ? '⏳ 승인 대기 중 — 승인되면 개체를 계정에 저장하고 기기 간에 동기화합니다.'
        : '로그인하면 개체를 계정에 저장하고 어느 기기에서든 같은 목록을 봅니다. 로그인 없이도 CP 계산은 해 볼 수 있어요.'),
      el('div', { class: 'acct-actions' },
        AUTH.status === 'anon' ? el('button', { class: 'drawer-item', onclick: signIn }, '🔐 Google로 로그인') : '',
        el('button', { class: 'drawer-item', onclick: () => navigateHash('#/plan/collection') }, '🎒 내 포켓몬 열기 (계산만)')));
  } else {
    const recent = [...mons].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 6);
    collectionCard = el('div', { class: 'plan-card' },
      el('p', { class: 'plan-title' }, `🎒 내 포켓몬 ${mons.length}마리`),
      mons.length
        ? el('p', { class: 'plan-desc' }, `육성 중 ${countBy('육성 중')} · 완료 ${countBy('완료')} · 교환 후보 ${countBy('교환 후보')}`)
        : el('p', { class: 'plan-desc' }, '아직 저장한 개체가 없어요. 도감 상세 팝업의 "➕ 내 개체로 저장"이나 아래 버튼으로 시작하세요.'),
      recent.length ? el('div', { class: 'boss-recs wrap-recs' }, ...recent.map((mon) =>
        el('button', { class: 'boss-rec', onclick: () => openPlanMonEditor(mon) },
          sprite(mon.sprite), el('span', {}, nameNode(planMonName(mon))), el('small', { class: 'sub' }, `Lv ${mon.level} · CP ${planMonCp(mon).toLocaleString()}`)))) : '',
      el('div', { class: 'acct-actions' },
        el('button', { class: 'drawer-item', onclick: () => navigateHash('#/plan/collection') }, mons.length ? '🎒 전체 보기 · 비교' : '➕ 첫 개체 저장하기')));
  }

  // 도감 모드로 돌아가는 문 + 후속 기능 안내
  const dexCard = el('div', { class: 'plan-card' },
    el('p', { class: 'plan-title' }, '🔎 도감 모드'),
    el('p', { class: 'plan-desc' }, '순위표·도감·상성 검색은 도감 모드에 그대로 있어요. 상세 팝업에서 "➕ 내 개체로 저장"을 누르면 여기로 돌아옵니다.'),
    el('div', { class: 'acct-actions' },
      el('button', { class: 'drawer-item', onclick: () => switchMode('dex', 'home') }, '🔎 도감 모드로'),
      el('button', { class: 'drawer-item', onclick: () => openPage('dex', 'plan') }, '📕 도감에서 찾기')));
  const roadmap = el('p', { class: 'd-foot plan-roadmap' }, '다음에 붙을 것: 육성 판단 카드(키울 가치·다음 행동) · 목표 자원 계산기 · 게임 검색식 생성기 · 보유 개체 기반 파티 · 내 목표 × 일정 연결');

  $content.append(intro, collectionCard, dexCard, roadmap);
  $note.textContent = '플래너 모드는 내 개체(레벨·개체값·기술)를 계정에 저장하고 같은 종끼리 비교하는 화면입니다. 헤더의 배지를 누르면 도감 모드로 돌아갑니다. 저장은 승인된 로그인 사용자만, 계산은 누구나.';
}
