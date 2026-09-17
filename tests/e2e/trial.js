'use strict';
// 잠시 써보기 — **꺼 둔 상태**를 지키는 회귀 (2026-09-17 v3.59.0 · components/trial.js)
//
// 왜 내용이 바뀌었나
//   v3.16.0~v3.18.0 에는 잠긴 화면을 로그인 없이 두 시간씩 세 번 열어 주는 기능이었다.
//   v3.59.0 에 잠그는 화면을 **육성 플래너 · 내 포켓몬 둘로 좁히면서 이 기능을 껐다** —
//   둘 다 내 개체를 적어 두는 자리라, 두 시간 뒤 잠기면 적어 둔 것을 못 보게 된다(체험이 아니라 손해).
//   읽기만 하는 화면은 아예 안 잠그므로 체험으로 열어 줄 것도 없다.
//
//   기능은 **지우지 않고 스위치만 내렸다**(trial.js TRIAL_ENABLED). 그래서 이 스위트는
//   "잘 돈다" 가 아니라 **"흔적이 새어 나오지 않는다"** 를 지킨다. 되살릴 때 이 파일도 같이 되돌린다.
//
// 이 스위트가 지키려는 것
//   - 잠긴 화면의 잠금 카드에 [잠시 써보기] 가 없다 (누를 수 없는 길을 보여 주지 않는다)
//   - 로그인 유도 팝업에도 없다
//   - 오른쪽 위 남은 시간 배지가 뜨지 않는다
//   - 예전에 쓰던 저장값이 남아 있어도 화면이 열리지 않는다 — 잠금은 로그인만 푼다
//   - 열어 둔 화면은 그대로 열린다 (잠금을 좁힌 것이 유지되는가)
//   - 콘솔 오류가 없다 (꺼진 채로도 코드가 성하다)
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/';

suite(async () => {
  const browser = await launch();
  const errs = [];
  const ctx = await newContext(browser, { locks: true, viewport: { width: 1440, height: 900 } });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(400);
  };
  // **보이는 것만** 센다 — 해시 이동은 문서를 다시 싣지 않아 앞 화면의 잠금 카드가
  // 감춰진 채 남는다. 그걸 같이 세면 열린 화면도 잠긴 것으로 잡힌다 (실측: raids 에서 1개)
  const lockCards = () => page.locator('#page .plan__lock:visible, #content .plan__lock:visible').count();

  // ── 잠긴 화면: 잠금은 살아 있고, 체험 버튼만 없다 ──────────────────────────
  await go('#/planner');
  ok('비로그인: 육성 플래너가 잠겨 있다', (await lockCards()) === 1);
  ok('잠금 카드에 [잠시 써보기] 가 없다', (await page.locator('.plan__lock .trial-go').count()) === 0);
  ok('남은 시간 배지가 없다', (await page.locator('#trial-timer').count()) === 0);

  await go('#/planner/collection');
  ok('내 포켓몬도 잠겨 있다', (await lockCards()) === 1);
  ok('여기에도 체험 버튼이 없다', (await page.locator('.plan__lock .trial-go').count()) === 0);

  // ── 로그인 유도 팝업에도 없다 ──────────────────────────────────────────────
  await go('');
  await page.locator('#home-tile-planner').click({ force: true });
  await page.waitForTimeout(600);
  ok('로그인 유도 팝업이 뜬다', await page.locator('.login-invite').isVisible());
  ok('팝업에도 [잠시 써보기] 가 없다', (await page.locator('.login-invite .trial-go').count()) === 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 예전 저장값이 남아 있어도 열리지 않는다 ────────────────────────────────
  // 기능을 껐다고 저장소까지 지우지는 않는다. 옛 값을 들고 있는 기기가 있어도 잠금이 풀리면 안 된다
  await page.evaluate(() => {
    try {
      localStorage.setItem('pogo_trial_used', '0');
      localStorage.setItem('pogo_trial_until', String(Date.now() + 60 * 60 * 1000));
    } catch {}
  });
  await go('#/planner');
  ok('옛 체험 기록이 남아 있어도 잠긴 채다', (await lockCards()) === 1);
  ok('그래도 배지는 뜨지 않는다', (await page.locator('#trial-timer').count()) === 0);
  ok('trialActive() 는 꺼져 있다', await page.evaluate(() => typeof trialOff === 'function' && trialOff()));

  // ── 열어 둔 화면은 그대로 ──────────────────────────────────────────────────
  for (const [hash, name] of [['#/raids', '레이드 보스'], ['#/schedule', '이벤트 일정'], ['#/dex', '포켓몬 도감']]) {
    await go(hash);
    const n = await lockCards();
    ok(`${name} 는 로그인 없이 열린다`, n === 0, `잠금 카드 ${n}개`);
  }

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close();
  finish();
});
