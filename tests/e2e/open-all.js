'use strict';
// 2026-09-12 v3.18.0 임시 개방 · 움직이는 그림 기본 회귀
//
// 이 스위트가 지키려는 것
//   - 비로그인으로도 잠겼던 화면(레이드 보스·육성 플래너·배틀 PvP)이 열리고 메뉴에 자물쇠가 없다 (router.js LOCK_OPEN_ALL)
//   - 가입 권유 팝업이 뜨지 않는다 (auth.js SIGNUP_INVITE_ENABLED)
//   - 목록의 그림이 기본으로 움직이는 GIF 로 갈아 끼워진다 · 설정에서 끄면 정지본만 (components/sprite.js)
//   - 옛 동작(잠금·팝업)은 localStorage 스위치로 살아난다 — 그 검사는 trial.js · planner.js · signup-invite.js 가 한다
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/';

suite(async () => {
  const browser = await launch();
  const errs = [];
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  // 가입 권유 팝업 '본 적 있음' 표시를 지운다 — 내려가 있는지는 표시 없이 봐야 한다
  await ctx.addInitScript(() => { try { localStorage.removeItem('pogo_signup_invite_seen'); } catch {} });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(500);
  };

  // ── 잠금 전부 열림 ──────────────────────────────────────────────────────────
  await go('#/raids');
  ok('비로그인: 레이드 보스가 열려 있다', (await page.locator('.plan__lock:visible').count()) === 0 && (await page.locator('#page .dex__row').count()) > 0);
  ok('메뉴에 잠긴 줄이 없다', (await page.locator('.nav-menu a[aria-disabled="true"]').count()) === 0);
  await go('#/planner');
  ok('육성 플래너도 열린다 (게스트 저장)', (await page.locator('.plan__lock:visible').count()) === 0 && (await page.locator('#content .plan__hero, #content .plan__summary, #content .plan__stats').count()) > 0);
  await go('#/pvp');
  ok('배틀 · PvP 도 열린다', (await page.locator('.plan__lock:visible').count()) === 0 && (await page.locator('#content .row').count()) > 0);
  await go('');
  ok('홈 타일에 잠김 표시가 없다', (await page.locator('.home__tile[aria-disabled="true"]').count()) === 0);

  // ── 잠시 써보기도 내려가 있다 — 열어 두기 전에 시작한 시간이 남아 있어도 배지가 안 뜬다 ──
  await page.evaluate(() => { localStorage.setItem('pogo_trial_until', String(Date.now() + 60000)); });
  await go('#/raids');
  ok('진행 중이던 잠시 써보기 배지가 뜨지 않는다', (await page.locator('#trial-timer').count()) === 0 && !(await page.evaluate(() => startTrial('x'))));
  await page.evaluate(() => { localStorage.removeItem('pogo_trial_until'); });
  await go('');
  // ── 가입 권유 팝업은 내려가 있다 ─────────────────────────────────────────────
  await page.waitForTimeout(4200);   // initAuth 의 3초 타이머보다 넉넉히
  ok('가입 권유 팝업이 뜨지 않는다', (await page.locator('.signup-invite').count()) === 0);

  // ── 움직이는 그림이 기본 ──────────────────────────────────────────────────────
  await go('#/dex');
  await page.waitForFunction(() => document.querySelectorAll('#page img.sprite--anim').length > 0, null, { timeout: 8000 }).catch(() => {});
  const anim = await page.evaluate(() => ({
    anim: document.querySelectorAll('#page img.sprite--anim').length,
    gif: [...document.querySelectorAll('#page img.sprite--anim')].every((img) => /sprites-anim\/\d+\.gif$/.test(img.getAttribute('src'))),
  }));
  ok('도감 목록 그림이 GIF 로 갈아 끼워진다', anim.anim > 0 && anim.gif, JSON.stringify(anim));
  await page.locator('#page .dex__row').first().click();
  await page.waitForTimeout(600);
  ok('상세 그림도 움직인다', (await page.locator('#detail-panel .sprite-box img.sprite--anim').count()) === 1);

  // 2026-09-12 v3.19.0 움직이는 그림이 없는 종(오거폰 · 9세대)은 CSS 로 살짝 흔든다
  await go('#/dex?q=%EC%98%A4%EA%B1%B0%ED%8F%B0');
  await page.waitForTimeout(800);
  const idle = await page.evaluate(() => {
    const img = document.querySelector('#page .dex__row img.sprite');
    return img ? { anim: img.classList.contains('sprite--anim'), name: getComputedStyle(img).animationName } : null;
  });
  ok('GIF 없는 종은 CSS 로 흔든다 (sprite-idle)', idle && !idle.anim && idle.name === 'sprite-idle', JSON.stringify(idle));
  // 설정에서 끄기 → 다음 화면부터 정지본
  await go('#/settings');
  ok('설정에 움직이는 그림 줄 (기본 켜기)', await page.evaluate(() => document.querySelector('[aria-label="움직이는 그림"] .settings__choice.is-on b')?.textContent === '켜기'));
  await page.locator('[aria-label="움직이는 그림"] .settings__choice').nth(1).click();
  await page.waitForTimeout(200);
  ok('끄기가 저장된다', (await page.evaluate(() => localStorage.getItem('pogo_sprite_anim'))) === 'off');
  await go('#/dex');
  await page.waitForTimeout(1500);
  ok('끄면 정지 그림만', (await page.locator('#page img.sprite--anim').count()) === 0 && (await page.locator('#page img.sprite').count()) > 0);
  ok('끄면 흔들지도 않는다', await page.evaluate(() => document.body.classList.contains('sprite-anim-off') && getComputedStyle(document.querySelector('#page img.sprite')).animationName === 'none'));
  ok('영어로도 설정 줄이 옮겨진다', await page.evaluate(() => { setLang('en'); location.hash = '#/settings'; return true; }) && await page.waitForTimeout(600).then(() => page.evaluate(() => /Animated sprites/.test(document.body.textContent))));

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
