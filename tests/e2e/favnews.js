'use strict';
// v3.60.0 ★ 즐겨찾기 + 📣 소식 배지 — components/favnews.js · components/detail.js
//
// 무엇을 되살렸나
//   v3.4.0 에 ★ 즐겨찾기를 통째로 걷어냈다. 그때 코드에 남긴 이유가
//   "담을 수는 있는데 담은 뒤에 할 일이 없었다" 다. 이번에는 담은 뒤가 있다 —
//   담아 둔 포켓몬이 커뮤니티 데이·스포트라이트·레이드에 뜨면 상세에서 알려 준다.
//
// 이 스위트가 지키려는 것
//   - FAV_EVENTS 계약: 포켓몬이 걸린 일정만 들어 있고(빈 dex 없음), 종류·날짜를 읽을 수 있다
//   - 로그인해야 보인다 — 비로그인이면 셈도 0, 배지도 없다 (담을 수 있는 사람만 소식을 본다)
//   - 승인 대기(pending)도 본다 — 담는 것이 허용돼 있어서다 (firestore.rules favsOnly)
//   - 담아 둔 종만 걸린다 (★ 를 누를 이유가 배지에서 나온다)
//   - 끝난 일정은 세지 않고, 너무 먼 일정도 세지 않는다
//   - 상세 팝업에 ★ 가 있고 **목록 카드에는 없다** (입구는 하나)
//   - ★ 를 누르면 팝업을 다시 그리지 않고 그 자리에서 ★ 와 배지가 함께 바뀐다
//   - 로그인하지 않은 사람에게는 ★ 는 보이되 배지는 없다
//   - 콘솔 오류가 없다
//
// 로그인을 흉내 내는 법. Firebase 는 로컬에서 안 붙으므로 AUTH 를 직접 세운다 —
// favnews.js 가 보는 것은 AUTH.status · AUTH.favs · isFav() 셋뿐이라 그 셋이면 충분하다.
// 2026-09-17 v3.61.0 AUTH.beta 문턱을 걷어냈다 — 소식이 🎒 내 포켓몬 화면의 주 내용이 되면서
// 실험 참가자가 아닌 사람에게 빈 화면이 뜨게 됐다. 로그인 + 승인이 이미 문턱이다.
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

// AUTH 를 세운다. status 는 부르는 쪽이 고른다 ('ok' 승인 · 'pending' 승인 대기 · 'none' 비로그인)
const signIn = (page, { status = 'ok', favs = [] } = {}) => page.evaluate(({ status, favs }) => {
  AUTH.status = status;
  AUTH.favs = new Set(favs);
}, { status, favs });

suite(async () => {
  const browser = await launch();
  const errs = [];
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${BASE}#/dex`, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(500);

  // ── 데이터 계약 ────────────────────────────────────────────────────────────
  const data = await page.evaluate(() => ({
    total: FAV_EVENTS.length,
    emptyDex: FAV_EVENTS.filter((row) => !(row.dex || []).length).length,
    badDate: FAV_EVENTS.filter((row) => !Number.isFinite(Date.parse(row.start))).length,
    unknownType: FAV_EVENTS.filter((row) => !FAV_NEWS_LABEL[row.type]).map((row) => row.type),
    types: [...new Set(FAV_EVENTS.map((row) => row.type))].length,
  }));
  ok('FAV_EVENTS 가 코어 데이터에 실려 있다', data.total > 0, `${data.total}건`);
  ok('포켓몬이 없는 일정은 싣지 않는다', data.emptyDex === 0, String(data.emptyDex));
  ok('날짜를 읽을 수 있다', data.badDate === 0, String(data.badDate));
  ok('종류에 이름이 다 붙는다', data.unknownType.length === 0, data.unknownType.join(','));
  ok('여러 종류의 일정이 섞여 있다', data.types >= 2, `${data.types}종`);

  // 검사에 쓸 표본 — 가장 이른 일정과 그 포켓몬
  const sample = await page.evaluate(() => {
    const row = [...FAV_EVENTS].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .find((one) => Date.parse(one.end || one.start) >= Date.now());
    return row ? { dex: row.dex[0], type: row.type, title: row.title } : null;
  });
  ok('앞으로 남은 일정을 하나 골랐다', !!sample, JSON.stringify(sample));

  // ── 로그인하지 않으면 아무것도 없다 ────────────────────────────────────────
  // 담아 둔 것처럼 favs 를 채워 둬도(옛 세션의 잔여물) status 가 서지 않으면 한 건도 세지 않는다
  await signIn(page, { status: 'none', favs: [sample.dex] });
  const off = await page.evaluate((dex) => ({
    enabled: favNewsEnabled(), count: favNewsCount(),
    forMon: favNewsFor(dex).length, node: favNewsNode(dex) === '',
  }), sample.dex);
  ok('비로그인이면 소식이 꺼져 있다', off.enabled === false);
  ok('꺼져 있으면 셈이 0 이다', off.count === 0 && off.forMon === 0, JSON.stringify(off));
  ok('꺼져 있으면 배지 조각을 만들지 않는다', off.node === true);

  // 승인 대기도 담을 수 있으니 소식도 본다 — 두 조건이 갈리면 "담았는데 아무 일도 없는" 자리가 생긴다
  await signIn(page, { status: 'pending', favs: [sample.dex] });
  ok('승인 대기도 소식을 본다', await page.evaluate(() => favNewsEnabled()) === true);

  // ── 로그인하면 담아 둔 종만 걸린다 ─────────────────────────────────────────
  await signIn(page, { status: 'ok', favs: [sample.dex] });
  const on = await page.evaluate((dex) => {
    // 어느 일정에도 없는 번호 하나 — 담지 않은 종이 걸리지 않는지 보려고
    const used = new Set(FAV_EVENTS.flatMap((row) => row.dex));
    let other = 1;
    while (used.has(other)) other += 1;
    return {
      enabled: favNewsEnabled(),
      forMon: favNewsFor(dex).length,
      count: favNewsCount(),
      otherNode: favNewsNode(other) === '',
      // 담지 않은 종은 배지가 없다 — 소식이 있어도 ★ 가 먼저다
      notFavNode: (() => { const some = [...used].find((one) => one !== dex); return some ? favNewsNode(some) === '' : true; })(),
      sorted: (() => { const rows = favNewsList(); return rows.every((row, i) => i === 0 || rows[i - 1].start <= row.start); })(),
      past: favNewsList().filter((row) => Date.parse(row.event.end || row.event.start) < Date.now()).length,
      far: favNewsList().filter((row) => row.days > 45).length,
    };
  }, sample.dex);
  ok('로그인하면 소식이 켜진다', on.enabled === true);
  ok('담아 둔 종의 소식이 잡힌다', on.forMon > 0, `${on.forMon}건`);
  ok('합계도 같이 선다', on.count > 0, `${on.count}건`);
  ok('일정에 없는 번호는 배지가 없다', on.otherNode === true);
  ok('담지 않은 종은 배지가 없다', on.notFavNode === true);
  ok('가까운 일정이 먼저다', on.sorted === true);
  ok('끝난 일정은 세지 않는다', on.past === 0, String(on.past));
  ok('45일 너머는 세지 않는다', on.far === 0, String(on.far));

  // ── 상세 팝업 ──────────────────────────────────────────────────────────────
  // 목록 카드에는 ★ 가 없다 — 입구는 상세 하나뿐이다 (v2.66.0 에 모았던 규칙)
  ok('목록 카드에 ★ 가 없다', (await page.locator('#page .row .detail__fav, #page .card .detail__fav').count()) === 0);

  await page.evaluate((dex) => openDetailByDex(dex, true), sample.dex);
  await page.waitForTimeout(500);
  ok('상세에 ★ 가 하나 있다', (await page.locator('.detail__fav').count()) === 1);
  // 2026-09-17 v3.61.0 [＋ 내 포켓몬] 은 내려갔다 — 누르면 편집 팝업이 열리고 저장까지 되는데
  // 그 값을 보여 주는 화면이 없었다 (planner/collection.js PLAN_MONS_ENABLED)
  ok('[＋ 내 포켓몬] 버튼은 없다', (await page.locator('.detail__plan').count()) === 0);
  ok('담아 둔 상태로 켜져 있다', (await page.locator('.detail__fav').getAttribute('aria-pressed')) === 'true');
  ok('📣 소식 배지가 섰다', (await page.locator('.detail__favnews').count()) === 1);
  // 배지는 **이름 아래**다 — 머리줄에 두면 좁은 화면에서 제목을 눌러 버린다 (아래 390px 검사가 그 결과를 지킨다)
  ok('배지가 머리줄이 아니라 이름 아래에 있다',
    (await page.locator('.detail__bar .detail__favnews').count()) === 0
    && (await page.locator('.detail__info .detail__favnews').count()) === 1);
  const badge = (await page.locator('.detail__favnews').textContent()) || '';
  ok('배지가 남은 날을 말한다', /D-\d+|오늘|내일|진행 중/.test(badge), badge);

  // ★ 를 끄면 배지도 같이 사라진다 — 팝업을 다시 그리지 않고 그 자리에서
  const before = await page.evaluate(() => document.querySelector('.detail--mon')?.dataset.tab);
  await page.evaluate(() => { AUTH.favs.delete(Number(document.querySelector('.detail__fav').dataset.dex)); });
  await page.evaluate(() => { document.querySelector('.detail__fav').onclick({ stopPropagation() {} }); });
  await page.waitForTimeout(300);
  // toggleFav 는 Firestore 에 못 닿아 되돌려 놓는다. 여기서 보는 것은 **다시 그리지 않았다** 는 것뿐이다
  ok('팝업을 다시 그리지 않는다 (탭이 그대로)',
    (await page.evaluate(() => document.querySelector('.detail--mon')?.dataset.tab)) === before, String(before));

  // ── 로그인하지 않으면 배지는 없다 (★ 는 보인다 — 무엇이 열리는지 알아야 로그인할 이유가 생긴다)
  await page.evaluate(() => { AUTH.status = 'none'; AUTH.favs = new Set(); });
  await page.evaluate(() => openDetailByDex(1, true));
  await page.waitForTimeout(400);
  ok('비로그인에게도 ★ 는 보인다', (await page.locator('.detail__fav').count()) === 1);
  ok('비로그인에게 배지는 없다', (await page.locator('.detail__favnews').count()) === 0);

  // ── 좁은 화면에서 머리줄이 두 줄이 되지 않는다 ────────────────────────────
  // 처음 만들었을 때 ★ 가 늘어난 만큼 390px 머리줄이 접혀, ✕ 와 버튼 줄이 6px 어긋났다
  // (tests/e2e/detail.js 가 그걸 잡았다). 여기서는 배지까지 선 **가장 붐비는 줄**로 지킨다
  const narrow = await newContext(browser, { viewport: { width: 390, height: 900 } });
  const small = await narrow.newPage();
  small.on('pageerror', (e) => errs.push(String(e)));
  await small.goto(`${BASE}#/dex`, { waitUntil: 'domcontentloaded' });
  await waitSplash(small);
  await small.waitForTimeout(500);
  await signIn(small, { status: 'ok', favs: [sample.dex] });
  await small.evaluate((dex) => openDetailByDex(dex, true), sample.dex);
  await small.waitForTimeout(500);
  ok('좁은 화면에도 배지가 선다', (await small.locator('.detail__favnews').count()) === 1);
  const rows = await small.evaluate(() => {
    const boxes = [...document.querySelectorAll('.detail__top-actions > *')]
      .filter((node) => node.offsetParent !== null)
      .map((node) => Math.round(node.getBoundingClientRect().top));
    return new Set(boxes).size;
  });
  ok('머리줄 버튼이 한 줄에 있다', rows === 1, `${rows}줄`);
  const closeBox = await small.locator('.modal__close').boundingBox();
  const dexBox = await small.locator('.detail__bar-dex').boundingBox();
  ok('✕ 와 [포켓몬 도감] 이 같은 줄이다', Math.abs(closeBox.y - dexBox.y) < 1,
    `close ${closeBox.y} dex ${dexBox.y}`);
  ok('좁은 화면은 ★ 글자를 접는다', await small.locator('.detail__fav-label').isHidden());
  await narrow.close();

  ok('콘솔 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await browser.close();
  finish();
});
