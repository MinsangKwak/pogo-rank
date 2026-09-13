'use strict';
// 광고 보고 열기 회귀 (2026-09-13 v3.25.0 · components/adgate.js) — v3.16.0 trial.js(잠시 써보기)의 후신
//
// 이 스위트가 지키려는 것
//   - 비로그인으로 잠긴 화면에 가면 잠금 카드에 문이 **둘** — [📺 광고 보고 다 훑어보기 (15초 광고)] · [🔐 광고 안 보고 회원가입 후 보기]
//   - 광고 버튼을 누르면 아래에 광고 시트가 붙어 초를 세고, 그동안은 아직 잠겨 있으며, 끝까지 보면 열리고 오른쪽 위 배지가 남은 시간을 센다
//   - 중간에 [그만 볼래요] 하면 열리지 않고 오늘 횟수도 안 센다
//   - 열린 시간이 끝나면 다시 잠기고 로그인 유도 팝업이 뜬다 — 그 팝업에도 버튼은 딱 둘, [나중에]·[잠시 써보기] 없음
//   - 새로고침해도 열린 시간은 이어진다 · 하루 3번을 다 보면 광고 버튼이 잠기고 회원가입 버튼만 산다 · 날이 바뀌면 횟수가 돌아온다
//   - 광고 계정이 없는 빌드는 "광고 준비 중" 상자에 스크립트 없음 · 로그인(목)한 사람에겐 문이 없다
// 15초·2시간을 기다리지 않는다 — AD_SECONDS · AD_UNLOCK_SECONDS 는 let 이라 평가 문맥에서 줄여 쓴다
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
  // 같은 주소로 goto 하면 해시 이동으로 끝나 새로고침이 아니다 — 새로고침은 reload 로
  const reload = async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(400);
  };
  const locked = () => page.locator('#page .plan__lock, #content .plan__lock').count();
  const views = () => page.evaluate(() => localStorage.getItem('pogo_ad_views') || '');

  await go('#/raids');
  ok('비로그인: 레이드 보스가 잠겨 있다 (임시 개방 종료)', (await locked()) === 1);
  ok('잠금 카드의 문은 둘 — 광고 · 회원가입', (await page.locator('.plan__lock .ad-gate__go').count()) === 1 && (await page.locator('.plan__lock .plan__lock-go').count()) === 1);
  ok('옛 [잠시 써보기] 는 없다', (await page.locator('.trial-go, .trial-exhausted').count()) === 0);
  ok('광고 버튼 이름: 광고 보고 다 훑어보기 (15초 광고)', /광고 보고 다 훑어보기 \(15초 광고\)/.test(await page.locator('.plan__lock .ad-gate__go b').innerText()), await page.locator('.plan__lock .ad-gate__go b').innerText());
  ok('오늘 3번 남음 · 한 번에 2시간', /오늘 3번 남음.*2시간/.test(await page.locator('.plan__lock .ad-gate__sub').innerText()), await page.locator('.plan__lock .ad-gate__sub').innerText());
  ok('회원가입 버튼 이름: 광고 안 보고 회원가입 후 보기', /광고 안 보고 회원가입 후 보기/.test(await page.locator('.plan__lock .plan__lock-go').innerText()));
  ok('메뉴에 자물쇠가 있다', (await page.locator('.nav-menu a[aria-disabled="true"]').count()) > 0);
  ok('광고 계정이 없는 빌드: 광고 스크립트 없음', (await page.locator('script[src*="adsbygoogle"]').count()) === 0);
  ok('시·분 표기', await page.evaluate(() => adSpanLabel(2 * 3600) === '2시간' && adSpanLabel(3600 + 59 * 60 + 30) === '1시간 59분' && adSpanLabel(90) === '1분 30초' && adSpanLabel(15) === '15초'));

  // ── 1회차: 광고 2초 · 열림 4초 ─────────────────────────────────────────────
  await page.evaluate(() => { AD_SECONDS = 2; AD_UNLOCK_SECONDS = 4; });
  await page.locator('.plan__lock .ad-gate__go').click();
  await page.waitForTimeout(300);
  ok('광고 시트가 아래에 붙는다', await page.locator('#ad-gate').isVisible());
  const sheet = await page.locator('#ad-gate').boundingBox();
  ok('시트는 화면 아래', sheet && sheet.y + sheet.height >= 900 - 2 && sheet.y > 450, JSON.stringify(sheet));
  ok('광고 계정이 없으면 준비 중 상자', (await page.locator('#ad-gate .ad-gate__slot--empty').count()) === 1 && /광고 준비 중/.test(await page.locator('#ad-gate').innerText()));
  ok('초를 센다', /\d초/.test(await page.locator('#ad-gate .ad-gate__left').innerText()));
  ok('보는 동안은 아직 잠겨 있다', (await locked()) === 1);
  ok('아직 횟수를 안 센다', (await views()) === '');
  await page.waitForTimeout(3000);
  ok('끝까지 보면 시트가 사라진다', (await page.locator('#ad-gate').count()) === 0);
  ok('화면이 열린다 (잠금 카드 없음)', (await locked()) === 0);
  ok('레이드 보스 내용이 그려졌다', (await page.locator('#page .dex__row, #page .boss, #page .gameday__list').count()) > 0);
  ok('오른쪽 위 배지 — 광고로 열림', await page.locator('#ad-timer').isVisible() && /광고로 열림/.test(await page.locator('#ad-timer').innerText()));
  const box = await page.locator('#ad-timer').boundingBox();
  ok('배지는 오른쪽 위 고정', box && box.x > 1000 && box.y < 200, JSON.stringify(box));
  ok('오늘 1번 봤다고 적힌다 (날짜|횟수)', /^\d{4}-\d{2}-\d{2}\|1$/.test(await views()), await views());
  ok('메뉴 자물쇠가 풀렸다', (await page.locator('.nav-menu a[aria-disabled="true"]').count()) === 0);
  await page.waitForTimeout(4600);
  ok('열린 시간이 끝나면 배지가 사라진다', (await page.locator('#ad-timer').count()) === 0);
  ok('다시 잠긴다', (await locked()) === 1);
  ok('끝나면 로그인 유도 팝업이 뜬다', (await page.locator('.login-invite').count()) === 1);
  ok('팝업 제목: 광고 보거나, 회원가입하면 열려요', /광고 보거나, 회원가입하면 열려요/.test(await page.locator('.login-invite h2').innerText()));
  ok('팝업의 버튼은 딱 둘', (await page.locator('.login-invite button.drawer__item').count()) === 2 && (await page.locator('.login-invite .ad-gate__go').count()) === 1 && (await page.locator('.login-invite .login-invite__go').count()) === 1);
  ok('[나중에]·[잠시 써보기] 없음', (await page.locator('.login-invite__later, .trial-go').count()) === 0);
  ok('팝업 광고 버튼: 오늘 2번 남음', /오늘 2번 남음/.test(await page.locator('.login-invite .ad-gate__sub').innerText()));

  // ── 중간에 그만두기 — 열리지 않고 횟수도 그대로 ─────────────────────────────
  await page.evaluate(() => { AD_SECONDS = 30; });
  await page.locator('.login-invite .ad-gate__go').click();
  await page.waitForTimeout(300);
  ok('팝업이 닫히고 시트가 뜬다', (await page.locator('.login-invite').count()) === 0 && await page.locator('#ad-gate').isVisible());
  await page.locator('#ad-gate .ad-gate__cancel').click();
  await page.waitForTimeout(300);
  ok('그만 보면 시트가 사라지고 여전히 잠겨 있다', (await page.locator('#ad-gate').count()) === 0 && (await locked()) === 1);
  ok('그만 본 것은 횟수에 안 센다', /\|1$/.test(await views()), await views());

  // ── 2회차: 새로고침해도 이어진다 ────────────────────────────────────────────
  await page.evaluate(() => { AD_SECONDS = 1; AD_UNLOCK_SECONDS = 30; });
  await page.locator('.plan__lock .ad-gate__go').click();
  await page.waitForTimeout(1800);
  ok('두 번째도 열린다', (await locked()) === 0 && /\|2$/.test(await views()));
  await reload();
  ok('새로고침해도 열린 채', (await locked()) === 0);
  ok('새로고침해도 배지가 다시 선다', await page.locator('#ad-timer').isVisible());
  await page.evaluate(() => { localStorage.setItem('pogo_trial_until', String(Date.now() - 1)); });
  await page.waitForTimeout(1300);
  ok('시간을 지나면 잠긴다', (await locked()) === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // ── 3회차 → 오늘 횟수 소진 ──────────────────────────────────────────────────
  await page.evaluate(() => { AD_SECONDS = 1; AD_UNLOCK_SECONDS = 1; });
  await page.locator('.plan__lock .ad-gate__go').click();
  await page.waitForTimeout(2800);
  ok('세 번째가 끝나면 잠긴다', (await locked()) === 1 && /\|3$/.test(await views()));
  ok('팝업의 광고 버튼이 잠긴다 — 오늘 3번 다 봤어요', (await page.locator('.login-invite .ad-gate__go.is-spent[disabled]').count()) === 1 && /오늘 광고 3번을 다 봤어요/.test(await page.locator('.login-invite .ad-gate__go').innerText()));
  ok('회원가입 버튼은 그대로 (버튼 둘)', (await page.locator('.login-invite button.drawer__item').count()) === 2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok('잠금 카드의 광고 버튼도 잠긴다', (await page.locator('.plan__lock .ad-gate__go.is-spent').count()) === 1);
  ok('영어로 바꿔도 문구가 옮겨진다', await page.evaluate(() => { setLang('en'); return /watched all 3 ads/i.test(document.querySelector('.plan__lock .ad-gate__go').textContent); }));
  await page.evaluate(() => setLang('ko'));

  // ── 날이 바뀌면 횟수가 돌아온다 ─────────────────────────────────────────────
  await page.evaluate(() => { localStorage.setItem('pogo_ad_views', '2000-01-01|3'); });
  await reload();
  await page.waitForSelector('.plan__lock .ad-gate__sub', { timeout: 8000 }).catch(() => {});
  const dayText = await page.locator('.plan__lock .ad-gate__sub').innerText().catch(() => '(없음)');
  ok('어제 본 것은 오늘 횟수가 아니다 — 3번 남음', /오늘 3번 남음|3 left today/.test(dayText), dayText);

  // ── 로그인(목)한 사람에게는 문이 없다 — 잠긴 화면 자체가 없다 ────────────────
  const mctx = await newContext(browser, { locks: true, viewport: { width: 1440, height: 900 } });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errs.push('mock: ' + e));
  await mp.goto(BASE + '?mock=1#/raids', { waitUntil: 'domcontentloaded' });
  await waitSplash(mp);
  await mp.waitForTimeout(600);
  ok('로그인한 사람: 잠금 카드도 광고 버튼도 없다', (await mp.locator('.plan__lock, .ad-gate__go').count()) === 0);

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
