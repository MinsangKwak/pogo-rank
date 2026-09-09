'use strict';
// v2.37.0 그리드 ↔ 리스트 보기 전환 회귀 — components/ui.js layoutInitial/layoutToggle
// v2.40.0 버튼 하나(누르면 뒤집힘) → 두 칸 세그먼트 컨트롤(리스트 | 그리드, 고른 칸이 눌린 표시)
//
// 이 스위트가 지키려는 것
//   - 도감뿐 아니라 즐겨찾기 · 레이드 보스 · 알 부화에도 같은 컨트롤이 있는가
//   - 지금 보기가 어느 칸인지 aria-pressed 로 드러나는가
//   - 다른 칸을 누르면 실제로 목록의 is-grid 가 바뀌는가, 저장(localStorage)되는가
//   - 새로고침해도 고른 보기가 유지되는가
//   - 화면마다 저장 키가 달라 서로 선택이 안 섞이는가 (도감을 리스트로 바꿔도 즐겨찾기는 그대로)
//   - 레이드 보스처럼 목록이 여러 묶음(티어별)인 화면은 컨트롤 하나로 전부 같이 바뀌는가
//   - 도감의 기존 .dex__layout 클래스·localStorage 키('pogo_dex_cols')는 그대로인가 (회귀 없음)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click().catch(() => {});
    await page.waitForTimeout(500);
  };
  const clearKeys = () => page.evaluate(() => {
    for (const k of ['pogo_dex_cols', 'pogo_favs_cols', 'pogo_raids_cols', 'pogo_eggs_cols']) {
      try { localStorage.removeItem(k); } catch { /* 저장 불가 환경 */ }
    }
  });
  // 두 칸짜리 컨트롤 — 왼쪽이 리스트, 오른쪽이 그리드 (components/ui.js layoutToggle 의 차례)
  const viewSeg = () => page.locator('#page .seg-view').first();
  const listBtn = () => viewSeg().locator('button').first();
  const gridBtn = () => viewSeg().locator('button').last();
  const pressed = () => viewSeg().locator('button[aria-pressed="true"]').textContent();

  // ── 도감·즐겨찾기·레이드 보스·알 부화 모두 컨트롤이 있고, 기본은 그리드(PC)
  for (const [hash, label] of [['#/dex', '도감'], ['#/favs', '즐겨찾기'], ['#/raids', '레이드 보스'], ['#/eggs', '알 부화']]) {
    await clearKeys();
    await go(hash);
    ok(`${label} 보기 방식 컨트롤 있음`, await viewSeg().isVisible());
    ok(`${label} 두 칸(리스트·그리드)이 다 보인다`, (await viewSeg().locator('button').count()) === 2);
    ok(`${label} PC 기본은 그리드`, await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid')));
    ok(`${label} 지금 보기가 눌린 칸으로 드러난다`, /그리드/.test(await pressed()), await pressed());
  }

  // ── 도감: 리스트 칸을 눌러 리스트로 → 저장 → 새로고침해도 유지, 기존 클래스·키 이름 불변
  await clearKeys();
  await go('#/dex');
  ok('도감 컨트롤에 .dex__layout 유지 (회귀)', await page.locator('.dex__layout').count() === 1);
  await listBtn().click();
  await page.waitForTimeout(300);
  ok('도감 리스트 칸을 누르면 리스트로', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));
  ok('도감 눌린 칸도 리스트로 바뀐다', /리스트/.test(await pressed()), await pressed());
  ok('도감 저장 키 불변(pogo_dex_cols=1)', (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '1');
  // 이미 고른 칸을 다시 눌러도 아무 일이 없어야 한다 (뒤집히던 예전 버튼과 다른 점)
  await listBtn().click();
  await page.waitForTimeout(200);
  ok('이미 고른 칸을 또 눌러도 그대로', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  ok('도감 새로고침해도 리스트 유지', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));

  // ── 화면마다 저장 키가 달라 선택이 안 섞인다 (도감을 리스트로 바꿔도 즐겨찾기는 그리드 그대로)
  await go('#/favs');
  ok('즐겨찾기는 도감의 선택과 무관 (그리드 유지)', await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid')));
  await listBtn().click();
  await page.waitForTimeout(300);
  ok('즐겨찾기 저장 키는 따로(pogo_favs_cols)', (await page.evaluate(() => localStorage.getItem('pogo_favs_cols'))) === '1');
  ok('도감 저장 키는 그대로(즐겨찾기 선택에 안 흔들림)', (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '1');

  // ── 레이드 보스: 티어별로 목록이 여러 묶음인데, 컨트롤 하나로 전부 같이 바뀌는가
  await clearKeys();
  await go('#/raids');
  const sectionCount = await page.locator('#page .dex__list').count();
  ok('레이드 보스는 티어별 묶음이 여럿', sectionCount > 1, String(sectionCount));
  ok('시작은 전부 그리드', (await page.locator('#page .dex__list').evaluateAll((nodes) => nodes.every((n) => n.classList.contains('is-grid')))));
  await listBtn().click();
  await page.waitForTimeout(300);
  ok('컨트롤 하나로 모든 묶음이 같이 리스트로', (await page.locator('#page .dex__list').evaluateAll((nodes) => nodes.every((n) => !n.classList.contains('is-grid')))));
  await gridBtn().click();
  await page.waitForTimeout(300);
  ok('그리드 칸을 누르면 다시 전부 그리드로', (await page.locator('#page .dex__list').evaluateAll((nodes) => nodes.every((n) => n.classList.contains('is-grid')))));

  // ── v2.39.0 auto-fill 그리드: 디바이스 폭에 따라 열 개수가 저절로 바뀐다 (미디어 쿼리 고정값 아님)
  // 뷰포트마다 새 컨텍스트로 열어서 확인
  for (const [w, hash, sel, label, expect] of [
    [1280, '#/raids', '#page .dex__list', '태블릿 레이드 보스', 3],
    [1440, '#/raids', '#page .dex__list', 'PC 레이드 보스', 4],
    [1280, '#/dmax', '#content .row-list', '태블릿 D-MAX', 3],
    [1440, '#/dmax', '#content .row-list', 'PC D-MAX', 4],
    [1280, '#/pve', '#content .row-list', '태블릿 레이드·PvE', 3],
    [1440, '#/pve', '#content .row-list', 'PC 레이드·PvE', 4],
  ]) {
    const gctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await gctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const gpage = await gctx.newPage();
    gpage.on('pageerror', (e) => errs.push(`${label}:` + e));
    await gpage.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await gpage.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await gpage.locator('#consent .consent__deny').click().catch(() => {});
    await gpage.waitForTimeout(500);
    const cols = await gpage.evaluate((s) => {
      const node = document.querySelector(s);
      return node ? getComputedStyle(node).gridTemplateColumns.split(' ').length : null;
    }, sel);
    ok(`${label} (w=${w}) ${expect}열`, cols === expect, String(cols));
    await gctx.close();
  }

  // 상세 패널이 열려 본문이 좁아지면 자동으로 열이 줄어드는가 (레이드 보스 기준)
  for (const [w, expect] of [[1280, 1], [1440, 2]]) {
    const sctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await sctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const spage = await sctx.newPage();
    spage.on('pageerror', (e) => errs.push(`squeeze ${w}:` + e));
    await spage.goto(BASE + '#/raids', { waitUntil: 'domcontentloaded' });
    await spage.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await spage.locator('#consent .consent__deny').click().catch(() => {});
    await spage.waitForTimeout(500);
    await spage.locator('#page .dex__row').first().click();
    await spage.waitForTimeout(400);
    const cols = await spage.evaluate(() => {
      const node = document.querySelector('#page .dex__list');
      return node ? getComputedStyle(node).gridTemplateColumns.split(' ').length : null;
    });
    ok(`상세 패널 열림(w=${w}) 레이드 보스 ${expect}열로 줄어듦`, cols === expect, String(cols));
    await sctx.close();
  }

  // ── v2.39.0 보기 방식 컨트롤이 안내 문구와 같은 줄, 오른쪽 끝에 있는가 (가독성 문제로 재배치)
  {
    const pctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await pctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const ppage = await pctx.newPage();
    ppage.on('pageerror', (e) => errs.push('intro-pos:' + e));
    await ppage.goto(BASE + '#/raids', { waitUntil: 'domcontentloaded' });
    await ppage.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await ppage.locator('#consent .consent__deny').click().catch(() => {});
    await ppage.waitForTimeout(500);
    const rects = await ppage.evaluate(() => {
      const intro = document.querySelector('#page .gameday__intro');
      const note = intro?.querySelector('.note');
      const btn = intro?.querySelector('.seg-view');
      return {
        sameRow: note && btn ? Math.abs(note.getBoundingClientRect().top - btn.getBoundingClientRect().top) < 4 : false,
        btnIsRightmost: note && btn ? btn.getBoundingClientRect().right > note.getBoundingClientRect().right : false,
      };
    });
    ok('레이드 보스: 보기 방식 컨트롤이 안내문과 같은 줄', rects.sameRow);
    ok('레이드 보스: 보기 방식 컨트롤이 오른쪽 끝', rects.btnIsRightmost);
    await pctx.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
