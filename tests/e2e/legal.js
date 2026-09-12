'use strict';
// v2.18.0 공개 준비 e2e — 동의 배너 · 약관 동의 팝업 · 계정 삭제 · 약관/방침 페이지 · 푸터 고지 · 드로어 항목
const { launch, newContext, suite } = require('./_lib');
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

  // 1. 첫 방문: 배너가 뜬다 · 거부 → 사라지고 localStorage 저장
  await page.goto(BASE + '?mock=friend', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  ok('배너 표시', await page.locator('#consent').isVisible());
  await page.click('#consent .consent__deny');
  ok('배너 거부 후 제거', (await page.locator('#consent').count()) === 0);
  ok('pogo_consent=denied', await page.evaluate(() => localStorage.getItem('pogo_consent')) === 'denied');
  ok('gtag 없음(거부)', await page.evaluate(() => typeof window.gtag === 'undefined'));
  // 재방문: 배너 안 뜸
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  ok('재방문 배너 없음', (await page.locator('#consent').count()) === 0);

  // 2. 푸터 고지문 · 링크
  const notice = await page.locator('#ip-notice').textContent();
  ok('푸터 IP 고지 (Scopely·Pokémon Company)', /Scopely/.test(notice) && /The Pokémon Company/.test(notice), notice.slice(0, 60));
  ok('푸터 이용약관 링크', (await page.locator('footer a[href="#/terms"]').count()) === 1);

  // 3. 드로어: 약관·설정 항목, 설정 팝업에서 동의로 변경
  await page.click('#menu-toggle');
  ok('드로어 이용약관 항목', await page.locator('.drawer__panel button:has-text("이용약관")').isVisible());
  await page.click('#menu-consent');
  await page.waitForSelector('.consent__modal');
  ok('설정 팝업 현재값 denied 표시', await page.locator('.consent__opt[aria-pressed="true"]').textContent().then((t) => /거부/.test(t)));
  await page.click('.consent__opt:has-text("통계 동의")');
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
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
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
  ok('삭제 확인 팝업 항목 3개', (await page.locator('.consent__modal .priv__list li').count()) === 3);
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
  await page.waitForSelector('#consent');
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: __dirname + '/legal-banner.png' });
  await page.goto(BASE + '?mock=1#/privacy', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#page:not([hidden])');
  await page.screenshot({ path: __dirname + '/legal-privacy.png', fullPage: false });

  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 300));
  for (const [s, n, e] of results) console.log(s, n, e || '');
  console.log(`${results.filter((r) => r[0] === 'PASS').length}/${results.length} passed`);
  await browser.close();
});
