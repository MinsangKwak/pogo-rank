// 2026-09-03 v2.0.0 오프라인 캐시: 페이지·데이터는 네트워크 우선, 스프라이트는 캐시 우선(불변)
const CACHE = 'pogonote-v3';  // 2026-09-07 v2.16.1 스프라이트 재시도 추가하며 캐시 세대 교체
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
  } else if (url.origin === location.origin && url.pathname.includes('/sprites/')) {
    // 스프라이트는 id별 불변 — 캐시 우선
    // 2026-09-07 v2.16.1 ?r=n 재시도 주소도 같은 파일이라 쿼리를 뗀 키로 캐시를 찾고 저장한다. 네트워크 실패는 한 번 더 시도
    const key = new Request(url.origin + url.pathname);
    const fromNet = () => fetch(e.request).catch(() => fetch(e.request, { cache: 'reload' }));
    e.respondWith(caches.match(key).then((hit) => hit || fromNet().then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    })));
  } else if (url.origin === location.origin && url.pathname.endsWith('data.js')) {
    // 데이터는 매일 갱신 — 네트워크 우선, 실패 시 캐시
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request)));
  }
});
