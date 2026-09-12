'use strict';
// v2.47.0 화면 테마 회귀 — 헤더의 해·달 버튼 · 이 브라우저 기억 · 계정 기억
//
// 이 스위트가 지키려는 것
//   1) 버튼이 둘만 도는가 — 밝게 ↔ 어둡게 (2026-09-12 v3.11.0).
//      셋을 한 버튼으로 돌리면 누를 때마다 무엇이 될지 예측이 안 된다.
//      "기기 설정 따름" 은 없애지 않고 설정 화면(#/settings)으로 옮겼다 —
//      없애면 기기를 밤에 어둡게 바꿔도 이 사이트만 밝게 남는다
//   2) 실제로 색이 바뀌는가 — data-theme 만 붙고 색이 그대로면 고친 게 아니다. 배경색을 읽어 본다
//   3) 새로고침해도 **깜빡이지 않는가** — 저장한 값은 번들(body 끝)이 아니라 head 에서 붙어야 한다.
//      번들이 붙이면 어둡게 골라 둔 사람이 매번 흰 화면을 한 번 보고 지나간다
//   4) 다른 기기에서도 따라오는가 — 이 브라우저 값을 지워도 계정에 적어 둔 값이 살아난다
const { launch, newContext, ok, finish } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

(async () => {
  const browser = await launch();
  // 기기 설정은 어둡게 — "기기 설정 따름" 상태가 실제로 기기를 따르는지 보려면 기준이 있어야 한다
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const state = () => page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    saved: localStorage.getItem('pogo_theme'),
    // 2026-09-12 v3.6.0 얼굴은 도트 그림(svg.pxi)이라 글자가 없다 — 어떤 얼굴인지는 data-icon 이 들고 있다
    icon: document.getElementById('theme-toggle')?.dataset.icon,
    pxi: !!document.getElementById('theme-toggle')?.querySelector('svg.pxi'),
    label: document.getElementById('theme-toggle')?.getAttribute('aria-label'),
    bg: getComputedStyle(document.body).backgroundColor,
  }));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  // ── 1. 버튼이 있고, 처음은 기기 설정을 따른다
  ok('헤더에 테마 버튼', await page.locator('#theme-toggle').isVisible());
  const start = await state();
  ok('처음은 기기 설정 따름 (표시 없음)', start.attr === null, String(start.attr));
  // v3.0.0 딥네이비(#0b0f15) → 잉크블랙(#0a0a0f) · 흰 바탕 → 꺼진 바탕(#fafafa)
  ok('기기가 어두우면 어두운 배경', start.bg === 'rgb(10, 10, 15)', start.bg);
  ok('버튼에 이름이 있다', /테마/.test(start.label || ''), start.label || '');

  // ── 2. 세 상태를 돈다 + 실제로 색이 바뀐다
  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const light = await state();
  ok('1번 → 밝게', light.attr === 'light' && light.saved === 'light', JSON.stringify(light));
  ok('밝게는 밝은 배경', light.bg === 'rgb(250, 250, 250)', light.bg);
  ok('밝게 아이콘 ☀️ (도트)', light.icon === '☀️' && light.pxi, JSON.stringify(light));

  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const dark = await state();
  ok('2번 → 어둡게', dark.attr === 'dark' && dark.saved === 'dark', JSON.stringify(dark));
  ok('어둡게는 어두운 배경', dark.bg === 'rgb(10, 10, 15)', dark.bg);
  ok('어둡게 아이콘 🌙 (도트)', dark.icon === '🌙' && dark.pxi, JSON.stringify(dark));

  // 2026-09-12 v3.11.0 세 번째 누름은 '기기 설정' 이 아니라 다시 밝게다 — 버튼은 둘만 돈다
  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const again = await state();
  ok('3번 → 다시 밝게 (셋을 안 돈다)', again.attr === 'light' && again.saved === 'light', JSON.stringify(again));
  ok('버튼 이름이 다음에 될 것을 말한다', /누르면 어둡게/.test(again.label), again.label);

  // ── 2-2. 기기 설정 따름은 설정 화면에서 고른다 (#/settings)
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(700);
  // 2026-09-12 v3.18.0 라디오 그룹이 둘(테마 · 움직이는 그림)이라 테마 그룹으로 좁힌다
  const choices = await page.locator('#page [aria-label="화면 테마"] .settings__choice').count();
  ok('설정 화면에 세 갈래가 있다', choices === 3, String(choices));
  await page.locator('#page [aria-label="화면 테마"] .settings__choice').first().click();
  await page.waitForTimeout(400);
  const sys = await state();
  ok('기기 설정 따름을 고르면 표시가 없어진다', sys.attr === null && sys.saved === 'system', JSON.stringify(sys));
  ok('기기 설정 아이콘 🌗 (도트)', sys.icon === '🌗' && sys.pxi, JSON.stringify(sys));
  ok('고른 줄만 눌린 표시', (await page.locator('#page [aria-label="화면 테마"] .settings__choice[aria-checked="true"]').count()) === 1);
  // 기기가 어두운 상태라(colorScheme: dark) '기기 설정' 에서 누르면 그 반대인 밝게로 간다
  await page.locator('#theme-toggle').click();
  await page.waitForTimeout(300);
  const fromSys = await state();
  ok('기기 설정에서 누르면 지금 보이는 것의 반대', fromSys.saved === 'light', JSON.stringify(fromSys));

  // ── 3. 새로고침해도 유지되고, head 에서 먼저 붙는다 (깜빡임 없음)
  await page.waitForTimeout(300);
  await page.goto(BASE, { waitUntil: 'commit' });
  // 2026-09-11 v2.56.0 전에는 'commit' 직후 한 번 들여다보고 "번들 전인데 이미 붙었다" 를 확인했다.
  // 그런데 그 순간에는 **head 스크립트조차 아직 안 돌았을 수** 있어(스위트를 여럿 같이 돌릴 때 특히)
  // 부하에 따라 통과와 실패가 갈렸다. "언제 보느냐" 를 재면 재는 쪽이 흔들린다.
  // 흔들리지 않는 두 가지로 나눠 본다 — (1) 값이 실제로 붙는가 (2) 붙이는 코드가 번들보다 앞에 있는가.
  // (2) 는 문서 순서라 부하와 무관하다: head 안의 <script> 는 body 끝의 번들보다 반드시 먼저 돈다
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light',
    null, { timeout: 10000 }).catch(() => {});
  const early = await page.evaluate(() => document.documentElement.getAttribute('data-theme')).catch(() => null);
  ok('새로고침해도 고른 테마가 유지된다', early === 'light', String(early));
  const themeInHead = await page.evaluate(() => /pogo_theme/.test(document.head.innerHTML));
  ok('테마를 head 에서 붙인다 (번들보다 앞 — 흰 화면 깜빡임 없음)', themeInHead);
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
  await finish(browser);
})();
