// ─────────────────────────────────────────────────────────────────────────────
// components/modal.js — 팝업(모달) 껍데기
//
// 제공하는 전역
//   openModal(content)          content를 담은 팝업을 띄운다 (상세·관리자 패널 등이 공유한다)
//   closeModal({ silent })      열려 있는 팝업을 닫는다. silent 면 히스토리를 건드리지 않는다
//
// 의존하는 전역
//   el (dom.js) · NAV · pushOverlayEntry · releaseOverlayEntry · overlayVisible (components/history.js)
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
    class: 'overlay',
    'aria-label': content.querySelector('h2')?.textContent || '상세 정보',
    // 배경만 눌렀을 때 닫는다. 팝업 안쪽을 눌러도 클릭이 여기까지 올라오므로(이벤트 버블링)
    // event.target이 배경 자신인지 확인해야 한다
    onclick: (event) => { if (event.target === overlay) closeModal(); },
  },
    el('div', { class: 'modal' },
      // 2026-09-02 X버튼을 sticky 바에 넣어 스크롤해도 항상 보이게
      el('div', { class: 'modal-close-bar' },
        el('button', { class: 'modal-close', 'aria-label': '닫기', onclick: () => closeModal() }, '✕')),
      content));
  document.body.append(overlay);
  overlay.addEventListener('cancel', (event) => { event.preventDefault(); closeModal(); });
  overlay.showModal();
  // 팝업 뒤의 본문이 같이 스크롤되지 않게 잠근다 (닫을 때 closeModal이 되돌린다)
  document.body.style.overflow = 'hidden';
  pushOverlayEntry();
}

// 팝업을 닫는다. 떠 있지 않아도 아무 일도 하지 않으므로 언제 불러도 안전하다
//   silent     히스토리 항목을 되돌리지 않는다 (popstate 로 닫히는 중 · 페이지 이동이 항목을 대체할 때)
//   keepEntry  다른 오버레이가 곧 열리므로 항목을 유지한다 (openModal 내부용)
function closeModal({ silent = false, keepEntry = false } = {}) {
  const overlay = document.querySelector('.overlay');
  if (overlay) { overlay.close(); overlay.remove(); }
  // 드로어가 아직 열려 있으면 스크롤 잠금은 유지한다
  if (!overlayVisible()) document.body.style.overflow = '';
  // 2026-09-06 v2.9.0 상세 딥링크(#/mon/…)를 열어 둔 채 닫으면 주소에서 해시만 지운다 (히스토리 항목 추가 없음)
  if (overlay && /^#\/mon\//.test(location.hash) && !keepEntry) {
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch {}
  }
  if (overlay && !keepEntry && !overlayVisible()) releaseOverlayEntry(silent);
}

// Esc로 닫기. 팝업마다 리스너를 달고 떼는 대신 문서에 하나만 달아 둔다
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && document.querySelector('.overlay')) { event.preventDefault(); closeModal(); } });
