// ─────────────────────────────────────────────────────────────────────────────
// track.js — GA4 이벤트 전송 헬퍼
//
// 제공하는 전역
//   track(name, params)   GA4 이벤트 1건 기록. 탭 전환·서브탭·덱 편집 등 곳곳에서 부른다
//   IS_BOT_LIKE           헤드리스 브라우저(자동화 봇) 신호가 있으면 true (2026-09-09 v2.37.0)
//
// 의존하는 전역
//   window.gtag (index.html이 GA 스니펫을 넣었을 때만 존재)
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-09 v2.37.0 헤드리스 브라우저(자동화 봇) 신호 감지 — GA4 최근 28일 활성 사용자 26명 중
// 9명이 화면 800×600(헤드리스 기본값) · 구글 데이터센터 소재지(Council Bluffs·Boardman·Frankfurt)에서
// 잡혀 확인됨. 차단이 아니라 집계에서만 뺀다 — 사이트 기능은 봇에게도 그대로 동작해야 한다.
// 셋 중 하나라도 해당하면 봇으로 본다(OR 조건):
//   navigator.webdriver          Selenium·Puppeteer·Playwright 자동화 플래그
//   화면 정확히 800×600          헤드리스 브라우저 기본 뷰포트
//   UA 에 headless·bot 등 포함    흔한 자동화 도구 UA 문자열
// GA4 초기화(gtag 로드, components/consent.js)보다 먼저 확인해야 하므로 번들 맨 앞(track.js)에 둔다.
// 콘솔에 남기지 않는다 — 남기면 봇이 우회를 학습할 수 있다
const IS_BOT_LIKE = (() => {
  if (navigator.webdriver) return true;
  if (window.screen?.width === 800 && window.screen?.height === 600) return true;
  return /headless|puppeteer|playwright|bot|crawler|spider/i.test(navigator.userAgent || '');
})();

// 2026-09-03 GA4 사용 추적 헬퍼: 어떤 기능을 얼마나 쓰는지 이벤트로 기록
// 측정 ID가 없거나(GA_ID 미설정 빌드) 로컬 미리보기면 gtag가 없어 전부 무시된다
// 2026-09-07 v2.18.0 통계 동의 전에도 gtag 가 없다 — components/consent.js 가 동의 뒤에만 붙인다
//   name    GA 이벤트 목록에 그대로 뜨는 이름 ('tab_max' · 'sub_pve_easy' …)
//   params  이벤트에 딸려 보낼 값. 없으면 빈 객체를 보낸다 (gtag는 인자 생략을 싫어한다)
function track(name, params) {
  if (IS_BOT_LIKE) return;
  if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
}

// 2026-09-06 v2.10.1 GA User-ID — "누가 눌렀나"를 사람 단위로 보기 위해 로그인한 계정의 Firebase uid 를 GA user_id 로 보낸다.
// uid 는 가명 식별자라 GA 정책상 허용되고(이메일·이름은 금지), 개인정보처리방침(#/privacy)에 고지돼 있다.
// 비로그인·로그아웃은 null 을 넣어 기기 단위(client_id)로 되돌린다. send_page_view:false 는 config 재호출로 page_view 가 한 번 더 찍히는 것을 막는다.
// 사용자 속성 login_status(ok/pending/anon)는 GA 에서 "승인된 친구만" 필터로 쓴다 — 콘솔 맞춤 정의(사용자 범위) 등록 필요.
function setTrackingUser(uid, status) {
  if (IS_BOT_LIKE) return;
  if (typeof window.gtag !== 'function' || typeof window.GA_MEASUREMENT_ID !== 'string') return;
  window.gtag('config', window.GA_MEASUREMENT_ID, { user_id: uid || null, send_page_view: false });
  window.gtag('set', 'user_properties', { login_status: status || 'anon' });
}
