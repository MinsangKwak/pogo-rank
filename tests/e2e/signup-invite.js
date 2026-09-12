'use strict';
// 가입 권유 팝업 · 설정 화면 회귀 (2026-09-12 v3.11.0)
//
// 이 스위트가 지키려는 것
//   - 비로그인 첫 방문에만 뜨는가 — 로그인했거나 한 번 본 뒤에는 안 뜬다
//   - 비교 표가 **라우터 표에서 읽은 실제 잠긴 화면**을 말하는가 (지어낸 수가 아니다)
//   - 로그인 유도 팝업(.login-invite)과 선택자가 안 겹치는가 — 둘은 생김새만 같고 하는 말이 다르다
//   - 설정 화면의 세 갈래가 저장되고 안내가 로그인 상태를 따르는가
const { launch, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/';

suite(async () => {
  const browser = await launch();
  const errs = [];
  const open = async (ctx, url) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 2000 }).catch(() => {});
    return page;
  };

  // ── 1. 비로그인 첫 방문 ──────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  // 2026-09-12 v3.18.0 팝업은 임시로 내려가 있다(auth.js SIGNUP_INVITE_ENABLED) — 검사하려고 켠다
  await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite', 'on'); } catch {} });
  const page = await open(ctx, BASE);
  await page.waitForTimeout(4200);   // initAuth 의 3초 타이머보다 넉넉히
  ok('비로그인 첫 방문에 뜬다', (await page.locator('.signup-invite').count()) === 1);
  ok('가입을 원한다고 말한다', /가입/.test(await page.locator('.signup-invite h2').innerText()));
  // 잠긴 화면 수는 라우터 표에서 읽는다 — 화면이 늘면 이 수도 따라와야 한다
  const locked = await page.evaluate(() => lockedScreenNames().length);
  const shown = +(/(\d+)개 잠김/.exec(await page.locator('.signup-invite__table').innerText())?.[1] ?? -1);
  ok('잠긴 화면 수가 라우터 표와 같다', locked > 0 && shown === locked, `${shown} vs ${locked}`);
  ok('비교 표가 네 줄', (await page.locator('.signup-invite__table tbody tr').count()) === 4);
  ok('로그인 버튼이 있다', (await page.locator('.signup-invite .account__login').count()) === 1);
  // 두 팝업의 선택자가 안 겹친다 — planner.js 가 .login-invite 로 잠금 안내를 찾는다
  ok('로그인 유도 팝업과 클래스가 갈려 있다', (await page.locator('.login-invite').count()) === 0);
  await page.locator('.signup-invite .login-invite__later').click();
  await page.waitForTimeout(400);
  ok('[둘러볼게요] 로 닫힌다', (await page.locator('.signup-invite').count()) === 0);

  // ── 2. 한 번 본 뒤에는 안 뜬다 ──────────────────────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4200);
  ok('두 번째 방문에는 안 뜬다', (await page.locator('.signup-invite').count()) === 0);
  await ctx.close();

  // ── 3. 로그인한 사람에게는 안 뜬다 ─────────────────────────────────────────
  const mctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await mctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const mp = await open(mctx, BASE + '?mock=1');
  await mp.waitForTimeout(4200);
  ok('로그인한 사람에게는 안 뜬다', (await mp.locator('.signup-invite').count()) === 0,
    await mp.evaluate(() => AUTH.status));

  // ── 4. 설정 화면 ────────────────────────────────────────────────────────────
  await mp.evaluate(() => { location.hash = '#/settings'; });
  await mp.waitForTimeout(800);
  ok('설정 화면이 열린다', (await mp.locator('#page [aria-label="화면 테마"] .settings__choice').count()) === 3);
  ok('메뉴에 설정 줄이 있다', (await mp.locator('#menu-settings').count()) === 1);
  await mp.locator('#page [aria-label="화면 테마"] .settings__choice').nth(2).click();   // 어둡게
  await mp.waitForTimeout(400);
  ok('고르면 화면이 바뀐다', (await mp.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  ok('고르면 이 브라우저에 저장된다', (await mp.evaluate(() => localStorage.getItem('pogo_theme'))) === 'dark');
  ok('로그인 상태면 계정에 저장된다고 말한다', /계정/.test(await mp.locator('#page .dex__hint').innerText()));
  // 주소로 바로 들어와도 같다
  await mp.goto(BASE + '?mock=1#/settings', { waitUntil: 'domcontentloaded' });
  await mp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await mp.waitForTimeout(700);
  ok('주소로 바로 들어와도 열린다', (await mp.locator('#page [aria-label="화면 테마"] .settings__choice').count()) === 3);
  ok('고른 값이 눌린 채로 열린다', (await mp.locator('#page [aria-label="화면 테마"] .settings__choice[aria-checked="true"] b').innerText()) === '어둡게');
  await mctx.close();

  // ── 5. 비로그인 설정 화면은 "이 브라우저에만" 이라고 말한다 ────────────────
  const gctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await gctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await gctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
  const gp = await open(gctx, BASE + '#/settings');
  await gp.waitForTimeout(700);
  ok('비로그인은 이 브라우저에만 저장된다고 말한다', /브라우저/.test(await gp.locator('#page .dex__hint').innerText()));
  await gctx.close();

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
