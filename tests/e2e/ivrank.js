'use strict';
// v2.61.0 🧬 PvP 개체값 순위 (실험 기능) 회귀 — components/ivrank.js
//
// 이 스위트가 지키려는 것
//   - 계산이 맞는가: 스탯 곱 순위가 선형 탐색과 같은 답을 내는가 (브라우저 안에서 직접 대조)
//   - PvP 는 100% 개체가 1위가 아니다 — 그 전제가 실제로 지켜지는가
//   - 마스터리그는 순위를 매기지 않는다 (CP 상한이 없어 15/15/15 가 늘 1위라 볼 것이 없다)
//   - 획득 경로 하한을 올리면 순위 후보 수가 줄어드는가
//   - 고른 값이 새로고침 뒤에도 남는가 (pogo_ivrank)
//   - PvP 순위에 오른 종의 상세에만 PvP 블록이 붙는가 (도감 아무 종에나 붙지 않는다)
//   - 로그인 없이는 잠겨 있는가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(500);
  };

  await go('#/ivrank');
  await page.waitForSelector('.ivrank__pick', { timeout: 10000 }).catch(() => {});
  ok('화면이 열린다', (await page.locator('.ivrank__pick').count()) === 1);

  // ── 계산 대조: 이진 탐색(화면이 쓰는 것)과 선형 탐색(정답)이 같은 답을 내는가
  const cross = await page.evaluate(() => {
    const form = DEX_DATA.forms[379];           // 레지스틸 — PvP 에서 자주 보는 종
    let mismatch = 0, checked = 0;
    for (const cap of [500, 1500, 2500]) {
      for (let a = 0; a <= 15; a += 3) for (let d = 0; d <= 15; d += 3) for (let h = 0; h <= 15; h += 3) {
        let linear = null;
        for (let l = 1; l <= 50; l += 0.5) { if (calcCp(form, l, a, d, h) > cap) break; linear = l; }
        const row = ivRankTable(form, cap, 0).find((r) => r.ivs[0] === a && r.ivs[1] === d && r.ivs[2] === h);
        checked++;
        if ((row ? row.level : null) !== linear) mismatch++;
      }
    }
    return { checked, mismatch };
  });
  ok(`도달 레벨이 선형 탐색과 일치 (${cross.checked}건)`, cross.mismatch === 0, `불일치 ${cross.mismatch}`);

  // ── PvP 는 100% 가 1위가 아니다 — 이 화면이 서 있는 전제
  const hundo = await page.evaluate(() => {
    const form = DEX_DATA.forms[379];
    const rows = ivRankTable(form, 1500, 0);
    const at = rows.findIndex((r) => r.ivs.join() === '15,15,15') + 1;
    return { total: rows.length, hundoRank: at, topIvs: rows[0].ivs.join('/'), topAtk: rows[0].ivs[0] };
  });
  ok('슈퍼리그 조합이 4,096개', hundo.total === 4096, String(hundo.total));
  ok('100% 개체는 1위가 아니다', hundo.hundoRank > 1, `${hundo.hundoRank}위`);
  ok('1위는 공격 개체값이 낮다', hundo.topAtk <= 2, hundo.topIvs);

  // ── 마스터리그는 순위를 매기지 않는다
  await page.fill('.ivrank__pick .boss__search', '레지스틸');
  await page.waitForTimeout(400);
  await page.locator('.ivrank__pick .boss__sugg > *').first().click({ timeout: 3000 });
  await page.waitForSelector('.ivrank__cards', { timeout: 8000 });
  const cards = await page.locator('.ivrank__card').allTextContents();
  ok('리그 카드가 넷', cards.length === 4, String(cards.length));
  ok('마스터리그는 순위 없음', /순위 없음/.test(cards[3]), cards[3].slice(0, 40));
  ok('상한 있는 리그는 순위가 보인다', /\d+위/.test(cards[1]), cards[1].slice(0, 40));
  ok('판정 한 줄이 있다', (await page.locator('.ivrank__verdict').count()) === 1);
  // ── 2026-09-12 v2.65.0 세 리그를 늘 그려 둔다. 넓은 화면은 나란히, 좁은 화면은 탭으로 하나씩
  ok('리그 칸 셋을 다 그린다 (마스터는 순위가 없어 뺀다)', (await page.locator('.ivrank__top-col').count()) === 3,
    (await page.locator('.ivrank__top-col').evaluateAll((ns) => ns.map((n) => n.dataset.lg))).join('|'));
  ok('넓은 화면은 셋이 다 보인다', (await page.locator('.ivrank__top-col:visible').count()) === 3);
  ok('넓은 화면에는 탭이 없다', !(await page.locator('.ivrank__top > .seg').isVisible()));
  ok('칸마다 상위 10', (await page.locator('.ivrank__top-col[data-lg="great"] .ivrank__list li').count()) === 10);
  const tops = await page.locator('.ivrank__top-col .ivrank__list li:first-child b').allTextContents();
  ok('리그마다 1위가 다르다', new Set(tops).size > 1, tops.join(' | '));
  ok('칸마다 리그 이름과 CP', (await page.locator('.ivrank__col-head').allTextContents()).join('|').includes('하이퍼리그'),
    (await page.locator('.ivrank__col-head').allTextContents()).join('|'));

  // 고른 종 카드 — 이름과 종족값이 따로 놓이는가 (전에는 스타일 없는 클래스라 한 줄에 붙었다)
  const pickedBox = await page.evaluate(() => {
    const card = document.querySelector('.ivrank__picked');
    const main = document.querySelector('.ivrank__picked-main');
    if (!card || !main) return null;
    const name = main.querySelector('b').getBoundingClientRect();
    const stats = main.querySelector('.meta').getBoundingClientRect();
    return { display: getComputedStyle(card).display, stacked: stats.top >= name.bottom - 1, overflow: card.scrollWidth - card.clientWidth };
  });
  ok('고른 종 카드가 한 줄 배치', pickedBox && pickedBox.display === 'flex', JSON.stringify(pickedBox));
  ok('이름 아래에 종족값', pickedBox && pickedBox.stacked, JSON.stringify(pickedBox));
  ok('카드가 넘치지 않는다', pickedBox && pickedBox.overflow === 0, JSON.stringify(pickedBox));

  // ── 획득 경로 하한을 올리면 후보가 줄어든다
  const before = await page.evaluate(() => ivRankTable(DEX_DATA.forms[379], 1500, 0).length);
  const after = await page.evaluate(() => ivRankTable(DEX_DATA.forms[379], 1500, 10).length);
  ok('하한 10 이면 후보가 준다', after < before && after === 6 ** 3, `${before} → ${after}`);

  // ── 새로고침해도 고른 값이 남는다
  await page.fill('.ivrank__ivs input >> nth=0', '3');
  await page.waitForTimeout(400);
  await go('#/ivrank');
  await page.waitForSelector('.ivrank__cards', { timeout: 10000 }).catch(() => {});
  const kept = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('pogo_ivrank') || '{}'); } catch { return {}; }
  });
  ok('고른 종·개체값이 남는다', kept.sprite === 379 && kept.ivs?.[0] === 3, JSON.stringify(kept));

  // ── 상세의 PvP 블록 — 순위에 오른 종에만 붙는다
  await go('#/rank/pvp');
  await page.waitForSelector('#content .row-list > .row', { timeout: 15000 }).catch(() => {});
  await page.locator('#content .row-list > .row').first().click();
  await page.waitForTimeout(700);
  ok('PvP 순위에서 연 상세에 PvP 블록', (await page.locator('.ivrank__detail').count()) === 1);
  await page.locator('.ivrank__detail summary').click().catch(() => {});
  await page.waitForTimeout(300);
  const detail = await page.locator('.ivrank__detail').innerText().catch(() => '');
  ok('리그 이름과 개체값이 적힌다', /리그/.test(detail) && /\d+\/\d+\/\d+/.test(detail), detail.slice(0, 60).replace(/\n/g, ' '));

  await go('#/dex');
  await page.waitForSelector('#page .dex__row', { timeout: 15000 }).catch(() => {});
  await page.locator('#page .dex__row').first().click();
  await page.waitForTimeout(700);
  ok('PvP 순위 밖 종에는 안 붙는다', (await page.locator('.ivrank__detail').count()) === 0);
  await page.keyboard.press('Escape');
  await ctx.close();

  // ── 좁은 화면은 탭으로 한 리그씩 (넓은 화면은 셋이 나란해 탭이 필요 없다)
  {
    const nctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await nctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await nctx.addInitScript(() => { try { localStorage.setItem('pogo_ivrank', JSON.stringify({ sprite: 379, ivs: [0, 15, 15], floor: 0 })); } catch {} });
    const p3 = await nctx.newPage();
    p3.on('pageerror', (e) => errs.push('좁은 화면: ' + e));
    await p3.goto(BASE + '#/ivrank', { waitUntil: 'domcontentloaded' });
    await p3.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await p3.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await p3.waitForSelector('.ivrank__top', { timeout: 10000 }).catch(() => {});
    await p3.waitForTimeout(400);
    ok('좁은 화면은 한 칸만 보인다', (await p3.locator('.ivrank__top-col:visible').count()) === 1);
    const tabs = await p3.locator('.ivrank__top .seg button').allTextContents();
    ok('좁은 화면에는 탭이 있다', tabs.join('|') === '리틀리그|슈퍼리그|하이퍼리그', tabs.join('|'));
    const before = await p3.locator('.ivrank__top-col:visible').getAttribute('data-lg');
    await p3.locator('.ivrank__top .seg button:has-text("하이퍼리그")').click();
    await p3.waitForTimeout(500);
    const after = await p3.locator('.ivrank__top-col:visible').getAttribute('data-lg');
    ok('탭을 바꾸면 보이는 칸이 바뀐다', before !== after && after === 'ultra', `${before} → ${after}`);
    await nctx.close();
  }

  // ── 로그인 없이는 잠겨 있다
  {
    const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await anon.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const p2 = await anon.newPage();
    p2.on('pageerror', (e) => errs.push('비로그인: ' + e));
    await p2.goto('http://localhost:5503/#/ivrank', { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await p2.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await p2.waitForTimeout(600);
    ok('로그인 없이는 잠긴 화면', (await p2.locator('.plan__lock').count()) === 1);
    ok('잠겼을 때 본문은 안 그린다', (await p2.locator('.ivrank__pick').count()) === 0);
    await anon.close();
  }

  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
