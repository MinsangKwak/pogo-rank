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
      brand: cs.getPropertyValue('--brand').trim(),
      'brand-2': cs.getPropertyValue('--brand-2').trim(),
      point: cs.getPropertyValue('--point').trim(),
      warn: cs.getPropertyValue('--warn').trim(),
      caution: cs.getPropertyValue('--caution').trim(),
      off: cs.getPropertyValue('--off').trim(),
      tap: cs.getPropertyValue('--tap').trim(),
      // 2026-09-10 v2.52.0 토큰이 rem 으로 바뀌어 글자로는 '4.4rem' 이다.
      // 지켜야 할 것은 글자가 아니라 손가락이 닿는 실제 크기라서, 재어서 본다
      tapPx: (() => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--tap)';
        document.body.append(probe);
        const h = probe.getBoundingClientRect().height;
        probe.remove();
        return h;
      })(),
      font: body.fontFamily,
      size: body.fontSize,
    };
  });
  // 2026-09-10 v2.42.0 디자인 시스템 개편 — 목업 팔레트로 갈아끼웠다 (tokens.css).
  // 값을 여기 못 박아 두는 이유는 그대로다: 화면마다 색을 직접 적는 습관이 되살아나면 바로 걸린다
  ok('토큰 --surface (#f5f7fa)', design.surface === '#f5f7fa', design.surface);
  ok('토큰 --line (#e4e8ee)', design.line === '#e4e8ee', design.line);
  ok('토큰 --muted (#64748b)', design.muted === '#64748b', design.muted);
  ok('토큰 --accent = 브랜드 초록 (#16a34a)', design.accent === '#16a34a', design.accent);
  ok('의미 색 여섯 벌 있음', ['brand', 'brand-2', 'point', 'warn', 'caution', 'off'].every((k) => design[k]),
    JSON.stringify({ brand: design.brand, warn: design.warn }));
  ok('토큰 --tap 이 손가락 크기 44px', design.tapPx === 44, `${design.tap} = ${design.tapPx}px`);
  ok('본문 글꼴 Montserrat 우선', /Montserrat/.test(design.font), design.font.slice(0, 40));
  ok('본문 15px 유지', design.size === '15px', design.size);

  // 2. 서비스 홈 — 타일 · 이모지 아이콘 · 탭 줄 숨김
  // 2026-09-10 v2.47.0 '내 포켓몬' 타일과 '육성 플래너' 타일을 하나로 합쳐 10 → 9 가 됐다
  ok('홈 타일 9개', (await page.locator('.home__tile').count()) === 9);
  const icons = await page.locator('.home__icon').allTextContents();
  ok('홈 아이콘이 이모지', icons.join('') === '🌱📕🧭✨⚔️🃏📅⚔️🥚', icons.join(''));
  ok('홈에서 탭 줄 숨김', await page.locator('#tabs').isHidden());
  const tile = await page.locator('.home__tile').first().evaluate((n) => {
    const s = getComputedStyle(n);
    return { r: s.borderRadius, bg: s.backgroundColor, bw: s.borderTopWidth };
  });
  ok('타일 12px 반경 · 1px 테두리', tile.r === '12px' && tile.bw === '1px', JSON.stringify(tile));
  ok('홈에서 뒤로가기 버튼 숨김', await page.locator('.app-bar__head .icon-btn').isHidden());

  // 3. 헤더 버튼이 이모지 아이콘 · 44px 정사각 통일
  // 2026-09-10 v2.47.0 화면 테마 버튼이 늘었다. 좁은 화면에서는 CSS 가 감추므로(로고가 잘려서)
  // **보이는 것만** 센다 — hidden 속성이 아니라 실제 크기로 걸러야 그 규칙까지 함께 지킨다
  const btns = await page.locator('.app-bar .app-bar__actions .icon-btn').evaluateAll((ns) =>
    ns.filter((n) => !n.hidden && n.getBoundingClientRect().width > 0)
      .map(n => ({ t: n.textContent.trim(), w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height })));
  // v2.29.0 계정(👤)을 빼고 그 자리에 KR/EN 토글 — 로그인·마이페이지는 ☰ 메뉴 한 곳으로 모았다
  const wide = page.viewportSize().width >= 1100;
  ok(`헤더 아이콘 ${wide ? '4개 (🔍 🌗 EN ☰)' : '3개 (🔍 EN ☰)'}`,
    btns.map(b => b.t).join('') === (wide ? '🔍🌗EN☰' : '🔍EN☰'), JSON.stringify(btns.map(b => b.t)));
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
  ok('검색 카드 배경 = --surface', sheet.bg === 'rgb(245, 247, 250)', sheet.bg);
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
  ok('현재 항목 = --accent (브랜드 초록)', cur === 'rgb(22, 163, 74)', cur);
  ok('드로어 서비스 홈 항목', (await page.locator('.nav-menu a .drawer__label').first().textContent()) === '서비스 홈');
  await page.click('.nav-menu a:has-text("서비스 홈")');
  await page.waitForTimeout(400);
  ok('서비스 홈으로 이동', (await page.locator('.home__tile').count()) === 9 && !(await page.evaluate(() => location.hash)));

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

  // 9. 길이 단위가 rem 인가 (2026-09-10 v2.52.0)
  // html 62.5% 기준이라 1rem = 10px 이고, 기본 설정에서는 지금까지와 같은 크기로 그려진다.
  // 확인해야 하는 것은 "픽셀이 같은가" 가 아니라 **사용자가 글자를 키우면 같이 커지는가** 다 —
  // px 로 박아 두면 글자만 커지고 상자는 그대로라 글자가 상자를 넘친다.
  // 그래서 기준을 100% 로 바꿔 "기본 글자가 1.6배인 사용자" 를 흉내 내고 배율을 잰다
  await page.goto(BASE + '?mock=1#/dex', { waitUntil: 'domcontentloaded' });
  await settle();
  ok('html 기준이 62.5% (1rem = 10px)', (await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === '10px',
    await page.evaluate(() => getComputedStyle(document.documentElement).fontSize));
  // 좁은 화면에는 사이드바(.nav-menu)도 카드 격자(.is-grid)도 없다 — 어느 폭에서나 있는 것으로 잰다
  const measure = () => page.evaluate(() => {
    const card = document.querySelector('.dex__row');
    const chip = document.querySelector('.tchips .uchip');
    const cs = card && getComputedStyle(card);
    return {
      body: parseFloat(getComputedStyle(document.body).fontSize),
      pad: cs ? parseFloat(cs.paddingTop) : null,
      radius: cs ? parseFloat(cs.borderRadius) : null,
      tap: chip ? parseFloat(getComputedStyle(chip).minHeight) : null,
    };
  });
  // 2026-09-10 v2.52.0 1px 선은 화면마다 붙는 곳이 달라서, 선택자 하나를 못 박으면
  // 그 화면이 바뀌는 순간 잴 것이 없어져 0 이 잡힌다 (통과처럼 보이지도 않고, 그냥 헛것을 잰다).
  // 그래서 기준 배율에서 1px 이던 것을 **모두** 모아 두고, 키운 뒤 같은 것들을 다시 본다
  // 자리(인덱스)로 기억하면 안 된다 — 배율을 올릴 때 <style> 하나가 <head> 에 끼어들어
  // 그 뒤 요소가 통째로 한 칸씩 밀린다. 요소에 표식을 달아 두면 밀려도 같은 것을 다시 찾는다
  const onePxLines = () => page.evaluate(() => {
    let n = 0;
    for (const node of document.querySelectorAll('*')) {
      if (getComputedStyle(node).borderTopWidth === '1px') { node.dataset.onepx = '1'; n++; }
    }
    return n;
  });
  const stillOnePx = () => page.evaluate(() =>
    [...document.querySelectorAll('[data-onepx]')]
      .filter((node) => getComputedStyle(node).borderTopWidth === '1px').length);
  const base = await measure();
  const baseLines = await onePxLines();
  ok('본문 15px 유지 (rem 으로 옮겨도 같은 크기)', base.body === 15, String(base.body));
  await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
  await page.waitForTimeout(300);
  const big = await measure();
  const scaled = (a, b) => Math.abs(b / a - 1.6) < 0.02;
  ok('글자를 키우면 본문도 같이', scaled(base.body, big.body), `${base.body} → ${big.body}`);
  ok('글자를 키우면 줄 여백도 같이', scaled(base.pad, big.pad), `${base.pad} → ${big.pad}`);
  if (base.tap) ok('글자를 키우면 칩 높이도 같이', scaled(base.tap, big.tap), `${base.tap} → ${big.tap}`);
  // 1px 선만 고정 — 선은 굵기가 아니라 '있다/없다' 를 말한다
  ok('잴 1px 선이 실제로 있다', baseLines > 0, `${baseLines}개`);
  const keptLines = await stillOnePx();
  ok('1px 선은 굵어지지 않는다', keptLines === baseLines, `${keptLines}/${baseLines}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle();

  // 10. 티어표 "선정 근거" 는 한 번에 하나만 열린다 (2026-09-10 v2.52.0)
  // 전에는 카드마다 따로 토글해서, 넷을 차례로 누르면 근거 넷이 한꺼번에 펼쳐진 채 쌓였다.
  // 근거는 카드 뒤에 가로폭을 다 쓰고 붙으므로, 여러 개가 열리면 어느 카드의 것인지 짝지을 수 없다
  await page.goto(BASE + '?mock=1#/dmax', { waitUntil: 'domcontentloaded' });
  await settle();
  const openWhy = () => page.locator('.row__why.is-open').count();
  ok('처음엔 근거가 닫혀 있다', (await openWhy()) === 0);
  for (let i = 0; i < 4; i++) {
    await page.locator('.row-list > .row').nth(i).click();
    await page.waitForTimeout(300);
    ok(`${i + 1}번째까지 눌러도 열린 근거는 하나`, (await openWhy()) === 1, String(await openWhy()));
  }
  // 같은 카드를 다시 누르면 닫힌다 — 끄는 길도 있어야 한다
  await page.locator('.row-list > .row').nth(3).click();
  await page.waitForTimeout(300);
  ok('같은 카드를 다시 누르면 닫힌다', (await openWhy()) === 0);

  // 2026-09-11 v2.55.0 [딜러] 탭은 티어표가 위, 딜러가 아래다.
  // 타입을 고르고 들어오면 "이 타입으로 뭘 키우나" 와 "이 타입 보스를 뭘로 때리나" 둘 다 궁금한데,
  // 전에는 뒤엣것만 보여 주고 앞엣것은 [전체] 탭으로 되돌아가야 했다.
  // 순서가 뒤집히면 화면의 뜻이 바뀌므로 순서 자체를 못 박는다
  await page.locator('.seg button, .seg .uchip').filter({ hasText: /^딜러$/ }).first().click({ force: true });
  await page.waitForTimeout(500);
  const headsOf = () => page.locator('#content .row-head h2').allTextContents();
  let heads = await headsOf();
  ok('딜러 탭: 티어표가 위, 딜러가 아래', /티어표/.test(heads[0]) && /딜러/.test(heads[heads.length - 1]), heads.join(' → '));

  // 타입을 고르면 두 표가 **같은 타입의 서로 다른 각도**를 말한다 —
  // 위는 그 타입 맥스무브를 쓰는 개체, 아래는 그 타입 보스를 상대할 개체다.
  // 머리글이 그 차이를 글자로 말하지 않으면 같은 것의 두 벌로 읽힌다
  await page.evaluate(() => { state.maxBoss = 'psychic'; render(); });
  await page.waitForTimeout(500);
  heads = await headsOf();
  ok('타입 고르면 위는 "맥스무브 티어표"', /에스퍼.*맥스무브.*티어표/.test(heads[0]), heads[0] || '(없음)');
  ok('타입 고르면 아래는 "보스 상대 딜러"', /에스퍼.*보스 상대.*딜러/.test(heads[heads.length - 1]), heads[heads.length - 1] || '(없음)');
  ok('두 머리글이 서로 다르다', heads[0] !== heads[heads.length - 1]);
  await page.evaluate(() => { state.maxBoss = 'overall'; state.maxAxis = 'all'; render(); });
  await page.waitForTimeout(300);

  // 11. 다크 모드에서도 토큰 한 벌
  const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  await dark.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/, (r) => r.abort());
  const dp = await dark.newPage();
  await dp.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await dp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  const dtok = await dp.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim(), accent: cs.getPropertyValue('--accent').trim() };
  });
  ok('다크 --bg (딥네이비 #0b0f15)', dtok.bg === '#0b0f15', dtok.bg);
  ok('다크 --accent (#22c55e)', dtok.accent === '#22c55e', dtok.accent);
  await dark.close();

  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200));
  for (const [s, n, e] of results) console.log(s, n, e || '');
  console.log(`${results.filter(r => r[0] === 'PASS').length}/${results.length} passed`);
  await browser.close();
  if (results.some(r => r[0] === 'FAIL')) process.exit(1);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
