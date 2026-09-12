'use strict';
// v2.41.0 UI 목록(#/styleguide) 회귀 — components/styleguide.js
//
// 이 스위트가 지키려는 것
//   - dev 미리보기 빌드에만 있고, 실서비스 빌드에는 화면도 주소도 없다 (backend/build.py 채널 분기)
//   - 있는 빌드에서는 오류 없이 그려지고, 구역·조각이 실제로 렌더된다
//   - 실제 CSS·실제 함수를 쓰므로 조각이 실제 화면과 같은 클래스를 갖는다
//   - 이 화면이 실제 메뉴를 건드리지 않는다 (같은 id 를 빌리지 않는다 — 중복 id 는 getElementById 를 흔든다)
//
// 채널은 화면에 적힌 버전으로 가른다 (dev 빌드는 -dev 가 붙는다) — 어느 쪽으로 구워도 맞는 검사를 한다
const { launch, newContext, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto(BASE + '#/styleguide', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  const version = await page.locator('.drawer__meta, .app-bar__version').first().textContent().catch(() => '');
  const isDev = /-dev/.test(await page.content().then((html) => (html.match(/v[\d.]+-dev/) || [''])[0]) || version || '');
  const sections = await page.locator('.sg__sec').count();

  if (isDev) {
    ok('dev 빌드: UI 목록이 열린다', sections > 0, `구역 ${sections}개`);
    ok('dev 빌드: 조각 칸이 렌더된다', (await page.locator('.sg__item').count()) > 20, String(await page.locator('.sg__item').count()));
    ok('dev 빌드: 화면 제목', /UI 목록/.test(await page.locator('#page-head h2, .page__bar b').first().textContent()));
    // 실제 조각을 그대로 부르는지 — 실제 화면과 같은 클래스가 나와야 한다
    for (const sel of ['.view-toggle', '.nav-menu .drawer__item', '.drawer__group', '.account__stats',
                       '.form-tag', '.tier__badge', '.dex__list.is-grid', '.row-list > .row', '.home__tile']) {
      ok(`dev 빌드: ${sel} 조각 있음`, (await page.locator(`#page ${sel}`).count()) > 0);
    }
    // 같은 id 를 빌리면 app-shell.js 의 getElementById 가 어느 쪽을 집을지 문서 순서에 달린다
    const dupIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
      return [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
    });
    ok('dev 빌드: 중복 id 없음', dupIds.length === 0, dupIds.join(', '));
    // 이 화면을 열어 둔 채로도 실제 메뉴가 멀쩡한가
    await page.locator('#menu-toggle').click();
    await page.waitForTimeout(400);
    ok('dev 빌드: 실제 메뉴 이동 목록 그대로', (await page.locator('.nav-menu .drawer__item').count()) >= 11);
  } else {
    ok('실서비스 빌드: UI 목록 화면이 없다', sections === 0, `구역 ${sections}개`);
    ok('실서비스 빌드: 번들에 스타일가이드 코드가 없다',
      !(await page.evaluate(() => typeof renderStyleguidePage !== 'undefined')));
    ok('실서비스 빌드: 그 주소로 들어와도 홈으로', !(await page.locator('.layout').isHidden()));
  }

  ok('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | ').slice(0, 200));
  await finish(browser);
});
