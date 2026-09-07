// ─────────────────────────────────────────────────────────────────────────────
// planner/home.js — 🌱 플래너 홈 (2026-09-07 v2.15.0, QA-53 · v2.15.1 중복 버튼 정리)
//
// 홈은 "이 모드가 무엇인지"와 내 개체 요약만 보여 준다. 버튼을 두지 않는다 —
// 내 포켓몬은 탭 줄, 도감 모드는 헤더 배지, 로그인은 헤더 👤 가 각각 유일한 진입점이다 (화면 하나에 버튼 하나).
// 후속 버전(육성 판단 · 목표 계산기 · 검색식 · 파티 · 일정 연결)은 QA 트래커 [플래너] 백로그 순서대로 이 화면에 카드로 붙는다.
//
// 제공하는 전역
//   renderPlanHome()
//
// 의존하는 전역
//   el (dom.js) · AUTH · authEnabled (components/auth.js) · planMons (planner/collection.js) · $content · $note (app.js)
// ─────────────────────────────────────────────────────────────────────────────

function renderPlanHome() {
  const loggedIn = authEnabled() && AUTH.status === 'ok';
  const mons = planMons();
  const countBy = (status) => mons.filter((mon) => mon.status === status).length;

  const intro = el('div', { class: 'plan-card plan-intro' },
    el('p', { class: 'plan-title' }, '🌱 플래너 — 내 개체를 어떻게 키울까'),
    el('p', { class: 'plan-desc' }, '도감이 "뭐가 세나"에 답한다면, 플래너는 "내가 가진 이 개체를 지금 키워도 되나, 다음에 뭘 하나"에 답합니다. 위 탭의 🎒 내 포켓몬에서 개체를 레벨·개체값·기술 단위로 저장하면 같은 종끼리 비교할 수 있어요. 도감 상세 팝업의 ➕ 로도 바로 저장됩니다.'));

  let summary;
  if (!authEnabled()) {
    summary = el('p', { class: 'plan-desc' }, '이 빌드는 로그인 기능이 꺼져 있어 저장이 안 됩니다. 계산·조회는 할 수 있어요.');
  } else if (!loggedIn) {
    summary = el('p', { class: 'plan-desc' }, AUTH.status === 'pending'
      ? '⏳ 승인 대기 중 — 승인되면 개체를 계정에 저장하고 기기 간에 동기화합니다.'
      : '헤더의 👤 로 로그인하면 개체를 계정에 저장하고 어느 기기에서든 같은 목록을 봅니다. 로그인 없이도 CP 계산은 해 볼 수 있어요.');
  } else {
    summary = el('p', { class: 'plan-desc' }, mons.length
      ? `육성 중 ${countBy('육성 중')} · 완료 ${countBy('완료')} · 교환 후보 ${countBy('교환 후보')}`
      : '아직 저장한 개체가 없어요. 🎒 내 포켓몬 탭의 ➕ 개체 추가, 또는 도감 상세 팝업의 ➕ 로 시작하세요.');
  }
  const collectionCard = el('div', { class: 'plan-card' },
    el('p', { class: 'plan-title' }, loggedIn ? `🎒 내 포켓몬 ${mons.length}마리` : '🎒 내 포켓몬'),
    summary);
  const roadmap = el('p', { class: 'd-foot plan-roadmap' }, '다음에 붙을 것: 육성 판단 카드(키울 가치·다음 행동) · 목표 자원 계산기 · 게임 검색식 생성기 · 보유 개체 기반 파티 · 내 목표 × 일정 연결');

  $content.append(intro, collectionCard, roadmap);
  $note.textContent = '플래너 모드는 내 개체(레벨·개체값·기술)를 계정에 저장하고 같은 종끼리 비교하는 화면입니다. 헤더의 배지를 누르면 도감 모드로 돌아갑니다. 저장은 승인된 로그인 사용자만, 계산은 누구나.';
}
