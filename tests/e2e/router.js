'use strict';
// v2.30.0 주소 체계 회귀 — 라우트 표 · 옛 주소 · 측정용 식별자
//
// 이 스위트가 지키려는 것
//   - 새 주소(#/pve · #/dmax · #/planner/collection)가 메뉴 구조와 1:1 인가
//   - **옛 주소로 들어와도 같은 화면에 닿는가** — 이미 공유·북마크된 링크를 깨지 않는다
//   - 옛 주소가 뒤로가기 기록에 쌓이지 않는가 (replace 로 돌린다)
//   - 화면마다 DOM 에 식별자가 붙는가 — GA·히트맵이 주소를 다시 파싱하지 않아도 되게
//   - 상세 팝업이 "무엇의 상세인지" 를 종·폼 단위까지 밝히는가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

// [들어간 주소, 닿아야 할 주소, 라우트 id, 화면 헤더]
const ROUTES = [
  ['', '', 'home', null],
  ['#/dmax', '#/dmax', 'dmax', 'D-MAX'],
  ['#/pve', '#/pve', 'pve', '레이드 · PvE'],
  ['#/pvp', '#/pvp', 'pvp', '배틀 · PvP'],
  ['#/planner', '#/planner', 'planner', '육성 플래너'],
  ['#/planner/collection', '#/planner/collection', 'planner-collection', '내 포켓몬'],
  ['#/dex', '#/dex', 'dex', '포켓몬 도감'],
  ['#/types', '#/types', 'types', '타입 & 상성'],
  ['#/schedule', '#/schedule', 'schedule', '이벤트 일정'],
  ['#/raids', '#/raids', 'raids', '레이드 보스'],
  ['#/eggs', '#/eggs', 'eggs', '알 부화'],
  ['#/favs', '#/favs', 'favs', '즐겨찾기'],
];
// 옛 주소 → 새 주소 (v2.29.x 이전에 공유된 링크)
const LEGACY = [
  ['#/rank/max', '#/dmax', 'dmax'],
  ['#/rank/pve', '#/pve', 'pve'],
  ['#/rank/pvp', '#/pvp', 'pvp'],
  ['#/plan', '#/planner', 'planner'],
  ['#/plan/collection', '#/planner/collection', 'planner-collection'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click().catch(() => {});
    await page.waitForTimeout(500);
  };
  const seen = async () => page.evaluate(() => ({
    hash: location.hash,
    route: document.body.dataset.route,
    head: document.getElementById('page-head').hidden ? null : document.querySelector('#page-head h2').textContent,
  }));

  // ── 새 주소
  for (const [enter, hash, id, head] of ROUTES) {
    await go(enter);
    const now = await seen();
    ok(`${enter || '(홈)'} → ${id}`, now.hash === hash && now.route === id, JSON.stringify(now));
    ok(`${enter || '(홈)'} 화면 헤더`, now.head === head, `${now.head}`);
  }

  // ── 옛 주소는 새 주소로 (그리고 뒤로가기에 쌓이지 않는다)
  for (const [old, hash, id] of LEGACY) {
    await go(old);
    const now = await seen();
    ok(`옛 주소 ${old} → ${hash}`, now.hash === hash && now.route === id, JSON.stringify(now));
  }
  // 홈 → 옛 주소 → 뒤로가기 한 번에 홈으로 (옛 주소가 기록에 남았다면 두 번 눌러야 한다)
  await go('');
  await page.evaluate(() => { location.hash = '#/rank/pve'; });
  await page.waitForTimeout(600);
  ok('옛 주소로 이동해도 새 주소', (await page.evaluate(() => location.hash)) === '#/pve');
  await page.goBack();
  await page.waitForTimeout(600);
  ok('뒤로가기 한 번에 홈 (옛 주소가 기록에 없다)', (await page.evaluate(() => location.hash)) === '');

  // ── 이동 목록이 라우트 표에서 나오는가
  await go('#/dex');
  const navHrefs = await page.locator('.nav-menu a').evaluateAll((ns) => ns.map((n) => n.getAttribute('href')));
  ok('이동 목록에 옛 주소 없음', !navHrefs.some((href) => /#\/(rank|plan)(\/|$)/.test(href)), navHrefs.filter((h) => /rank|\/plan\b/.test(h)).join(' '));
  ok('이동 목록에 새 주소', navHrefs.includes('#/pve') && navHrefs.includes('#/planner/collection'), navHrefs.join(' '));

  // ── 측정용 식별자: 전체 페이지
  for (const [hash, id] of [['#/dex', 'dex'], ['#/raids', 'raids'], ['#/schedule', 'schedule'], ['#/favs', 'favs']]) {
    await go(hash);
    const marks = await page.evaluate(() => {
      const page = document.getElementById('page');
      const body = page.querySelector('.page__body');
      return { pageRoute: page.dataset.route, bodyId: body?.id, bodyRoute: body?.dataset.route };
    });
    ok(`${hash} 식별자`, marks.pageRoute === id && marks.bodyId === `page-${id}` && marks.bodyRoute === id, JSON.stringify(marks));
  }

  // ── 측정용 식별자: 상세 (종·폼·어디서 열었나까지)
  // 2026-09-09 v2.36.0 이 스위트는 PC 폭(1440px)이라 상세는 팝업이 아니라 오른쪽 패널(#detail-panel)로 뜬다
  // (useDetailPanel(), components/modal.js). 껍데기 식별자는 패널 쪽에, 본문 식별자는 지금까지와 같다
  await go('#/dex');
  await page.locator('#page .dex__row').first().click();
  await page.waitForSelector('#detail-panel:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(400);
  const detail = await page.evaluate(() => {
    const panel = document.getElementById('detail-panel');
    const body = panel.querySelector('[data-route="mon"]');
    return { dialogRoute: panel.dataset.route, dialogMon: panel.dataset.mon, id: body?.id, ...body?.dataset };
  });
  ok('상세 껍데기도 식별자', detail.dialogRoute === 'mon' && !!detail.dialogMon, JSON.stringify(detail).slice(0, 90));
  ok('상세 본문 id = detail-<스프라이트>', /^detail-\d+$/.test(detail.id || ''), detail.id);
  ok('상세에 종·폼·진입 경로', !!detail.mon && !!detail.form && detail.view === 'dex', `${detail.mon}/${detail.form}/${detail.view}`);

  // 랭킹에서 연 상세는 진입 경로가 다르다 (같은 종이라도 어디서 봤는지 갈린다)
  await go('#/pve');
  await page.locator('#content .row').first().click();
  await page.waitForSelector('#detail-panel:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(400);
  ok('랭킹에서 연 상세는 view=list', (await page.evaluate(() => document.querySelector('#detail-panel [data-route="mon"]')?.dataset.view)) === 'list');

  // ── 상세 딥링크
  // 앞 단계에서 열어 둔 패널을 닫고, 해시만 다른 goto 는 새로고침이 아니므로 reload 로 찬 시작을 만든다
  // (공유 링크를 처음 여는 상황이 바로 이것이다)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.goto(BASE + '#/mon/6', { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#detail-panel:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('상세 딥링크가 패널을 연다', await page.locator('#detail-panel').isVisible());
  ok('딥링크 라우트 id = mon', (await page.evaluate(() => document.body.dataset.route)) === 'mon');

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
