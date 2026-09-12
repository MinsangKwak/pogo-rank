'use strict';
// 잠시 써보기 회귀 (2026-09-12 v3.16.0 · components/trial.js)
//
// 이 스위트가 지키려는 것
//   - 비로그인으로 잠긴 화면에 가면 잠금 카드에 [잠시 써보기] 가 있고, 누르면 화면이 열리고 오른쪽 위 배지가 센다
//   - 시간이 다 되면 다시 잠기고 로그인 유도 팝업이 뜬다 (그 팝업에도 [잠시 써보기] 가 있다)
//   - 세 번을 다 쓰면 버튼 대신 "이젠 가입하셔야죠" 문구가 남는다
//   - 새로고침해도 진행 중이던 시간은 이어진다 · 로그인(목)한 사람에겐 버튼이 없다
// 20초를 세 번 기다리지 않는다 — TRIAL_SECONDS 는 let 이라 평가 문맥에서 줄여 쓴다
const { launch, newContext, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/';

suite(async () => {
  const browser = await launch();
  const errs = [];
  const ctx = await newContext(browser, { locks: true, viewport: { width: 1440, height: 900 } });   // v3.18.0 잠금은 임시로 열려 있다 — 여기서는 켠다
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
  };
  const locked = () => page.locator('#page .plan__lock, #content .plan__lock').count();

  await go('#/raids');
  ok('비로그인: 레이드 보스가 잠겨 있다', (await locked()) === 1);
  ok('잠금 카드에 [잠시 써보기]', (await page.locator('.plan__lock .trial-go').count()) === 1);
  ok('남은 횟수 3번', /3/.test(await page.locator('.plan__lock .trial-go__left').innerText()));
  ok('기본 기간은 2시간', /^⏱ 잠시 써보기 \^\^ \(2시간\)$/.test(await page.locator('.plan__lock .trial-go b').innerText()), await page.locator('.plan__lock .trial-go b').innerText());
  ok('시·분 표기', await page.evaluate(() => trialSpanLabel(24 * 3600) === '24시간' && trialSpanLabel(23 * 3600 + 59 * 60 + 30) === '23시간 59분' && trialSpanLabel(90) === '1분 30초' && trialSpanLabel(30) === '30초'));

  // 1회차 — 2초로 줄여 끝까지 본다
  await page.evaluate(() => { TRIAL_SECONDS = 2; });
  await page.locator('.plan__lock .trial-go').click();
  await page.waitForTimeout(300);
  ok('누르면 화면이 열린다 (잠금 카드 없음)', (await locked()) === 0);
  ok('레이드 보스 내용이 그려졌다', (await page.locator('#page .dex__row, #page .boss, #page .gameday__list').count()) > 0);
  ok('오른쪽 위 배지가 떠 있다', await page.locator('#trial-timer').isVisible());
  const box = await page.locator('#trial-timer').boundingBox();
  ok('배지는 오른쪽 위 고정', box && box.x > 1000 && box.y < 200, JSON.stringify(box));
  ok('배지가 초를 센다', /초/.test(await page.locator('#trial-timer').innerText()));
  ok('메뉴 자물쇠가 풀렸다', (await page.locator('.app-nav [data-route="raids"].is-locked, .app-nav [data-route="raids"] .drawer__lock').count()) === 0);
  await page.waitForTimeout(2600);
  ok('시간이 끝나면 배지가 사라진다', (await page.locator('#trial-timer').count()) === 0);
  ok('다시 잠긴다', (await locked()) === 1);
  ok('끝나면 로그인 유도 팝업이 뜬다', (await page.locator('.login-invite').count()) === 1);
  ok('팝업에도 [잠시 써보기] — 남은 횟수 2번', /2/.test(await page.locator('.login-invite .trial-go__left').innerText()));
  ok('쓴 횟수가 저장됐다', (await page.evaluate(() => localStorage.getItem('pogo_trial_used'))) === '1');

  // 2회차 — 팝업의 버튼으로 시작하고, 새로고침해도 이어지는가
  await page.evaluate(() => { TRIAL_SECONDS = 6; });
  await page.locator('.login-invite .trial-go').click();
  await page.waitForTimeout(300);
  ok('팝업이 닫히고 열린다', (await page.locator('.login-invite').count()) === 0 && (await locked()) === 0);
  await go('#/raids');
  ok('새로고침해도 진행 중이면 열린 채', (await locked()) === 0);
  ok('새로고침해도 배지가 다시 선다', await page.locator('#trial-timer').isVisible());
  await page.evaluate(() => { localStorage.setItem('pogo_trial_until', String(Date.now() - 1)); });
  await page.waitForTimeout(600);
  ok('시간을 지나면 잠긴다', (await locked()) === 1);

  // 3회차 → 다 쓰면 권유 문구
  await page.locator('.login-invite__later').click().catch(() => {});
  await page.waitForTimeout(200);
  await page.evaluate(() => { TRIAL_SECONDS = 1; });
  await page.locator('.plan__lock .trial-go').click();
  await page.waitForTimeout(1600);
  ok('세 번째가 끝나면 잠긴다', (await locked()) === 1);
  ok('팝업에 버튼 대신 권유 문구', (await page.locator('.login-invite .trial-go').count()) === 0 && /가입하셔야죠/.test(await page.locator('.login-invite .trial-exhausted').innerText()));
  await page.locator('.login-invite__later').click();
  await page.waitForTimeout(200);
  ok('잠금 카드에도 권유 문구', (await page.locator('.plan__lock .trial-go').count()) === 0 && (await page.locator('.plan__lock .trial-exhausted').count()) === 1);
  ok('영어로 바꿔도 문구가 옮겨진다', await page.evaluate(() => { setLang('en'); return /sign up/i.test(document.querySelector('.plan__lock .trial-exhausted').textContent); }));
  await page.evaluate(() => setLang('ko'));

  // 로그인(목)한 사람에게는 버튼이 없다 — 잠긴 화면 자체가 없다
  const mctx = await newContext(browser, { locks: true, viewport: { width: 1440, height: 900 } });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errs.push('mock: ' + e));
  await mp.goto(BASE + '?mock=1#/raids', { waitUntil: 'domcontentloaded' });
  await mp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(600);
  ok('로그인한 사람: 잠금 카드도 버튼도 없다', (await mp.locator('.plan__lock, .trial-go').count()) === 0);

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
