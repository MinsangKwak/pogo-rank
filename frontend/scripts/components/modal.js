// ─────────────────────────────────────────────────────────────────────────────
// components/modal.js — 팝업(모달) 껍데기
//
// 제공하는 전역
//   openModal(content)   content를 담은 팝업을 띄운다 (상세·일정표·패치노트 등이 공유한다)
//   closeModal()         열려 있는 팝업을 닫는다
//
// 의존하는 전역
//   el (dom.js)
//
// 팝업은 한 번에 하나만 뜬다. 그래서 열 때 먼저 닫고, 닫을 때는 문서에서 .overlay를 찾아
// 지우는 식으로 관리한다 (열려 있는 팝업을 변수에 들고 있지 않아도 된다).
// ─────────────────────────────────────────────────────────────────────────────

// 팝업 껍데기: 배경 클릭·✕·Esc로 닫힘
//   content  팝업 안에 넣을 노드
function openModal(content) {
  // 이미 떠 있는 팝업이 있으면 먼저 치운다 (팝업이 겹쳐 쌓이지 않게)
  closeModal();
  const overlay = el('div', {
    class: 'overlay',
    // 배경만 눌렀을 때 닫는다. 팝업 안쪽을 눌러도 클릭이 여기까지 올라오므로(이벤트 버블링)
    // event.target이 배경 자신인지 확인해야 한다
    onclick: (event) => { if (event.target === overlay) closeModal(); },
  },
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      // 2026-09-02 X버튼을 sticky 바에 넣어 스크롤해도 항상 보이게
      el('div', { class: 'modal-close-bar' },
        el('button', { class: 'modal-close', 'aria-label': '닫기', onclick: closeModal }, '✕')),
      content));
  document.body.append(overlay);
  // 팝업 뒤의 본문이 같이 스크롤되지 않게 잠근다 (닫을 때 closeModal이 되돌린다)
  document.body.style.overflow = 'hidden';
}

// 팝업을 닫는다. 떠 있지 않아도 그냥 아무 일도 하지 않으므로 언제 불러도 안전하다
function closeModal() {
  document.querySelector('.overlay')?.remove();
  document.body.style.overflow = '';
  // 2026-09-06 v2.9.0 상세 딥링크(#/mon/…)를 열어 둔 채 닫으면 주소에서 해시만 지운다 (히스토리 항목 추가 없음)
  if (/^#\/mon\//.test(location.hash)) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
  }
}

// Esc로 닫기. 팝업마다 리스너를 달고 떼는 대신 문서에 하나만 달아 둔다
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
