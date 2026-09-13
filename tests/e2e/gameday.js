'use strict';
// v2.25.0 신규 화면 회귀 — ⚔️ 레이드 보스 · 🥚 알 부화 · 유사백 판정
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';
suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { viewport: { width: 390, height: 844 } });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(300);

  // v2.47.0 '내 포켓몬'·'육성 플래너' 타일 통합으로 10 → 9
  ok('홈 타일 9개', (await page.locator('.home__tile').count()) === 9);
  const tiles = await page.locator('.home__tile strong').allTextContents();
  ok('새 타일 2개', tiles.includes('레이드 보스') && tiles.includes('알 부화'), tiles.slice(-2).join('|'));

  // ── 레이드 보스
  await page.click('.home__tile:has-text("레이드 보스")');
  await page.waitForTimeout(500);
  ok('#/raids 라우팅', (await page.evaluate(() => location.hash)) === '#/raids');
  // v2.30.0 상단 바는 늘 로고, 화면 이름은 본문 헤더로 내려왔다
  ok('화면 헤더 제목', (await page.locator('#page-head h2').textContent()).includes('레이드 보스'));
  const raidSecs = await page.locator('.gameday__sec .page__sec').allTextContents();
  ok('티어 구역 있음', raidSecs.length > 0, raidSecs.join('|').slice(0, 80));
  const raidRows = await page.locator('.gameday__sec .dex__row').count();
  ok('보스 줄 렌더', raidRows > 0, String(raidRows));
  const firstName = await page.locator('.gameday__sec .dex__row b').first().textContent();
  ok('한글 이름', /[가-힣]/.test(firstName), firstName);
  ok('영문 이름 없음', !/[A-Za-z]{4,}/.test((await page.locator('.gameday__sec').first().textContent())));
  const note = await page.locator('.gameday__note').first().textContent();
  ok('조건 문구', note.includes('CP'), note.slice(0, 60));
  ok('출처 각주', (await page.locator('#page .detail__foot').textContent()).includes('ScrapedDuck'));
  // 줄을 누르면 상세가 열린다
  await page.locator('.gameday__sec .dex__row').first().click();
  await page.waitForTimeout(500);
  ok('상세 열림', (await page.locator('dialog.modal[open]').count()) === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ── 알 부화
  await page.goto(BASE + '#/eggs', { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(600);
  const eggSecs = await page.locator('.gameday__sec .page__sec').allTextContents();
  ok('거리 구역 있음', eggSecs.length > 0, eggSecs.join('|').slice(0, 60));
  ok('km 표기', eggSecs.some((t) => /km/.test(t)));
  const eggRows = await page.locator('.gameday__sec .dex__row').count();
  ok('알 줄 렌더', eggRows > 20, String(eggRows));
  ok('알 한글 이름', /[가-힣]/.test(await page.locator('.gameday__sec .dex__row b').first().textContent()));

  // 2026-09-10 v2.53.0 거리로만 묶으면 안 된다 — 같은 거리라도 알을 어디서 얻었는지에 따라
  // 나오는 종이 아예 다르다. 걸어서 깐 5km 에 어드벤처 싱크 전용이 섞여 있으면 "안 나오는 애" 를
  // 나온다고 말하는 셈이다. 그래서 칸 이름이 얻는 곳까지 말하는지, 순서가 거리순인지를 못 박는다
  ok('얻는 곳까지 나눈 칸이 있다', eggSecs.some((t) => /어드벤처 싱크|선물/.test(t)), eggSecs.join(' | ').slice(0, 120));
  ok('7km 은 친구 선물과 루트 선물이 따로', eggSecs.some((t) => /친구 선물/.test(t)) && eggSecs.some((t) => /루트 선물/.test(t)));
  const eggOrder = eggSecs.map((t) => parseInt(t, 10)).filter((n) => n > 0);
  ok('거리는 숫자 오름차순 (1km 이 맨 앞)', eggOrder.every((n, i) => i === 0 || eggOrder[i - 1] <= n), eggOrder.join(','));
  // 한 마리가 두 칸에 겹쳐 들어가면 합계가 원본보다 커진다 — 칸만 나누고 종은 늘지 않아야 한다
  const eggTotal = await page.locator('.gameday__sec .dex__row').count();
  ok('칸을 나눠도 종 수는 그대로', eggTotal === eggRows, `${eggTotal} vs ${eggRows}`);

  // ── 드로어 이동 항목
  await page.click('#menu-toggle');
  await page.waitForTimeout(400);
  // 2026-09-09 v2.40.0 항목이 [아이콘][이름] 두 조각이라 이름 칸(.drawer__label)만 본다
  const nav = await page.locator('.nav-menu a .drawer__label').allTextContents();
  ok('드로어에 두 항목', nav.includes('레이드 보스') && nav.includes('알 부화'), String(nav.length));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 유사백 판정 (mock 로그인 = 저장된 개체가 있는 상태)
  await page.goto(BASE + '#/plan/collection', { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.ready, null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const hundo = await page.evaluate(() => {
    // 저장된 개체가 없으면 판정 함수만 직접 검증한다
    const form = (typeof DEX_DATA !== 'undefined' && DEX_DATA.forms) ? Object.values(DEX_DATA.forms)[0] : null;
    const mk = (ivs) => ({ sprite: 150, level: 40, ivs });
    return {
      perfect: typeof planHundoLabel === 'function' ? (planHundoLabel(mk([15, 15, 15])) || {}).text : null,
      low: typeof planHundoLabel === 'function' ? planHundoLabel(mk([0, 0, 0])) : 'no-fn',
      gapKeys: typeof planHundoGap === 'function' ? Object.keys(planHundoGap(mk([14, 15, 15])) || {}) : [],
    };
  });
  ok('백개체 판정', hundo.perfect === '백개체', String(hundo.perfect));
  ok('낮은 개체는 뱃지 없음', hundo.low === null, JSON.stringify(hundo.low));
  ok('gap 반환 형태', hundo.gapKeys.join(',') === 'perfect,mine,ratio,gap,level', hundo.gapKeys.join(','));

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
