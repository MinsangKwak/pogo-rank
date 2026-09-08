// ─────────────────────────────────────────────────────────────────────────────
// track.js — GA4 이벤트 전송 헬퍼
//
// 제공하는 전역
//   track(name, params)   GA4 이벤트 1건 기록. 탭 전환·서브탭·덱 편집 등 곳곳에서 부른다
//
// 의존하는 전역
//   window.gtag (index.html이 GA 스니펫을 넣었을 때만 존재)
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-03 GA4 사용 추적 헬퍼: 어떤 기능을 얼마나 쓰는지 이벤트로 기록
// 측정 ID가 없거나(GA_ID 미설정 빌드) 로컬 미리보기면 gtag가 없어 전부 무시된다
// 2026-09-07 v2.18.0 통계 동의 전에도 gtag 가 없다 — components/consent.js 가 동의 뒤에만 붙인다
//   name    GA 이벤트 목록에 그대로 뜨는 이름 ('tab_max' · 'sub_pve_easy' …)
//   params  이벤트에 딸려 보낼 값. 없으면 빈 객체를 보낸다 (gtag는 인자 생략을 싫어한다)
function track(name, params) {
  if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
}

// 2026-09-06 v2.10.1 GA User-ID — "누가 눌렀나"를 사람 단위로 보기 위해 로그인한 계정의 Firebase uid 를 GA user_id 로 보낸다.
// uid 는 가명 식별자라 GA 정책상 허용되고(이메일·이름은 금지), 개인정보처리방침(#/privacy)에 고지돼 있다.
// 비로그인·로그아웃은 null 을 넣어 기기 단위(client_id)로 되돌린다. send_page_view:false 는 config 재호출로 page_view 가 한 번 더 찍히는 것을 막는다.
// 사용자 속성 login_status(ok/pending/anon)는 GA 에서 "승인된 친구만" 필터로 쓴다 — 콘솔 맞춤 정의(사용자 범위) 등록 필요.
function setTrackingUser(uid, status) {
  if (typeof window.gtag !== 'function' || typeof window.GA_MEASUREMENT_ID !== 'string') return;
  window.gtag('config', window.GA_MEASUREMENT_ID, { user_id: uid || null, send_page_view: false });
  window.gtag('set', 'user_properties', { login_status: status || 'anon' });
}
