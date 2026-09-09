'use strict';
// v2.39.1 로그아웃 뒤 로그인이 매번 auth/internal-error 로 실패하던 문제 회귀
//
// 이 스위트가 지키려는 것
//   - signIn() 이 auth/internal-error 를 받으면 같은 팝업을 다시 시도하는 대신 리다이렉트로 넘어가는가
//   - 리다이렉트가 성공하면 사용자에게 오류를 보이지 않고 로그인 상태로 넘어가는가
//   - 리다이렉트까지 실패하면 그 오류를 그대로 안내하는가 (조용히 실패하지 않는가)
//   - cancelled-popup-request 는 지금처럼 리다이렉트를 시도하지 않고 조용히 넘어가는가 (회귀 없음)
//
// 왜 "같은 방식 재시도"가 아니라 "리다이렉트로 전환"인가 (v2.39.0 → v2.39.1)
//   처음엔 로그아웃 정리가 끝나기 전에 팝업이 뜨는 타이밍 문제로 보고 잠깐 쉬고 같은 팝업으로
//   재시도했지만, 실제로는 재시도도 매번 똑같이 실패했다 — 타이밍이 아니라 팝업 창과의 통신
//   자체가 막힌 경우였다. 팝업이 막힌 경우(popup-blocked)와 같은 처방으로, 창 사이 통신이 필요
//   없는 리다이렉트로 넘긴다
//
// 주의: 로그인 팝업(components/terms.js openTermsConsent)은 openModal()을 쓰는데, openModal()은
// 열릴 때 드로어를 조용히 닫는다(components/modal.js) — 첫 로그인 동의 뒤에는 드로어가 닫힌 채로
// 남으므로, 그 다음 계정 상태를 보려면 드로어를 다시 열어야 한다(실제 앱과 같은 동작, 버그 아님)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 800 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const drawerOpen = () => page.evaluate(() => !document.getElementById('drawer-backdrop').hidden);
  const openDrawer = async () => {
    if (await drawerOpen()) return;
    await page.locator('#menu-toggle').click();
    await page.waitForTimeout(300);
  };
  // 로그인은 기기당 첫 시도에서만 약관 동의 팝업을 먼저 띄운다(components/terms.js) — 동의하고 넘어간다
  const acceptTermsIfShown = async () => {
    const go = page.locator('.consent__go');
    if (!(await go.isVisible().catch(() => false))) return;
    await page.locator('.consent__check input[type="checkbox"]').nth(0).check();
    await page.locator('.consent__check input[type="checkbox"]').nth(1).check();
    await go.click();
    await page.waitForTimeout(300);
  };
  const logIn = async () => {
    await openDrawer();
    await page.locator('#account .account__login').click();
    await page.waitForTimeout(300);
    await acceptTermsIfShown();  // openModal()이 드로어를 닫았을 수 있다 — 결과를 보려면 다시 연다
    await page.waitForTimeout(900);
    await openDrawer();
  };
  const logOut = async () => {
    await openDrawer();
    await page.locator('#account button', { hasText: '로그아웃' }).click();
    await page.waitForTimeout(300);
  };

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.locator('#consent .consent__deny').click().catch(() => {});
  await page.waitForTimeout(500);
  // 이 컨텍스트에서 재사용할 정상 동작 signInWithPopup 을 미리 잡아 둔다(뒤에서 여러 번 덮어쓴다)
  await page.evaluate(() => { window.__origSignInWithPopup = firebase.auth().signInWithPopup.bind(firebase.auth()); });

  // mock=1 은 관리자로 자동 로그인된 상태로 시작한다 — 먼저 로그아웃해 비로그인으로 만든다
  await logOut();
  ok('로그아웃 뒤 로그인 버튼이 다시 보임', await page.locator('#account .account__login').isVisible());

  // ── 팝업이 auth/internal-error → 리다이렉트로 넘어가 성공하는 시나리오
  await page.evaluate(() => {
    const auth = firebase.auth();
    window.__redirectCalls = 0;
    auth.signInWithPopup = async () => { const e = new Error('internal'); e.code = 'auth/internal-error'; throw e; };
    auth.signInWithRedirect = async (...args) => { window.__redirectCalls += 1; return window.__origSignInWithPopup(...args); };
  });
  await logIn();
  ok('팝업이 internal-error 면 리다이렉트를 시도함', (await page.evaluate(() => window.__redirectCalls)) === 1);
  ok('리다이렉트 성공 시 로그인 상태로 넘어감', await page.locator('#account .account__who').isVisible());
  ok('리다이렉트 성공 시 오류 문구 없음', (await page.locator('#account .account__msg').count()) === 0);

  // ── 팝업도, 리다이렉트도 둘 다 실패하는 시나리오 — 오류를 그대로 안내해야 한다(조용히 실패 X)
  await logOut();
  await page.evaluate(() => {
    const auth = firebase.auth();
    auth.signInWithPopup = async () => { const e = new Error('internal'); e.code = 'auth/internal-error'; throw e; };
    auth.signInWithRedirect = async () => { const e = new Error('redirect-fail'); e.code = 'auth/redirect-cancelled-by-user'; throw e; };
  });
  await page.locator('#account .account__login').click();
  await page.waitForTimeout(1000);
  const msg = await page.locator('#account .account__msg').textContent().catch(() => '');
  ok('둘 다 실패하면 오류를 그대로 안내', /로그인 실패.*redirect-cancelled-by-user/.test(msg || ''), msg || '(없음)');

  // ── 기존 취소 처리 회귀: cancelled-popup-request 는 리다이렉트를 시도하지 않고 오류 문구도 없다
  await page.evaluate(() => { firebase.auth().signInWithPopup = window.__origSignInWithPopup; });
  await page.locator('#account .account__login').click();
  await page.waitForTimeout(900);
  await logOut();
  await page.evaluate(() => {
    const auth = firebase.auth();
    window.__redirectCalls = 0;
    auth.signInWithPopup = async () => { const e = new Error('cancelled'); e.code = 'auth/cancelled-popup-request'; throw e; };
    auth.signInWithRedirect = async (...args) => { window.__redirectCalls += 1; return window.__origSignInWithPopup(...args); };
  });
  await page.locator('#account .account__login').click();
  await page.waitForTimeout(600);
  ok('취소된 팝업 요청은 리다이렉트를 안 탐(회귀)', (await page.evaluate(() => window.__redirectCalls)) === 0);
  ok('취소된 팝업 요청은 오류 문구 없음(회귀)', (await page.locator('#account .account__msg').count()) === 0);

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
