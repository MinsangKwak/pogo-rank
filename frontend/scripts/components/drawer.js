// ─────────────────────────────────────────────────────────────────────────────
// components/drawer.js — 오른쪽에서 열리는 드로어 메뉴와 검색창 토글
//
// 제공하는 전역
//   openDrawer()   드로어를 연다 (계정 버튼·☰ 버튼·다른 화면에서도 부른다)
//   closeDrawer()  드로어를 닫는다
//   initDrawer()   헤더 버튼들에 동작을 붙인다 (파일 끝에서 바로 한 번 실행한다)
//
// 의존하는 전역
//   AUTH · signIn (components/auth.js)
//
// 드로어의 열림/닫힘은 #drawer-backdrop의 hidden 속성 하나로만 표현한다.
// 상태를 따로 변수에 들고 있지 않으므로 DOM이 곧 상태다.
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-02 오른쪽 드로어 메뉴 + 검색창 토글
// 2026-09-06 v2.11.0 뒤로가기: 열 때 히스토리 항목을 넣어 폰의 뒤로가기가 드로어를 닫게 한다 (components/history.js)
function openDrawer() {
  closeModal({ silent: true });
  closeSearchDialog(true);
  const drawer = document.getElementById('drawer-backdrop');
  drawer.hidden = false;
  if (!drawer.open) drawer.showModal();
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'true');
  document.getElementById('drawer-close').focus();
  syncScrollLock();   // 드로어가 떠 있는 동안 뒤쪽 본문이 같이 스크롤되지 않게 잠근다
  pushOverlayEntry();
}
//   silent  히스토리 항목을 되돌리지 않는다 (popstate 로 닫히는 중 · 팝업으로 넘어가며 항목을 재사용 · 페이지 이동)
function closeDrawer({ silent = false } = {}) {
  const $backdrop = document.getElementById('drawer-backdrop');
  const wasOpen = !$backdrop.hidden;
  if ($backdrop.open) $backdrop.close();
  $backdrop.hidden = true;
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
  syncScrollLock();
  if (wasOpen && !silent && !overlayVisible()) releaseOverlayEntry(false);
}

// 헤더의 ☰·계정·🔍 버튼과 드로어 닫기 동작을 한 번에 연결한다
function initDrawer() {
  const $backdrop = document.getElementById('drawer-backdrop');
  $backdrop.addEventListener('cancel', (event) => { event.preventDefault(); closeDrawer(); });
  document.getElementById('menu-toggle').addEventListener('click', openDrawer);
  // 2026-09-03 v2.2.0 계정 버튼: 비로그인 → 바로 Google 로그인, 로그인 상태 → 드로어(계정 영역)
  document.getElementById('account-toggle').addEventListener('click', () => { AUTH.user ? openDrawer() : signIn(); });
  document.getElementById('drawer-close').addEventListener('click', () => closeDrawer());
  // 어두운 배경만 눌렀을 때 닫는다. 드로어 안쪽 클릭도 배경까지 올라오므로(이벤트 버블링)
  // event.target이 배경 자신인지 확인해야 한다
  $backdrop.addEventListener('click', (event) => { if (event.target === $backdrop) closeDrawer(); });
  // Esc로 닫기. 드로어가 닫혀 있을 때 눌린 Esc까지 처리하지 않도록 hidden을 함께 본다
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$backdrop.hidden) closeDrawer(); });
  // 검색 패널 토글: 평소엔 접어두고 🔍 로 열기 (v2.12.1 열기·닫기·비우기는 search.js toggleSearchPanel)
  document.getElementById('search-toggle').addEventListener('click', () => toggleSearchPanel());
}
initDrawer();
