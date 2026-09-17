'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// sw.js — 옛 v3 서비스 워커를 **스스로 걷어낸다** (2026-09-17)
//
// 왜 빈 파일이 아니라 이 코드인가
//   어제까지 dev.moncamp.kr 루트는 v3 였고, 그 페이지가 /sw.js 를 등록해 두고 갔다.
//   서비스 워커는 페이지를 닫아도 브라우저에 남아, 다음 방문 때 **캐시해 둔 v3 껍데기**를
//   먼저 내준다. 그대로 두면 전에 들른 사람은 루트가 v4 로 바뀐 줄도 모르고 옛 화면을 본다.
//   (파일을 아예 지우면 404 가 나고, 그때 브라우저는 옛 워커를 그냥 계속 쓴다.)
//
//   그래서 같은 자리에 '스스로 물러나는' 워커를 한 벌 올린다 — 캐시를 비우고,
//   등록을 지우고, 열려 있는 탭을 다시 불러온다. 한 번 돌고 나면 이 파일도 할 일이 없다.
//   v4 가 제 캐시 전략을 갖추면(PWA) 그때 이 자리를 그 코드가 이어받는다.
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    // 지금 열려 있는 탭은 아직 옛 껍데기를 보고 있다 — 새로 받아 오게 한다
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
