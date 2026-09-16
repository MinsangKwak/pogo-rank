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
// 2026-09-16 v3.48.0 데이터도 같은 방식으로 — dist/data-lazy.js (gzip 84KB)
//     PVE_EASY · SHEET_DATA · BOSS_LIST · GAMEDAY · MOVE_CHANGES · ROLES
//   PvE 탭 · 레이드 보스 · 알 부화 · 기술 변경 · 솔플 계산기 · 검색이 쓴다. 홈은 한 글자도 안 쓴다.
//   그 화면들은 lazyDataReady() 로 묻고, 아직이면 lazyDataWaitNode() 를 내밀고 도착하면 다시 그린다.
//   미리 만들어 둔 색인(검색 · 보스 목록)은 onLazyData() 로 등록해 두면 도착했을 때 비운다.
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

const _lazyPromises = {};

// 지연 파일 하나를 받는다. 같은 주소를 두 번 불러도 요청은 한 번이다.
// 주소가 없는 빌드(미리보기 INLINE)는 이미 다 들어 있으므로 바로 성공으로 답한다
function _lazyScript(url) {
  if (typeof url !== 'string' || !url) return Promise.resolve(true);
  if (_lazyPromises[url]) return _lazyPromises[url];
  _lazyPromises[url] = new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = url;
    tag.onload = () => resolve(true);
    // 실패하면 다음에 다시 시도할 수 있게 약속을 비운다 — 한 번 실패가 영구 실패가 되면 안 된다
    tag.onerror = () => { delete _lazyPromises[url]; resolve(false); };
    document.head.appendChild(tag);
  });
  return _lazyPromises[url];
}

function loadLazyBundle() {
  if (typeof LAZY_BUNDLE_URL !== 'string' || !LAZY_BUNDLE_URL) return Promise.resolve(false);
  return _lazyScript(LAZY_BUNDLE_URL);
}

// 지연 데이터가 이미 있는가 — 여섯 표는 한 파일이라 하나만 보면 된다
function lazyDataReady() {
  return typeof GAMEDAY !== 'undefined';
}

// 지연 데이터를 받는다. 도착하면 등록된 후처리(색인 비우기 등)를 한 번 돌린다
function loadLazyData() {
  if (lazyDataReady()) return Promise.resolve(true);
  if (typeof LAZY_DATA_URL !== 'string' || !LAZY_DATA_URL) return Promise.resolve(false);
  const first = !_lazyPromises[LAZY_DATA_URL];
  const promise = _lazyScript(LAZY_DATA_URL);
  if (first) promise.then((ok) => { if (ok) (onLazyData.hooks || []).forEach((hook) => { try { hook(); } catch (e) { console.error(e); } }); });
  return promise;
}

// 지연 데이터가 도착하면 부를 것을 등록한다 (미리 만든 색인 비우기 · 메뉴 항목 갱신).
// 함수 선언은 번들 어디서든 보이므로 이 파일보다 앞에 있는 파일도 부를 수 있다 — 목록은 함수에 매달아 TDZ 를 피한다
function onLazyData(hook) {
  (onLazyData.hooks = onLazyData.hooks || []).push(hook);
}

// 지연 데이터가 아직일 때 화면이 내미는 한 줄. 도착하면 onReady(true), 실패하면 onReady(false).
// 실패했을 때 다시 그리면 또 이 줄로 돌아와 요청을 되풀이하므로, 실패는 여기서 문구만 바꾸고 멈춘다
function lazyDataWaitNode(onReady) {
  const node = el('p', { class: 'meta lazy-wait' }, '데이터를 불러오는 중이에요…');
  loadLazyData().then((ok) => {
    if (ok) onReady(true);
    else node.textContent = '데이터를 불러오지 못했어요. 새로고침해 주세요.';
  });
  return node;
}

// 첫 렌더가 끝난 뒤 한가할 때 미리 받아 둔다 (app.js 가 부른다).
// 데이터가 먼저다 — PvE 탭·검색이 더 자주 쓰인다. 그다음 패치노트·영어 사전
function prefetchLazyBundle() {
  const go = () => loadLazyData().then(() => loadLazyBundle());
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}
