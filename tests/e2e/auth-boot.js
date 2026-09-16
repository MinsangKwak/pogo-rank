'use strict';
// 2026-09-16 v3.49.1 "새로고침하면 로그인이 풀린다" 회귀
//
// 실제로 풀리는 게 아니라 되돌아오는 데 오래 걸려서 그렇게 보였다 — initAuth 를 window.load 뒤에
// 부르고(Slow 4G 휴대폰 실측: DOMContentLoaded 보다 4.4초 늦다) 그 뒤에야 compat SDK 208KB 를
// 차례로 받았다. 그 십수 초 동안 화면은 [Google로 로그인] 을 내밀었고, 내 포켓몬 저장은
// 계정이 아니라 손님 저장소로 샜다.
//
// 이 스위트가 지키려는 것
//   - 이 기기에 로그인 자취(localStorage 'firebase:authUser:…')가 있으면 SDK 가 오기 전에도
//     **로그인 버튼을 내밀지 않는다** — '🔄 로그인 확인 중…' 을 보여 준다 (AUTH.status === 'loading')
//   - SDK 가 도착하면 로그인 상태로 이어진다 (확인 중 문구는 사라진다)
//   - 자취가 없으면 예전 그대로 — 곧바로 비로그인이고 로그인 버튼이 보인다
//   - 자취가 있으면 load 를 기다리지 않고 SDK 를 받기 시작한다 (예전에는 load 뒤였다)
//   - 판정 중에는 화면을 잠그지 않는다 (잠갔다 여는 깜빡임은 "로그아웃됐다" 로 읽힌다)
//   - EN 으로도 확인 중 문구가 옮겨진다
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';
// compat 이 로그인 사용자를 남기는 자리 — 우리는 이 키의 **존재만** 본다 (값은 SDK 것이다)
const STORED_KEY = 'firebase:authUser:mock-api-key:[DEFAULT]';

suite(async () => {
  const browser = await launch();
  const errs = [];

  // 목(dev-mock.js)이 늦게 도착하는 상황을 만든다 — 실제로는 gstatic 에서 208KB 를 받는 그 시간이다
  const openWith = async ({ stored, delayMs = 0 }) => {
    const ctx = await newContext(browser, { viewport: { width: 900, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(([key, want]) => {
      try { if (want) localStorage.setItem(key, JSON.stringify({ uid: 'mock-admin' })); else localStorage.removeItem(key); } catch {}
    }, [STORED_KEY, stored]);
    if (delayMs) {
      await page.route('**/dev-mock.js', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await route.continue();
      });
    }
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    return { ctx, page };
  };
  const openDrawer = async (page) => {
    await page.evaluate(() => { if (typeof openDrawer === 'function') openDrawer(); });
    await page.waitForTimeout(250);
  };

  // ── 1. 자취가 있으면 "확인 중" — 로그인 버튼을 내밀지 않는다 ────────────────
  {
    const { ctx, page } = await openWith({ stored: true, delayMs: 2500 });
    await waitSplash(page);
    await page.waitForTimeout(400);
    ok('자취가 있으면 판정 중(loading)', (await page.evaluate(() => AUTH.status)) === 'loading');
    ok('SDK 는 아직 안 왔다', (await page.evaluate(() => AUTH.ready)) === false);
    await openDrawer(page);
    ok('로그인 버튼을 내밀지 않는다', (await page.locator('.account__login').count()) === 0);
    const loading = page.locator('.account__loading');
    ok('확인 중 문구가 보인다', (await loading.count()) === 1 && /확인 중/.test(await loading.textContent()));
    // 판정 중에는 잠그지 않는다 (잠금을 되살려 둔 채로 본다 — 평소에는 LOCK_OPEN_ALL 이 다 연다)
    const lockedWhileLoading = await page.evaluate(() => {
      try { localStorage.setItem('pogo_lock_open', 'off'); } catch {}
      const answer = routeLocked('planner');
      try { localStorage.removeItem('pogo_lock_open'); } catch {}
      return answer;
    });
    ok('판정 중에는 잠그지 않는다', lockedWhileLoading === false);
    // 목이 도착하면 로그인으로 이어진다
    await page.waitForFunction(() => AUTH.status === 'ok' || AUTH.status === 'pending', null, { timeout: 8000 });
    await page.waitForTimeout(300);
    ok('SDK 가 오면 로그인 상태로 이어진다', ['ok', 'pending'].includes(await page.evaluate(() => AUTH.status)));
    await openDrawer(page);
    ok('확인 중 문구가 사라진다', (await page.locator('.account__loading').count()) === 0);
    ok('계정 카드에 사람이 보인다', (await page.locator('#account .account__who').count()) === 1);
    await ctx.close();
  }

  // ── 2. 자취가 없으면 예전 그대로 ──────────────────────────────────────────
  {
    const { ctx, page } = await openWith({ stored: false, delayMs: 2500 });
    await waitSplash(page);
    await page.waitForTimeout(400);
    ok('자취가 없으면 비로그인(anon)', (await page.evaluate(() => AUTH.status)) === 'anon');
    await openDrawer(page);
    ok('로그인 버튼이 보인다', (await page.locator('.account__login').count()) === 1);
    ok('확인 중 문구는 없다', (await page.locator('.account__loading').count()) === 0);
    await ctx.close();
  }

  // ── 3. 자취가 있으면 load 를 기다리지 않는다 ──────────────────────────────
  // 그림이 다 오기 전에 이미 SDK 를 받으러 갔는지 본다 — load 를 기다리면 그 요청이 늦게 나간다
  {
    const ctx = await newContext(browser, { viewport: { width: 900, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript((key) => {
      try { localStorage.setItem(key, JSON.stringify({ uid: 'mock-admin' })); } catch {}
      window.__loadFired = false;
      addEventListener('load', () => { window.__loadFired = true; });
    }, STORED_KEY);
    let askedBeforeLoad = null;
    await page.route('**/dev-mock.js', async (route) => {
      if (askedBeforeLoad === null) askedBeforeLoad = await page.evaluate(() => window.__loadFired === false).catch(() => null);
      await route.continue();
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    ok('load 를 기다리지 않고 SDK 를 받으러 간다', askedBeforeLoad === true, String(askedBeforeLoad));
    await ctx.close();
  }

  // ── 4. EN ────────────────────────────────────────────────────────────────
  {
    const { ctx, page } = await openWith({ stored: true, delayMs: 3000 });
    await waitSplash(page);
    await page.waitForTimeout(300);
    await page.evaluate(() => (typeof loadLazyBundle === 'function' ? loadLazyBundle() : null));
    await page.evaluate(() => setLang('en'));
    await page.waitForTimeout(500);
    await openDrawer(page);
    const text = (await page.locator('.account__loading').textContent().catch(() => '')) || '';
    ok('EN 에서 확인 중 문구가 영어', text.length > 0 && !/[가-힣]/.test(text), text);
    await ctx.close();
  }

  ok('JS 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
