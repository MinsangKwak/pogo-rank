'use strict';
// v2.47.0 화면 테마 회귀 — 헤더의 해·달 버튼 · 이 브라우저 기억 · 계정 기억
//
// 이 스위트가 지키려는 것
//   1) 세 상태를 도는가 — 기기 설정 따름 → 밝게 → 어둡게 → 기기 설정 따름.
//      "기기 설정 따름" 을 없애면 기기를 밤에 어둡게 바꿔도 이 사이트만 밝게 남는다
//   2) 실제로 색이 바뀌는가 — data-theme 만 붙고 색이 그대로면 고친 게 아니다. 배경색을 읽어 본다
//   3) 새로고침해도 **깜빡이지 않는가** — 저장한 값은 번들(body 끝)이 아니라 head 에서 붙어야 한다.
//      번들이 붙이면 어둡게 골라 둔 사람이 매번 흰 화면을 한 번 보고 지나간다
//   4) 다른 기기에서도 따라오는가 — 이 브라우저 값을 지워도 계정에 적어 둔 값이 살아난다
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // 기기 설정은 어둡게 — "기기 설정 따름" 상태가 실제로 기기를 따르는지 보려면 기준이 있어야 한다
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const state = () => page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    saved: localStorage.getItem('pogo_theme'),
    icon: document.getElementById('theme-toggle')?.textContent,
    label: document.getElementById('theme-toggle')?.getAttribute('aria-label'),
    bg: getComputedStyle(document.body).backgroundColor,
  }));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.locator('#consent .consent__deny').click().catch(() => {});
  await page.waitForTimeout(800);

  // ── 1. 버튼이 있고, 처음은 기기 설정을 따른다
  ok('헤더에 테마 버튼', await page.locator('#theme-toggle').isVisible());
  const start = await state();
  ok('처음은 기기 설정 따름 (표시 없음)', start.attr === null, String(start.attr));
  ok('기기가 어두우면 어두운 배경', start.bg === 'rgb(11, 15, 21)', start.bg);
  ok('버튼에 이름이 있다', /테마/.test(start.label || ''), start.label || '');

  // ── 2. 세 상태를 돈다 + 실제로 색이 바뀐다
  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const light = await state();
  ok('1번 → 밝게', light.attr === 'light' && light.saved === 'light', JSON.stringify(light));
  ok('밝게는 흰 배경', light.bg === 'rgb(255, 255, 255)', light.bg);
  ok('밝게 아이콘 ☀️', light.icon === '☀️', light.icon);

  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const dark = await state();
  ok('2번 → 어둡게', dark.attr === 'dark' && dark.saved === 'dark', JSON.stringify(dark));
  ok('어둡게는 어두운 배경', dark.bg === 'rgb(11, 15, 21)', dark.bg);
  ok('어둡게 아이콘 🌙', dark.icon === '🌙', dark.icon);

  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const sys = await state();
  ok('3번 → 기기 설정 따름', sys.attr === null && sys.saved === 'system', JSON.stringify(sys));
  ok('기기 설정 아이콘 🌗', sys.icon === '🌗', sys.icon);

  // ── 3. 새로고침해도 유지되고, head 에서 먼저 붙는다 (깜빡임 없음)
  await page.locator('#theme-toggle').click();   // → light
  await page.waitForTimeout(300);
  await page.goto(BASE, { waitUntil: 'commit' });
  // 'commit' 직후 = 번들이 돌기 전. 이때 이미 붙어 있어야 한다
  const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme')).catch(() => null);
  ok('새로고침 직후(번들 전) 이미 적용', early === 'light', String(early));
  await page.waitForTimeout(2000);
  ok('새로고침 뒤에도 밝게', (await state()).attr === 'light');

  // ── 4. 계정에 적히고, 다른 기기에서 따라온다
  const stored = await page.evaluate(() => {
    try {
      const db = JSON.parse(localStorage.getItem('pogo_mock_db') || '{}');
      return Object.values(db.users || {}).map((u) => u.theme).filter(Boolean);
    } catch { return []; }
  });
  ok('계정 문서에 theme 이 적혔다', stored.includes('light'), JSON.stringify(stored));

  // 이 브라우저 값만 지운다 — 계정 문서는 그대로. "다른 기기에서 로그인" 과 같은 상황
  await page.evaluate(() => localStorage.removeItem('pogo_theme'));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const restored = await state();
  ok('다른 기기에서도 계정 값이 따라온다', restored.attr === 'light', JSON.stringify(restored));

  // ── 5. 로그인하지 않아도 이 브라우저에서는 기억한다
  await page.evaluate(() => { try { firebase.auth().signOut(); } catch {} });
  await page.waitForTimeout(1000);
  await page.locator('#theme-toggle').click();   // light → dark
  await page.waitForTimeout(300);
  ok('비로그인도 이 브라우저에는 저장', (await state()).saved === 'dark');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  ok('비로그인 새로고침 뒤에도 유지', (await state()).attr === 'dark');

  // ── 6. 좁은 화면 — 헤더에는 자리가 없다. ☰ 메뉴 줄이 대신한다
  // (버튼을 하나 더 넣었더니 로고 "POGO PLAN" 이 잘렸다. 폭에 따라 하나만 켠다)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  ok('좁은 화면은 헤더 버튼을 감춘다', !(await page.locator('#theme-toggle').isVisible()));
  await page.locator('#menu-toggle').click();
  await page.waitForTimeout(600);
  ok('좁은 화면 ☰ 메뉴에 화면 테마 줄', await page.locator('#menu-theme').isVisible());
  const beforeWord = await page.locator('#menu-theme-value').textContent();
  await page.locator('#menu-theme').click();
  await page.waitForTimeout(400);
  ok('메뉴 줄도 상태를 바꾼다', (await page.locator('#menu-theme-value').textContent()) !== beforeWord,
    `${beforeWord} → ${await page.locator('#menu-theme-value').textContent()}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(600);
  ok('넓은 화면은 메뉴 줄을 감춘다', !(await page.locator('#menu-theme').isVisible()));

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  console.log(`${pass}/${pass + fail} passed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
