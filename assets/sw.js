// 2026-09-03 v2.0.0 오프라인 캐시: 페이지·데이터는 네트워크 우선, 스프라이트는 캐시 우선(불변)
const CACHE = 'moncamp-v6';  // 2026-09-12 v2.67.0 v5 — sprites-anim/ 이 캐시 대상에 들어와 규칙이 바뀌었다 (옛 캐시는 activate 가 지운다)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./', copy));
      return res;
    }).catch(() => caches.match('./')));
  } else if (url.origin === location.origin && /\/sprites(-anim)?\//.test(url.pathname)) {
    // 스프라이트는 id별 불변 — 캐시 우선
    // 2026-09-12 v2.67.0 움직이는 그림(sprites-anim/)도 같은 규칙. 상세를 열 때 한 장씩만 받으므로
    // 캐시에 쌓이는 양은 내가 열어 본 포켓몬 수만큼이다
    // 2026-09-07 v2.16.1 ?r=n 재시도 주소도 같은 파일이라 쿼리를 뗀 키로 캐시를 찾고 저장한다. 네트워크 실패는 한 번 더 시도
    const key = new Request(url.origin + url.pathname);
    const fromNet = () => fetch(e.request).catch(() => fetch(e.request, { cache: 'reload' }));
    e.respondWith(caches.match(key).then((hit) => hit || fromNet().then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    })));
  } else if (url.origin === location.origin && (url.pathname.endsWith('style.css') || url.pathname.endsWith('data.js') || url.pathname.endsWith('data-lazy.js') || url.pathname.endsWith('app.js') || url.pathname.endsWith('app-lazy.js'))) {
    // 데이터는 매일 갱신 — 네트워크 우선, 실패 시 캐시
    // 2026-09-16 v3.46.0 app.js 도 같은 규칙. 전에는 이 코드가 HTML 안에 있어 'navigate' 규칙이 챙겼는데,
    // 밖으로 빼면서 어느 갈래에도 안 걸려 오프라인에서 화면이 통째로 비게 될 뻔했다.
    // 주소에 ?v=버전 이 붙지만 캐시 키는 요청 그대로 쓴다 — 판이 바뀌면 키도 바뀌어 옛 것을 안 집는다
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
  }
});
