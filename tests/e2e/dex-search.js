'use strict';
// 검색 → 도감 회귀 (2026-09-12 v3.9.0)
//
// 이 스위트가 지키려는 것
//   - 헤더 검색의 기본 행동이 **도감으로 데려가는 것**인가 (Enter · [도감에서 보기])
//   - 도감이 주소(#/dex?q=…&t=…)에 실린 조건을 그대로 그리는가 — 링크로 공유·재방문이 된다
//   - 결과에 **폼**(메가·섀도우·다이맥스)이 남는가 — 도감번호 목록에는 종만 있어 그냥 거르면 사라진다
//   - 폼 줄을 누르면 그 폼이 열리는가 — 도감번호로 열면 전부 원종이 뜬다
//   - 타입 칩이 실제로 목록을 거르는가 (v3.9.0 전에는 조용히 색인 전체로 되돌아갔다)
//   - 패널이 적는 마리 수가 **잘리기 전의 참 수**인가
//   - (v3.10.0) 패널은 결과를 한 줄도 안 그리는가 — 결과는 도감 한 곳에서만 그린다
//   - (v3.10.0) 도감 안 검색 칸이 커서를 안 빼앗기고 목록·주소를 함께 고치는가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const settle = async () => {
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
  };
  const goHash = async (hash) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForTimeout(500);
  };
  const rows = () => page.locator('#page .dex__row');
  const banner = () => page.locator('#page .dex__found b').innerText();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await settle();

  // ── 1. 헤더 검색 패널: 참 수 · 도감으로 가는 길 ──────────────────────────────
  await page.click('#search-toggle');
  await page.waitForTimeout(200);
  await page.fill('#psearch', '리');
  await page.waitForTimeout(400);
  const head = await page.locator('#psearch-sugg .sugg__head').first().innerText();
  const total = +(/(\d+)마리/.exec(head)?.[1] ?? 0);
  // 2026-09-12 v3.10.0 패널은 결과를 **한 줄도** 그리지 않는다 — 같은 목록을 두 곳에서 그리면
  // 패널의 여덟 줄이 "결과" 로 보여 정작 전부가 있는 도감까지 가지 않는다
  ok('패널에 결과 줄이 없다', (await page.locator('#psearch-sugg .sugg__item').count()) === 0);
  ok('몇 마리인지는 말해 준다', total > 8, String(total));
  ok('머리에 [도감에서 보기] 가 있다', (await page.locator('#psearch-sugg .sugg__all').count()) === 1);
  ok('도감으로 보내는 줄이 있다',
    /도감에서 보기/.test(await page.locator('#psearch-sugg .sugg__all-row').innerText()));

  // ── 2. Enter = 도감으로 ─────────────────────────────────────────────────────
  await page.press('#psearch', 'Enter');
  await page.waitForTimeout(700);
  ok('Enter 를 치면 도감으로 간다', /^#\/dex\?/.test(decodeURIComponent(await page.evaluate(() => location.hash))));
  ok('검색어가 주소에 실린다', /q=리/.test(decodeURIComponent(await page.evaluate(() => location.hash))));
  ok('검색 패널은 닫힌다', !(await page.evaluate(() => !!document.querySelector('#search-dialog')?.open)));
  ok('도감이 결과를 전부 그린다', (await rows().count()) === total, `${await rows().count()} / ${total}`);
  ok('머리 줄이 조건과 수를 말한다', /"리" \d+마리/.test(await banner()), await banner());
  ok('[더보기] 는 없다 (한 번에 다 그렸다)', await page.evaluate(() => document.querySelector('#page .boss__more')?.hidden === true));

  // ── 3. 세대 칩은 결과 안에서 다시 거른다 ─────────────────────────────────────
  await page.locator('#page .dex__toolbar .uchip').first().click();
  await page.waitForTimeout(400);
  const gen1 = await rows().count();
  ok('세대 칩이 결과를 좁힌다', gen1 > 0 && gen1 < total, `${gen1} < ${total}`);
  ok('머리 줄의 수도 같이 줄어든다', (await banner()).includes(`${gen1}마리`), await banner());

  // ── 4. 폼(메가·섀도우)이 살아 있다 ───────────────────────────────────────────
  await goHash('#/dex?q=리자몽');
  const names = await rows().allInnerTexts();
  ok('폼도 결과에 남는다', names.some((t) => /메가|섀도우|다이맥스/.test(t)), names.slice(0, 6).join(' / ').replace(/\n/g, ' '));
  const megaIndex = names.findIndex((t) => /메가/.test(t));
  await rows().nth(megaIndex).click();
  await page.waitForTimeout(700);
  const detail = await page.locator('.detail__head').innerText();
  ok('폼 줄을 누르면 그 폼이 열린다 (원종이 아니다)', /메가/.test(detail), detail.replace(/\n/g, ' ').slice(0, 60));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 5. 타입으로 거르기 ──────────────────────────────────────────────────────
  await goHash('#/dex?t=water,flying');
  const both = await rows().count();
  await goHash('#/dex?t=water');
  const one = await rows().count();
  ok('타입 칩이 실제로 목록을 거른다', both > 0 && both < one, `물·비행 ${both} < 물 ${one}`);
  ok('전 종(1,025)보다 적다 — 색인 전체로 되돌아가지 않는다', one < 1025, String(one));
  await goHash('#/dex?t=water,flying');
  ok('머리 줄이 타입 조합을 적는다', /물·비행 타입 \d+마리/.test(await banner()), await banner());
  ok('고른 타입을 **모두** 가진 것만 남는다', await page.evaluate(() =>
    searchTypePool(['water', 'flying']).every((m) => m.types.includes('water') && m.types.includes('flying'))));

  // ── 6. 결과 없음 · 전체 도감 복귀 ───────────────────────────────────────────
  await goHash('#/dex?q=zzzzz');
  ok('결과가 없으면 0마리라고 말한다', /0마리/.test(await banner()), await banner());
  ok('없을 때 안내가 보인다', await page.evaluate(() => {
    const n = document.querySelector('#page .dex__hint');
    return !!n && !n.hidden;
  }));
  await page.locator('#page .dex__found-clear').click();
  await page.waitForTimeout(600);
  ok('[전체 도감 보기] 로 돌아온다', (await page.evaluate(() => location.hash)) === '#/dex');
  ok('돌아오면 머리 줄이 사라진다', await page.evaluate(() => document.querySelector('#page .dex__found')?.hidden === true));
  ok('돌아오면 다시 100종씩 나눠 그린다', (await rows().count()) === 100, String(await rows().count()));
  ok('[더보기] 가 돌아온다', /더보기 \(100\/\d+\)/.test(await page.locator('#page .boss__more').innerText()));

  // ── 7. 링크로 바로 들어와도 같다 (공유·재방문) ──────────────────────────────
  await page.goto(`${BASE}#/dex?q=${encodeURIComponent('메타')}`, { waitUntil: 'domcontentloaded' });
  await settle();
  ok('검색 주소로 바로 들어와도 그려진다', (await rows().count()) > 0 && /"메타" \d+마리/.test(await banner()), await banner());

  // ── 8. 2026-09-12 v3.10.0 도감 안 검색 칸 ────────────────────────────────────
  // 결과가 도감 한 곳에 모였으니 그 결과를 좁히는 칸도 그 곁에 있어야 한다.
  // 한 글자 지우자고 헤더 팝업을 다시 여는 일이 없어야 한다
  await goHash('#/dex?q=리자');
  ok('검색해서 오면 칸에 검색어가 들어 있다', (await page.inputValue('#dex-search')) === '리자');
  const wide = await rows().count();
  await page.click('#dex-search');
  await page.type('#dex-search', '몽', { delay: 30 });
  await page.waitForTimeout(500);
  const narrow = await rows().count();
  ok('칸에서 좁히면 목록이 줄어든다', narrow > 0 && narrow < wide, `${wide} → ${narrow}`);
  ok('좁혀도 커서가 칸에 남아 있다', (await page.evaluate(() => document.activeElement?.id)) === 'dex-search');
  ok('주소가 결과를 따라온다', /q=리자몽/.test(decodeURIComponent(await page.evaluate(() => location.hash))),
    decodeURIComponent(await page.evaluate(() => location.hash)));
  ok('머리 줄의 수도 따라온다', (await banner()).includes(`${narrow}마리`), await banner());
  await page.fill('#dex-search', '');
  await page.waitForTimeout(500);
  ok('칸을 비우면 전 종으로 돌아온다', (await page.evaluate(() => location.hash)) === '#/dex' && (await rows().count()) === 100,
    `${await page.evaluate(() => location.hash)} / ${await rows().count()}`);

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
