'use strict';
// v3.36.0 🌫 미구현 표시 회귀 — "데이터는 있는데 아직 못 쓰는 것" 을 지우지 않고 흐리게 보여 준다
//
// 이 스위트가 지키려는 것
//   - D-MAX 세 표(전체·딜러·탱커)에 미구현 줄이 흐리게(.is-unreleased) 뜨는가
//   - 그 줄에 [미구현] 딱지가 붙고 순위 칸이 '–' 인가
//   - **출시분의 순위가 1,2,3… 으로 끊기지 않는가** — 미구현을 같이 세면 번호가 밀린다
//   - 등급의 100% 기준이 출시분 1위인가 (미구현은 100% 를 넘을 수 있다)
//   - 펼친 근거 줄에 순위 0 이 안 나오는가 (탭마다 행이 복사본이라 객체로 찾으면 못 찾는다)
//   - **덱 짜기·솔플 후보에는 안 들어가는가** — 순위표는 "있으면 이쯤" 이지만 덱은 지금 데려갈 수 있는 것만
//   - 도감의 미출시 메가가 딱지로 뜨되 흐린가 (메가 폭타)
//   - 도감 줄에서 메가 딱지가 눕지 않는가 (PC 줄 모드 격자에 자리가 없어 '메/가' 로 세로로 눕던 자리)
//   - EN 으로 바꿔도 한글이 남지 않는가
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const errs = [];
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 1000 } });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(500);
  };
  // 줄 모드로 — 카드 모드는 순위 칸이 모서리에 얹혀 읽기 번거롭다
  const toListView = async () => {
    const toggle = page.locator('.view-toggle').first();
    if (await toggle.count()) { await toggle.click(); await page.waitForTimeout(500); }
  };
  // 표의 줄을 [순위, 미구현 여부] 로 읽는다.
  // **표 단위로 읽는다** — 딜러 화면에는 티어표와 딜러표가 같이 있어 한 줄로 이으면 번호가 두 번 1부터 센다
  const readRows = (index = 0) => page.evaluate((listIndex) => {
    const list = document.querySelectorAll('.row-list')[listIndex];
    return [...(list?.querySelectorAll('.row') ?? [])].map((node) => ({
      rank: node.querySelector('.row__rank')?.firstChild?.textContent?.trim() ?? '',
      unrel: node.classList.contains('is-unreleased'),
      badge: !!node.querySelector('.dex__unrel'),
      opacity: getComputedStyle(node).opacity,
    }));
  }, index);

  // ── 1. D-MAX 티어표 ───────────────────────────────────────────────────────
  await go('#/dmax');
  await toListView();
  let rows = await readRows();
  const unrelRows = rows.filter((row) => row.unrel);
  ok('티어표에 미구현 줄이 있다', unrelRows.length > 0, `줄 ${rows.length} 중 미구현 ${unrelRows.length}`);
  ok('미구현 줄은 흐리다', unrelRows.every((row) => Number(row.opacity) < 0.7),
    unrelRows.map((row) => row.opacity).join(','));
  ok('미구현 줄에 딱지가 붙는다', unrelRows.every((row) => row.badge));
  ok('미구현 줄은 순위 대신 –', unrelRows.every((row) => row.rank === '–'), unrelRows.map((row) => row.rank).join(','));
  // 출시분 번호가 1,2,3… 으로 이어진다 (미구현이 사이에 끼어도 밀리지 않는다)
  const ranks = rows.filter((row) => !row.unrel).map((row) => Number(row.rank));
  ok('출시분 순위가 1부터 안 끊긴다', ranks.every((value, index) => value === index + 1),
    ranks.slice(0, 8).join(','));

  // 등급 기준선: 출시분 1위가 100%
  const pcts = await page.evaluate(() => [...document.querySelectorAll('.row')].map((node) => ({
    unrel: node.classList.contains('is-unreleased'),
    pct: Number((node.querySelector('.row__score')?.textContent ?? '').replace('%', '')),
  })));
  const topReleased = pcts.find((entry) => !entry.unrel);
  ok('출시분 1위가 100%', topReleased?.pct === 100, String(topReleased?.pct));
  ok('미구현은 100% 를 넘을 수 있다', pcts.some((entry) => entry.unrel && entry.pct > 100),
    pcts.filter((entry) => entry.unrel).map((entry) => entry.pct).join(','));

  // 근거 줄: 순위 0 이 나오면 목록에서 그 행을 못 찾은 것이다
  await page.locator('.row').first().click();
  await page.waitForTimeout(400);
  const why = await page.evaluate(() => [...document.querySelectorAll('.row__why-line')].map((node) => node.textContent));
  ok('근거 줄이 펼쳐진다', why.length > 0);
  ok('근거 줄에 0위가 없다', !why.some((line) => /\s0위/.test(line)),
    why.filter((line) => /\s0위/.test(line)).slice(0, 2).join(' | '));

  // ── 2. 딜러 · 탱커 표도 같은 규칙 ─────────────────────────────────────────
  for (const [axis, label] of [['dealer', '딜러'], ['tank', '탱커']]) {
    await go(`#/dmax?axis=${axis}`);
    await page.evaluate((id) => {
      const button = [...document.querySelectorAll('.js-screen-tab button, .seg button')]
        .find((node) => node.dataset.v === id || node.textContent.trim() === (id === 'tank' ? '탱커' : '딜러'));
      if (button) button.click();
    }, axis);
    await page.waitForTimeout(600);
    await toListView();
    // 딜러 화면은 [티어표, 딜러표] 두 표다 — 마지막 표가 그 축의 표
    rows = await readRows(await page.locator('.row-list').count() - 1);
    const unrel = rows.filter((row) => row.unrel);
    const numbered = rows.filter((row) => !row.unrel).map((row) => Number(row.rank));
    ok(`${label}: 미구현 줄이 흐리게 있다`, unrel.length > 0 && unrel.every((row) => Number(row.opacity) < 0.7),
      `미구현 ${unrel.length}`);
    ok(`${label}: 출시분 순위가 안 밀린다`, numbered.every((value, index) => value === index + 1),
      numbered.slice(0, 8).join(','));
  }

  // ── 3. 덱 짜기에는 안 들어간다 ────────────────────────────────────────────
  await go('#/dmax/deck');
  const deckUnrel = await page.evaluate(() =>
    [...document.querySelectorAll('.deck-slot')].filter((node) => node.textContent.includes('미구현')).length);
  ok('덱 짜기 칸에 미구현이 없다', deckUnrel === 0, String(deckUnrel));
  // [바꾸기] 후보 목록에도 없어야 한다
  const swap = page.locator('.deck-slot button').filter({ hasText: '바꾸기' }).first();
  if (await swap.count()) {
    await swap.click();
    await page.waitForTimeout(500);
    const candUnrel = await page.evaluate(() =>
      [...document.querySelectorAll('.deck-swap__item, .deck-slot__cand, .row')]
        .filter((node) => node.textContent.includes('미구현')).length);
    ok('후보 목록에도 미구현이 없다', candUnrel === 0, String(candUnrel));
  }

  // ── 4. 도감의 미출시 메가 ─────────────────────────────────────────────────
  await go('#/dex');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.screen-tabs button')].find((node) => node.textContent.trim() === '3세대');
    if (button) button.click();
  });
  await page.waitForTimeout(700);
  const megaTags = await page.evaluate(() => [...document.querySelectorAll('.dex__mega')].map((node) => {
    const box = node.getBoundingClientRect();
    return { text: node.textContent.trim(), unrel: node.classList.contains('is-unreleased'),
      title: node.title, w: Math.round(box.width), h: Math.round(box.height) };
  }));
  ok('메가 딱지가 그려진다', megaTags.length > 0, String(megaTags.length));
  ok('미출시 메가도 딱지가 붙는다', megaTags.some((tag) => tag.unrel),
    megaTags.filter((tag) => tag.unrel).map((tag) => tag.text).join(','));
  ok('미출시 메가 딱지는 그 사실을 말한다',
    megaTags.filter((tag) => tag.unrel).every((tag) => tag.title.includes('미구현')),
    megaTags.filter((tag) => tag.unrel).map((tag) => tag.title).join(' | '));
  // 글자가 세로로 눕지 않는다 — 가로가 세로보다 넓어야 한다
  ok('메가 딱지가 눕지 않는다', megaTags.every((tag) => tag.w > tag.h),
    megaTags.map((tag) => `${tag.text}:${tag.w}x${tag.h}`).slice(0, 4).join(' '));
  // 줄 모드에서도 (PC 격자에 자리가 없어 눕던 자리)
  await toListView();
  await page.waitForTimeout(400);
  const megaTagsList = await page.evaluate(() => [...document.querySelectorAll('.dex__mega')].map((node) => {
    const box = node.getBoundingClientRect();
    return { w: Math.round(box.width), h: Math.round(box.height) };
  }));
  ok('줄 모드에서도 안 눕는다', megaTagsList.every((tag) => tag.w > tag.h),
    megaTagsList.slice(0, 4).map((tag) => `${tag.w}x${tag.h}`).join(' '));

  // ── 5. EN ────────────────────────────────────────────────────────────────
  await go('#/dmax');
  await page.evaluate(() => setLang('en'));
  await page.waitForTimeout(600);
  const leftKo = await page.evaluate(() => {
    const scope = document.querySelector('#content').textContent + ' ' + (document.getElementById('note')?.textContent ?? '');
    return scope.match(/[가-힣]+/g) ?? [];
  });
  ok('EN 에서 한글이 안 남는다', leftKo.length === 0, leftKo.slice(0, 8).join(' '));
  await page.evaluate(() => setLang('ko'));
  await ctx.close();

  ok('JS 오류 없음', errs.length === 0, errs.join(' | '));
  await finish(browser);
});
