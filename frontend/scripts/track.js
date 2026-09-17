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

// 2026-09-17 v3.57.0 화면 전환을 page_view 로 보낸다 — **GA 의 기본 보고서가 화면별로 갈리게 하려고.**
//
// 무엇이 틀렸었나. gtag('config') 는 페이지가 통째로 실릴 때 page_view 를 딱 한 번 보낸다.
// 우리는 해시 라우터라 화면을 옮겨도 문서는 그대로다 — 그래서 한 세션에 page_view 가 한 건뿐이었고,
// 그 한 건의 경로마저 '/' 였다(해시는 pathname 이 아니다). 실측 3일치: 조회수 60 이 전부 '/' 하나.
// route_view 는 93건 찍혔지만 그건 맞춤 이벤트라, 콘솔에 맞춤 측정기준을 등록하기 전에는
// 어느 보고서에도 안 나온다. 즉 "어느 화면을 봤나" 를 볼 방법이 사실상 없었다.
//
// 고친 방법. 화면을 옮길 때마다 page_view 를 **직접** 보내고, 주소를 가상 경로로 바꿔 준다
// (#/dex → /dex). 그러면 '페이지 경로' 보고서가 화면별로 갈리고, GA 가 화면마다 재는
// 참여 시간·이탈도 화면 단위로 쌓인다. 경로는 실제로 열리는 주소가 아니라 **측정용 이름**이다.
//
// 앞 화면을 page_referrer 로 같이 보낸다 — 어디서 어디로 갔는지(이동 경로)를 GA 가 이어 붙일 수 있다.
// route_view 는 그대로 둔다. GA 이벤트명은 불변이고, 이미 쌓인 자료와 이어 봐야 한다.
// 가상 경로 계산. head 의 GA 스니펫이 먼저 돌며 같은 함수를 심어 두지만, 통계 동의를 껐다가
// 다시 켠 길에서는 스니펫이 일찍 빠져나가 함수가 없다 — 그 경우 여기서 채운다.
// 스니펫과 여기, 두 곳에 같은 규칙이 있는 이유는 순서다: 스니펫은 <head>(번들보다 먼저)에서
// 첫 조회를 보내야 하고, 번들은 그 뒤 모든 화면 전환을 맡는다.
window.gaVirtualUrl = window.gaVirtualUrl || function () {
  const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
  return location.origin + '/' + raw;
};

// 스니펫이 홈 첫 조회를 이미 보냈다면 같은 주소를 두 번 세지 않게 시작값을 맞춘다.
// 하위 화면으로 들어온 경우는 스니펫이 보내지 않았으므로 빈 값 — 번들이 첫 한 건을 맡는다.
let _gaLastUrl = window.GA_SENT_FIRST && typeof window.gaVirtualUrl === 'function' ? window.gaVirtualUrl() : '';
function trackPageView() {
  if (IS_BOT_LIKE) return;
  if (typeof window.gtag !== 'function' || typeof window.gaVirtualUrl !== 'function') return;
  const url = window.gaVirtualUrl();
  if (url === _gaLastUrl) return;   // 같은 화면을 다시 그리는 것은 새 조회가 아니다
  const from = _gaLastUrl;
  _gaLastUrl = url;
  window.gtag('event', 'page_view', {
    page_location: url,
    page_title: document.title,
    ...(from ? { page_referrer: from } : {}),
  });
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
