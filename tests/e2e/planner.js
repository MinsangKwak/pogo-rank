'use strict';
// 🎒 내 포켓몬 회귀 — 로그인 잠금 · 화면 구성 (v2.47.0 신설 · 2026-09-17 v3.61.0 개편)
//
// 무엇이 바뀌었나 (v3.61.0)
//   '🌱 육성 플래너' 와 '🎒 내 포켓몬' 두 화면을 **하나로 합쳤다.** 둘 다 같은 것(담아 둔 내 것)을
//   묻고 있었고, 홈의 걸음 다섯 중 넷이 이미 자식 화면 하나를 가리키고 있었다.
//   그러면서 화면의 뼈대를 개체 기록에서 ★ 즐겨찾기로 바꿨다 — 개체 기록은 일곱 번 입력해서
//   얻는 것이 계산기가 저장 없이도 알려 주던 값이었고, 게임과 동기화되지 않아 적을수록 틀려졌다.
//
//   개체 기록(.plan__mon · 같은 종 비교)은 **지우지 않고 스위치만 내렸다**
//   (planner/collection.js PLAN_MONS_ENABLED). 그래서 v2.47.0~v3.59.0 의 4·5 절(개체 줄의 정보 묶음 ·
//   비교 팝업)은 여기서 빠졌다 — 되살릴 때 이 스위트도 그 판에서 같이 되돌린다.
//
// 이 스위트가 지키려는 것
//   1) 로그인해야 열리는가 — 메뉴 줄·홈 타일이 잠기고, 주소로 바로 들어가도 잠긴 화면이 뜨는가
//      (잠금은 "보여 주기"가 아니라 화면 자체가 막혀야 한다. 메뉴만 흐리게 하고 주소로는 들어가지면 잠근 게 아니다)
//   2) 메뉴가 하나인가 — 합친 뒤 문이 다시 둘로 늘지 않는가. 옛 자식 주소는 이 화면으로 오는가
//   3) **일정이 먼저, 목록이 나중**인가 — v3.4.0 에 ★ 를 걷어낸 이유가 "★ 목록이 도감을 이름순으로
//      거른 것과 다르지 않아서" 였다. 목록이 맨 위로 올라오면 그 실수를 되풀이한다
//   4) ★ 를 빼면 그 줄이 목록에서 사라지는가
//   5) 개체 기록은 꺼진 채인가 — 스위치를 내렸는데 화면에 흔적이 새어 나오지 않는가
const { launch, newContext, waitSplash, ok, finish } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { locks: true, viewport: { width: 1440, height: 900 } });   // v3.18.0 잠금 동작을 검사하는 스위트
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const settle = async (ms = 900) => page.waitForTimeout(ms);

  // ── 1. 메뉴는 한 줄 ────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await settle();

  const navLabels = await page.locator('.nav-menu .drawer__label').allTextContents();
  ok('메뉴에 내 포켓몬 한 줄', navLabels.filter((t) => t === '내 포켓몬').length === 1, navLabels.join('|'));
  ok('육성 플래너 줄은 사라졌다', !navLabels.includes('육성 플래너'), navLabels.join('|'));
  ok('들여쓴 자식 줄이 없다', (await page.locator('.nav-menu .drawer__item--sub').count()) === 0,
    (await page.locator('.nav-menu .drawer__item--sub .drawer__label').allTextContents()).join('|'));
  ok('홈 타일 10개', (await page.locator('.home__tile').count()) === 10);   // v3.51.0 📢 게임 업데이트가 늘었다

  // ── 2. 로그아웃 상태 = 잠김 ────────────────────────────────────────────────
  await page.evaluate(() => { try { firebase.auth().signOut(); } catch {} });
  await settle(1200);
  ok('로그아웃 확인', (await page.evaluate(() => AUTH.status)) === 'anon');
  ok('메뉴 줄 잠김', (await page.locator('#menu-planner').getAttribute('aria-disabled')) === 'true');
  ok('홈 타일 잠김', (await page.locator('#home-tile-planner').getAttribute('aria-disabled')) === 'true');
  // 2026-09-17 v3.59.0 잠그는 화면을 좁혔고, v3.61.0 에 그 둘이 한 줄로 합쳐져 **하나**가 됐다.
  // 담아 둔 것이 계정에 남는 자리라 계정이 있어야 뜻이 있다.
  // 읽기만 하는 화면(일정·레이드·알·티어표·PvP·검색식)은 열어 둔다 —
  // 처음 온 사람이 볼 것이 없으면 가입할 이유도 생기지 않는다
  const lockedLabels = await page.locator('.nav-menu a[aria-disabled="true"] .drawer__label').allTextContents();
  ok('잠긴 메뉴 줄은 하나뿐', lockedLabels.join('|') === '내 포켓몬', lockedLabels.join('|'));
  const openLabels = await page.locator('.nav-menu a:not([aria-disabled]) .drawer__label').allTextContents();
  ok('읽는 화면은 안 잠긴다',
    ['포켓몬 도감', 'D-MAX', '이벤트 일정', '레이드 보스', '알 부화', '레이드 · PvE', '배틀 · PvP', '검색식 만들기']
      .every((t) => openLabels.includes(t)), openLabels.join('|'));
  const lockedTiles = await page.locator('.home__tile[aria-disabled="true"] strong').allTextContents();
  ok('잠긴 홈 타일도 하나', lockedTiles.join('|') === '내 포켓몬', lockedTiles.join('|'));
  // 잠긴 타일을 눌러도 그 화면으로 가지 않는다 (대신 로그인 유도 팝업이 열린다)
  // force: true — Playwright 는 aria-disabled 를 "누를 수 없음" 으로 보고 클릭을 거절하지만,
  // 실제 브라우저에서는 눌린다. 우리는 그 눌림을 받아 팝업을 여는 쪽을 택했으므로 강제로 누른다
  await page.locator('#home-tile-planner').click({ force: true });
  await settle(600);
  ok('잠긴 타일은 이동하지 않는다', !(await page.evaluate(() => location.hash)), await page.evaluate(() => location.hash));
  // 2026-09-10 v2.51.0 계정 카드(☰ 메뉴)로 데려다주던 것을 로그인 유도 팝업으로 바꿨다 —
  // 메뉴를 열면 일정표·기준 안내·약관 같은 줄이 함께 있어 정작 할 일이 묻혔다
  ok('잠긴 타일을 누르면 로그인 유도 팝업', await page.locator('.login-invite').isVisible());
  ok('메뉴는 열지 않는다', !(await page.locator('#drawer-backdrop').isVisible().catch(() => false)));
  ok('팝업이 가려던 화면 이름을 말한다', /내 포켓몬/.test(await page.locator('.login-invite .plan__desc').textContent()));
  // 승인제라는 걸 누르기 전에 알려야 "로그인했는데 왜 안 되지" 를 겪지 않는다
  ok('승인 단계를 미리 알린다', (await page.locator('.login-invite__steps li').count()) === 3);
  ok('승인 대기 단계가 있다', /승인/.test(await page.locator('.login-invite__steps').textContent()));
  // 조사는 받침을 따른다 — "내 포켓몬은(는)" 같은 말을 쓰지 않는다
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

  // 주소로 바로 들어가도 막힌다 — 옛 자식 주소로 들어와도 마찬가지다
  for (const [hash, name] of [['#/planner', '내 포켓몬'], ['#/planner/collection', '옛 자식 주소'],
    ['#/plan/collection', '더 옛 자식 주소']]) {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await settle(1400);
    // .first() 를 쓰면 안 된다 — 앞 화면이 남긴 잠금 카드가 감춰진 채 .wrap 안에 남아 있어
    // 그쪽이 먼저 잡힌다. **보이는 것**만 센다
    ok(`${name} 로 들어가도 잠긴 화면`, (await page.locator('.plan__lock:visible').count()) === 1);
    ok(`${name} 는 #/planner 로 모인다`, (await page.evaluate(() => location.hash)) === '#/planner',
      await page.evaluate(() => location.hash));
  }
  // v3.59.0 열어 둔 화면 — 메뉴만 열어 두고 주소로 들어가면 잠기는 일이 없어야 한다
  for (const [hash, name] of [['#/dex', '포켓몬 도감'], ['#/dmax', 'D-MAX'],
    ['#/raids', '레이드 보스'], ['#/eggs', '알 부화'], ['#/schedule', '이벤트 일정'],
    ['#/pvp', '배틀 PvP'], ['#/pve', '레이드 PvE'], ['#/finder', '검색식 만들기']]) {
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
  ok('잠긴 화면에 목록이 없다', (await page.locator('.plan__fav-row').count()) === 0);

  // ── 3. 로그인 상태 = 열림 ─────────────────────────────────────────────────
  // 목(dev-mock.js)의 로그인은 팝업 호출 한 번으로 끝난다. 약관 동의는 먼저 표시해 둔다
  await page.evaluate(() => { try { localStorage.setItem(TERMS_OK_KEY, TERMS_VER); } catch {} });
  await page.evaluate(() => signIn());
  await settle(1500);
  await page.goto(BASE + '#/planner', { waitUntil: 'domcontentloaded' });
  await settle(1500);
  ok('로그인 상태 복구', (await page.evaluate(() => AUTH.status)) === 'ok', await page.evaluate(() => AUTH.status));
  ok('잠금 해제 — 탭 줄은 없다', (await page.locator('#tabs .tabs__item').count()) === 0);
  ok('메뉴 줄 잠금 해제', (await page.locator('#menu-planner').getAttribute('aria-disabled')) === null);

  ok('히어로 카드', (await page.locator('.plan__hero').count()) === 1);
  ok('히어로에 주 동작 하나', (await page.locator('.plan__hero-go').count()) === 1);
  ok('주 동작은 담으러 가는 길 (도감)', (await page.locator('.plan__hero-go').getAttribute('href')) === '#/dex',
    await page.locator('.plan__hero-go').getAttribute('href'));

  // ── 4. 일정이 먼저, 목록이 나중 ───────────────────────────────────────────
  // 일정이 잡힌 종을 담아 둔 계정으로 만든다 (목 계정의 시드 favs 에는 이번 주 일정이 없다)
  const sample = await page.evaluate(() => {
    const row = [...FAV_EVENTS].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .find((one) => Date.parse(one.end || one.start) >= Date.now());
    return row ? row.dex[0] : null;
  });
  ok('앞으로 남은 일정을 하나 골랐다 (검사 전제)', sample != null, String(sample));
  await page.evaluate((dex) => { AUTH.favs.add(Number(dex)); render(); }, sample);
  await settle(600);

  const order = await page.evaluate(() => {
    const y = (sel) => { const n = document.querySelector(sel); return n ? Math.round(n.getBoundingClientRect().top) : null; };
    return { news: y('.favnews__list'), favs: y('.plan__fav-list') };
  });
  ok('📣 소식 덩이가 있다', order.news != null, JSON.stringify(order));
  ok('★ 목록 덩이가 있다', order.favs != null, JSON.stringify(order));
  ok('일정이 목록보다 위다 (v3.4.0 의 실수를 되풀이하지 않는다)', order.news < order.favs, JSON.stringify(order));

  const cards = await page.locator('.favnews__card').count();
  ok('소식 카드가 있다', cards > 0, String(cards));
  ok('소식 카드는 이벤트 일정으로 잇는다',
    (await page.locator('.favnews__card').first().getAttribute('href')) === '#/schedule');
  ok('소식 카드가 언제인지 말한다',
    /D-\d+|오늘|내일|진행 중/.test(await page.locator('.favnews__when').first().textContent()),
    await page.locator('.favnews__when').first().textContent());

  const favRows = await page.locator('.plan__fav-row').count();
  ok('★ 목록에 담아 둔 만큼 줄이 선다', favRows === await page.evaluate(() => AUTH.favs.size),
    `${favRows} vs ${await page.evaluate(() => AUTH.favs.size)}`);
  ok('★ 줄은 상세로 잇는다', /^#\/mon\/\d+$/.test(await page.locator('.plan__fav-go').first().getAttribute('href')),
    await page.locator('.plan__fav-go').first().getAttribute('href'));
  // 일정이 걸린 줄에만 D-day 가 붙는다 — 없는 줄에 '없음' 을 적으면 없는 쪽이 더 눈에 띈다
  const whenTags = await page.locator('.plan__fav-when').count();
  ok('일정이 걸린 줄에만 D-day', whenTags > 0 && whenTags < favRows, `${whenTags}/${favRows}`);

  // ── 5. ★ 를 빼면 줄이 사라진다 ────────────────────────────────────────────
  await page.locator('.plan__fav-off').first().click();
  await settle(900);
  ok('★ 를 빼면 목록이 한 줄 준다', (await page.locator('.plan__fav-row').count()) === favRows - 1,
    `${await page.locator('.plan__fav-row').count()} (before ${favRows})`);

  // ── 6. 개체 기록은 꺼진 채다 ──────────────────────────────────────────────
  // 기능을 지우지 않고 스위치만 내렸다(PLAN_MONS_ENABLED). 흔적이 새어 나오지 않는지 본다
  ok('개체 기록 스위치가 내려가 있다', await page.evaluate(() => PLAN_MONS_ENABLED === false));
  ok('개체 줄이 화면에 없다', (await page.locator('.plan__mon').count()) === 0);
  ok('비교 바도 없다', (await page.locator('.plan__cmp-bar').count()) === 0);
  // 목 계정에는 옛 개체가 시드돼 있다 — 데이터는 살아 있는데 화면만 안 그린다는 뜻이다
  ok('옛 개체 데이터는 지우지 않는다', (await page.evaluate(() => (AUTH.mons || []).length)) > 0,
    String(await page.evaluate(() => (AUTH.mons || []).length)));

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
})();
