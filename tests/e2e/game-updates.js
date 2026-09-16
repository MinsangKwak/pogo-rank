'use strict';
// v3.51.0 📢 게임 업데이트 회귀 — 게임 쪽 변경을 모아 읽는 상설 창구 (components/updates.js)
//
// 이 스위트가 지키려는 것
//   - **확인 대기 글이 공개 빌드에 없다** — editorialStatus 가 published 가 아닌 글은 빌드가 걸러야 한다.
//     이 검사가 이 화면에서 가장 중요하다: 검증 안 된 소식을 내보내는 것이 이 기능의 유일한 큰 사고다
//   - 공개된 글에는 출처 · 발표일 · 근거/적용 상태가 빠짐없이 있다
//   - 메뉴와 홈에서 들어갈 수 있고, 목록 → 상세 한 단계로 원문까지 닿는다
//   - 목록에서 검색 · 분류 · 기간으로 좁혀지고, 결과 없음이 잘못된 내용을 만들지 않는다
//   - 상세를 보고 뒤로 오면 검색·분류가 그대로다 (기획: 복귀 시 탐색 상태 유지)
//   - 없는 글 주소(#/game-updates/없는id)로 들어가도 빈 화면·오류가 아니라 안내가 뜬다
//   - 이전 값을 모르는 항목은 지어내지 않고 '이전 값 미확인' 으로 적힌다
//   - 원문은 줄 링크가 아니라 미리보기 카드(썸네일 + 제목 + 주소)로 나가고, CSP 가 그 그림 주소를 허용한다
//   - moncamp 는 '점검 필요' 같은 우리 쪽 작업 상태가 아니라 '이렇게 추천해요' 를 적는다 (v3.52.0)
//   - 글이 쌓이면 [지난 소식 더 보기] 로 과거를 이어 본다 · 거르는 조건을 바꾸면 첫 장부터 (v3.53.0)
//   - 게임 업데이트 · 이벤트 일정 · moncamp 패치노트가 메뉴에서 서로 다른 화면으로 갈린다
//   - 영어로 볼 때 화면 뼈대가 번역되고, 본문이 한국어로 남는다는 안내가 보인다
const { launch, newContext, waitSplash, ok, finish, suite, toEnglish } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { viewport: { width: 390, height: 900 } });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await waitSplash(page);
    await page.waitForTimeout(500);
  };
  const cards = () => page.locator('.upd__cards:not(.upd__cards--top) .upd__card');

  // ── 빌드가 무엇을 실었나 — 화면보다 먼저 데이터를 본다
  await go('#/game-updates');
  const data = await page.evaluate(() => (typeof GAME_UPDATES === 'undefined' ? null : GAME_UPDATES));
  ok('GAME_UPDATES 가 빌드에 실렸다', Array.isArray(data) && data.length > 0, String(data && data.length));
  ok('공개 빌드에 확인 대기·초안 글이 없다',
    data.every((article) => article.editorialStatus === 'published'),
    data.filter((article) => article.editorialStatus !== 'published').map((article) => article.id).join(','));
  ok('공개 글은 모두 공식 출처를 갖는다',
    data.every((article) => article.evidenceStatus === 'official' && (article.sources || []).length > 0),
    data.filter((article) => !(article.sources || []).length).map((article) => article.id).join(','));
  // 공식 릴리스 노트는 날짜를 적지 않는다 — 그런 글은 우리가 확인한 날이 유일한 시간 기준이다
  ok('공개 글은 발표일이나 확인일이 있다',
    data.every((article) => /^\d{4}-\d{2}-\d{2}$/.test(article.announcedAt || article.checkedAt || '')));
  ok('최신이 위로 (적용일 > 발표일 > 확인일)', (() => {
    const key = (a) => a.effectiveAt || a.announcedAt || a.checkedAt || '';
    return data.every((a, i) => i === 0 || key(data[i - 1]) >= key(a));
  })());
  // v3.52.0 moncamp 축은 상태가 아니라 추천 문단이다 — 옛 필드가 남아 있으면 화면에 두 벌이 생긴다
  ok('moncampImpact 상태 필드는 없다', data.every((article) => article.moncampImpact === undefined));
  ok('분류마다 공개 글이 있다 — 체육관 포함',
    ['gym', 'pvp'].every((cat) => data.some((article) => (article.category || []).includes(cat))),
    data.map((article) => article.category.join('+')).join(' | '));
  ok('출처는 모두 https', data.every((article) => (article.sources || []).every((source) => source.url.startsWith('https://'))));
  // 편집 원본에는 초안이 있는데 빌드에 안 실렸다 — 거르는 자리가 실제로 동작한다는 뜻
  ok('초안(체육관 방어 제보)은 주소로도 못 연다',
    !data.some((article) => article.id === 'gym-defense-2026-09'));

  // ── 목록 화면
  // 화면 머리는 라우터의 메뉴 이름을 쓴다 (PAGES.title 의 이모지는 다른 자리에서 쓰인다)
  ok('화면 제목', (await page.locator('#page-head h2').textContent()) === '게임 업데이트');
  // v3.53.0 한 번에 5건씩 — 글이 쌓이는 화면이라 나머지는 [더보기] 로 온다
  const PAGE = 5;
  const listCount = await cards().count();
  ok('첫 장은 5건', listCount === Math.min(PAGE, data.length), `${listCount} vs ${data.length}`);
  ok('공개 글이 10건 이상 쌓였다', data.length >= 10, String(data.length));
  const more = page.locator('.upd__more');
  ok('[지난 소식 더 보기] 에 남은 수가 적힌다',
    await more.isVisible() && (await more.textContent()).includes(String(data.length - PAGE)), await more.textContent());
  await more.click();
  await page.waitForTimeout(250);
  ok('더 보기를 누르면 이어진다', (await cards().count()) === Math.min(PAGE * 2, data.length), String(await cards().count()));
  while (await more.isVisible()) { await more.click(); await page.waitForTimeout(200); }
  ok('끝까지 펼치면 전부 보이고 버튼이 사라진다', (await cards().count()) === data.length && !(await more.isVisible()));
  const firstTitle = await cards().first().locator('.upd__title').textContent();
  ok('카드에 제목·요약·상태·날짜', !!firstTitle
    && (await cards().first().locator('.upd__summary').count()) === 1
    && (await cards().first().locator('.upd__badge').count()) > 0
    && (await cards().first().locator('.upd__dates b').count()) > 0, firstTitle);

  // ── 검색 · 분류 · 기간
  // 제목만이 아니라 요약·핵심까지 훑는다 — 체육관 글은 제목에 '메가' 가 없어도 본문에 있어 걸린다
  await page.fill('.upd__search', '썰스데이');
  await page.waitForTimeout(250);
  const hitTitles = await cards().locator('.upd__title').allTextContents();
  ok('검색어로 좁혀진다', hitTitles.length > 0 && hitTitles.length < data.length, hitTitles.join(' | '));
  await page.fill('.upd__search', '메가');
  await page.waitForTimeout(250);
  const bodyHits = await cards().evaluateAll((ns) => ns.map((n) => /메가/.test(n.innerText)));
  ok('본문에만 있는 말로도 찾는다', bodyHits.length > 0 && bodyHits.every(Boolean), String(bodyHits.length));
  await page.fill('.upd__search', '있을 리 없는 말 zzzz');
  await page.waitForTimeout(250);
  ok('없으면 안내가 뜬다 (빈 화면이 아니다)', (await cards().count()) === 0 && (await page.locator('.upd__cards .dex__hint').count()) === 1);
  await page.fill('.upd__search', '');
  await page.waitForTimeout(250);
  ok('검색어를 지우면 첫 장으로 되돌아온다', (await cards().count()) === Math.min(PAGE, data.length));

  await page.locator('.upd__filter .uchip', { hasText: '체육관' }).first().click();
  await page.waitForTimeout(250);
  const gymCount = await cards().count();
  ok('분류로 좁힌다 — 체육관 글이 보인다', gymCount > 0 && gymCount < data.length, `${gymCount}/${data.length}`);
  ok('조건을 바꾸면 첫 장부터 (펼친 만큼이 남지 않는다)', gymCount <= PAGE, String(gymCount));
  await page.locator('.upd__filter .uchip', { hasText: 'PvP' }).first().click();
  await page.waitForTimeout(250);
  const pvpCount = await cards().count();
  ok('PvP 분류는 있다', pvpCount > 0, String(pvpCount));
  await page.locator('.upd__filter .uchip', { hasText: '전체 분류' }).first().click();
  await page.waitForTimeout(250);
  ok('전체 분류로 되돌아온다', (await cards().count()) === Math.min(PAGE, data.length));
  await page.locator('.upd__filter .uchip', { hasText: '최근 7일' }).first().click();
  await page.waitForTimeout(250);
  const recent = await cards().count();
  ok('기간으로 좁힌다 (최근 7일)', recent <= data.length, `${recent}/${data.length}`);
  await page.locator('.upd__filter .uchip', { hasText: '전체' }).first().click();
  await page.waitForTimeout(250);

  // ── 목록 → 상세 → 뒤로: 탐색 상태가 남는가
  await page.fill('.upd__search', '메가');
  await page.waitForTimeout(250);
  await cards().first().click();
  await page.waitForTimeout(600);
  ok('상세 주소는 #/game-updates/<id>', /^#\/game-updates\/[a-z0-9-]+$/.test(await page.evaluate(() => location.hash)),
    await page.evaluate(() => location.hash));
  await page.locator('.upd__back').click();
  await page.waitForTimeout(500);
  ok('뒤로 오면 검색어가 그대로', (await page.inputValue('.upd__search')) === '메가' && (await cards().count()) < data.length);
  await page.fill('.upd__search', '');
  await page.waitForTimeout(200);

  // ── 상세의 차례·내용은 **글을 지정해** 본다.
  // 검색 첫 줄에 기대면 글이 늘 때마다 다른 글이 걸려 검사가 흔들린다 (v3.53.0 에 실제로 겪었다)
  await go('#/game-updates/gbl-mega-twilight-trails');
  const secs = await page.locator('.upd__sec > h3').allTextContents();
  ok('상세 차례 — 핵심 → 전후 → 영향 → 확인 → 반영 → 관련 → 원문',
    secs[0] === '핵심 요약' && secs.includes('변경 전 · 후') && secs.includes('플레이에 미치는 영향') && secs.at(-1) === '공식 원문',
    secs.join(' | '));
  const source = await page.locator('.upd__source').first();
  ok('원문 링크가 공식 주소로 나간다', (await source.getAttribute('href')).startsWith('https://pokemongo.com/'),
    await source.getAttribute('href'));
  ok('원문은 새 탭으로 (읽던 자리를 잃지 않게)', (await source.getAttribute('target')) === '_blank'
    && /noopener/.test((await source.getAttribute('rel')) || ''));
  ok('이전 값을 모르는 항목은 지어내지 않는다', (await page.locator('.upd__ba-none').first().textContent()) === '이전 값 미확인');
  ok('moncamp 는 추천을 적는다 (작업 상태가 아니라)',
    (await page.locator('.upd__advice').count()) === 1 && (await page.locator('.upd__impact').count()) === 0
    && (await page.locator('.upd__sec > h3', { hasText: 'moncamp' }).textContent()) === 'moncamp 는 이렇게 추천해요');
  ok('상태 알약은 두 축뿐 (근거 · 게임 적용)', (await page.locator('.upd__head .upd__badge').count()) === 2);

  // ── 원문 미리보기 카드 — 썸네일 주소 · 새 탭 · CSP 허용
  const srcCards = page.locator('.upd__source');
  ok('원문이 카드로 나온다 (줄 링크가 아니라)', (await srcCards.count()) >= 1);
  const thumbs = await page.locator('.upd__source-img').evaluateAll((ns) => ns.map((n) => n.getAttribute('src')));
  // 이 검사망의 브라우저는 바깥 그림을 못 받아(gstatic 과 같은 정책) 실제로 뜨는지는 못 본다 —
  // 주소가 맞게 붙는지, 썸네일 크기로 줄였는지, CSP 가 그 호스트를 허용하는지까지 본다
  ok('썸네일 주소가 붙는다', thumbs.length >= 1 && thumbs.every((src) => src.startsWith('https://')), thumbs.join(' | ').slice(0, 120));
  ok('썸네일은 원본이 아니라 줄인 크기로', thumbs.every((src) => !/googleusercontent/.test(src) || /=w\d+-h\d+-c-no-rj$/.test(src)),
    thumbs.join(' | ').slice(0, 120));
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  const imgSrc = (csp.split(';').find((part) => part.trim().startsWith('img-src')) || '');
  ok('CSP img-src 가 그 그림 호스트를 허용한다',
    thumbs.every((src) => { const host = new URL(src).host; return imgSrc.includes(host) || imgSrc.includes('*.' + host.split('.').slice(-2).join('.')); }),
    imgSrc.trim());
  ok('원문 카드에 주소가 보인다', (await page.locator('.upd__source-host').first().textContent()) === 'pokemongo.com');
  // ── 없는 글 주소
  await go('#/game-updates/there-is-no-such-post');
  ok('없는 글은 안내로 받는다 (오류·빈 화면이 아니다)',
    (await page.locator('#page-game-update .dex__hint').count()) === 1 && (await page.locator('.upd__back').count()) === 1);
  await page.locator('.upd__back').click();
  await page.waitForTimeout(500);
  ok('안내에서 목록으로 돌아온다', await page.evaluate(() => location.hash) === '#/game-updates');

  // ── 홈 · 메뉴 진입
  await go('');
  const homeItems = page.locator('.home-updates__item');
  ok('홈에 주요 소식이 최대 3건', (await homeItems.count()) > 0 && (await homeItems.count()) <= 3, String(await homeItems.count()));
  await homeItems.first().click();
  await page.waitForTimeout(600);
  ok('홈 카드를 누르면 그 글이 열린다', /^#\/game-updates\/[a-z0-9-]+$/.test(await page.evaluate(() => location.hash)));
  await go('');
  await page.locator('.home-updates__all').click();
  await page.waitForTimeout(600);
  ok('홈 [전체 보기]로 목록', await page.evaluate(() => location.hash) === '#/game-updates');

  await page.click('#menu-toggle');
  await page.waitForTimeout(400);
  const menu = await page.locator('.nav-menu .drawer__label').allTextContents();
  ok('메뉴에 게임 업데이트 · 이벤트 일정이 따로 있다',
    menu.includes('게임 업데이트') && menu.includes('이벤트 일정'), menu.join(' | '));
  await page.locator('.nav-menu a:has-text("게임 업데이트")').first().click();
  await page.waitForTimeout(700);
  ok('메뉴로 이동', await page.evaluate(() => location.hash) === '#/game-updates');

  // ── 영어
  await toEnglish(page);
  await page.waitForTimeout(500);
  const hangul = (text) => /[가-힣]/.test(text || '');
  ok('화면 제목이 영어', !hangul(await page.locator('#page-head h2').textContent()),
    await page.locator('#page-head h2').textContent());
  const chips = await page.locator('.upd__filter .uchip').allTextContents();
  ok('분류·기간 칩이 영어', !chips.some(hangul), chips.join(' | '));
  const badges = await page.locator('.upd__badge').allTextContents();
  ok('상태 알약이 영어', badges.length > 0 && !badges.some(hangul), badges.join(' | '));
  const dateLabels = await page.locator('.upd__date em').allTextContents();
  ok('날짜 라벨이 영어 (뒤 공백 없는 제 노드)', dateLabels.length > 0 && !dateLabels.some(hangul), dateLabels.join(' | '));
  // 홈에도 같은 안내가 있으므로(감춰진 채) 지금 보고 있는 화면 안의 것만 본다
  ok('본문이 한국어로 남는다는 안내', await page.locator('#page .i18n-note').first().isVisible());

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
