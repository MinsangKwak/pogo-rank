'use strict';
// v3.32.0 🧩 D-MAX 덱 짜기 회귀 — views/maxdeck.js
//
// 이 스위트가 지키려는 것
//   - 주소로 들어가면 세 칸이 채워져 있는가 (딜러 2 + 탱커 1)
//   - 보스 칩을 바꾸면 세 칸이 **전부** 새 보스의 표에서 다시 채워지는가
//     (첫 구현에서 주소에 남은 옛 덱을 되읽어 칸이 비던 버그가 있었다 — 그 자리를 못 박는다)
//   - 같은 종이 두 칸에 들어가지 않는가
//   - [바꾸기] 로 고른 개체가 그 칸에 들어가는가
//   - [다이맥스만] 을 켜면 거다이맥스가 한 칸도 안 남는가
//   - 주소에 실린 덱을 그대로 열면 같은 세 칸이 나오는가
//   - D-MAX 화면과 덱 짜기를 버튼 하나로 오가는가
//   - 로그인 없이도 열리는가 — 부모인 D-MAX 가 누구나 보는 화면이라 이 도구도 잠그지 않는다
//     (잠금은 app.js 가 탭 단위로 건다. PvP 덱 짜기가 잠기는 것은 PvP 탭이 잠겨서다)
//   - EN 으로 바꿔도 한글이 남지 않는가
const { toEnglish, launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const errs = [];
  const ctx = await newContext(browser, { locks: true, viewport: { width: 1440, height: 1000 } });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(500);
  };
  // 칸마다 종 이름 하나 (nameNode 가 폼 뱃지 + <b>종 이름</b> 을 만든다)
  const names = () => page.evaluate(() => [...document.querySelectorAll('#content .deck-slot')]
    .map((row) => row.querySelector('.row__name b')?.textContent.trim() ?? ''));
  const bossChip = (label) => page.locator('#content .submenu button', { hasText: new RegExp(`^${label}$`) }).first();

  await go('#/dmax/deck');

  // ── 세 칸이 채워진다
  ok('칸이 셋', (await page.locator('#content .deck-slot').count()) === 3);
  const first = await names();
  ok('세 칸이 다 차 있다', first.every((name) => name && name !== '비어 있어요'), first.join(' / '));
  ok('역할이 딜러 2 + 탱커 1', await page.evaluate(() => {
    const subs = [...document.querySelectorAll('#content .deck-slot .row__sub')].map((s) => s.textContent);
    return subs.filter((t) => t.startsWith('딜러')).length === 2 && subs.filter((t) => t.startsWith('탱커')).length === 1;
  }));
  ok('주소에 보스와 덱이 실린다', /[?&]b=/.test(await page.evaluate(() => location.hash))
    && /[?&]p=/.test(await page.evaluate(() => location.hash)), await page.evaluate(() => decodeURIComponent(location.hash)));

  // ── 보스를 바꾸면 세 칸이 전부 다시 채워진다 (빈 칸이 생기던 버그 자리)
  for (const label of ['불꽃', '물', '전기']) {
    await bossChip(label).click();
    await page.waitForTimeout(400);
    const got = await names();
    ok(`${label} 보스로 바꿔도 빈 칸이 없다`, got.every((name) => name && name !== '비어 있어요'), got.join(' / '));
    ok(`${label} 보스에 같은 종이 두 칸에 없다`, new Set(got).size === got.length, got.join(' / '));
  }

  // ── [바꾸기] 로 고른 개체가 그 칸에 들어간다
  await page.locator('#content .deck-slot .deck-slot__swap').nth(1).click();
  await page.waitForTimeout(350);
  const picker = page.locator('#content .deck-slot__picker .row__why-chip');
  ok('후보가 펼쳐진다', (await picker.count()) > 1, `${await picker.count()}개`);
  const wanted = (await picker.nth(2).locator('b').textContent()).trim();   // 칩도 nameNode 라 폼 뱃지가 앞에 붙는다
  await picker.nth(2).click();
  await page.waitForTimeout(400);
  ok('고른 개체가 2번 칸에 들어간다', (await names())[1] === wanted, `${(await names())[1]} vs ${wanted}`);
  ok('고르고 나면 후보가 접힌다', (await page.locator('#content .deck-slot__picker').count()) === 0);

  // ── [다이맥스만]
  await page.locator('#content .uchip', { hasText: '다이맥스만' }).click();
  await page.waitForTimeout(450);
  ok('다이맥스만: 거다이맥스가 한 칸도 없다', await page.evaluate(() =>
    ![...document.querySelectorAll('#content .deck-slot .form-tag')].some((tag) => tag.textContent.includes('거다이맥스'))));
  const dynaDeck = await names();
  ok('다이맥스만: 세 칸이 그대로 찬다', dynaDeck.every((name) => name && name !== '비어 있어요'), dynaDeck.join(' / '));

  // ── 주소를 그대로 열면 같은 덱
  const shared = await page.evaluate(() => location.hash);
  const ctx2 = await newContext(browser, { locks: true, viewport: { width: 1440, height: 1000 } });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', (e) => errs.push('share: ' + e));
  await page2.goto(BASE + shared, { waitUntil: 'domcontentloaded' });
  await waitSplash(page2);
  await page2.waitForTimeout(600);
  const opened = await page2.evaluate(() => [...document.querySelectorAll('#content .deck-slot')]
    .map((row) => row.querySelector('.row__name b')?.textContent.trim() ?? ''));
  ok('주소로 연 덱이 같다', JSON.stringify(opened) === JSON.stringify(dynaDeck), `${opened.join('/')} vs ${dynaDeck.join('/')}`);
  await ctx2.close();

  // ── D-MAX 화면과 오가는 버튼
  await go('#/dmax');
  ok('D-MAX 화면에 덱 짜기 버튼', (await page.locator('.tool-btn', { hasText: '덱 짜기' }).count()) === 1);
  await page.locator('.tool-btn', { hasText: '덱 짜기' }).click();
  await page.waitForTimeout(500);
  ok('버튼으로 덱 짜기에 간다', (await page.evaluate(() => location.hash)).startsWith('#/dmax/deck'));
  await page.locator('.tool-btn', { hasText: '덱 짜기' }).click();
  await page.waitForTimeout(500);
  ok('한 번 더 누르면 D-MAX 로 돌아온다', (await page.evaluate(() => location.hash)) === '#/dmax');

  // ── EN
  await go('#/dmax/deck');
  await toEnglish(page);
  await page.waitForTimeout(500);
  const leftKo = await page.evaluate(() => (document.querySelector('#content').textContent.match(/[가-힣]+/g) ?? []));
  ok('EN 에서 한글이 안 남는다', leftKo.length === 0, leftKo.slice(0, 8).join(' '));
  await page.evaluate(() => setLang('ko'));
  await ctx.close();

  // ── 로그인 없이도 열린다 (부모 D-MAX 와 같다). 잠긴 PvP 덱 짜기와 대조해 둔다
  const ctx3 = await newContext(browser, { locks: true, viewport: { width: 1440, height: 1000 } });
  const page3 = await ctx3.newPage();
  page3.on('pageerror', (e) => errs.push('anon: ' + e));
  await page3.goto('http://localhost:5503/#/dmax/deck', { waitUntil: 'domcontentloaded' });
  await waitSplash(page3);
  await page3.waitForTimeout(600);
  ok('로그인 없이도 덱이 그려진다', (await page3.locator('.deck-slot').count()) === 3);
  ok('로그인 없이 잠금 카드가 안 뜬다', (await page3.locator('.plan__lock').count()) === 0);
  await page3.goto('http://localhost:5503/#/pvp/deck', { waitUntil: 'domcontentloaded' });
  await waitSplash(page3);
  await page3.waitForTimeout(600);
  ok('대조: PvP 덱 짜기는 잠겨 있다', (await page3.locator('.plan__lock').count()) === 1);
  await ctx3.close();

  ok('JS 오류 없음', errs.length === 0, errs.join(' | '));
  await finish(browser);
});
