'use strict';
// v2.22.0 디자인 통일 검증 — 토큰·글꼴 복구 · 탭 줄 · 헤더 아이콘 · 팝업/검색 시트 · 홈
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/';
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const settle = async () => {
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { try { localStorage.setItem('pogo_consent', 'denied'); } catch {} });
    await page.locator('#consent .consent-deny').click().catch(() => {});
    await page.waitForTimeout(250);
  };

  // 1. 토큰·글꼴이 원래 체계로 돌아왔나
  await page.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await settle();
  const design = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      surface: cs.getPropertyValue('--surface').trim(),
      line: cs.getPropertyValue('--line').trim(),
      muted: cs.getPropertyValue('--muted').trim(),
      accent: cs.getPropertyValue('--accent').trim(),
      tap: cs.getPropertyValue('--tap').trim(),
      font: body.fontFamily,
      size: body.fontSize,
    };
  });
  ok('토큰 --surface 원본(#f4f4f5)', design.surface === '#f4f4f5', design.surface);
  ok('토큰 --line 원본(#e8e9eb)', design.line === '#e8e9eb', design.line);
  ok('토큰 --muted 원본(#7a7c80)', design.muted === '#7a7c80', design.muted);
  ok('토큰 --accent 추가', design.accent === '#2f8f5b', design.accent);
  ok('토큰 --tap 44px', design.tap === '44px', design.tap);
  ok('본문 글꼴 Montserrat 우선', /Montserrat/.test(design.font), design.font.slice(0, 40));
  ok('본문 15px 유지', design.size === '15px', design.size);

  // 2. 서비스 홈 — 타일 8개 · 이모지 아이콘 · 탭 줄 숨김
  ok('홈 타일 10개', (await page.locator('.home__tile').count()) === 10);
  const icons = await page.locator('.home__icon').allTextContents();
  ok('홈 아이콘이 이모지', icons.join('') === '🎒📕🧭✨⚔️🃏🌱📅⚔️🥚', icons.join(''));
  ok('홈에서 탭 줄 숨김', await page.locator('#tabs').isHidden());
  const tile = await page.locator('.home__tile').first().evaluate((n) => {
    const s = getComputedStyle(n);
    return { r: s.borderRadius, bg: s.backgroundColor, bw: s.borderTopWidth };
  });
  ok('타일 12px 반경 · 1px 테두리', tile.r === '12px' && tile.bw === '1px', JSON.stringify(tile));
  ok('홈에서 뒤로가기 버튼 숨김', await page.locator('.app-bar__head .icon-btn').isHidden());

  // 3. 헤더 버튼이 이모지 아이콘 · 44px 정사각 통일
  const btns = await page.locator('.app-bar .app-bar__actions .icon-btn').evaluateAll((ns) =>
    ns.filter(n => !n.hidden).map(n => ({ t: n.textContent.trim(), w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height })));
  // v2.29.0 계정(👤)을 빼고 그 자리에 KR/EN 토글 — 로그인·마이페이지는 ☰ 메뉴 한 곳으로 모았다
  ok('헤더 아이콘 3개 (🔍 EN ☰)', btns.map(b => b.t).join('') === '🔍EN☰', JSON.stringify(btns.map(b => b.t)));
  ok('헤더 버튼 44×44 통일', btns.every(b => Math.round(b.w) === 44 && Math.round(b.h) === 44), JSON.stringify(btns));
  ok('헤더에 텍스트 버튼 없음', !(await page.locator('.app-bar').textContent()).includes('메뉴'));

  // 4. 탭 줄 복구 — 홈 타일 → D-MAX → 탭으로 PvE → PvP
  await page.click('.home__tile:has-text("D-MAX")');
  await page.waitForFunction(() => location.hash === '#/dmax', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  ok('D-MAX 진입 시 탭 줄 표시', await page.locator('#tabs').isVisible());
  ok('탭 3개 + 바로가기', (await page.locator('#tabs .tabs__item:not(.tabs__item--quick)').allTextContents()).join('|') === 'D-MAX|PvE|PvP');
  ok('현재 탭 aria-selected', await page.locator('#tabs .tabs__item[aria-selected="true"]').textContent() === 'D-MAX');
  // v2.30.0 상단 바는 늘 로고, 화면 이름은 본문 헤더로 (좁은 화면도 PC 와 같은 규칙)
  ok('상단 바는 로고', (await page.locator('#app-title').textContent()).trim() === 'POGO PLAN');
  ok('화면 헤더 = D-MAX', (await page.locator('#page-head h2').textContent()) === 'D-MAX');
  await page.click('#tabs .tabs__item:has-text("PvE")');
  await page.waitForFunction(() => location.hash === '#/pve', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  ok('탭으로 PvE 이동 (주소·제목 동기화)', (await page.locator('#page-head h2').textContent()) === '레이드 · PvE');
  ok('PvE 탭 선택 표시', await page.locator('#tabs .tabs__item[aria-selected="true"]').textContent() === 'PvE');
  const quick = await page.locator('#tabs .tabs__item--quick').allTextContents();
  ok('바로가기 📕 🧭 ★', quick.join('|') === '📕 도감|🧭 상성|★ 즐겨찾기 9', JSON.stringify(quick));
  await page.goBack();
  await page.waitForTimeout(300);
  ok('뒤로가기로 D-MAX 복귀', (await page.locator('#page-head h2').textContent()) === 'D-MAX');

  // 5. 상세 팝업이 카드/시트로 (전체 화면 아님) — 도감 목록에서 여는 일반 경로
  await page.goto(BASE + '?mock=1#/dex', { waitUntil: 'domcontentloaded' });
  await settle();
  await page.click('.dex__row');
  await page.waitForSelector('dialog.modal[open]', { timeout: 8000 });
  const modal = await page.locator('.modal__box').evaluate((n) => {
    const r = n.getBoundingClientRect(); const s = getComputedStyle(n);
    return { top: Math.round(r.top), h: Math.round(r.height), radius: s.borderTopLeftRadius };
  });
  ok('상세 = 바텀시트 (화면 아래에서)', modal.top > 60, JSON.stringify(modal));
  ok('상세 모서리 둥근 카드', modal.radius === '16px', modal.radius);
  ok('닫기 버튼 ✕', (await page.locator('.modal__close').textContent()) === '✕');
  // 2026-09-09 v2.34.0 ✕ 를 .modal__bar(카드 안) 대신 .modal__wrap(카드 밖, 카드의 부모)에 둔다
  ok('"상세 정보" 군더더기 줄 없음', !(await page.locator('.modal__wrap').textContent()).includes('상세 정보'));
  await page.click('.modal__close');
  await page.waitForTimeout(300);
  ok('닫으면 팝업 사라짐', (await page.locator('dialog.modal[open]').count()) === 0);

  // 6. 검색 시트
  await page.click('#search-toggle');
  await page.waitForSelector('#search-dialog[open]', { timeout: 5000 });
  await page.waitForTimeout(250);
  const sheet = await page.locator('#search-dialog .search').evaluate((n) => {
    const r = n.getBoundingClientRect(); const s = getComputedStyle(n);
    return { top: Math.round(r.top), bg: s.backgroundColor, radius: s.borderTopLeftRadius };
  });
  ok('검색 = 같은 시트 기하', sheet.top > 60, JSON.stringify(sheet));
  ok('검색 카드 배경 = --surface', sheet.bg === 'rgb(244, 244, 245)', sheet.bg);
  ok('검색 안내문 보임', (await page.locator('.search__head .meta').isVisible()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('Esc 로 검색 닫힘', (await page.locator('#search-dialog[open]').count()) === 0);

  // 7. 드로어 현재 위치 표시가 강조색
  await page.goto(BASE + '?mock=1#/rank/pvp', { waitUntil: 'domcontentloaded' });
  await settle();
  await page.click('#menu-toggle');
  await page.waitForTimeout(350);
  // 2026-09-09 v2.40.0 항목이 [아이콘][이름] 두 조각이라 이름 칸(.drawer__label)만 본다
  ok('드로어 현재 항목 표시', (await page.locator('.nav-menu [aria-current="page"] .drawer__label').textContent()) === '배틀 · PvP');
  const cur = await page.locator('.nav-menu [aria-current="page"]').evaluate((n) => getComputedStyle(n).color);
  ok('현재 항목 = --accent', cur === 'rgb(47, 143, 91)', cur);
  ok('드로어 서비스 홈 항목', (await page.locator('.nav-menu a .drawer__label').first().textContent()) === '서비스 홈');
  await page.click('.nav-menu a:has-text("서비스 홈")');
  await page.waitForTimeout(400);
  ok('서비스 홈으로 이동', (await page.locator('.home__tile').count()) === 10 && !(await page.evaluate(() => location.hash)));

  // 8. 플래너 탭 라벨 텍스트 통일
  await page.goto(BASE + '?mock=1#/planner/collection', { waitUntil: 'domcontentloaded' });
  await settle();
  ok('플래너 탭 = 텍스트', (await page.locator('#tabs .tabs__item').allTextContents()).join('|') === '육성 현황|내 포켓몬',
    (await page.locator('#tabs .tabs__item').allTextContents()).join('|'));

  // 8b. 타입 & 상성 — 칩을 누르면 결과가 바로 나오는가 (v2.28.0 회귀)
  //     matchupBucket 이 묶음 키가 아니라 CSS 클래스를 돌려주는 바람에 buckets[...] 가 undefined 가 되어
  //     .push 에서 예외가 났고, 결과 영역이 통째로 비었다. 예외는 콘솔에만 남아 화면은 조용히 아무것도 안 했다
  await page.goto(BASE + '?mock=1#/types', { waitUntil: 'domcontentloaded' });
  await settle();
  await page.locator('.types__pick .chips__item').first().click();
  await page.waitForTimeout(400);
  const typeSecs = await page.locator('.types__sec h3').allTextContents();
  ok('타입 칩 → 배율표', typeSecs.some((text) => text.includes('때릴 때')), typeSecs.join(' | ').slice(0, 80));
  ok('타입 칩 → 그 타입 포켓몬 목록', (await page.locator('.types__mons .boss__rec').count()) > 0);
  ok('타입 칩 → 추천 딜러·반대로 절', typeSecs.length >= 3, String(typeSecs.length));

  // 9. 다크 모드에서도 토큰 한 벌
  const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await dark.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/, (r) => r.abort());
  const dp = await dark.newPage();
  await dp.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await dp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  const dtok = await dp.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim(), accent: cs.getPropertyValue('--accent').trim() };
  });
  ok('다크 --bg', dtok.bg === '#121315', dtok.bg);
  ok('다크 --accent', dtok.accent === '#4fb37c', dtok.accent);
  await dark.close();

  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200));
  for (const [s, n, e] of results) console.log(s, n, e || '');
  console.log(`${results.filter(r => r[0] === 'PASS').length}/${results.length} passed`);
  await browser.close();
  if (results.some(r => r[0] === 'FAIL')) process.exit(1);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
