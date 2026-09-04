// ─────────────────────────────────────────────────────────────────────────────
// components/totop.js — "맨 위로" 플로팅 버튼
//
// 제공하는 전역
//   initTotop()   버튼에 스크롤·클릭 동작을 붙인다 (파일 끝에서 바로 한 번 실행한다)
//
// 의존하는 전역
//   없음 (index.html의 #totop 버튼만 찾는다)
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-03 긴 목록에서 한 번에 맨 위로 (스크롤이 깊어지면 나타나는 플로팅 버튼)
function initTotop() {
  const button = document.getElementById('totop');
  if (!button) return;
  // 스크롤 이벤트는 아주 자주 오므로 passive로 달아 스크롤을 막지 않게 한다.
  // 600px 아래로 내려가야 버튼이 보인다
  addEventListener('scroll', () => { button.hidden = scrollY < 600; }, { passive: true });
  button.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
}
initTotop();
