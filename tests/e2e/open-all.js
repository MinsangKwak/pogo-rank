'use strict';
// 잠금 범위 · 움직이는 그림 기본 회귀
// 2026-09-12 v3.18.0 임시 개방(전부 열기) → 2026-09-17 v3.59.0 **둘만 잠근다**
//
// 이 스위트가 지키려는 것
//   - 읽기만 하는 화면(레이드 보스·배틀 PvP 등)은 비로그인으로 열린다
//   - 잠기는 것은 육성 플래너 · 내 포켓몬 둘뿐 — 메뉴 자물쇠와 홈 타일까지 그 범위다
//   - 가입 권유 팝업이 뜨지 않는다 (auth.js SIGNUP_INVITE_ENABLED)
//   - 목록의 그림이 기본으로 움직이는 GIF 로 갈아 끼워진다 · 설정에서 끄면 정지본만 (components/sprite.js)
//   - 옛 동작(잠금·팝업)은 localStorage 스위치로 살아난다 — 그 검사는 trial.js · planner.js · signup-invite.js 가 한다
const { toEnglish, launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
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

  // ── 잠금 범위 (v3.59.0 둘로 좁혔다) ─────────────────────────────────────────
  // 읽기만 하는 화면은 열어 두고, 내 개체를 적어 두는 두 화면만 잠근다.
  // 잠긴 쪽의 자세한 동작(팝업 문구·주소 직접 진입)은 planner.js 가 본다 — 여기서는 범위만 확인한다
  await go('#/raids');
  ok('비로그인: 레이드 보스가 열려 있다', (await page.locator('.plan__lock:visible').count()) === 0 && (await page.locator('#page .dex__row').count()) > 0);
  ok('메뉴 자물쇠는 육성 플래너·내 포켓몬 둘뿐',
    (await page.locator('.nav-menu a[aria-disabled="true"] .drawer__label').allTextContents()).join('|') === '육성 플래너|내 포켓몬',
    (await page.locator('.nav-menu a[aria-disabled="true"] .drawer__label').allTextContents()).join('|'));
  await go('#/planner');
  ok('육성 플래너는 잠겨 있다 (내 개체를 적는 자리)', (await page.locator('.plan__lock:visible').count()) === 1);
  await go('#/pvp');
  ok('배틀 · PvP 는 열린다', (await page.locator('.plan__lock:visible').count()) === 0 && (await page.locator('#content .row').count()) > 0);
  await go('');
  ok('홈 타일 자물쇠는 육성 플래너 하나',
    (await page.locator('.home__tile[aria-disabled="true"] strong').allTextContents()).join('|') === '육성 플래너',
    (await page.locator('.home__tile[aria-disabled="true"] strong').allTextContents()).join('|'));

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
  ok('상세 그림도 움직인다', (await page.locator('dialog.modal[open] .sprite-box img.sprite--anim').count()) === 1);

  // 2026-09-12 v3.19.0 움직이는 그림이 없는 종(오거폰 · 9세대)은 CSS 로 살짝 흔들었다 —
  // 2026-09-16 v3.48.1 뺐다. 수십 장이 제각각 움찔거려 어수선했다. 정지 그림은 정지 그대로여야 한다
  await go('#/dex?q=%EC%98%A4%EA%B1%B0%ED%8F%B0');
  await page.waitForTimeout(800);
  const idle = await page.evaluate(() => {
    const img = document.querySelector('#page .dex__row img.sprite');
    return img ? { anim: img.classList.contains('sprite--anim'), name: getComputedStyle(img).animationName } : null;
  });
  ok('GIF 없는 종은 정지 그림 그대로 (흔들지 않는다)', idle && !idle.anim && idle.name === 'none', JSON.stringify(idle));
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
  // 2026-09-16 v3.46.0 영어 사전은 지연 묶음이라 먼저 받는다 (toEnglish)
  await toEnglish(page);
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(600);
  ok('영어로도 설정 줄이 옮겨진다', await page.evaluate(() => /Animated sprites/.test(document.body.textContent)));

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
