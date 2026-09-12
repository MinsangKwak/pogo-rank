'use strict';
// v2.37.0 헤드리스 브라우저(봇) 신호 감지 회귀 — track.js IS_BOT_LIKE
//
// 이 스위트가 지키려는 것
//   - navigator.webdriver · 화면 800×600 · UA 의 headless/bot 등 키워드 — 셋 중 하나만 있어도 봇 판정(OR)
//   - 봇 판정이면 track()·setTrackingUser() 가 gtag 를 아예 부르지 않는다 (집계 제외)
//   - 봇이 아니면(정상 브라우저 신호) 지금까지처럼 gtag 가 불린다 — 회귀 없음
//   - 봇 판정이어도 사이트 기능(도감 목록·상세 열기 등)은 그대로 동작한다 (차단이 아니다)
//   - 판정 결과를 콘솔에 남기지 않는다 (봇이 우회를 학습하지 못하게)
//
// 주의: 이 스위트 자체가 Playwright(자동화 도구)로 돈다 — navigator.webdriver 가 기본으로 true 라
// "정상 브라우저" 시나리오는 webdriver·UA 를 일부러 정상값으로 덮어써서 흉내 낸다
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

// 페이지가 gtag 를 실제로 불렀는지 세도록, 우리 번들보다 먼저 가짜 gtag 를 심어 둔다
// (로컬 빌드는 GA_PENDING_ID 가 없어 진짜 gtag 스니펫이 안 실리므로, track() 의 typeof 검사만 통과하면 된다)
const installGtagSpy = (ctx) => ctx.addInitScript(() => { window.__gtagCalls = []; window.gtag = (...args) => window.__gtagCalls.push(args); });
const spoofNormalBrowser = (ctx) => ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
});
const NORMAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const consoleLines = [];

  // consent: 'deny' 면 window.gtag 가 아예 undefined 가 된다(기존 동작, legal.js 가 이미 지킨다) —
  // "봇이 아니면 track() 이 gtag 를 그대로 부르는가" 는 그 뒤에도 gtag 가 남아 있어야 확인할 수 있으므로 'allow' 를 쓴다
  const openAndCheck = async (ctx, consent = 'deny') => {
    const page = await ctx.newPage();
    page.on('console', (m) => consoleLines.push(m.text()));
    await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator(consent === 'allow' ? '#consent .consent__allow' : '#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(400);
    return page;
  };

  // ── 1. 기본 Playwright 컨텍스트 — navigator.webdriver 가 true 라 봇으로 잡혀야 한다
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    // 2026-09-11 v2.57.0 바깥 주소(웹폰트·Firebase)를 끊는다. 이 방(샌드박스)에는 바깥이 없어서
    // 그 요청들이 타임아웃까지 매달리고, 그동안 첫 렌더가 끝나지 않는다 — 실측 한 번 여는 데 13.7초.
    // 끊으면 1.2초다(11.5배). 앱은 바깥 것 없이도 돌게 만들어 뒀으니(대체 글꼴·?mock) 검사 내용은 그대로다.
    // 다른 스위트 열넷은 이미 이렇게 하고 있었다 — 빠진 곳만 맞춘다
    // 2026-09-12 v3.11.0 첫 방문 가입 권유 팝업은 '본 적 있음' 으로 표시해 두고 시작한다 —
    // 안 그러면 3초 뒤 모달이 떠서 그 뒤의 클릭을 전부 가로챈다 (동의 배너를 끄는 것과 같은 처방).
    // 팝업 자체는 tests/e2e/signup-invite.js 가 따로 검사한다
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await installGtagSpy(ctx);
    const page = await openAndCheck(ctx);
    ok('기본 자동화 컨텍스트는 봇으로 판정 (webdriver)', await page.evaluate(() => IS_BOT_LIKE === true));
    await page.evaluate(() => track('sub_favs_all'));
    // 2026-09-09 consent.js 는 동의 처리에 gtag('consent', 'update', …) 를 직접 부른다 — 이건 GA4
    // Consent Mode 신호(개인정보 준수용)라 이벤트 집계와 무관해 봇 여부와 상관없이 그대로 둔다.
    // 여기서는 track() 이 만드는 ('event', …) 호출만 셈해 새는 게 없는지 본다
    const eventCalls = await page.evaluate(() => window.__gtagCalls.filter((c) => c[0] === 'event'));
    ok('봇 판정이면 track() 이 gtag event 를 하나도 안 부름', eventCalls.length === 0, JSON.stringify(eventCalls));
    // 기능은 그대로 — 도감 목록이 뜨고 상세를 열 수 있다 (차단이 아니다)
    ok('봇이어도 도감 목록은 정상 표시', (await page.locator('#page .dex__row').count()) > 0);
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(400);
    const opened = (await page.locator('dialog.modal[open]').count()) > 0 || (await page.locator('#detail-panel:not([hidden])').count()) > 0;
    ok('봇이어도 상세를 열 수 있음 (기능 차단 아님)', opened);
    await ctx.close();
  }

  // ── 2. 정상 브라우저 신호로 덮어쓴 컨텍스트 — 봇이 아니어야 하고, track() 이 실제로 gtag 를 불러야 한다
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: NORMAL_UA });
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await installGtagSpy(ctx);
    await spoofNormalBrowser(ctx);
    const page = await openAndCheck(ctx, 'allow');
    ok('정상 브라우저 신호면 봇 아님', await page.evaluate(() => IS_BOT_LIKE === false));
    await page.evaluate(() => track('sub_favs_all'));
    // 이 컨텍스트는 실제 페이지라 tab_start·login 같은 다른 track() 호출도 자연히 섞인다 —
    // 내가 명시적으로 부른 이벤트가 그 안에 실제로 찍혔는지만 본다
    const eventCalls = await page.evaluate(() => window.__gtagCalls.filter((c) => c[0] === 'event'));
    ok('봇이 아니면 track() 이 gtag 를 그대로 부름 (회귀 없음)',
      eventCalls.some((c) => c[1] === 'sub_favs_all'), JSON.stringify(eventCalls));
    await ctx.close();
  }

  // ── 3. 화면 정확히 800×600 — webdriver 를 정상으로 덮어써도 이 신호 하나만으로 봇 판정
  {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, userAgent: NORMAL_UA });
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await installGtagSpy(ctx);
    await spoofNormalBrowser(ctx);
    const page = await openAndCheck(ctx);
    ok('화면 800×600 만으로도 봇 판정', await page.evaluate(() => IS_BOT_LIKE === true));
    await ctx.close();
  }

  // ── 4. UA 에 봇 키워드 — webdriver·화면을 정상으로 덮어써도 이 신호 하나만으로 봇 판정
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await installGtagSpy(ctx);
    await spoofNormalBrowser(ctx);
    const page = await openAndCheck(ctx);
    ok('UA 의 bot 키워드만으로도 봇 판정', await page.evaluate(() => IS_BOT_LIKE === true));
    await ctx.close();
  }

  // ── 판정 결과를 콘솔에 남기지 않는다
  const leaked = consoleLines.filter((line) => /is_?bot|봇\s*판정|bot.?like/i.test(line));
  ok('판정 결과를 콘솔에 남기지 않음', leaked.length === 0, leaked.join(' | ').slice(0, 200));

  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
