// 2026-09-02 오른쪽 드로어 메뉴 + 검색창 토글
function openDrawer() {
  document.getElementById('drawer-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('drawer-backdrop').hidden = true;
  document.body.style.overflow = '';
}
function initDrawer() {
  const $backdrop = document.getElementById('drawer-backdrop');
  document.getElementById('menu-toggle').addEventListener('click', openDrawer);
  // 2026-09-03 v2.2.0 계정 버튼: 비로그인 → 바로 Google 로그인, 로그인 상태 → 드로어(계정 영역)
  document.getElementById('account-toggle').addEventListener('click', () => { AUTH.user ? openDrawer() : signIn(); });
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  $backdrop.addEventListener('click', (e) => { if (e.target === $backdrop) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$backdrop.hidden) closeDrawer(); });
  // 검색창 토글: 평소엔 접어두고 🔍 로 열기
  const $search = document.querySelector('.psearch');
  document.getElementById('search-toggle').addEventListener('click', () => {
    $search.hidden = !$search.hidden;
    if (!$search.hidden) document.getElementById('psearch').focus();
  });
}
initDrawer();
