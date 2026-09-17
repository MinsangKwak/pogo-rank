'use strict';
// v3.57.0 화면별 측정 회귀 — track.js trackPageView · GA 스니펫의 가상 경로
//
// 왜 생겼나. 3일치 실측에서 **조회수 60 이 전부 경로 '/' 하나로 뭉쳐 있었다.**
// 해시 라우터라 화면을 옮겨도 문서가 그대로여서 page_view 가 세션당 한 건뿐이었고,
// 그 한 건의 경로마저 '/' 였다 — GA4 의 '페이지 경로' 는 page_location 의 pathname 에서 뽑는데
// 해시(#/dex)는 pathname 이 아니기 때문이다. 어느 화면을 봤는지 볼 방법이 사실상 없었다.
//
// 이 스위트가 지키려는 것
//   - 화면을 옮길 때마다 page_view 가 **한 건씩** 간다 (한 번도 안 가거나, 두 번 가지 않는다)
//   - 그 page_view 의 경로가 화면마다 다르다 (#/dex → /dex)
//   - 경로와 제목이 **같은 화면을 가리킨다** — 경로는 /dex 인데 제목은 홈인 어긋남이 없어야 한다
//   - 같은 화면을 다시 그려도 조회가 늘지 않는다
//   - 앞 화면이 page_referrer 로 따라간다 (이동 경로를 GA 가 이어 붙일 수 있게)
//   - 봇은 여전히 한 건도 보내지 않는다
//
// 로컬 빌드는 GA_ID 가 없어 진짜 스니펫이 안 실린다. 그래서 스니펫이 하는 일(gaVirtualUrl 정의,
// 홈이면 첫 조회 전송)을 흉내 낸 뒤 번들의 동작을 잰다.
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

// 우리 번들보다 먼저 가짜 gtag 를 심어 호출을 전부 모은다
const installSpy = (ctx, { atHome = true } = {}) => ctx.addInitScript((home) => {
  window.__gtagCalls = [];
  window.gtag = (...args) => window.__gtagCalls.push(args);
  // 스니펫이 head 에서 하는 일 — 번들은 이 함수가 있다고 보고 돈다
  window.gaVirtualUrl = function () {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
    return location.origin + '/' + raw;
  };
  window.GA_SENT_FIRST = home && (!location.hash || location.hash === '#' || location.hash === '#/');
  Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
}, atHome);

const NORMAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// page_view 호출만 골라 { path, title, referrer } 로 펴 둔다
const views = (page) => page.evaluate(() => (window.__gtagCalls || [])
  .filter((call) => call[0] === 'event' && call[1] === 'page_view')
  .map((call) => ({
    path: new URL(call[2].page_location).pathname,
    title: call[2].page_title || '',
    referrer: call[2].page_referrer ? new URL(call[2].page_referrer).pathname : '',
  })));

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { userAgent: NORMAL_UA });
  await installSpy(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/`, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(600);

  // ── 홈으로 들어오면 스니펫이 첫 건을 보냈으므로 번들은 더 보내지 않는다
  ok('홈 진입에 번들이 조회를 덧붙이지 않는다', (await views(page)).length === 0,
    JSON.stringify(await views(page)));

  // ── 화면을 옮기면 한 건씩
  const go = async (hash) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(500);
  };
  await go('#/dex');
  let got = await views(page);
  ok('도감으로 옮기면 조회 한 건', got.length === 1, JSON.stringify(got));
  ok('경로가 화면 이름이다 (/dex)', got[0]?.path === '/dex', got[0]?.path);
  ok('제목이 그 화면 제목이다', /포켓몬 도감/.test(got[0]?.title || ''), got[0]?.title);

  await go('#/dmax');
  got = await views(page);
  ok('D-MAX 로 옮기면 두 건째', got.length === 2, JSON.stringify(got.map((v) => v.path)));
  ok('경로가 갈린다 (/dmax)', got[1]?.path === '/dmax', got[1]?.path);
  ok('앞 화면이 page_referrer 로 따라온다', got[1]?.referrer === '/dex', got[1]?.referrer);
  // 경로와 제목이 같은 화면을 가리키는가 — 경로는 /dmax 인데 제목은 홈인 어긋남을 막는다
  ok('경로와 제목이 어긋나지 않는다', /D-MAX/i.test(got[1]?.title || ''), got[1]?.title);

  // ── 같은 화면을 다시 그려도 조회는 그대로
  await go('#/dmax');
  ok('같은 화면을 다시 그려도 조회가 늘지 않는다', (await views(page)).length === 2,
    String((await views(page)).length));

  // ── 홈으로 돌아오는 것도 한 건
  await go('#/');
  got = await views(page);
  ok('홈으로 돌아오면 경로가 / 다', got.length === 3 && got[2]?.path === '/', JSON.stringify(got.map((v) => v.path)));

  // ── 모든 조회의 경로가 실제 주소와 이어진다 (측정용 이름이지만 라우트와 1:1)
  ok('조회 경로에 해시 기호가 섞이지 않는다', got.every((v) => !v.path.includes('#')),
    JSON.stringify(got.map((v) => v.path)));
  await ctx.close();

  // ── 하위 화면으로 바로 들어오면 번들이 첫 건을 맡는다 (제목이 세워진 뒤라야 이름이 맞다)
  const deep = await newContext(browser, { userAgent: NORMAL_UA });
  await installSpy(deep, { atHome: false });
  const deepPage = await deep.newPage();
  await deepPage.goto(`${BASE}#/game-updates`, { waitUntil: 'domcontentloaded' });
  await waitSplash(deepPage);
  await deepPage.waitForTimeout(700);
  const first = await views(deepPage);
  ok('딥링크 진입도 조회 한 건', first.length === 1, JSON.stringify(first));
  ok('딥링크 경로가 맞다 (/game-updates)', first[0]?.path === '/game-updates', first[0]?.path);
  ok('딥링크 제목이 홈 제목이 아니다', /게임 업데이트/.test(first[0]?.title || ''), first[0]?.title);
  await deep.close();

  // ── 봇은 한 건도 보내지 않는다 (집계 제외는 그대로)
  const bot = await newContext(browser, { userAgent: 'Mozilla/5.0 HeadlessChrome/128.0.0.0' });
  await bot.addInitScript(() => {
    window.__gtagCalls = [];
    window.gtag = (...args) => window.__gtagCalls.push(args);
    window.gaVirtualUrl = () => location.origin + '/bot';
  });
  const botPage = await bot.newPage();
  await botPage.goto(`${BASE}#/dex`, { waitUntil: 'domcontentloaded' });
  await botPage.waitForTimeout(600);
  await botPage.evaluate(() => { location.hash = '#/dmax'; });
  await botPage.waitForTimeout(500);
  ok('봇은 조회를 보내지 않는다', (await views(botPage)).length === 0,
    JSON.stringify(await views(botPage)));
  await bot.close();

  await browser.close();
  finish();
});
