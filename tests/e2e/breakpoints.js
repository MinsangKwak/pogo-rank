'use strict';
// v2.38.0 태블릿(1100px~)·PC(1440px~) 2단계 브레이크포인트 회귀
//
// 이 스위트가 지키려는 것
//   - 1099px 이하는 지금까지처럼 모바일 배치(사이드바·패널 없음)
//   - 1100~1439px(태블릿)은 사이드바 210px + 컨테이너 1100px + 패널 420px, 간격 24px
//   - 1440px 이상(PC)은 컨테이너 1440px + 패널 480px, 간격 32px — 태블릿보다 더 넓다
//   - 상세 패널이 열렸을 때 목록 내용과 패널 사이에 실제로 간격이 있는가 (겹치지 않는가) — 이전에
//     이 간격이 4px 로 거의 없어 보이던 버그가 있었다(패널 위치 공식의 20px 안쪽 여백을 빼먹었었다)
//   - 사이드바 왼쪽 끝과 패널 오른쪽 끝이 컨테이너를 기준으로 좌우 대칭인가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  const openDexDetail = async (page) => {
    await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click().catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(400);
  };

  // ── 모바일 경계: 1099px 는 아직 사이드바·패널이 없어야 한다
  {
    const ctx = await browser.newContext({ viewport: { width: 1099, height: 800 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('1099:' + e));
    await openDexDetail(page);
    ok('1099px 는 사이드바 없음', !(await page.locator('.app-nav').isVisible()));
    ok('1099px 는 패널 없음(팝업)', (await page.locator('dialog.modal[open]').count()) === 1);
    await ctx.close();
  }

  // ── 태블릿(1100px)·PC(1440px) 각각의 실제 치수와 간격
  const tiers = [
    { w: 1100, label: '태블릿 1100', panelW: 420, gap: 24, containerW: 1100 },
    { w: 1280, label: '태블릿 1280', panelW: 420, gap: 24, containerW: 1100 },
    { w: 1440, label: 'PC 1440', panelW: 480, gap: 32, containerW: 1440 },
    { w: 1680, label: 'PC 1680', panelW: 480, gap: 32, containerW: 1440 },
  ];
  for (const tier of tiers) {
    const ctx = await browser.newContext({ viewport: { width: tier.w, height: 900 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(`${tier.w}:` + e));
    await openDexDetail(page);

    ok(`${tier.label} 사이드바 보임`, await page.locator('.app-nav').isVisible());
    ok(`${tier.label} 상세는 패널로(팝업 아님)`, (await page.locator('dialog.modal[open]').count()) === 0 && await page.locator('#detail-panel').isVisible());

    const rects = await page.evaluate(() => ({
      page: document.getElementById('page').getBoundingClientRect(),
      panel: document.getElementById('detail-panel').getBoundingClientRect(),
      nav: document.querySelector('.app-nav').getBoundingClientRect(),
      pagePaddingRight: parseFloat(getComputedStyle(document.getElementById('page')).paddingRight),
    }));
    ok(`${tier.label} 패널 폭 ${tier.panelW}px`, Math.round(rects.panel.width) === tier.panelW, String(Math.round(rects.panel.width)));
    ok(`${tier.label} 컨테이너 폭 ${tier.containerW}px`, Math.round(rects.page.width) === tier.containerW, String(Math.round(rects.page.width)));

    // 목록 내용의 실제 오른쪽 끝(패딩 뺀 값) ~ 패널 왼쪽 끝 사이 간격이 의도한 값인가 (겹치지 않는가)
    const contentRight = rects.page.right - rects.pagePaddingRight;
    const actualGap = rects.panel.left - contentRight;
    ok(`${tier.label} 목록·패널 간격 ${tier.gap}px (겹침 없음)`, Math.abs(actualGap - tier.gap) < 1, `${actualGap.toFixed(1)}px`);

    // 사이드바 왼쪽 여백과 패널 오른쪽 여백이 대칭인가 (컨테이너 기준 거울 대칭)
    const leftGutter = rects.nav.left;
    const rightGutter = tier.w - rects.panel.right;
    ok(`${tier.label} 사이드바·패널 좌우 대칭`, Math.abs(leftGutter - rightGutter) < 1, `${leftGutter} vs ${rightGutter}`);

    await ctx.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
