// ─────────────────────────────────────────────────────────────────────────────
// lazy.js — 첫 화면이 안 쓰는 덩이를 뒤로 미룬다 (2026-09-16 v3.46.0)
//
// 왜
//   첫 화면이 받던 462KB(gzip) 중 94KB 가 홈에서 한 글자도 안 쓰이는 것이었다:
//     release-notes.js   30KB  패치노트 본문 — #/release 를 열어야 쓴다
//     i18n-en.js         37KB  영어 사전 — EN 으로 바꿔야 쓴다
//     i18n-release-en.js 28KB  패치노트 영문판 — 둘 다여야 쓴다
//   셋을 dist/app-lazy.js 로 묶어 **첫 렌더가 끝난 뒤** 부른다.
//
// HTML 에 <script src> 로 적지 않는 이유
//   브라우저 미리읽기가 그 줄을 보면 곧바로 받기 시작해 첫 화면과 대역폭을 나눠 쓴다.
//   실측으로 그렇게 했다가 FCP 가 1.9s → 3.3s 로 되레 늦어졌다. 그래서 JS 로 직접 넣는다.
//
// 읽는 쪽의 규칙
//   전역이 아직 없을 수 있다. 쓰는 곳은 typeof 로 막고(이미 그렇게 돼 있었다),
//   그 화면이 열려 있으면 도착한 뒤 다시 그린다. 실패해도 한국어로는 멀쩡히 돈다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

let _lazyPromise = null;

// 지연 묶음을 받는다. 두 번 불러도 요청은 한 번이다.
// 주소가 없는 빌드(미리보기 INLINE)는 이미 다 들어 있으므로 바로 성공으로 답한다
function loadLazyBundle() {
  if (typeof LAZY_BUNDLE_URL !== 'string' || !LAZY_BUNDLE_URL) return Promise.resolve(false);
  if (_lazyPromise) return _lazyPromise;
  _lazyPromise = new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = LAZY_BUNDLE_URL;
    tag.onload = () => resolve(true);
    // 실패하면 다음에 다시 시도할 수 있게 약속을 비운다 — 한 번 실패가 영구 실패가 되면 안 된다
    tag.onerror = () => { _lazyPromise = null; resolve(false); };
    document.head.appendChild(tag);
  });
  return _lazyPromise;
}

// 첫 렌더가 끝난 뒤 한가할 때 미리 받아 둔다 (app.js 가 부른다).
// 미리 받아 두면 패치노트를 열거나 EN 으로 바꿀 때 기다림이 없다
function prefetchLazyBundle() {
  const go = () => loadLazyBundle();
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}
