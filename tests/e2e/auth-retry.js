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
const { launch, newContext, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { viewport: { width: 900, height: 800 } });
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

  // ── 2026-09-10 v2.48.0 (긴급) 홈 화면에 설치한 앱(PWA)도 **팝업을 먼저 쓴다**
  // 전에는 display-mode: standalone 이면 무조건 리다이렉트로 보냈는데, 이 서비스는 authDomain 이
  // 앱과 다른 출처라 리다이렉트가 자격을 들고 돌아오지 못한다(브라우저의 사이트 간 저장소 차단).
  // 그래서 설치형 앱에서 로그인이 통째로 안 됐다. 이 검사는 그 분기가 되살아나는 것을 막는다
  // 앞 검사(취소된 팝업)가 비로그인 상태로 끝나므로 여기서 따로 로그아웃하지 않는다
  await page.evaluate(() => { firebase.auth().signInWithPopup = window.__origSignInWithPopup; });
  await page.evaluate(() => {
    // 설치형 앱인 척한다 — 예전 코드는 이 값을 보고 리다이렉트로 갈랐다
    const realMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => /display-mode:\s*standalone/.test(query)
      ? { matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : realMatchMedia(query);
    const auth = firebase.auth();
    window.__redirectCalls = 0;
    window.__popupCalls = 0;
    auth.signInWithPopup = async (...args) => { window.__popupCalls += 1; return window.__origSignInWithPopup(...args); };
    auth.signInWithRedirect = async () => { window.__redirectCalls += 1; };
  });
  await page.locator('#account .account__login').click();
  await page.waitForTimeout(1200);
  ok('설치형 앱(PWA)도 팝업을 쓴다', (await page.evaluate(() => window.__popupCalls)) === 1, String(await page.evaluate(() => window.__popupCalls)));
  ok('설치형 앱에서 리다이렉트로 새지 않는다', (await page.evaluate(() => window.__redirectCalls)) === 0);
  ok('설치형 앱에서 로그인 성공', (await page.evaluate(() => AUTH.status)) !== 'anon', await page.evaluate(() => AUTH.status));

  // ── 리다이렉트가 **오류 없이 빈손으로** 돌아온 경우 — 가장 흔한 실패 모양이라 말로 알려 준다
  await logOut();
  await page.evaluate(() => {
    localStorage.setItem('pogo_auth_redirect', String(Date.now()));   // 리다이렉트로 나갔던 표시
    firebase.auth().getRedirectResult = async () => ({ user: null }); // 자격 없이 돌아옴
  });
  await page.evaluate(() => initAuth());
  await page.waitForTimeout(1200);
  const emptyMsg = await page.locator('#account .account__msg').textContent().catch(() => '');
  ok('빈손 리다이렉트를 말로 알려 준다', /끝까지 가지 못했어요/.test(emptyMsg || ''), (emptyMsg || '').slice(0, 40));
  ok('안내 뒤에는 표시를 지운다', !(await page.evaluate(() => localStorage.getItem('pogo_auth_redirect'))));

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
