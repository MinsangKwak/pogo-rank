'use strict';
// v2.37.0 그리드 ↔ 리스트 보기 전환 회귀 — components/ui.js layoutInitial/layoutToggle
// v2.40.0 버튼 하나(누르면 뒤집힘) → 두 칸 세그먼트 컨트롤(리스트 | 그리드, 고른 칸이 눌린 표시)
//
// 이 스위트가 지키려는 것
//   - 도감뿐 아니라 레이드 보스 · 알 부화에도 같은 컨트롤이 있는가 (즐겨찾기는 v3.4.0 에서 걷어냈다)
//   - 지금 보기가 어느 칸인지 aria-pressed 로 드러나는가
//   - 다른 칸을 누르면 실제로 목록의 is-grid 가 바뀌는가, 저장(localStorage)되는가
//   - 새로고침해도 고른 보기가 유지되는가
//   - 화면마다 저장 키가 달라 서로 선택이 안 섞이는가 (도감을 리스트로 바꿔도 알 부화는 그대로)
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
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(500);
  };
  const clearKeys = () => page.evaluate(() => {
    for (const k of ['pogo_dex_cols', 'pogo_raids_cols', 'pogo_eggs_cols', 'pogo_pve_cols']) {
      try { localStorage.removeItem(k); } catch { /* 저장 불가 환경 */ }
    }
  });
  // 2026-09-12 v3.8.0 컨트롤이 **버튼 하나**다 — 누르면 리스트 ↔ 그리드가 뒤집힌다
  // (화면 테마 버튼과 같은 문법, components/ui.js layoutToggle 머리말).
  // 지금 보기는 글자가 아니라 data-view 에 있다. 그림이 SVG 라 글자로는 못 읽는다.
  // 2026-09-12 v3.1.0 보기 전환은 본문이 아니라 **화면 머리**의 동작 슬롯에 있다 —
  // 목록 하나가 아니라 이 화면 전체에 걸리는 설정이라 제목과 같은 높이에 놓았다.
  // 노드는 본문에서 옮겨 온 그것 그대로라(복제가 아니다) onclick·저장 키가 붙어 있다
  const viewSeg = () => page.locator('#page-head-actions .view-toggle').first();
  const view = () => viewSeg().getAttribute('data-view');
  // 지금 보기가 원하는 쪽이 아닐 때만 누른다 — 버튼 하나는 누를 때마다 뒤집히기 때문이다
  const setView = async (want) => {
    if ((await view()) !== want) { await viewSeg().click(); await page.waitForTimeout(300); }
  };
  const listBtn = () => ({ click: () => setView('list') });
  const gridBtn = () => ({ click: () => setView('grid') });

  // ── 도감·레이드 보스·알 부화 모두 컨트롤이 있고, 기본은 그리드(PC)
  for (const [hash, label] of [['#/dex', '도감'], ['#/raids', '레이드 보스'], ['#/eggs', '알 부화']]) {
    await clearKeys();
    await go(hash);
    ok(`${label} 보기 방식 컨트롤 있음`, await viewSeg().isVisible());
    ok(`${label} 버튼 하나로 전환한다`, (await page.locator('#page-head-actions .view-toggle').count()) === 1);
    ok(`${label} PC 기본은 그리드`, await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid')));
    ok(`${label} 지금 보기가 버튼 얼굴로 드러난다`, (await view()) === 'grid', await view());
    ok(`${label} 이름이 "지금 이것 · 누르면 저것"`, /그리드/.test(await viewSeg().getAttribute('aria-label')) && /누르면/.test(await viewSeg().getAttribute('aria-label')),
      await viewSeg().getAttribute('aria-label'));
  }

  // ── 도감: 리스트 칸을 눌러 리스트로 → 저장 → 새로고침해도 유지, 기존 클래스·키 이름 불변
  await clearKeys();
  await go('#/dex');
  ok('도감 컨트롤에 .dex__layout 유지 (회귀)', await page.locator('.dex__layout').count() === 1);
  await listBtn().click();
  await page.waitForTimeout(300);
  ok('도감 버튼을 누르면 리스트로', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));
  ok('도감 버튼 얼굴도 리스트로 바뀐다', (await view()) === 'list', await view());
  ok('도감 저장 키 불변(pogo_dex_cols=1)', (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '1');
  // 한 번 더 누르면 되돌아온다 — 버튼 하나는 누를 때마다 뒤집힌다
  await viewSeg().click();
  await page.waitForTimeout(300);
  ok('한 번 더 누르면 그리드로 되돌아온다', (await view()) === 'grid' && (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '2', await view());
  await viewSeg().click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  ok('도감 새로고침해도 리스트 유지', !(await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'))));

  // ── 화면마다 저장 키가 달라 선택이 안 섞인다 (도감을 리스트로 바꿔도 알 부화는 그리드 그대로)
  await go('#/eggs');
  ok('알 부화는 도감의 선택과 무관 (그리드 유지)', await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid')));
  await listBtn().click();
  await page.waitForTimeout(300);
  ok('알 부화 저장 키는 따로(pogo_eggs_cols)', (await page.evaluate(() => localStorage.getItem('pogo_eggs_cols'))) === '1');
  ok('도감 저장 키는 그대로(다른 화면 선택에 안 흔들림)', (await page.evaluate(() => localStorage.getItem('pogo_dex_cols'))) === '1');

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
    await gpage.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    // 고정 대기는 병렬로 돌 때 모자란다 — 재려는 목록이 실제로 붙을 때까지 기다린다
    // (2026-09-11 v2.59.0: 500ms 뒤에 재다가 아직 안 그려진 화면에서 null 을 집었다)
    await gpage.waitForSelector(sel, { timeout: 15000 }).catch(() => {});
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
    await spage.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await spage.waitForSelector('#page .dex__row', { timeout: 15000 }).catch(() => {});
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
    await ppage.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await ppage.waitForTimeout(500);
    // 2026-09-12 v3.1.0 안내문 옆이 아니라 화면 머리 오른쪽이다 — 제목과 같은 높이,
    // 본문(안내문·목록)보다 위. 본문에는 토글이 남아 있으면 안 된다(옮긴 것이지 복제가 아니다)
    const rects = await ppage.evaluate(() => {
      const btn = document.querySelector('#page-head-actions .view-toggle');
      const title = document.querySelector('#page-head h2');
      const note = document.querySelector('#page .gameday__intro .note');
      if (!btn || !title) return null;
      const b = btn.getBoundingClientRect(), t = title.getBoundingClientRect();
      return {
        inHead: true,
        rightOfTitle: b.left > t.right,
        aboveBody: note ? b.bottom <= note.getBoundingClientRect().top + 1 : false,
        leftInBody: !!document.querySelector('#page .page__body .view-toggle'),
      };
    });
    ok('레이드 보스: 보기 방식 컨트롤이 화면 머리에', !!rects && rects.inHead, JSON.stringify(rects));
    ok('레이드 보스: 제목 오른쪽 · 본문 위', !!rects && rects.rightOfTitle && rects.aboveBody, JSON.stringify(rects));
    ok('레이드 보스: 본문에 남은 토글이 없다', !!rects && !rects.leftInBody, JSON.stringify(rects));
    await pctx.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
