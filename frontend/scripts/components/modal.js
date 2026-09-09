// ─────────────────────────────────────────────────────────────────────────────
// components/modal.js — 팝업(모달) 껍데기
//
// 제공하는 전역
//   openModal(content)          content를 담은 팝업을 띄운다 (상세·관리자 패널 등이 공유한다)
//   closeModal({ silent })      열려 있는 팝업을 닫는다. silent 면 히스토리를 건드리지 않는다
//   useDetailPanel()            지금 상세를 PC 오른쪽 패널로 열어야 하면 true (2026-09-09 v2.36.0)
//   openDetailPanel(content) · closeDetailPanel()   PC 오른쪽 패널 열고 닫기
//
// 의존하는 전역
//   el (dom.js) · NAV · pushOverlayEntry · releaseOverlayEntry · overlayVisible (components/history.js)
//   wideScreen (components/app-shell.js) · routeIdOf (router.js)
//
// 팝업은 한 번에 하나만 뜬다. 열 때 먼저(조용히) 닫고, 닫을 때는 문서에서 .overlay를 찾아 지운다.
// 2026-09-06 v2.11.0 뒤로가기: 처음 열 때 히스토리 항목을 하나 넣어 폰의 뒤로가기가 팝업을 닫게 한다 (history.js)
// ─────────────────────────────────────────────────────────────────────────────

// 팝업 껍데기: 배경 클릭·✕·Esc·뒤로가기로 닫힘
//   content  팝업 안에 넣을 노드
function openModal(content) {
  // 이미 떠 있는 팝업이 있으면 먼저 치운다 — 히스토리 항목은 그대로 두고 재사용한다 (팝업 안에서 다른 팝업 열기)
  closeModal({ silent: true, keepEntry: true });
  // 드로어 위에서 팝업을 열면 드로어는 닫는다 — 히스토리 항목은 팝업이 이어받는다
  if (typeof closeDrawer === 'function') closeDrawer({ silent: true });
  const overlay = el('dialog', {
    class: 'modal',
    'aria-label': content.querySelector('h2')?.textContent || '상세 정보',
    // 배경만 눌렀을 때 닫는다. 팝업 안쪽을 눌러도 클릭이 여기까지 올라오므로(이벤트 버블링)
    // event.target이 배경 자신인지 확인해야 한다
    onclick: (event) => { if (event.target === overlay) closeModal(); },
  },
    el('div', { class: 'modal__wrap' },
      // 2026-09-09 v2.34.0 ✕를 카드 안이 아니라 밖(오른쪽 위, 카드 테두리 바깥)에 둔다.
      // 안에 있으면 카드 내용(예: 상세 팝업의 공유·저장 아이콘)과 자리를 다툴 여지가 늘 있었는데,
      // 밖으로 빼면 카드 안에서 뭘 어떻게 배치하든 겹칠 자리 자체가 없다. 스크롤에도 카드가 움직이지 않으니
      // sticky 트릭도 필요 없다
      el('button', { class: 'modal__close', 'aria-label': '닫기', onclick: () => closeModal() }, '✕'),
      el('div', { class: 'modal__box' }, content)));
  // 2026-09-08 v2.30.0 안쪽 내용이 식별자를 달았으면 껍데기도 같이 단다 —
  // 측정 도구는 열려 있는 dialog 를 먼저 보므로, 거기서 바로 "무엇의 상세인지" 가 읽혀야 한다
  if (content.dataset?.route) {
    overlay.dataset.route = content.dataset.route;
    if (content.dataset.mon) overlay.dataset.mon = content.dataset.mon;
    if (content.dataset.sprite) overlay.dataset.sprite = content.dataset.sprite;
  }
  document.body.append(overlay);
  overlay.addEventListener('cancel', (event) => { event.preventDefault(); closeModal(); });
  overlay.showModal();
  syncScrollLock();   // 팝업 뒤의 본문이 같이 스크롤되지 않게 잠근다
  pushOverlayEntry();
}

// 팝업을 닫는다. 떠 있지 않아도 아무 일도 하지 않으므로 언제 불러도 안전하다
//   silent     히스토리 항목을 되돌리지 않는다 (popstate 로 닫히는 중 · 페이지 이동이 항목을 대체할 때)
//   keepEntry  다른 오버레이가 곧 열리므로 항목을 유지한다 (openModal 내부용)
function closeModal({ silent = false, keepEntry = false } = {}) {
  const overlay = document.querySelector('.modal');
  if (overlay) { overlay.close(); overlay.remove(); }
  syncScrollLock();   // 드로어가 아직 열려 있으면 잠금은 그대로 유지된다
  // 2026-09-06 v2.9.0 상세 딥링크(#/mon/…)를 열어 둔 채 닫으면 주소에서 해시만 지운다 (히스토리 항목 추가 없음)
  if (overlay && /^#\/mon\//.test(location.hash) && !keepEntry) {
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch {}
  }
  if (overlay && !keepEntry && !overlayVisible()) releaseOverlayEntry(silent);
}

// Esc로 닫기. 팝업마다 리스너를 달고 떼는 대신 문서에 하나만 달아 둔다
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.querySelector('.modal')) { event.preventDefault(); closeModal(); } });

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-09 v2.36.0 PC 오른쪽 상세 패널 — 넓은 화면에서는 상세를 팝업(다이얼로그)이 아니라
// 목록 오른쪽 고정 패널(#detail-panel)에 띄운다. 목록을 계속 보면서 여러 포켓몬을 이어서 확인할 수 있다.
// 좁은 화면은 지금까지처럼 팝업이다.
// #detail-panel 은 스크립트가 만들지 않고 index.html 에 처음부터 있다(#page·#drawer-backdrop 과 같은 자리) —
// #/mon/<id> 딥링크로 바로 들어오면 이 파일의 코드가 pages.js 의 첫 렌더보다 늦게 조각을 만들 수도 있어서다
//
// 제공하는 전역
//   useDetailPanel()          지금 상세를 패널로 열어야 하면 true (넓은 화면 = app-shell.js 의 wideScreen)
//   openDetailPanel(content)  content 를 패널에 채우고 연다 (openModal 과 같은 모양의 content 를 받는다)
//   closeDetailPanel()        패널을 닫는다
//
// 패널은 모달과 달리 화면을 덮지 않는다 — 뒤 목록이 계속 상호작용 가능하므로 스크롤 잠금·
// 히스토리 오버레이 항목(pushOverlayEntry)을 쓰지 않는다. 딥링크 해시(#/mon/id) 규칙만 모달과 맞춘다
// wideScreen(components/app-shell.js) 을 재사용하지 않고 matchMedia 를 직접 부른다 — 딥링크(#/mon/id)
// 로 처음 들어오면 pages.js 가 app-shell.js 보다 먼저 이 함수를 부르는데, wideScreen 은 const 라
// 선언되기 전에 참조하면(TDZ) typeof 로도 못 피하고 ReferenceError 가 난다. matchMedia 는 어디서 불러도 안전하다
function useDetailPanel() {
  return window.matchMedia('(min-width: 1024px)').matches;
}
function openDetailPanel(content) {
  const panel = document.getElementById('detail-panel');
  if (!panel) return false;
  document.getElementById('detail-panel-body').replaceChildren(content);
  panel.hidden = false;
  document.body.classList.add('has-detail-panel');
  if (content.dataset?.route) {
    panel.dataset.route = content.dataset.route;
    if (content.dataset.mon) panel.dataset.mon = content.dataset.mon;
    if (content.dataset.sprite) panel.dataset.sprite = content.dataset.sprite;
  }
  return true;
}
function closeDetailPanel() {
  const panel = document.getElementById('detail-panel');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.body.classList.remove('has-detail-panel');
  document.getElementById('detail-panel-body').replaceChildren();
  delete panel.dataset.route; delete panel.dataset.mon; delete panel.dataset.sprite;
  // 딥링크(#/mon/…)를 열어 둔 채 닫으면 주소에서 해시만 지운다 — closeModal 과 같은 규칙
  if (/^#\/mon\//.test(location.hash)) {
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch {}
  }
}
document.getElementById('detail-panel-close')?.addEventListener('click', () => closeDetailPanel());
// Esc 로 패널도 닫는다 (모달이 열려 있으면 그쪽이 우선 — 위 리스너가 이미 처리)
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || document.querySelector('.modal')) return;
  const panel = document.getElementById('detail-panel');
  if (panel && !panel.hidden) { event.preventDefault(); closeDetailPanel(); }
});
// 목록 화면을 벗어나면(다른 탭·메뉴로 이동) 패널을 닫는다 — 다른 화면 옆에 이전 포켓몬이 남아 있으면 헷갈린다.
// 같은 화면 안에서 다른 포켓몬을 열 때는 openDetailPanel 이 내용만 바꿔치므로 이 리스너를 타지 않는다
// (history.replaceState 는 hashchange 를 일으키지 않는다)
window.addEventListener('hashchange', () => {
  const panel = document.getElementById('detail-panel');
  if (!panel || panel.hidden) return;
  const onShell = routeIdOf() === 'home' || routeIdOf() === 'mon';
  if (!onShell) closeDetailPanel();
});
