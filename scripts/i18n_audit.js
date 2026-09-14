'use strict';
// 쓰는 법: dist 를 띄운 뒤(localhost:5503) node scripts/i18n_audit.js — 남은 한글을 어디서 나왔는지와 함께 찍는다 (2026-09-14 v3.26.0)
// EN 으로 놓고 화면·팝업을 두루 열어 한글이 남은 글자·속성을 모은다
const { launch, newContext, waitSplash } = require('../tests/e2e/_lib');
const BASE = 'http://localhost:5503/';
const HANGUL = /[가-힣]/;
(async () => {
  const browser = await launch();
  const found = new Map();   // text → Set(where)
  const collect = async (page, where) => {
    const items = await page.evaluate(() => {
      const out = [];
      const skip = (n) => n.closest('[data-i18n="off"], .i18n-note, script, style, noscript');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const s = t.textContent.trim();
        if (!/[가-힣]/.test(s) || !t.parentElement || skip(t.parentElement)) continue;
        const el = t.parentElement;
        const vis = el.getClientRects().length > 0 || el.closest('dialog[open], .drawer, .app-nav');
        out.push({ text: s.slice(0, 90), path: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`, vis: !!vis, kind: 'text' });
      }
      for (const el of document.body.querySelectorAll('[aria-label],[placeholder],[title],[alt]')) {
        if (skip(el)) continue;
        for (const a of ['aria-label', 'placeholder', 'title', 'alt']) {
          const v = el.getAttribute(a); if (v && /[가-힣]/.test(v)) out.push({ text: `[${a}] ${v.slice(0, 90)}`, path: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`, vis: true, kind: 'attr' });
        }
      }
      return out;
    });
    for (const it of items) { const k = `${it.text}`; if (!found.has(k)) found.set(k, new Set()); found.get(k).add(`${where} ${it.path}${it.vis ? '' : ' (숨김)'}`); }
  };
  const open = async (ctx, hash, where, after) => {
    const page = await ctx.newPage();
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await waitSplash(page); await page.waitForTimeout(700);
    try { if (after) await after(page); } catch (e) { console.log('  (상호작용 실패)', where, e.message.split('\n')[0]); }
    await page.waitForTimeout(400);
    await collect(page, where);
    await page.close();
  };
  const mk = async (opts = {}) => {
    const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 }, ...opts });
    await ctx.addInitScript(() => { try { localStorage.setItem('pogo_lang', 'en'); } catch {} });
    return ctx;
  };
  const ctx = await mk();
  const mctx = await mk({ locks: true });
  const shots = [
    ['', '홈'], ['#/dex', '도감'], ['#/dex?q=리자', '도감 검색'], ['#/dmax', 'D-MAX'], ['#/pve', 'PvE'], ['#/pvp', 'PvP'], ['#/pvp/ivrank', '개체값 순위'],
    ['#/raids', '레이드 보스'], ['#/eggs', '알 부화'], ['#/finder', '검색식'], ['#/release', '패치노트'], ['#/changes', '기술 변경'], ['#/settings', '설정'],
    ['#/planner', '플래너'], ['#/mon/260', '상세 딥링크'], ['#/no-such', '404'],
  ];
  for (const [hash, where] of shots) await open(ctx, hash, where);
  // 상호작용이 있는 상태들
  await open(ctx, '', '드로어 메뉴', async (p) => { await p.locator('.app-bar .icon-btn[aria-label*="메뉴"], .app-bar .icon-btn[aria-label*="Menu"], #menu-btn, .app-bar__menu').first().click(); await p.waitForTimeout(400); });
  await open(ctx, '#/dex', '도감 상세 패널', async (p) => { await p.locator('#page .dex__row').first().click(); await p.waitForTimeout(800); });
  await open(ctx, '#/dex', '도감 상세 계산기', async (p) => { await p.locator('#page .dex__row').first().click(); await p.waitForTimeout(600); for (const b of await p.locator('#detail-panel details summary, #detail-panel .detail__acc > summary').all()) { await b.click().catch(() => {}); } await p.waitForTimeout(400); });
  await open(ctx, '#/dex', '도감 카드 모드', async (p) => { await p.locator('#page-head-actions .view-toggle').click(); await p.waitForTimeout(400); });
  await open(ctx, '#/dmax', 'D-MAX 딜러', async (p) => { await p.locator('.seg button').nth(1).click(); await p.waitForTimeout(500); });
  await open(ctx, '#/dmax', 'D-MAX 탱커+칩', async (p) => { await p.locator('.seg button').nth(2).click(); await p.waitForTimeout(400); await p.locator('.chips__item, .tchips > *').nth(1).click(); await p.waitForTimeout(400); await p.locator('#content .row-list > .row').first().click(); await p.waitForTimeout(500); });
  await open(ctx, '#/dmax', 'D-MAX 티어 행 펼침', async (p) => { await p.locator('#content .row-list > .row').first().click(); await p.waitForTimeout(500); });
  await open(ctx, '#/pve', 'PvE 전체+솔플', async (p) => { await p.locator('.seg button').nth(1).click(); await p.waitForTimeout(400); await p.locator('.tool-btn, [data-tool], button:has-text("솔플"), button:has-text("Solo")').first().click(); await p.waitForTimeout(600); });
  await open(ctx, '#/pvp', 'PvP 리그+덱', async (p) => { await p.locator('.seg button').nth(2).click(); await p.waitForTimeout(400); await p.locator('.tool-btn, button:has-text("덱"), button:has-text("team")').first().click(); await p.waitForTimeout(600); });
  await open(ctx, '#/pvp/ivrank', '개체값 순위 고르기', async (p) => { await p.locator('.ivrank__pick input, #ivrank-search, input[type="search"]').first().fill('리자'); await p.waitForTimeout(600); await p.locator('.ivrank__pick .boss__sugg > *').first().click(); await p.waitForTimeout(700); });
  await open(ctx, '#/finder', '검색식 조건', async (p) => { for (const b of (await p.locator('#page .finder__chip, #page .uchip, #page button').all()).slice(0, 6)) { await b.click().catch(() => {}); } await p.waitForTimeout(400); });
  await open(ctx, '#/settings', '설정 언어 줄', async (p) => { await p.locator('.settings__choice').nth(1).click().catch(() => {}); await p.waitForTimeout(300); });
  await open(mctx, '#/raids', '잠긴 화면(로그인 유도 카드)');
  await open(mctx, '#/raids', '로그인 유도 팝업', async (p) => { await p.locator('.plan__lock-go').click(); await p.waitForTimeout(500); });
  await open(mctx, '', '홈 잠긴 타일', async (p) => { await p.locator('.home__tile[aria-disabled="true"]').first().click(); await p.waitForTimeout(500); });
  const bctx = await mk({ banner: true });
  await open(bctx, '', '동의 배너');
  const mock = await mk();
  await open(mock, '?mock=1#/planner', '플래너(로그인)');
  await open(mock, '?mock=1#/plan/mons', '내 포켓몬(로그인)', async (p) => { await p.locator('button:has-text("추가"), button:has-text("Add"), .plan__add').first().click(); await p.waitForTimeout(600); });
  await open(mock, '?mock=1', '계정 메뉴(로그인)', async (p) => { await p.locator('.app-bar .icon-btn[aria-label*="메뉴"], .app-bar .icon-btn[aria-label*="Menu"], #menu-btn, .app-bar__menu').first().click(); await p.waitForTimeout(400); });
  await open(mock, '?mock=1#/dex', '상세(로그인) 저장', async (p) => { await p.locator('#page .dex__row').first().click(); await p.waitForTimeout(600); await p.locator('#detail-panel button:has-text("+"), #detail-panel .detail__save, #detail-panel [aria-label*="저장"], #detail-panel [aria-label*="Save"]').first().click(); await p.waitForTimeout(600); });
  const rows = [...found.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\n한글 남은 항목 ${rows.length}개\n`);
  for (const [text, wheres] of rows) console.log(`- ${text}\n    ${[...wheres].slice(0, 3).join(' | ')}`);
  await browser.close();
})();
