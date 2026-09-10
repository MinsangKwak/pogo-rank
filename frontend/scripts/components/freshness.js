// ─────────────────────────────────────────────────────────────────────────────
// components/freshness.js — "지금 보고 있는 것이 최신인가" (2026-09-10 v2.50.0)
//
// 왜 필요한가
//   알 부화 풀·레이드 보스는 게임 쪽에서 수시로 바뀌고, 서버는 매일 00시에 새로 받아 빌드한다.
//   그런데 **홈 화면에 설치한 앱(PWA)은 한 번 띄우면 그대로 살아 있다.** 탭을 닫지 않는 브라우저도 같다.
//   그 안의 data.js 는 앱을 처음 연 그날 것이라, 며칠이 지나도 화면은 그날 데이터를 계속 보여 준다.
//   서버는 최신인데 사용자는 옛것을 보는 상태 — "바뀌었는데 반영이 안 된다" 가 이 모양이다.
//   서비스워커는 data.js 를 네트워크 우선으로 받지만(static/sw.js), 그건 **다시 받을 때** 이야기다.
//   앱이 다시 받지 않으면 아무 소용이 없다.
//
// 어떻게 하나
//   앱이 다시 보이는 순간(visibilitychange)에 **작은 표식 파일 하나**(build.json, 100바이트 미만)를
//   캐시 없이 받아 지금 띄워 둔 것과 견준다. 다르면 줄 하나를 띄운다. 자동으로 새로고침하지는 않는다 —
//   보던 화면과 스크롤이 통째로 날아가고, 무엇이 왜 바뀌었는지도 모른 채 화면만 튄다.
//   고를 기회를 주고, 누르면 그때 새로고침한다.
//
// 왜 data.js 를 직접 안 보나
//   data.js 는 1.5MB 다. 앱을 열 때마다 그걸 받아 비교하면 확인 비용이 본체보다 크다.
//   build.json 은 버전과 데이터 날짜만 들어 있어 그 비교에 딱 맞다 (backend/build.py 가 만든다).
//
// 제공하는 전역
//   FRESH_CHECK_GAP · checkFreshness() · initFreshness()
//
// 의존하는 전역
//   el (dom.js) · GAMEDAY (data.js) · BUILD_VERSION (backend/build.py 가 심는다) · track (track.js)
// ─────────────────────────────────────────────────────────────────────────────

// 다시 보일 때마다 묻지는 않는다 — 앱을 자주 오가는 사람에게는 그게 성가시다.
// 10분은 "잠깐 다른 앱 갔다 옴" 과 "한참 뒤에 다시 옴" 을 가르는 선이다
const FRESH_CHECK_GAP = 10 * 60 * 1000;
let _freshLastCheck = 0;
let _freshBarShown = false;

// 지금 띄워 둔 화면이 어떤 빌드인지 (backend/build.py 가 BUILD_VERSION 을 심는다).
// 헤더에 글자로 박아 둔 버전(__VERSION__)은 못 쓴다 — app-shell.js 가 헤더를 갈아 끼우며 지워 버린다
function currentBuildMark() {
  return {
    version: typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : '',
    fetched: typeof GAMEDAY !== 'undefined' ? (GAMEDAY.fetched || '') : '',
  };
}

// 새 빌드가 있다고 알리는 줄. 한 번만 띄우고, 닫으면 이 세션에서는 다시 띄우지 않는다
function showFreshBar(next) {
  if (_freshBarShown) return;
  _freshBarShown = true;
  const dataChanged = next.fetched && next.fetched !== currentBuildMark().fetched;
  const bar = el('div', { class: 'fresh-bar', role: 'status' },
    el('span', { class: 'fresh-bar__ico', 'aria-hidden': 'true' }, '🔄'),
    el('span', { class: 'fresh-bar__text' }, dataChanged
      ? `새 데이터가 있어요 (${next.fetched} 기준) — 알 부화·레이드 보스가 바뀌었을 수 있어요.`
      : '새 버전이 나왔어요.'),
    el('button', { class: 'fresh-bar__go', onclick: () => {
      track('fresh_reload', { to: next.fetched || next.version });
      location.reload();
    } }, '새로고침'),
    el('button', { class: 'fresh-bar__close', 'aria-label': '닫기', onclick: () => bar.remove() }, '✕'));
  document.body.append(bar);
}

// 표식 파일을 캐시 없이 받아 견준다. 실패는 조용히 넘긴다 — 확인이 안 됐을 뿐 화면은 멀쩡하다
async function checkFreshness(force = false) {
  const now = Date.now();
  if (!force && now - _freshLastCheck < FRESH_CHECK_GAP) return null;
  _freshLastCheck = now;
  try {
    const res = await fetch(`build.json?t=${now}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const next = await res.json();
    const mine = currentBuildMark();
    // 버전이나 데이터 날짜 중 하나라도 다르면 새 빌드다
    const stale = (next.version && next.version !== mine.version)
      || (next.fetched && mine.fetched && next.fetched !== mine.fetched);
    if (stale) showFreshBar(next);
    return stale ? next : null;
  } catch {
    return null;
  }
}

function initFreshness() {
  // 다시 보이는 순간에만 묻는다. 첫 로드는 방금 받은 것이라 물을 이유가 없다
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkFreshness();
  });
  // 설치형 앱은 화면을 껐다 켜도 visibilitychange 가 안 오는 기기가 있어 포커스도 함께 본다
  window.addEventListener('focus', () => checkFreshness());
  // 앱을 켜 둔 채 자정을 넘기는 경우 — 그때는 다시 보이지 않아도 새 데이터가 나온다
  setInterval(() => { if (document.visibilityState === 'visible') checkFreshness(); }, FRESH_CHECK_GAP);
}
