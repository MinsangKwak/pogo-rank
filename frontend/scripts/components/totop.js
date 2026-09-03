// 2026-09-03 긴 목록에서 한 번에 맨 위로 (스크롤이 깊어지면 나타나는 플로팅 버튼)
function initTotop() {
  const btn = document.getElementById('totop');
  if (!btn) return;
  addEventListener('scroll', () => { btn.hidden = scrollY < 600; }, { passive: true });
  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
}
initTotop();
