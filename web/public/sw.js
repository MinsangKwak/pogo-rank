'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// sw.js — 오프라인 캐시 (v3 frontend/static/sw.js 이식)
//
// 규칙은 **무엇이 변하는가**로 가른다. v3 와 같은 판단이고, 갈래만 v4 의 파일 이름에 맞췄다.
//   화면(navigate)      네트워크 우선 · 실패하면 캐시해 둔 './' — 오프라인에서도 앱이 열린다
//   그림(sprites·anim)  캐시 우선 — id 별로 불변이다. 쌓이는 양은 내가 열어 본 종만큼이다
//   번들(assets/…)      캐시 우선 — vite 가 이름에 내용 해시를 박는다. 내용이 바뀌면 이름이 바뀐다
//   데이터(data/*.json) 캐시 우선 — 주소에 ?v=해시가 붙어 같은 이유로 안전하다.
//   매니페스트           **네트워크 우선** — '새 빌드가 올라왔나' 를 묻는 자리라 캐시가 답하면 안 된다
//
// v3 와 달라진 곳 하나 — v3 는 app.js·data.js 를 네트워크 우선으로 뒀다. 그 이름들은 해시가 없어
// 같은 주소가 매일 다른 내용을 담았기 때문이다. v4 는 이름이나 쿼리에 해시가 들어가 그럴 일이 없다.
// ─────────────────────────────────────────────────────────────────────────────
const CACHE = 'moncamp-v4-1';

// 2026-09-22 **도면(/storybook/)은 이 앱이 아니다 — 통째로 비켜 간다.**
// 서비스워커의 범위가 루트라 같은 도메인의 다른 판까지 들어온다. 그대로 두면 둘이 어긋난다:
//   · 온라인에서 /storybook/ 을 열면 navigate 갈래가 그 HTML 을 앱의 오프라인 자리('./')에 덮어쓴다
//     → 다음에 오프라인으로 앱을 열면 스토리북이 뜬다
//   · 오프라인에서 /storybook/ 을 열면 캐시의 './'(앱 화면)가 대신 나온다
// 캐시 이름(CACHE)은 그대로 둔다 — 바꾸면 남의 그림 캐시가 통째로 지워진다 (CLAUDE.md §2)
const OUTSIDE = /^\/storybook\//;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()),
));

// 캐시 우선 — 없으면 받아서 넣는다. 받기에 실패하면 한 번 더 시도한다(v3 와 같은 되받기)
function cacheFirst(request, key) {
  return caches.match(key).then((hit) => hit || fetch(request)
    .catch(() => fetch(request, { cache: 'reload' }))
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put(key, copy)); }
      return res;
    }));
}

// 네트워크 우선 — 받아서 넣고, 못 받으면 캐시로 답한다
function networkFirst(request, key) {
  return fetch(request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(key, copy));
    return res;
  }).catch(() => caches.match(key));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const mine = url.origin === location.origin;
  // 앱 밖의 판은 손대지 않는다 — navigate 보다 먼저 걸러야 한다 (위 주석)
  if (mine && OUTSIDE.test(url.pathname)) return;
  if (event.request.mode === 'navigate') {
    // 주소가 무엇이든 앱은 한 장이다 — './' 한 자리에만 담는다 (해시 라우팅)
    event.respondWith(networkFirst(event.request, './'));
    return;
  }
  if (!mine) return;
  if (/\/sprites(-anim)?\//.test(url.pathname)) {
    // ?r=n 재시도 주소도 같은 파일이다 — 쿼리를 뗀 키로 찾고 저장한다 (v3 v2.16.1)
    event.respondWith(cacheFirst(event.request, new Request(url.origin + url.pathname)));
    return;
  }
  if (url.pathname.endsWith('/data/manifest.json')) {
    event.respondWith(networkFirst(event.request, event.request));
    return;
  }
  if (/\/assets\/.+\.(js|css)$/.test(url.pathname) || /\/data\/.+\.json$/.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request, event.request));
  }
});
