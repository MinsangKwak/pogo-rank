'use strict';
// 회귀 스위트 공통 조각 (2026-09-12 v3.14.0)
//
// 스위트 22개가 같은 머리말을 각자 들고 있었다 — 브라우저 경로 · PASS/FAIL 집계 · 가입 권유 팝업 끄기 ·
// 바깥 요청 차단 · 스플래시 기다리기 · 종료 코드. 한 줄을 고치려면 스무 파일을 열어야 했고,
// 스위트마다 조금씩 달라져 있었다(대기 시간 12초/15초, ' :: ' 구분자). 여기 한 벌만 둔다.
//
// 파일 이름이 _ 로 시작하는 것은 스위트가 아니다 — scripts/test.sh 가 건너뛴다.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const CHROMIUM = '/opt/pw-browsers/chromium';
const SERVER = 'http://localhost:5503/';

// PASS/FAIL 한 줄씩 찍고 센다. 스위트 끝의 finish() 가 합계를 낸다
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + ' ' + extra); cond ? pass++ : fail++; };

const launch = () => chromium.launch({ executablePath: CHROMIUM });

// 새 컨텍스트 — 스위트가 늘 같은 세 가지를 먼저 한다
//   1. 가입 권유 팝업을 '본 적 있음' 으로 — 안 그러면 3초 뒤 모달이 떠서 그 뒤의 클릭을 전부 가로챈다
//      (팝업 자체는 signup-invite.js 가 따로 검사한다)
//   2. 통계를 '거부' 로 — 스위트가 GA 를 건드리지 않게. 2026-09-15 v3.45.0 첫 방문 배너를 걷어내
//      가로채는 물건은 이제 없지만, 값을 심어 두면 검사하는 화면이 통계 스크립트를 부르지 않는다.
//      { banner: true } 는 **아무것도 안 고른 첫 방문**을 재현한다 — legal.js 가
//      "그래도 배너가 안 뜬다" 를 지키는 데 쓴다 (이름은 그대로 둔다, 부르는 곳이 그 뜻으로 읽는다)
//   3. localhost 바깥 요청 차단 — 폰트·스프라이트 CDN 을 기다리느라 느려지지 않게
//   4. 2026-09-12 v3.18.0 잠금은 임시로 전부 열려 있다(router.js LOCK_OPEN_ALL). 잠금 동작을 검사하는
//      스위트는 { locks: true } 로 옛 동작을 켠다 (localStorage pogo_lock_open = 'off')
async function newContext(browser, { banner = false, locks = false, ...options } = {}) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(({ keepBanner, locks }) => {
    try {
      localStorage.setItem('pogo_signup_invite_seen', '1');
      if (!keepBanner) localStorage.setItem('pogo_consent', 'denied');
      if (locks) localStorage.setItem('pogo_lock_open', 'off');
    } catch {}
  }, { keepBanner: banner, locks });
  await ctx.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  return ctx;
}

// 스플래시가 걷힐 때까지 기다린다 (첫 화면 그림이 다 들어올 때까지 최대 2.5초 머문다).
// 2026-09-13 v3.22.0 한도 15 → 45초, 그리고 이 자리 하나로 모았다. 전에는 스위트 50곳이 같은 줄을
// 각자 들고 있었고 한도가 15초였다 — 코어 넷에 일꾼 넷이면 부하가 20 을 넘어 첫 화면이 15초를 넘기는
// 때가 있다. catch 가 그 실패를 삼키므로 스위트는 아직 안 그려진 화면에 대고 단언하다 **매번 다른
// 스위트**가 흔들렸다(단독 실행은 늘 통과). 넉넉히 기다린다 — 제때 뜨면 기다리지 않으니 느려지지 않는다
const waitSplash = (page) => page.waitForSelector('#splash', { state: 'detached', timeout: 45000 }).catch(() => {});

// 화면 이동 — 옮겨 간 뒤 스플래시가 걷히길 기다린다
async function go(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
}

// 스위트 끝 — 합계를 찍고 종료 코드로 알린다 (test.sh 는 마지막 줄과 종료 코드만 본다)
async function finish(browser) {
  if (browser) await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}

// 스위트 본문을 감싼다 — 예외로 죽으면 CRASH 한 줄과 종료 코드 1
const suite = (body) => body().catch((e) => { console.error('CRASH', e.message); process.exit(1); });

// 2026-09-16 v3.46.0 영어 사전은 지연 묶음에 있다 (scripts/lazy.js). 첫 렌더 뒤 미리 받지만
// 검사는 그 타이밍을 기다려 주지 않는다 — 먼저 받아 두고 바꾼다. 화면의 EN 버튼도 같은 순서로 돈다
async function toEnglish(page) {
  await page.evaluate(() => (typeof loadLazyBundle === 'function' ? loadLazyBundle() : null));
  await page.evaluate(() => setLang('en'));
  await page.waitForTimeout(250);
}

module.exports = {
  toEnglish, chromium, CHROMIUM, SERVER, ok, launch, newContext, go, waitSplash, finish, suite };
