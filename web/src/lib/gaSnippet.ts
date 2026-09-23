// ─────────────────────────────────────────────────────────────────────────────
// lib/gaSnippet.ts — <head> 에 심는 GA 불러오기 조각 (v4 scripts/ga-snippet.html 이식, v5 운영 전환)
//
// **v5 첫 판에는 이 조각이 없었다.** track.ts 는 window.gtag 를 기다리기만 했고 심는 자리가 없어
// dev 에서 한 건도 안 나갔다 — 조용해서 운영 전환 점검에서야 드러났다.
//
// v4 와 같은 것
//   · moncamp.kr 에서만 센다 — 미리보기 주소(vercel.app)가 운영 지표에 섞이지 않게
//   · '통계 끄기'(pogo_consent=denied)면 스크립트를 아예 안 불러온다 (CLAUDE.md §3)
//   · 광고 저장은 거부로 둔다 · 봇으로 보이면 안 센다
//   · 홈으로 들어오면 여기서 첫 조회를 보내고, 하위 화면은 라우터가 제목을 세운 뒤 보낸다 (GA_SENT_FIRST)
// v4 와 다른 것 하나 — 주소가 해시가 아니라 경로다. 옛 해시 주소로 들어오면 곧 경로로 옮겨지므로
// 여기서는 세지 않는다(옮긴 뒤 문서가 센다)
// ─────────────────────────────────────────────────────────────────────────────

/** id 가 비면 조각을 안 만든다 — dev 채널과 GA 를 안 쓰는 빌드 */
export function gaSnippet(id: string): string {
  if (!/^G-[A-Z0-9]+$/.test(id)) return '';
  return `(function () {
  if (!location.hostname.endsWith('moncamp.kr')) return;
  var id = ${JSON.stringify(id)};
  try { if (localStorage.getItem('pogo_consent') === 'denied') return; } catch (e) {}
  var bot = navigator.webdriver
    || (window.screen && window.screen.width === 800 && window.screen.height === 600)
    || /headless|puppeteer|playwright|bot|crawler|spider/i.test(navigator.userAgent || '');
  if (bot) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  // 해시는 한 번 담아 견준다 — 해시 대입을 막는 검사(web-test.yml)가 비교까지 대입으로 읽는다
  var hash = location.hash;
  var atHome = location.pathname === '/' && (!hash || hash === '#' || hash === '#/');
  window.GA_SENT_FIRST = atHome;
  window.gtag('config', id, atHome ? { page_location: location.origin + '/' } : { send_page_view: false });
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(tag);
})();`;
}
