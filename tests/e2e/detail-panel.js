'use strict';
// v3.50.0 넓은 화면(PC) 상세 = 두 열 팝업 회귀 (v2.36.0 의 오른쪽 고정 패널은 쓰지 않는다 — components/modal.js useDetailPanel)
//
// 이 스위트가 지키려는 것
//   - PC 에서 상세를 열면 #detail-panel 이 아니라 팝업(dialog)이 뜨는가
//   - 왼쪽 정보 칸 · 오른쪽 탭 내용이 나란히(두 열) 서는가 · 링크 복사 글자 · 하단 안내가 보이는가
//   - 다른 포켓몬(진화 계열)으로 바뀌어도 팝업은 하나인가 · ✕ · Esc 로 닫히는가
//   - 딥링크(#/mon/…)로 들어와도 팝업이 뜨는가
//   - 좁은 화면(모바일)은 그대로 바텀시트 팝업인가
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const errs = [];

  // ── PC (1440px)
  {
    const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    ctx.setDefaultTimeout(8000);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('PC: ' + e));
    const go = async (hash) => {
      await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
      await waitSplash(page);
      await page.waitForTimeout(500);
    };

    await go('#/dex');
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(600);
    ok('PC 상세는 팝업(dialog) — 패널이 아니다', (await page.locator('dialog.modal[open]').count()) === 1 && await page.locator('#detail-panel').isHidden());
    ok('PC body 에 has-detail-panel 없음', !(await page.evaluate(() => document.body.classList.contains('has-detail-panel'))));
    ok('PC 팝업에 상세 내용', (await page.locator('.detail__dexno').textContent()) === '#0001');
    const side = await page.locator('.detail__side').boundingBox();
    const main = await page.locator('.detail__main').boundingBox();
    ok('PC 두 열 — 정보 칸 왼쪽, 내용 오른쪽', side.x + side.width <= main.x + 2 && Math.abs(side.y - main.y) < 40, `side ${side.x}+${side.width} main ${main.x}`);
    const wrapWidth = (await page.locator('.modal__box').boundingBox()).width;
    ok('PC 팝업이 두 열만큼 넓다 (≥ 800px)', wrapWidth >= 800, String(wrapWidth));
    ok('PC 하단 왼쪽 [링크 복사] · 오른쪽 [CP 계산기]', await page.locator('.detail__dock .detail__share').isVisible() && await page.locator('.detail__dock-calc').isVisible());
    ok('PC 머리줄 [포켓몬 도감]', await page.locator('.detail__bar .detail__bar-dex').isVisible());
    const closeBox = await page.locator('.modal__close').boundingBox();
    const boxBox = await page.locator('.modal__box').boundingBox();
    ok('PC ✕ 가 카드 안 위쪽 오른쪽', closeBox.y >= boxBox.y && closeBox.y < boxBox.y + 60 && closeBox.x + closeBox.width <= boxBox.x + boxBox.width + 1);

    // 진화 계열 → 같은 팝업 안에서 바뀐다
    await page.click('.detail__tab[data-tab="evo"]');
    await page.waitForTimeout(250);
    await page.locator('.evo__mon').nth(2).click();   // 이상해씨 → 이상해풀 → [이상해꽃]
    await page.waitForTimeout(500);
    ok('PC 진화 단계를 누르면 같은 팝업이 그 포켓몬', (await page.locator('dialog.modal[open]').count()) === 1 && (await page.locator('.detail__dexno').textContent()) === '#0003');
    ok('PC ← 돌아가기 줄', (await page.locator('.detail__back').count()) === 1);

    // 닫기
    await page.locator('.modal__close').click();
    await page.waitForTimeout(300);
    ok('PC ✕ 로 닫힘', (await page.locator('dialog.modal[open]').count()) === 0);
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    ok('PC Esc 로 닫힘', (await page.locator('dialog.modal[open]').count()) === 0);

    // 딥링크
    await go('#/mon/1');
    await page.waitForTimeout(500);
    ok('PC 딥링크(#/mon/…)로 들어오면 팝업', (await page.locator('dialog.modal[open]').count()) === 1);
    ok('PC 페이지 오류 없음', errs.filter((e) => e.startsWith('PC:')).length === 0, errs.join(' | '));
    await ctx.close();
  }

  // ── 모바일 (390px) — 바텀시트 팝업 그대로
  {
    const ctx = await newContext(browser, { viewport: { width: 390, height: 844 } });
    ctx.setDefaultTimeout(8000);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('모바일: ' + e));
    await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(500);
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(500);
    ok('모바일 상세는 팝업', (await page.locator('dialog.modal[open]').count()) === 1);
    ok('모바일 패널은 뜨지 않음', await page.locator('#detail-panel').isHidden());
    const body = await page.locator('.detail__body').evaluate((n) => getComputedStyle(n).flexDirection);
    ok('모바일은 한 열(위아래)', body === 'column', body);
    ok('모바일 페이지 오류 없음', errs.filter((e) => e.startsWith('모바일:')).length === 0);
    await ctx.close();
  }

  await finish(browser);
});
