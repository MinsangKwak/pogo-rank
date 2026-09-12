'use strict';
// v2.59.0 목록 격자 사다리 회귀 — styles/tokens.css --list-cols
//
// 이 스위트가 지키려는 것
//   - 한 줄에 놓이는 개수가 폭에 따라 다섯 → 넷 → 셋 → 둘 → 하나로 줄어드는가
//   - 도감 · 레이드 보스 · 알 부화(.dex__list)와 D-MAX · 레이드 PvE · 배틀 PvP(.row-list)가
//     같은 값을 보는가 (전에는 파일마다 따로 계산해 화면마다 열이 달랐다)
//   - 줄 모드(리스트)도 여러 열로 흐르는가 — 이 화면 때문에 사다리를 만들었다
//   - 좁은 칸에서 줄이 넘치지 않는가 (도감 줄은 조각이 많아 그대로 두면 이름이 세로로 쪼개졌다)
//   - 상세 패널이 열리면 열이 줄어드는가 (본문이 패널 폭만큼 좁아진다)
//   - 좁은 화면(<1100px)의 티어표는 v2.53.0 결정대로 한 줄에 하나인가
const { launch, newContext, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

// 폭 하나 · 화면 하나를 새 컨텍스트로 열어 재고 닫는다.
// mode 가 'list' 면 그 화면의 보기 저장 키를 '1'(리스트)로 미리 박아 둔다
async function measure(browser, { width, hash, selector, storeKey, mode, openDetail }) {
  const ctx = await newContext(browser, { viewport: { width, height: 900 } });
  if (storeKey) {
    const value = mode === 'list' ? '1' : '2';
    await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } }, [storeKey, value]);
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  // 고정 대기는 병렬로 돌 때 모자란다 — 재려는 목록이 실제로 붙을 때까지 기다린다
  await page.waitForSelector(selector, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  if (openDetail) {
    await page.locator(`${selector} > *`).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const out = await page.evaluate((sel) => {
    const node = document.querySelector(sel);
    const doc = document.documentElement;
    // 칸 안에서 넘치는 줄이 있는지 — 있으면 글자가 잘리거나 세로로 쪼개진다
    let worst = 0;
    document.querySelectorAll(`${sel} > *`).forEach((row) => {
      worst = Math.max(worst, row.scrollWidth - row.clientWidth);
    });
    return {
      cols: node ? getComputedStyle(node).gridTemplateColumns.split(' ').length : null,
      display: node ? getComputedStyle(node).display : null,
      pageOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      rowOverflow: worst,
    };
  }, selector);
  out.errs = errs;
  await ctx.close();
  return out;
}

suite(async () => {
  const browser = await launch();
  const errs = [];

  // ── 사다리: 폭마다 몇 개가 한 줄에 놓이나
  // 1920 다섯 · 1440 넷 · 1100 셋 · 900 둘 · 390 하나 (tokens.css --list-cols)
  for (const [width, expect] of [[1920, 5], [1440, 4], [1280, 3], [900, 2], [390, 1]]) {
    const got = await measure(browser, {
      width, hash: '#/eggs', selector: '#page .dex__list', storeKey: 'pogo_eggs_cols', mode: 'list',
    });
    ok(`알 부화 리스트 (w=${width}) ${expect}열`, got.cols === expect, String(got.cols));
    ok(`알 부화 리스트 (w=${width}) 넘침 없음`, got.pageOverflow === 0 && got.rowOverflow === 0,
      `page=${got.pageOverflow} row=${got.rowOverflow}`);
    errs.push(...got.errs);
  }

  // 그리드 보기도 같은 사다리를 탄다 (1100px 이상). 그 아래는 토글 고유의 2·3열을 지킨다
  for (const [width, expect] of [[1920, 5], [1440, 4], [1280, 3]]) {
    const got = await measure(browser, {
      width, hash: '#/eggs', selector: '#page .dex__list', storeKey: 'pogo_eggs_cols', mode: 'grid',
    });
    ok(`알 부화 그리드 (w=${width}) ${expect}열`, got.cols === expect, String(got.cols));
    errs.push(...got.errs);
  }

  // ── 도감 줄 모드: 조각이 가장 많은 화면이라 넘침을 따로 본다
  for (const [width, expect] of [[1920, 5], [1440, 4], [1280, 3]]) {
    const got = await measure(browser, {
      width, hash: '#/dex', selector: '#page .dex__list', storeKey: 'pogo_dex_cols', mode: 'list',
    });
    ok(`도감 리스트 (w=${width}) ${expect}열`, got.cols === expect, String(got.cols));
    ok(`도감 리스트 (w=${width}) 줄이 칸을 넘지 않음`, got.rowOverflow === 0, String(got.rowOverflow));
    errs.push(...got.errs);
  }

  // ── 티어표(.row-list)도 같은 값을 본다
  for (const [width, hash, expect] of [
    [1920, '#/dmax', 5], [1440, '#/pve', 4], [1280, '#/rank/pvp', 3],
  ]) {
    const got = await measure(browser, { width, hash, selector: '#content .row-list' });
    ok(`티어표 ${hash} (w=${width}) ${expect}열`, got.cols === expect, String(got.cols));
    errs.push(...got.errs);
  }

  // 좁은 화면은 v2.53.0 결정대로 카드가 아니라 한 줄에 하나인 목록이다 (격자로 만들지 않는다)
  {
    const got = await measure(browser, { width: 900, hash: '#/rank/pvp', selector: '#content .row-list' });
    ok('좁은 화면(900) 티어표는 격자가 아니다', got.display !== 'grid', String(got.display));
    errs.push(...got.errs);
  }

  // ── 상세 패널이 열리면 본문이 패널 폭만큼 좁아진다 — 열도 함께 줄어야 카드가 안 눌린다
  for (const [width, expect] of [[1920, 3], [1440, 2], [1280, 1]]) {
    const got = await measure(browser, {
      width, hash: '#/raids', selector: '#page .dex__list', storeKey: 'pogo_raids_cols', mode: 'grid',
      openDetail: true,
    });
    ok(`상세 패널 열림(w=${width}) 레이드 보스 ${expect}열`, got.cols === expect, String(got.cols));
    errs.push(...got.errs);
  }

  ok('콘솔 오류 없음', errs.length === 0, errs.join(' | '));
  await finish(browser);
});
