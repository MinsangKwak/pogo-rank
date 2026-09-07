// ─────────────────────────────────────────────────────────────────────────────
// components/history.js — 뒤로가기가 "사이트를 나가는" 대신 "열린 것을 닫게" 만드는 히스토리 관리 (2026-09-06 v2.11.0)
//
// 문제
//   팝업(상세)·드로어(☰)는 DOM 만 띄우고 히스토리에는 아무것도 남기지 않았다. 폰에서 뒤로가기를 누르면
//   팝업이 닫히는 게 아니라 이전 페이지(또는 사이트 밖)로 가 버렸다.
//
// 방식
//   오버레이(팝업·드로어)를 처음 열 때 history.pushState 로 항목을 하나 넣는다(NAV.open).
//   - 사용자가 뒤로가기 → popstate → 열린 오버레이를 전부 닫는다
//   - X·배경·Esc 로 닫으면 → DOM 을 먼저 지우고 history.back() 으로 그 항목을 되돌린다
//   - 팝업 위에서 다른 팝업을 열거나(진화 줄), 드로어에서 팝업으로 넘어갈 때는 항목을 하나만 유지한다(silent 닫기)
//   - 오버레이가 열린 채 페이지(#/dex 등)로 이동할 때는 그 항목을 location.replace 로 덮어써 히스토리에
//     "닫힌 팝업" 항목이 남지 않게 한다 (navigateHash)
//
// 제공하는 전역
//   NAV                 { open } — 오버레이용 히스토리 항목이 있는지
//   pushOverlayEntry()  오버레이를 열 때 호출 (이미 있으면 재사용)
//   releaseOverlayEntry(silent)  마지막 오버레이를 닫을 때 호출. silent 면 항목을 되돌리지 않는다
//   navigateHash(hash)  페이지 해시로 이동. 오버레이가 열려 있으면 닫고 그 항목을 대체한다
//   overlayVisible()    지금 화면에 오버레이(팝업 또는 드로어)가 보이는지
// ─────────────────────────────────────────────────────────────────────────────

const NAV = { open: false };

function overlayVisible() {
  return !!document.querySelector('.overlay') || document.getElementById('drawer-backdrop')?.hidden === false || !!document.getElementById('search-dialog')?.open;
}

function pushOverlayEntry() {
  if (NAV.open) return;
  try {
    history.pushState({ overlay: true }, '', location.href);
    NAV.open = true;
  } catch { /* file:// 등 pushState 가 막힌 환경 — 히스토리 없이 동작 */ }
}

// 마지막 오버레이가 닫힐 때. silent = 히스토리를 건드리지 않는다(popstate 로 닫히는 중이거나, 페이지 이동이 항목을 대체할 때)
function releaseOverlayEntry(silent) {
  if (!NAV.open) return;
  NAV.open = false;
  if (!silent) history.back();
}

// 페이지 해시로 이동. 오버레이 항목이 있으면 replace 로 덮어써 뒤로가기 한 번에 원래 화면으로 돌아가게 한다
function navigateHash(hash) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (NAV.open) {
    NAV.open = false;
    if (typeof closeDrawer === 'function') closeDrawer({ silent: true });
    if (typeof closeModal === 'function') closeModal({ silent: true });
    if (typeof closeSearchDialog === 'function') closeSearchDialog(true);
    location.replace(target);  // hashchange 는 그대로 발생한다
    return;
  }
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

// 뒤로가기(또는 앞으로가기)로 오버레이 항목을 벗어나면 열린 것을 전부 닫는다
window.addEventListener('popstate', () => {
  if (!NAV.open) return;
  NAV.open = false;
  if (typeof closeDrawer === 'function') closeDrawer({ silent: true });
  if (typeof closeModal === 'function') closeModal({ silent: true });
  if (typeof closeSearchDialog === 'function') closeSearchDialog(true);
});
