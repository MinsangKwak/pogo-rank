// 2026-09-03 GA4 사용 추적 헬퍼: 어떤 기능을 얼마나 쓰는지 이벤트로 기록
// 측정 ID가 없거나(GA_ID 미설정 빌드) 로컬 미리보기면 gtag가 없어 전부 무시된다
function track(name, params) {
  if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
}
