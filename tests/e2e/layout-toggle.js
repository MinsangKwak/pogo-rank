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
//   - **눌렀을 때 화면이 실제로 달라지는가** (v3.9.1) — 클래스만 바뀌고 CSS 가 그걸 안 보던 시절이 있었다
//   - (v3.10.0) 휴대폰 그리드가 두 칸인가 · 동작 버튼이 한 줄에 서는가 · 리스트 아이콘이 ☰ 메뉴와 다른가
const { launch, newContext, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
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
    const gctx = await newContext(browser, { viewport: { width: w, height: 900 } });
    const gpage = await gctx.newPage();
    gpage.on('pageerror', (e) => errs.push(`${label}:` + e));
    await gpage.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await gpage.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
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
    const sctx = await newContext(browser, { viewport: { width: w, height: 900 } });
    const spage = await sctx.newPage();
    spage.on('pageerror', (e) => errs.push(`squeeze ${w}:` + e));
    await spage.goto(BASE + '#/raids', { waitUntil: 'domcontentloaded' });
    await spage.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
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
    const pctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    const ppage = await pctx.newPage();
    ppage.on('pageerror', (e) => errs.push('intro-pos:' + e));
    await ppage.goto(BASE + '#/raids', { waitUntil: 'domcontentloaded' });
    await ppage.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
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

  // ── 2026-09-12 v3.9.1 **눈에 보이는 변화가 있는가**
  // 이 스위트는 40개가 통과하는 동안 레이드 · PvE 와 D-MAX 의 전환이 아무 일도 안 하고 있었다.
  // data-view 도 바뀌고 is-grid 도 붙었다 뗐다 했는데, 정작 CSS 가 그 클래스를 안 봤다 —
  // 카드 규칙(`body:is([data-route=…]) #content .row-list`)이 특정도에서 이겨 버렸기 때문이다.
  // 클래스는 수단이지 결과가 아니다. 줄 하나의 **실제 높이**가 달라지는지로 받는다:
  // 카드는 그림이 크게 들어가 줄보다 한참 높다. 폭도 둘 다 본다 — 좁은 화면에서는 전환 자체가
  // 미디어 쿼리에 묶여 있어 아무 일도 일어나지 않았다
  for (const w of [390, 1440]) {
    const vctx = await newContext(browser, { viewport: { width: w, height: 900 }, hasTouch: w < 1000, isMobile: w < 1000 });
    const vp = await vctx.newPage();
    vp.on('pageerror', (e) => errs.push(`visual(${w}):` + e));
    for (const [hash, label, sel] of [
      ['#/dex', '도감', '#page .dex__list > *'],
      ['#/raids', '레이드 보스', '#page .dex__list > *'],
      ['#/eggs', '알 부화', '#page .dex__list > *'],
      ['#/dmax', 'D-MAX', '#content .row-list > .row'],
      ['#/pve', '레이드 · PvE', '#content .row-list > .row'],
    ]) {
      await vp.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
      await vp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
      await vp.waitForTimeout(600);
      const btn = vp.locator('#page-head-actions .view-toggle').first();
      if (!(await btn.count())) { ok(`${label}(w=${w}) 보기 전환 버튼 있음`, false, '버튼 없음'); continue; }
      const rowH = () => vp.evaluate((s) => {
        const n = document.querySelector(s);
        return n ? Math.round(n.getBoundingClientRect().height) : 0;
      }, sel);
      const face = () => btn.getAttribute('data-view');
      const a = { view: await face(), h: await rowH() };
      await btn.click();
      await vp.waitForTimeout(450);
      const b = { view: await face(), h: await rowH() };
      ok(`${label}(w=${w}) 버튼 얼굴이 뒤집힌다`, a.view !== b.view, `${a.view} → ${b.view}`);
      ok(`${label}(w=${w}) 줄 높이가 실제로 달라진다`, a.h > 0 && b.h > 0 && Math.max(a.h, b.h) > Math.min(a.h, b.h) * 1.5,
        `${a.view} ${a.h}px → ${b.view} ${b.h}px`);
      // 카드 쪽이 더 높다 — 방향이 뒤집혀 있으면 어느 한쪽 규칙이 반대로 걸린 것이다
      const card = a.view === 'grid' ? a : b;
      const line = a.view === 'grid' ? b : a;
      ok(`${label}(w=${w}) 그리드가 리스트보다 높다`, card.h > line.h, `grid ${card.h} vs list ${line.h}`);
    }
    await vctx.close();
  }

  // ── 2026-09-12 v3.10.0 좁은 화면의 티어표 그리드 · 동작 버튼 줄 · 리스트 아이콘
  {
    const mctx = await newContext(browser, { viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    const mp = await mctx.newPage();
    mp.on('pageerror', (e) => errs.push('mobile:' + e));
    for (const [hash, label] of [['#/pve', '레이드 · PvE'], ['#/dmax', 'D-MAX'], ['#/pvp', '배틀 · PvP']]) {
      await mp.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
      await mp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
      await mp.waitForTimeout(700);
      const btn = mp.locator('#page-head-actions .view-toggle').first();
      ok(`${label} 보기 전환이 있다`, (await btn.count()) === 1);
      if (!(await btn.count())) continue;
      if ((await btn.getAttribute('data-view')) !== 'grid') { await btn.click(); await mp.waitForTimeout(450); }
      // 휴대폰 그리드는 두 칸 — 한 칸이면 스크롤 한 번에 한 마리라 티어표를 훑을 수가 없다
      const cols = await mp.evaluate(() => {
        const l = document.querySelector('#content .row-list');
        return l ? getComputedStyle(l).gridTemplateColumns.split(' ').length : 0;
      });
      ok(`${label} 휴대폰 그리드는 두 칸`, cols === 2, String(cols));
      // 동작 버튼은 가로 한 줄 — 위아래로 쌓으면 화면 머리가 두 배로 높아진다
      const headRow = await mp.evaluate(() => {
        const a = document.querySelector('#page-head-actions');
        if (!a || a.children.length < 2) return { tops: [], ok: true };
        const tops = [...a.children].map((c) => Math.round(c.getBoundingClientRect().top));
        return { tops, ok: new Set(tops).size === 1 };
      });
      ok(`${label} 동작 버튼이 한 줄에 선다`, headRow.ok, JSON.stringify(headRow.tops));
      ok(`${label} 가로 넘침 없음`, !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    }
    // 리스트 얼굴이 ☰ 메뉴 버튼과 같은 그림이면 안 된다 (v3.10.0)
    await mp.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
    await mp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await mp.waitForTimeout(700);
    const face = mp.locator('#page-head-actions .view-toggle').first();
    if ((await face.getAttribute('data-view')) !== 'list') { await face.click(); await mp.waitForTimeout(400); }
    const art = await mp.evaluate(() => {
      const pick = (n) => n?.querySelector('.pxi')?.innerHTML ?? '';
      return { list: pick(document.querySelector('#page-head-actions .view-toggle')), menu: pick(document.getElementById('menu-toggle')) };
    });
    ok('리스트 아이콘이 그려져 있다', art.list.length > 0);
    ok('리스트 아이콘이 ☰ 메뉴와 다른 그림이다', art.list !== art.menu, `${art.list.length} vs ${art.menu.length}`);
    await mctx.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
