'use strict';
// v2.29.0 다국어(KR/EN) 회귀
//
// 이 스위트가 지키려는 것
//   - 헤더 토글로 전환되고, 새로고침해도 고른 언어가 남는가
//   - 되돌아오는가 — 한 방향만 되는 번역은 되돌릴 수 없는 함정이다
//   - 이름(포켓몬·기술·타입)이 사전이 아니라 데이터로 바뀌는가
//   - 부분 렌더(도감 청크·상성 결과·검색 결과)도 번역되는가 (MutationObserver 가 살아 있는가)
//   - 한국어로만 두기로 한 화면에 영어 안내가 뜨는가
//   - 헤더에서 👤 가 사라지고 계정이 메뉴 안 "마이페이지"로 갔는가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };
const hangul = (text) => /[가-힣]/.test(text || '');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash = '') => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  // ── 헤더 개편: 👤 는 없고 KR/EN 이 그 자리에
  await go();
  ok('헤더에 계정(👤) 버튼 없음', (await page.locator('#account-toggle').count()) === 0);
  ok('헤더에 언어 토글 있음', await page.locator('#lang-toggle').isVisible());
  ok('한국어일 때 버튼은 EN (누르면 갈 언어)', (await page.locator('#lang-toggle').textContent()) === 'EN');
  await page.click('#menu-toggle');
  await page.waitForTimeout(400);
  ok('메뉴 안에 마이페이지 제목', await page.locator('#account-title').isVisible());
  ok('마이페이지 아래에 계정 카드', await page.locator('#account').isVisible());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 전환
  await go('#/rank/pve');
  const koTitle = await page.locator('#page-head h2').textContent();
  await page.click('#lang-toggle');
  await page.waitForTimeout(600);
  ok('전환 후 버튼은 KR', (await page.locator('#lang-toggle').textContent()) === 'KR');
  ok('html lang=en', (await page.evaluate(() => document.documentElement.lang)) === 'en');
  const enTitle = await page.locator('#page-head h2').textContent();
  ok('화면 제목이 영어로', enTitle === 'Raids · PvE', enTitle);
  const nav = await page.locator('.nav-menu a').allTextContents();
  ok('이동 목록에 한글 없음', !nav.some(hangul), nav.filter(hangul).join(' '));

  // 이름 — 사전이 아니라 데이터(dex.json en · moveKo)로 바뀐다
  const firstName = await page.locator('#content .row__name b').first().textContent();
  ok('포켓몬 이름이 영문', !hangul(firstName) && firstName.length > 2, firstName);
  const moves = await page.locator('#content .row__moves').first().textContent();
  ok('기술 이름이 영문', !hangul(moves), moves);

  // ── 새로고침해도 남는가
  await go('#/rank/pve');
  ok('새로고침 후에도 영어', (await page.locator('#page-head h2').textContent()) === 'Raids · PvE');

  // ── 부분 렌더도 번역되는가 (상성 검색 결과는 칩을 눌러야 그려진다)
  // 2026-09-12 v2.63.0 상성 검색 화면을 접었다 — 세대 칩을 눌러 다시 그려지는 도감 줄로 본다
  await go('#/dex');
  await page.locator('.dex__toolbar .tchips > *').nth(2).click();
  await page.waitForTimeout(600);
  const sections = await page.locator('#page .dex__row b').allTextContents();
  ok('나중에 그려진 절 제목도 영어', sections.length > 0 && !sections.some(hangul), sections.slice(0, 4).join(' | '));
  const monNames = await page.locator('#page .dex__types .dex__type b').allTextContents();
  ok('나중에 그려진 이름도 영어', monNames.length > 0 && !monNames.some(hangul), monNames.slice(0, 3).join(' '));

  // ── 한국어로 두는 화면에는 영어 안내
  for (const [hash, label] of [['#/release', '패치노트'], ['#/privacy', '개인정보'], ['#/terms', '약관'], ['#/schedule', '일정표']]) {
    await go(hash);
    const note = page.locator('.i18n-note').first();
    ok(`${label} 화면에 한국어 안내 표시`, await note.isVisible().catch(() => false));
  }

  // ── 일정표는 "한국 서버(KST) 기준" 을 먼저 밝힌다 (이벤트 날짜는 지역마다 다르다)
  await go('#/schedule');
  const kst = await page.locator('.schedule__page .i18n-note').first().textContent();
  ok('일정표 안내가 한국 기준을 밝힘', /Korean server/.test(kst) && /KST/.test(kst), kst.slice(0, 70));
  ok('드로어 미리보기에도 같은 안내', (await page.locator('#schedule-body .i18n-note').count()) === 1);
  // 한국어로 볼 때는 뜨지 않는다 (한국어 각주가 이미 "한국 시간 기준"이라고 적는다)
  const shownIn = async () => page.locator('.schedule__page .i18n-note').first().evaluate((n) => getComputedStyle(n).display);
  ok('영어일 때 안내 보임', (await shownIn()) === 'block');
  await page.click('#lang-toggle');
  await page.waitForTimeout(500);
  ok('한국어일 때 안내 숨김', (await shownIn()) === 'none');
  await page.click('#lang-toggle');
  await page.waitForTimeout(500);

  // ── 보기 방식 전환 버튼(v3.8.0): 버튼이 하나라 이름(aria-label)이 곧 라벨이다.
  // 글자가 아니라 도트 아이콘이라, 번역이 닿는 곳은 aria-label 하나뿐이다
  await go('#/dex');
  const layout = page.locator('.dex__layout');
  const viewLabel = (await layout.getAttribute('aria-label')) || '';
  ok('보기 방식 버튼 이름이 영어', !hangul(viewLabel) && /^View:/.test(viewLabel) && /tap for (grid|list)/.test(viewLabel), viewLabel);
  ok('보기 방식 묶음 이름도 영어', !hangul(await layout.getAttribute('aria-label')), await layout.getAttribute('aria-label'));

  // ── 되돌리기
  await go('#/dex');
  await page.click('#lang-toggle');
  await page.waitForTimeout(600);
  ok('되돌리면 한국어', (await page.locator('#page-head h2').textContent()) === koTitle.replace('레이드 · PvE', '포켓몬 도감') || (await page.locator('#page-head h2').textContent()) === '포켓몬 도감');
  // 2026-09-09 v2.40.0 항목이 [아이콘][이름] 두 조각이라 이름 칸만 본다 (아이콘은 번역 대상이 아니다)
  ok('되돌린 뒤 이동 목록도 한국어', (await page.locator('.nav-menu a .drawer__label').first().textContent()) === '서비스 홈');
  ok('html lang=ko', (await page.evaluate(() => document.documentElement.lang)) === 'ko');

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
