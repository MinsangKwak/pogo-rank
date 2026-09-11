'use strict';
// v2.47.0 육성 플래너 회귀 — 로그인 잠금 · 화면 구성 · 같은 종 비교
//
// 이 스위트가 지키려는 것
//   1) 로그인해야 열리는가 — 메뉴 줄·홈 타일이 잠기고, 주소로 바로 들어가도 잠긴 화면이 뜨는가
//      (잠금은 "보여 주기"가 아니라 화면 자체가 막혀야 한다. 메뉴만 흐리게 하고 주소로는 들어가지면 잠근 게 아니다)
//   2) 메뉴가 하나인가 — '내 포켓몬' 과 '육성 플래너' 를 합친 뒤 문이 다시 둘로 늘지 않는가
//   3) 비교가 눌린 티가 나는가 — v2.47.0 이전에는 안내문을 목록 **아래**(문서 3,000px 지점)에
//      그려, 다른 종을 고른 사람에게는 "눌렀는데 아무 일도 안 일어난" 화면이었다.
//      그래서 안내가 **뷰포트 안에** 있는지를 좌표로 확인한다 — 존재만 보면 이 버그를 다시 놓친다
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const settle = async (ms = 900) => page.waitForTimeout(ms);

  // ── 1. 메뉴는 한 줄 ────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
  await settle();

  const navLabels = await page.locator('.nav-menu .drawer__label').allTextContents();
  ok('메뉴에 육성 플래너 한 줄', navLabels.filter((t) => t === '육성 플래너').length === 1, navLabels.join('|'));
  ok('메뉴에서 내 포켓몬 줄은 없어짐', !navLabels.includes('내 포켓몬'), navLabels.join('|'));
  ok('홈 타일 10개', (await page.locator('.home__tile').count()) === 10);

  // ── 2. 로그아웃 상태 = 잠김 ────────────────────────────────────────────────
  await page.evaluate(() => { try { firebase.auth().signOut(); } catch {} });
  await settle(1200);
  ok('로그아웃 확인', (await page.evaluate(() => AUTH.status)) === 'anon');
  ok('메뉴 줄 잠김', (await page.locator('#menu-planner').getAttribute('aria-disabled')) === 'true');
  ok('홈 타일 잠김', (await page.locator('#home-tile-planner').getAttribute('aria-disabled')) === 'true');
  // 2026-09-10 v2.48.1 잠그는 화면이 늘었다 — 육성 플래너 · 배틀 PvP · 이벤트 일정 · 레이드 보스 · 알 부화.
  // 도감 · 타입 & 상성 · D-MAX · 레이드 PvE 는 로그인 없이 쓰는 화면이라 잠기면 안 된다
  const lockedLabels = await page.locator('.nav-menu a[aria-disabled="true"] .drawer__label').allTextContents();
  // 2026-09-11 v2.58.0 🔎 검색식 만들기가 늘어 일곱이다
  ok('잠긴 메뉴 줄이 정확히 일곱', lockedLabels.join('|') === '육성 플래너|레이드 · PvE|배틀 · PvP|이벤트 일정|레이드 보스|알 부화|검색식 만들기', lockedLabels.join('|'));
  const openLabels = await page.locator('.nav-menu a:not([aria-disabled]) .drawer__label').allTextContents();
  ok('로그인 없이 쓰는 화면은 안 잠긴다', ['포켓몬 도감', '타입 & 상성', 'D-MAX'].every((t) => openLabels.includes(t)), openLabels.join('|'));
  const lockedTiles = await page.locator('.home__tile[aria-disabled="true"] strong').allTextContents();
  ok('잠긴 홈 타일도 일곱', lockedTiles.length === 7, lockedTiles.join('|'));
  // 잠긴 타일을 눌러도 그 화면으로 가지 않는다 (대신 계정 카드가 열린다)
  // force: true — Playwright 는 aria-disabled 를 "누를 수 없음" 으로 보고 클릭을 거절하지만,
  // 실제 브라우저에서는 눌린다. 우리는 그 눌림을 받아 계정 카드를 여는 쪽을 택했으므로 강제로 누른다
  await page.locator('#home-tile-planner').click({ force: true });
  await settle(600);
  ok('잠긴 타일은 이동하지 않는다', !(await page.evaluate(() => location.hash)), await page.evaluate(() => location.hash));
  // 2026-09-10 v2.51.0 계정 카드(☰ 메뉴)로 데려다주던 것을 로그인 유도 팝업으로 바꿨다 —
  // 메뉴를 열면 일정표·기준 안내·약관 같은 줄이 함께 있어 정작 할 일이 묻혔다
  ok('잠긴 타일을 누르면 로그인 유도 팝업', await page.locator('.login-invite').isVisible());
  ok('메뉴는 열지 않는다', !(await page.locator('#drawer-backdrop').isVisible().catch(() => false)));
  ok('팝업이 가려던 화면 이름을 말한다', /육성 플래너/.test(await page.locator('.login-invite .plan__desc').textContent()));
  // 승인제라는 걸 누르기 전에 알려야 "로그인했는데 왜 안 되지" 를 겪지 않는다
  ok('승인 단계를 미리 알린다', (await page.locator('.login-invite__steps li').count()) === 3);
  ok('승인 대기 단계가 있다', /승인/.test(await page.locator('.login-invite__steps').textContent()));
  // 조사는 받침을 따른다 — "육성 플래너은(는)" 같은 말을 쓰지 않는다
  ok('조사가 받침을 따른다', !/은\(는\)|을\(를\)/.test(await page.locator('.login-invite').textContent()));

  // 2026-09-11 v2.56.0 두 버튼은 가운데. 내용 폭에 맞춰 줄어드는 버튼을 그냥 두면 왼쪽 모서리에 붙어
  // 위의 세 단계 설명과 같은 줄에 서고, 설명의 네 번째 줄처럼 읽힌다 —
  // 이 둘은 읽는 것이 아니라 고르는 것이라 줄에서 떨어져야 한다
  const centered = await page.evaluate(() => {
    const box = document.querySelector('.modal__box');
    if (!box) return null;
    const mid = (n) => { const r = n.getBoundingClientRect(); return r.left + r.width / 2; };
    const go = document.querySelector('.login-invite__go');
    const later = document.querySelector('.login-invite__later');
    if (!go || !later) return null;
    return { box: mid(box), go: mid(go), later: mid(later) };
  });
  ok('로그인 버튼이 팝업 가운데', centered && Math.abs(centered.go - centered.box) < 1,
    centered ? `${Math.round(centered.go)} vs ${Math.round(centered.box)}` : '(못 찾음)');
  ok('[나중에] 도 팝업 가운데', centered && Math.abs(centered.later - centered.box) < 1,
    centered ? `${Math.round(centered.later)} vs ${Math.round(centered.box)}` : '(못 찾음)');
  await page.keyboard.press('Escape');
  await settle(400);

  // 주소로 바로 들어가도 막힌다
  await page.goto(BASE + '#/planner', { waitUntil: 'domcontentloaded' });
  await settle(1200);
  ok('주소로 들어가도 잠긴 화면', (await page.locator('.plan__lock').count()) === 1);
  // 다른 잠긴 화면들도 주소로 들어가면 막힌다 — 메뉴만 흐리게 하고 주소로 들어가지면 잠근 게 아니다
  for (const [hash, name] of [['#/raids', '레이드 보스'], ['#/eggs', '알 부화'], ['#/schedule', '이벤트 일정'], ['#/pvp', '배틀 PvP'], ['#/pve', '레이드 PvE']]) {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await settle(1400);
    // .first() 를 쓰면 안 된다 — 앞 화면(플래너)이 남긴 잠금 카드가 감춰진 채 .wrap 안에 남아 있어
    // 그쪽이 먼저 잡힌다. **보이는 것**만 센다
    ok(`${name} 주소도 잠긴 화면`, (await page.locator('.plan__lock:visible').count()) > 0);
  }
  for (const [hash, name] of [['#/dex', '포켓몬 도감'], ['#/types', '타입 & 상성'], ['#/dmax', 'D-MAX']]) {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await settle(1400);
    ok(`${name} 는 잠기지 않는다`, (await page.locator('.plan__lock:visible').count()) === 0);
  }
  await page.goto(BASE + '#/planner', { waitUntil: 'domcontentloaded' });
  await settle(1200);
  ok('잠긴 화면에는 탭 줄이 없다', (await page.locator('#tabs .tabs__item').count()) === 0);
  ok('잠긴 화면에 로그인 버튼', await page.locator('.plan__lock-go').isVisible());
  // 잠긴 화면의 버튼도 곧바로 로그인 창을 띄우지 않고 안내 팝업을 먼저 연다
  await page.locator('.plan__lock-go').click();
  await settle(700);
  ok('잠긴 화면 버튼도 안내 팝업을 연다', await page.locator('.login-invite').isVisible());
  await page.keyboard.press('Escape');
  await settle(400);
  ok('잠긴 화면에 목록이 없다', (await page.locator('.plan__mon').count()) === 0);

  // ── 3. 로그인 상태 = 열림 ─────────────────────────────────────────────────
  // 목(dev-mock.js)의 로그인은 팝업 호출 한 번으로 끝난다. 약관 동의는 먼저 표시해 둔다
  await page.evaluate(() => { try { localStorage.setItem(TERMS_OK_KEY, TERMS_VER); } catch {} });
  await page.evaluate(() => signIn());
  await settle(1500);
  await page.goto(BASE + '#/planner', { waitUntil: 'domcontentloaded' });
  await settle(1500);
  ok('로그인 상태 복구', (await page.evaluate(() => AUTH.status)) === 'ok', await page.evaluate(() => AUTH.status));
  ok('잠금 해제 — 탭 줄 2개', (await page.locator('#tabs .tabs__item').count()) === 2);
  ok('메뉴 줄 잠금 해제', (await page.locator('#menu-planner').getAttribute('aria-disabled')) === null);

  // 육성 현황 — 목업의 카드 넉 장
  ok('히어로 카드', (await page.locator('.plan__hero').count()) === 1);
  ok('히어로에 주 동작 하나', (await page.locator('.plan__hero-go').count()) === 1);
  ok('상태 수치 세 칸', (await page.locator('.plan__stat').count()) === 3);
  ok('다섯 걸음', (await page.locator('.plan__step').count()) === 5);
  // 걸음은 전부 갈 곳이 있어야 한다 — "눌러서 할 수 있는 것" 만 걸음으로 적는다는 규칙
  const stepHrefs = await page.locator('.plan__step').evaluateAll((ns) => ns.map((n) => n.getAttribute('href')));
  ok('걸음마다 갈 곳이 있다', stepHrefs.every((h) => h && h.startsWith('#')), stepHrefs.join('|'));
  ok('최근 추가한 포켓몬 넷', (await page.locator('.plan__recent-item').count()) === 4);

  // ── 4. 내 포켓몬 목록 — 정보 묶음 ─────────────────────────────────────────
  await page.goto(BASE + '#/planner/collection', { waitUntil: 'domcontentloaded' });
  await settle(1500);
  const rowCount = await page.locator('.plan__mon').count();
  ok('개체 줄이 있다', rowCount > 0, String(rowCount));
  const first = page.locator('.plan__mon').first();
  ok('순번 배지', (await first.locator('.plan__mon-no').textContent()) === '1');
  ok('CP 묶음', /\d/.test(await first.locator('.plan__mon-cp b').textContent()));
  ok('주요 기술 두 줄', (await first.locator('.plan__move').count()) === 2);
  ok('개체값 막대', (await first.locator('.plan__mon-bar span').count()) === 1);
  // 2026-09-10 v2.48.1 (버그) 넓은 화면에서 묶음들이 한 줄에 서는가.
  // planner.css 가 좁은 화면용으로 주는 grid-column: 1 / -1 이 넓은 화면까지 따라와,
  // CP·기술·동작이 각각 한 줄씩 차지하며 카드가 400px 넘게 늘어져 있었다.
  // 높이만 재면 글자 크기 조정에도 걸리므로 **같은 줄에 있는지**를 좌표로 본다
  const cols = await first.evaluate((n) => {
    const box = (sel) => { const e = n.querySelector(sel); const r = e && e.getBoundingClientRect(); return r && { x: Math.round(r.x), y: Math.round(r.y) }; };
    return { no: box('.plan__mon-no'), cp: box('.plan__mon-cp'), moves: box('.plan__mon-moves'), acts: box('.plan__mon-actions'), h: Math.round(n.getBoundingClientRect().height) };
  });
  ok('넓은 화면: 번호 → CP → 기술 → 동작 이 가로로 선다',
    cols.no.x < cols.cp.x && cols.cp.x < cols.moves.x && cols.moves.x < cols.acts.x, JSON.stringify(cols));
  ok('넓은 화면: 카드가 한 줄 높이 (200px 미만)', cols.h < 200, `${cols.h}px`);
  // 좁은 화면에서도 CP·기술은 남아 있어야 한다 (v2.47.0 에서 감췄다가 되살린 값)
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(700);
  ok('좁은 화면에도 CP 가 보인다', await first.locator('.plan__mon-cp').isVisible());
  ok('좁은 화면에도 기술이 보인다', await first.locator('.plan__mon-moves').isVisible());
  ok('좁은 화면에서는 순번을 감춘다', !(await first.locator('.plan__mon-no').isVisible()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(700);

  // ── 5. 비교 ───────────────────────────────────────────────────────────────
  // 같은 종 두 마리 → 팝업이 열리고 결론이 붙는다
  const rows = page.locator('.plan__mon');
  const names = [];
  for (let i = 0; i < await rows.count(); i++) names.push((await rows.nth(i).locator('.row__name').innerText()).replace(/\s+/g, ' '));
  const sameIdx = names.map((n, i) => [n, i]).filter(([n]) => n.includes('물짱이')).map(([, i]) => i);
  ok('같은 종 두 마리가 목록에 있다 (검사 전제)', sameIdx.length >= 2, names.join(' / '));
  for (const i of sameIdx.slice(0, 2)) {
    await rows.nth(i).locator('.plan__mon-actions .uchip').first().click();
    await settle(500);
  }
  await settle(600);
  ok('같은 종 → 비교 팝업', (await page.locator('dialog[open] .plan__cmp-cards').count()) === 1);
  ok('비교 카드 두 장', (await page.locator('dialog[open] .plan__cmp-card').count()) === 2);
  ok('결론 한 줄', (await page.locator('dialog[open] .plan__cmp-verdict').count()) === 1);
  // 섀도우와 일반을 견줄 때는 승자를 정하지 않는다 (CP 에 안 잡히는 배틀 보정이 있다)
  const verdict = await page.locator('dialog[open] .plan__cmp-verdict b').textContent();
  ok('섀도우 vs 일반은 승자를 정하지 않는다', /못 고릅니다/.test(verdict), verdict);
  await page.keyboard.press('Escape');
  await settle(600);

  // 다른 종 → 팝업은 안 열리고, 왜 안 되는지가 **화면 안에** 보인다
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await settle(400);
  const otherIdx = names.map((n, i) => [n, i]).filter(([n]) => !n.includes('물짱이')).map(([, i]) => i);
  await rows.nth(otherIdx[0]).locator('.plan__mon-actions .uchip').first().click();
  await settle(600);
  await rows.nth(otherIdx[1]).locator('.plan__mon-actions .uchip').first().click();
  await settle(900);
  ok('다른 종 → 비교 팝업이 열리지 않는다', (await page.locator('dialog[open] .plan__cmp-cards').count()) === 0);
  const bar = page.locator('.plan__cmp-bar');
  ok('안내 바가 있다', (await bar.count()) === 1);
  const barBox = await bar.boundingBox();
  const vh = page.viewportSize().height;
  ok('안내 바가 화면 안에 있다 (v2.47.0 버그)', barBox && barBox.y > -barBox.height && barBox.y < vh,
    barBox ? `y=${Math.round(barBox.y)} vh=${vh}` : 'no box');
  const barText = await bar.innerText();
  ok('왜 안 되는지 말한다', /다른 종/.test(barText), barText.replace(/\s+/g, ' ').slice(0, 60));
  // 한국어 조사 — "거북왕 와" 처럼 틀린 말이 나오지 않는가
  ok('조사가 받침을 따른다', !/[가-힣] (와|과|은|는|로|으로) /.test(barText), barText.replace(/\s+/g, ' ').slice(0, 80));
  ok('짝이 안 되는 줄은 흐리게', (await page.locator('.uchip.is-offpair').count()) > 0);

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  console.log(`${pass}/${pass + fail} passed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
