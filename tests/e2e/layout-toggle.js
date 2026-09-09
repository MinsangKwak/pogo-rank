'use strict';
// v2.37.0 그리드 ↔ 리스트 토글 확장 회귀 — components/ui.js layoutInitial/layoutToggle
//
// 이 스위트가 지키려는 것
//   - 도감뿐 아니라 즐겨찾기 · 레이드 보스 · 알 부화에도 같은 토글 버튼이 있는가
//   - 눌러서 리스트로 바꾸면 실제로 목록의 is-grid 가 빠지는가, 저장(localStorage)되는가
//   - 새로고침해도 고른 보기가 유지되는가
//   - 화면마다 저장 키가 달라 서로 선택이 안 섞이는가 (도감을 리스트로 바꿔도 즐겨찾기는 그대로)
//   - 레이드 보스처럼 목록이 여러 묶음(티어별)인 화면은 토글 하나로 전부 같이 바뀌는가
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
  const toggleBtn = () => page.locator('#page .uchip').filter({ hasText: /⊞ 그리드|☰ 리스트/ }).first();

  // ── 도감·즐겨찾기·레이드 보스·알 부화 모두 토글 버튼이 있고, 기본은 그리드(PC)
  for (const [hash, label] of [['#/dex', '도감'], ['#/favs', '즐겨찾기'], ['#/raids', '레이드 보스'], ['#/eggs', '알 부화']]) {
    await clearKeys();
    await go(hash);
    ok(`${label} 토글 버튼 있음`, await toggleBtn().isVisible());
    ok(`${label} PC 기본은 그리드`, await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid')));
  }

  // ── 도감: 눌러서 리스트로 → 저장 → 새로고침해도 유지, 기존 클래스·키 이름 불변
  await clearKeys();
  await go('#/dex');
  ok('도감 토글 버튼에 .dex__layout 유지 (회귀)', await page.locator('.dex__layout').count() === 1);
  await toggleBtn().click();
  await page.waitForTimeout(300);
  ok('도감 누르면 리스트로', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));
  ok('도감 저장 키 불변(pogo_dex_cols=1)', (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '1');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  ok('도감 새로고침해도 리스트 유지', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));

  // ── 화면마다 저장 키가 달라 선택이 안 섞인다 (도감을 리스트로 바꿔도 즐겨찾기는 그리드 그대로)
  await go('#/favs');
  ok('즐겨찾기는 도감의 선택과 무관 (그리드 유지)', await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid')));
  await toggleBtn().click();
  await page.waitForTimeout(300);
  ok('즐겨찾기 저장 키는 따로(pogo_favs_cols)', (await page.evaluate(() => localStorage.getItem('pogo_favs_cols'))) === '1');
  ok('도감 저장 키는 그대로(즐겨찾기 토글에 안 흔들림)', (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '1');

  // ── 레이드 보스: 티어별로 목록이 여러 묶음인데, 토글 하나로 전부 같이 바뀌는가
  await clearKeys();
  await go('#/raids');
  const sectionCount = await page.locator('#page .dex__list').count();
  ok('레이드 보스는 티어별 묶음이 여럿', sectionCount > 1, String(sectionCount));
  ok('시작은 전부 그리드', (await page.locator('#page .dex__list').evaluateAll((nodes) => nodes.every((n) => n.classList.contains('is-grid')))));
  await toggleBtn().click();
  await page.waitForTimeout(300);
  ok('토글 하나로 모든 묶음이 같이 리스트로', (await page.locator('#page .dex__list').evaluateAll((nodes) => nodes.every((n) => !n.classList.contains('is-grid')))));

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

  // ── v2.39.0 그리드·리스트 토글 버튼이 안내 문구와 같은 줄, 오른쪽 끝에 있는가 (가독성 문제로 재배치)
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
      const btn = intro?.querySelector('.uchip');
      return {
        sameRow: note && btn ? Math.abs(note.getBoundingClientRect().top - btn.getBoundingClientRect().top) < 4 : false,
        btnIsRightmost: note && btn ? btn.getBoundingClientRect().right > note.getBoundingClientRect().right : false,
      };
    });
    ok('레이드 보스: 토글 버튼이 안내문과 같은 줄', rects.sameRow);
    ok('레이드 보스: 토글 버튼이 오른쪽 끝', rects.btnIsRightmost);
    await pctx.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
