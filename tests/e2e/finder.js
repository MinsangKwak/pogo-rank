'use strict';
// 🔎 검색식 만들기 회귀 (2026-09-11 v2.58.0, 백로그 QA-57)
//
// 이 스위트가 지키려는 것
//   - 고른 조건이 **게임이 읽는 문법**으로 이어지는가 (`&` 그리고 · `!` 제외 · `,` 또는)
//   - 한 칸이 세 상태를 도는가 (포함 → 제외 → 해제) — 같은 조건이 화면에 두 번 나오지 않게 한 설계다
//   - 타입 여러 개가 `&` 가 아니라 `,` 로 이어지는가 — `&` 로 이으면 "둘 다인 것" 이 되어 거의 안 걸린다
//   - 고른 것이 새로고침 뒤에도 남는가 — 검색식은 만들어 놓고 게임과 오가며 여러 번 쓴다
//   - 로그인해야 열리는가 — 만든 검색식은 계정에 이어서 쓰는 개인 설정이다
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const open = async () => {
    await page.goto(BASE + '#/finder', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
  };
  const out = () => page.locator('.finder__out').textContent();
  const flag = (text) => page.locator('.finder__flag').filter({ hasText: text }).first();

  await open();
  ok('로그인하면 열린다 (?mock=1)', await page.locator('.finder').isVisible());
  ok('처음엔 식이 비어 있다', /조건을 고르면/.test(await out()));

  // ── 세 상태 순환. 버튼을 둘로 나누면 같은 조건이 화면에 두 번 나와 어느 쪽이 켜졌는지 헷갈린다
  await flag('네 별').click(); await page.waitForTimeout(150);
  ok('한 번 누르면 포함', (await out()) === '4*', await out());
  await flag('네 별').click(); await page.waitForTimeout(150);
  ok('다시 누르면 제외 (! 붙음)', (await out()) === '!4*', await out());
  await flag('네 별').click(); await page.waitForTimeout(150);
  ok('또 누르면 해제', /조건을 고르면/.test(await out()), await out());

  // ── 여러 조건은 & 로 잇는다
  await flag('네 별').click();
  await flag('색이 다른').click();
  await page.waitForTimeout(200);
  ok('여러 조건은 & 로', (await out()) === '4*&shiny', await out());

  // ── 타입은 , 로. & 로 이으면 "둘 다인 것" 이라 거의 안 걸린다
  await page.locator('.finder__clear').click(); await page.waitForTimeout(150);
  await page.locator('.finder__type').filter({ hasText: '불꽃' }).first().click();
  await page.locator('.finder__type').filter({ hasText: /^물$/ }).first().click();
  await page.waitForTimeout(200);
  ok('타입 여러 개는 , 로 (또는)', (await out()) === 'fire,water', await out());

  // ── CP 범위
  await page.locator('.finder__num').first().fill('1500');
  await page.waitForTimeout(200);
  ok('CP 최소가 cp1500- 로', /cp1500-/.test(await out()), await out());

  // ── 저장 — 만들어 놓고 게임과 오가며 여러 번 쓴다
  const before = await out();
  await open();
  ok('새로고침해도 남는다', (await out()) === before, `${before} → ${await out()}`);

  // ── 비우기
  await page.locator('.finder__clear').click(); await page.waitForTimeout(200);
  ok('비우기가 식을 지운다', /조건을 고르면/.test(await out()), await out());

  // ── 자주 쓰는 묶음
  await page.locator('.finder__preset').first().click(); await page.waitForTimeout(200);
  const preset = await out();
  ok('묶음은 포함·제외를 함께 넣는다', /&!/.test(preset) && !/조건을 고르면/.test(preset), preset);

  // ── 넣지 않은 것을 넣지 않았다. 게임 버전마다 갈리는 문법을 주면 사용자는 게임에서 빈 결과를 본다
  const body = await page.locator('.finder').textContent();
  ok('버전 타는 문법은 노출하지 않는다', !/countcandy|countcandyxl|count5-/.test(body));
  ok('못 하는 것은 못 한다고 적는다', /지원하지 않아/.test(body));

  // ── 2026-09-12 v3.8.2 만들어진 식 칸은 sticky 다. 상단 바(sticky, z-index 30)보다 아래 층이라
  // top: 0 이면 바 뒤에 숨어 정작 식이 안 보였다 — 붙어 있게 한 이유가 통째로 사라진다.
  // 스크롤한 뒤에도 칸 전체가 바 아래에 온전히 보이는지 본다
  await page.locator('.finder__flag').first().click();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(300);
  const stick = await page.evaluate(() => {
    const box = document.querySelector('.finder__result');
    const bar = document.querySelector('.app-bar');
    const out = document.querySelector('.finder__out');
    if (!box || !bar || !out) return null;
    return {
      가림: Math.round(bar.getBoundingClientRect().bottom - box.getBoundingClientRect().top),
      식보임: out.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom - 1,
      붙어있나: Math.round(box.getBoundingClientRect().top) <= Math.round(bar.getBoundingClientRect().bottom) + 1,
    };
  });
  ok('식 칸이 상단 바에 안 가린다', !!stick && stick.가림 <= 0, JSON.stringify(stick));
  ok('스크롤해도 만들어진 식이 보인다', !!stick && stick.식보임, JSON.stringify(stick));
  ok('식 칸이 상단 바 바로 아래에 붙는다', !!stick && stick.붙어있나, JSON.stringify(stick));

  // ── 묶음 리듬: 제목은 제 칩에 붙고, 묶음끼리는 확실히 떨어진다 (v3.8.2)
  const rhythm = await page.evaluate(() => {
    const kids = [...document.querySelector('#page .finder').children];
    const head = kids.findIndex((n) => n.classList.contains('row-head'));
    const r = (n) => n.getBoundingClientRect();
    return {
      제목_칩: Math.round(r(kids[head + 1]).top - r(kids[head]).bottom),
      칩_다음제목: Math.round(r(kids[head + 2]).top - r(kids[head + 1]).bottom),
    };
  });
  ok('묶음 안(제목↔칩)이 묶음 사이보다 좁다', rhythm.제목_칩 * 2 < rhythm.칩_다음제목, JSON.stringify(rhythm));

  // ── 로그인하지 않으면 잠긴다 (2026-09-11 v2.58.0)
  {
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await guest.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const gp = await guest.newPage();
    await gp.goto('http://localhost:5503/#/finder', { waitUntil: 'domcontentloaded' });
    await gp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await gp.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await gp.waitForTimeout(500);
    ok('로그인 안 하면 잠긴다', (await gp.locator('.finder').count()) === 0);
    ok('잠금 안내가 왜 막혔는지 말한다', /검색식/.test(await gp.locator('#page').textContent()));
    await guest.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
