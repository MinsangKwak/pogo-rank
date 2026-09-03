// 팝업 껍데기: 배경 클릭·✕·Esc로 닫힘
function openModal(content) {
  closeModal();
  const overlay = el('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) closeModal(); } },
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
      // 2026-09-02 X버튼을 sticky 바에 넣어 스크롤해도 항상 보이게
      el('div', { class: 'modal-close-bar' },
        el('button', { class: 'modal-close', 'aria-label': '닫기', onclick: closeModal }, '✕')),
      content));
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.querySelector('.overlay')?.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
