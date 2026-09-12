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
const { launch, newContext, ok, finish, suite } = require('./_lib');
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
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
  };

  await go('#/pvp/ivrank');
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
  // ── 2026-09-12 v2.66.0 상위 10 은 화면 맨 위에서 고른 리그 하나. 이 블록은 리그 컨트롤을 갖지 않는다
  ok('상위 10 은 한 리그만', (await page.locator('.ivrank__top .ivrank__list').count()) === 1);
  ok('상위 10 이 열 줄', (await page.locator('.ivrank__top .ivrank__list li').count()) === 10);
  ok('제목이 고른 리그를 말한다', (await page.locator('.ivrank__top h2').textContent()).trim() === '슈퍼리그 상위 10',
    (await page.locator('.ivrank__top h2').textContent()).trim());
  // 리그를 바꾸면 1위 조합도 바뀐다 — 상한이 다르면 최적 개체값이 달라진다
  const greatTop = await page.locator('.ivrank__top .ivrank__list li:first-child b').textContent();
  await page.locator('#page-head-actions .seg button:has-text("리틀")').click();
  await page.waitForTimeout(600);
  const littleTop = await page.locator('.ivrank__top .ivrank__list li:first-child b').textContent();
  ok('리그가 바뀌면 1위도 바뀐다', greatTop !== littleTop, `${greatTop} → ${littleTop}`);
  await page.locator('#page-head-actions .seg button:has-text("슈퍼")').click();
  await page.waitForTimeout(600);
  // 지금 고른 리그 카드에 표시가 붙는가 (위 세그먼트와 눈이 이어지게)
  ok('고른 리그 카드에 표시', (await page.locator('.ivrank__card.is-on').count()) === 1);

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
  await go('#/pvp/ivrank');
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

  // ── 2026-09-12 v2.66.0 리그는 화면 맨 위 세그먼트 하나가 정한다.
  // 전에는 이 블록이 자기 리그 탭을 따로 가져 같은 화면에 리그 컨트롤이 둘이었다 —
  // 위에서 '슈퍼' 를 골라도 아래 상위 10 은 '리틀' 인 일이 생겼다
  {
    const nctx = await newContext(browser, { viewport: { width: 430, height: 900 } });
    await nctx.addInitScript(() => { try { localStorage.setItem('pogo_ivrank', JSON.stringify({ sprite: 379, ivs: [0, 15, 15], floor: 0 })); } catch {} });
    const p3 = await nctx.newPage();
    p3.on('pageerror', (e) => errs.push('좁은 화면: ' + e));
    await p3.goto(BASE + '#/pvp/ivrank', { waitUntil: 'domcontentloaded' });
    await p3.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await p3.waitForSelector('.ivrank__top', { timeout: 10000 }).catch(() => {});
    await p3.waitForTimeout(400);
    ok('블록 안에 리그 탭이 없다', (await p3.locator('.ivrank__top .seg').count()) === 0);
    const before = await p3.locator('.ivrank__top h2').textContent();
    ok('상위 10 제목이 고른 리그다', /리그 상위 10$/.test(before.trim()), before.trim());
    // 화면 머리의 리그 세그먼트를 바꾸면 상위 10 도 따라온다 (v3.2.0 부터 제목 옆에 있다)
    await p3.locator('#page-head-actions .seg button:has-text("하이퍼")').click();
    await p3.waitForTimeout(600);
    const after = await p3.locator('.ivrank__top h2').textContent();
    ok('위 세그먼트가 상위 10 을 바꾼다', after.trim().startsWith('하이퍼리그') && after !== before, `${before.trim()} → ${after.trim()}`);
    // 마스터리그는 CP 상한이 없어 순위 자체가 없다
    await p3.locator('#page-head-actions .seg button:has-text("마스터")').click();
    await p3.waitForTimeout(600);
    ok('마스터는 순위 대신 설명', /상한이 없어요/.test(await p3.locator('.ivrank__top').innerText()));
    await nctx.close();
  }

  // ── 로그인 없이는 잠겨 있다
  {
    const anon = await newContext(browser, { viewport: { width: 1440, height: 900 } });
    const p2 = await anon.newPage();
    p2.on('pageerror', (e) => errs.push('비로그인: ' + e));
    await p2.goto('http://localhost:5503/#/ivrank', { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await p2.waitForTimeout(600);
    ok('로그인 없이는 잠긴 화면', (await p2.locator('.plan__lock').count()) === 1);
    ok('잠겼을 때 본문은 안 그린다', (await p2.locator('.ivrank__pick').count()) === 0);
    await anon.close();
  }

  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await finish(browser);
});
