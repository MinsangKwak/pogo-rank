'use strict';
// v2.18.0 공개 준비 e2e — 약관 동의 팝업 · 계정 삭제 · 약관/방침 페이지 · 푸터 고지 · 드로어 항목
// 2026-09-15 v3.45.0 첫 방문 배너를 걷어냈다. 이 스위트는 이제 **배너가 안 뜨는 것**과
// 그래도 끄는 길과 고지가 남아 있는 것을 지킨다 — 둘 중 하나라도 없으면 방침이 거짓말이 된다
const { launch, newContext, waitSplash, suite } = require('./_lib');
const BASE = 'http://localhost:5503/';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { banner: true, viewport: { width: 390, height: 844 } });
  // 폰트 CDN 차단 (샌드박스 대기 방지)
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1. 첫 방문: **배너가 없다** (2026-09-15 v3.45.0)
  //    아무것도 안 고른 상태(newContext { banner: true } 가 pogo_consent 를 안 심는다)로 들어와도
  //    화면 아래를 막는 안내가 뜨지 않아야 한다 — 그것이 첫 방문의 문턱이었다
  await page.goto(BASE + '?mock=friend', { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(700);   // 옛 배너는 스플래시가 걷힌 뒤 늦게 떴다 — 늦게 뜨는 것까지 본다
  ok('첫 방문에 배너가 없다', (await page.locator('#consent').count()) === 0);
  ok('아무 값도 저장하지 않는다', await page.evaluate(() => localStorage.getItem('pogo_consent')) === null,
    String(await page.evaluate(() => localStorage.getItem('pogo_consent'))));
  ok('화면 아래를 막는 것이 없다', (await page.locator('.consent__btns').count()) === 0);
  ok('gtag 없음(로컬 빌드)', await page.evaluate(() => typeof window.gtag === 'undefined'));
  // 배너를 없앴다고 고지까지 없어지면 안 된다 — 끄는 길이 두 곳에 남아 있어야 한다
  ok('☰ 메뉴에 통계·저장소 설정이 있다', (await page.locator('#menu-consent').count()) === 1);
  ok('푸터에도 같은 항목이 있다', (await page.locator('#foot-consent').count()) === 1);

  // 1-b. 기본은 **켜짐** (2026-09-15 v3.39.0 옵트아웃)
  //   판정은 analyticsWanted() 하나가 한다 — head 스니펫(build.py)도 같은 규칙이라 둘이 어긋나면 안 된다.
  //   실제 gtag 로드는 배포 호스트(moncamp.kr)에서만 도는 head 스니펫의 몫이라 여기서는 판정만 본다
  const wanted = await page.evaluate(() => {
    const read = () => (typeof analyticsWanted === 'function' ? analyticsWanted() : null);
    const before = localStorage.getItem('pogo_consent');
    localStorage.removeItem('pogo_consent');
    const none = read();
    localStorage.setItem('pogo_consent', 'denied');
    const denied = read();
    localStorage.setItem('pogo_consent', 'granted');
    const granted = read();
    if (before === null) localStorage.removeItem('pogo_consent'); else localStorage.setItem('pogo_consent', before);
    return { none, denied, granted };
  });
  ok('아무것도 안 골랐으면 통계 켜짐', wanted.none === true, String(wanted.none));
  ok('끄기를 골랐으면 꺼짐', wanted.denied === false, String(wanted.denied));
  ok('켜기를 골랐으면 켜짐', wanted.granted === true, String(wanted.granted));

  // 2. 푸터 고지문 · 링크
  const notice = await page.locator('#ip-notice').textContent();
  ok('푸터 IP 고지 (Scopely·Pokémon Company)', /Scopely/.test(notice) && /The Pokémon Company/.test(notice), notice.slice(0, 60));
  ok('푸터 이용약관 링크', (await page.locator('footer a[href="#/terms"]').count()) === 1);

  // 3. 드로어: 약관·설정 항목, 설정 팝업에서 동의로 변경
  await page.click('#menu-toggle');
  ok('드로어 이용약관 항목', await page.locator('.drawer__panel button:has-text("이용약관")').isVisible());
  await page.click('#menu-consent');
  await page.waitForSelector('.consent__modal');
  // 아직 아무것도 안 고른 상태라 눌린 줄이 없다 (기본은 켜짐이지만 '고른 값' 은 아니다)
  ok('설정 팝업에 고른 값이 없다', (await page.locator('.consent__opt[aria-pressed="true"]').count()) === 0);
  await page.click('.consent__opt:has-text("통계 끄기")');
  ok('설정에서 끄면 denied 저장', await page.evaluate(() => localStorage.getItem('pogo_consent')) === 'denied');
  await page.click('#menu-toggle');
  await page.click('#menu-consent');
  await page.waitForSelector('.consent__modal');
  ok('다시 열면 끄기가 눌려 있다', await page.locator('.consent__opt[aria-pressed="true"]').textContent().then((t) => /끄기/.test(t)));
  await page.click('.consent__opt:has-text("통계 켜기")');
  ok('설정에서 granted 저장', await page.evaluate(() => localStorage.getItem('pogo_consent')) === 'granted');
  ok('로컬은 GA_PENDING_ID 없어 gtag 미로드', await page.evaluate(() => typeof window.gtag === 'undefined' && typeof window.GA_PENDING_ID === 'undefined'));

  // 4. 약관 · 방침 페이지 + 하단 고지
  await page.goto(BASE + '?mock=friend#/terms', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page:not([hidden])');
  ok('약관 페이지 제목', /이용약관/.test(await page.locator('.page__bar b').textContent()));
  ok('약관 7개 장', (await page.locator('#page .priv__sec').count()) >= 7);
  ok('약관 페이지 IP 고지', (await page.locator('#page .ip-notice').count()) >= 1);
  await page.goto(BASE + '?mock=friend#/privacy', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page:not([hidden])');
  const privText = await page.locator('#page').textContent();
  ok('방침: 처리위탁 표', (await page.locator('#page .priv__table').count()) === 2);
  ok('방침: 14세·보호책임자·위치 미수집', /만 14세/.test(privText) && /보호책임자/.test(privText) && /위치정보는 수집하지 않습니다/.test(privText));
  // 다른 전체 페이지(도감)에도 고지
  await page.goto(BASE + '?mock=friend#/dex', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page:not([hidden])');
  ok('도감 페이지 하단 IP 고지', (await page.locator('#page .ip-notice').count()) === 1);

  // 5. 첫 로그인 동의 팝업: 로그아웃 상태에서 시작 (mock: pogo_mock_signed_out)
  await page.evaluate(() => { localStorage.setItem('pogo_mock_signed_out', '1'); localStorage.removeItem('pogo_terms_ok'); });
  await page.goto(BASE + '?mock=friend', { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.ready, null, { timeout: 10000 });
  // v2.29.0 헤더 👤 제거 — 로그인은 ☰ 메뉴 안 계정 카드에서 시작한다
  await page.click('#menu-toggle');
  await page.waitForSelector('#account .account__login');
  await page.click('#account .account__login');
  await page.waitForSelector('.consent__modal');
  ok('동의 팝업 열림', await page.locator('.consent__modal .consent__go').isVisible());
  ok('버튼 비활성(체크 전)', await page.locator('.consent__go').isDisabled());
  const checks = page.locator('.consent__check input');
  await checks.nth(0).check();
  ok('한 개만 체크 → 여전히 비활성', await page.locator('.consent__go').isDisabled());
  await checks.nth(1).check();
  ok('둘 다 체크 → 활성', !(await page.locator('.consent__go').isDisabled()));
  await page.click('.consent__go');
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'ok', null, { timeout: 10000 });
  ok('동의 후 로그인 완료', true);
  ok('pogo_terms_ok 저장', await page.evaluate(() => localStorage.getItem('pogo_terms_ok')) === '2026-09-07');
  const req = await page.evaluate(() => JSON.parse(localStorage.getItem('pogo_mock_db')).requests['friend@mock.local']);
  ok('requests 문서에 consent 기록', req && req.consent === '2026-09-07', JSON.stringify(req && req.consent));

  // 6. 재로그인은 팝업 없이
  await page.click('#menu-toggle');
  await page.click('.drawer__panel button:has-text("로그아웃")');
  await page.waitForFunction(() => AUTH.status === 'anon');
  await page.click('#account .account__login');
  await page.waitForFunction(() => AUTH.status === 'ok', null, { timeout: 5000 });
  ok('동의 뒤 재로그인은 팝업 없음', (await page.locator('.consent__modal').count()) === 0);

  // 7. 계정 삭제 — 드로어는 6번에서 이미 열려 있다 (v2.29.0 계정은 드로어 안에만 있다)
  ok('계정 삭제 버튼', await page.locator('.drawer__panel .account__danger').isVisible());
  await page.click('.drawer__panel .account__danger');
  await page.waitForSelector('.consent__modal');
  // v3.61.0 에 ★ 와 개체 기록을 따로 적으면서 셋에서 넷이 됐다 (auth.js confirmDeleteAccount)
  ok('삭제 확인 팝업 항목 4개', (await page.locator('.consent__modal .priv__list li').count()) === 4);
  await page.click('.consent__modal .account__danger');
  await page.waitForFunction(() => AUTH.status === 'anon', null, { timeout: 5000 });
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('pogo_mock_db')));
  ok('users 문서 삭제', !db.users || !db.users['mock-friend'], JSON.stringify(Object.keys(db.users || {})));
  ok('allowlist 문서 삭제', !db.allowlist['friend@mock.local']);
  ok('requests 문서 삭제', !db.requests || !db.requests['friend@mock.local']);
  await page.waitForTimeout(200);
  ok('삭제 안내 문구', /지웠어요/.test(await page.locator('#account').textContent()));

  // 8. 승인 대기 계정도 삭제 버튼
  await page.evaluate(() => { localStorage.removeItem('pogo_mock_signed_out'); });
  await page.goto(BASE + '?mock=pending', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'pending', null, { timeout: 10000 });
  await page.click('#menu-toggle');
  ok('대기 상태 계정 삭제 버튼', await page.locator('.drawer__panel .account__danger').isVisible());

  // 9. 관리자는 삭제 버튼 없음
  await page.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof AUTH !== 'undefined' && AUTH.status === 'ok' && AUTH.admin, null, { timeout: 10000 });
  await page.click('#menu-toggle');
  ok('관리자 삭제 버튼 없음', (await page.locator('.drawer__panel .account__danger').count()) === 0);

  // 10. 캐시 비우기 버튼 존재 (reload 까지는 안 누름)
  await page.click('#menu-consent');
  await page.waitForSelector('.consent__modal');
  ok('캐시 비우기 버튼', await page.locator('.consent__modal button:has-text("캐시 비우고")').isVisible());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => localStorage.removeItem('pogo_consent'));
  await page.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(700);   // 옛 배너가 늦게 뜨던 시점까지 기다린 뒤 찍는다
  await page.screenshot({ path: __dirname + '/legal-first-visit.png' });   // v3.45.0 배너가 사라진 첫 화면
  await page.goto(BASE + '?mock=1#/privacy', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page:not([hidden])');
  await page.screenshot({ path: __dirname + '/legal-privacy.png', fullPage: false });

  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 300));
  for (const [s, n, e] of results) console.log(s, n, e || '');
  console.log(`${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
  await browser.close();
});
