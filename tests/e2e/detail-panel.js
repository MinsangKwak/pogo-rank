'use strict';
// v2.36.0 PC 오른쪽 상세 패널 회귀
//
// 이 스위트가 지키려는 것
//   - 넓은 화면(PC)에서는 상세를 열면 팝업이 아니라 #detail-panel 에 뜨는가 (dialog 는 안 뜬다)
//   - 목록이 패널에 가려지지 않고 계속 눌리는가 (모달과 달리 화면을 덮지 않는다)
//   - 다른 포켓몬을 이어서 누르면 패널 하나가 내용만 바뀌는가 (여러 개로 쌓이지 않는가)
//   - 닫기(✕)를 누르면 패널이 닫히고 body.has-detail-panel 도 지워지는가
//   - 다른 화면(탭)으로 이동하면 패널이 자동으로 닫히는가
//   - 좁은 화면(모바일)은 지금까지처럼 팝업(dialog)이지 패널이 아닌가 (회귀 없음)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  // ── PC (1440px) ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // 2026-09-12 v3.11.0 첫 방문 가입 권유 팝업은 '본 적 있음' 으로 표시해 두고 시작한다 —
    // 안 그러면 3초 뒤 모달이 떠서 그 뒤의 클릭을 전부 가로챈다 (동의 배너를 끄는 것과 같은 처방).
    // 팝업 자체는 tests/e2e/signup-invite.js 가 따로 검사한다
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    ctx.setDefaultTimeout(8000);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('PC: ' + e));

    const go = async (hash) => {
      await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
      await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(500);
    };

    await go('#/dex');
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(500);

    ok('PC 상세를 열면 팝업이 아니라 패널', (await page.locator('dialog.modal[open]').count()) === 0 && await page.locator('#detail-panel').isVisible());
    ok('PC body에 has-detail-panel 클래스', await page.evaluate(() => document.body.classList.contains('has-detail-panel')));
    const firstDexno = await page.locator('#detail-panel .detail__dexno').textContent();
    ok('PC 패널에 상세 내용', firstDexno === '#0001', firstDexno);

    // 목록이 계속 눌리는가 — 모달처럼 화면을 덮지 않는다
    const secondRow = page.locator('#page .dex__row').nth(1);
    ok('PC 패널이 떠도 목록 두 번째 줄이 화면에 보임', await secondRow.isVisible());
    await secondRow.click();
    await page.waitForTimeout(400);
    const secondDexno = await page.locator('#detail-panel .detail__dexno').textContent();
    ok('PC 다른 포켓몬을 누르면 패널 내용만 바뀜', secondDexno === '#0002', secondDexno);
    ok('PC 패널은 하나만 있음 (쌓이지 않음)', (await page.locator('#detail-panel').count()) === 1);

    // 닫기
    await page.locator('.detail-panel__close').click();
    await page.waitForTimeout(300);
    ok('PC 닫기를 누르면 패널이 숨음', await page.locator('#detail-panel').isHidden());
    ok('PC 닫으면 has-detail-panel 클래스도 지워짐', !(await page.evaluate(() => document.body.classList.contains('has-detail-panel'))));

    // 다시 열고 다른 화면으로 이동하면 자동으로 닫히는가
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(400);
    await page.evaluate(() => navigateHash('#/pve'));
    await page.waitForTimeout(500);
    ok('PC 다른 화면으로 이동하면 패널이 자동으로 닫힘', await page.locator('#detail-panel').isHidden());

    ok('PC 페이지 오류 없음', errs.filter((e) => e.startsWith('PC:')).length === 0);
    await ctx.close();
  }

  // ── 모바일 (390px) — 회귀: 지금까지처럼 팝업이어야 한다 ──────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    ctx.setDefaultTimeout(8000);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('모바일: ' + e));

    await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('#page .dex__row').first().click();
    await page.waitForTimeout(500);

    ok('모바일 상세는 지금까지처럼 팝업', (await page.locator('dialog.modal[open]').count()) === 1);
    ok('모바일 패널은 뜨지 않음 (회귀 없음)', await page.locator('#detail-panel').isHidden());
    ok('모바일 페이지 오류 없음', errs.filter((e) => e.startsWith('모바일:')).length === 0);
    await ctx.close();
  }

  // ── 2026-09-11 v2.60.1 화면을 옮기면 패널이 따라오지 않는다
  // 전에는 홈을 예외로 둬서, 도감에서 포켓몬을 연 채 [서비스 홈] 으로 가면
  // 홈 오른쪽에 이전 포켓몬 패널이 그대로 남아 본문이 눌렸다.
  // 남겨야 하는 것은 "홈" 이 아니라 상세를 가리키는 주소(#/mon/…) 하나뿐이다
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push('이동: ' + e));
    const open = async () => {
      await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
      await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
      await page.waitForSelector('#page .dex__row', { timeout: 15000 }).catch(() => {});
      await page.locator('#page .dex__row').first().click();
      await page.waitForTimeout(500);
    };
    const shut = () => page.evaluate(() => ({
      hidden: document.getElementById('detail-panel')?.hidden,
      cls: document.body.classList.contains('has-detail-panel'),
      hash: location.hash,
    }));

    await open();
    ok('패널이 열렸다', (await shut()).hidden === false);
    await page.click('.nav-menu a:has-text("서비스 홈")');
    await page.waitForTimeout(700);
    const home = await shut();
    ok('서비스 홈으로 가면 패널이 닫힌다', home.hidden === true && home.cls === false, JSON.stringify(home));

    await open();
    await page.click('.nav-menu a:has-text("알 부화")');
    await page.waitForTimeout(700);
    const other = await shut();
    ok('다른 화면으로 가도 패널이 닫힌다', other.hidden === true && other.cls === false, JSON.stringify(other));

    // 상세를 가리키는 주소로 들어오면 패널이 곧 그 화면이라 열려 있어야 한다
    await page.goto(BASE + '#/mon/1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(800);
    const deep = await shut();
    ok('딥링크(#/mon/…)로 들어오면 패널이 열린다', deep.hidden === false, JSON.stringify(deep));

    ok('이동 중 페이지 오류 없음', errs.filter((e) => e.startsWith('이동:')).length === 0, errs.filter((e) => e.startsWith('이동:')).join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
