'use strict';
// v2.22.0 디자인 통일 검증 — 토큰·글꼴 복구 · 탭 줄 · 헤더 아이콘 · 팝업/검색 시트 · 홈
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/';
const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // 2026-09-11 v2.57.0 바깥 주소(웹폰트·Firebase)를 끊는다. 이 방(샌드박스)에는 바깥이 없어서
  // 그 요청들이 타임아웃까지 매달리고, 그동안 첫 렌더가 끝나지 않는다 — 실측 한 번 여는 데 13.7초.
  // 끊으면 1.2초다(11.5배). 앱은 바깥 것 없이도 돌게 만들어 뒀으니(대체 글꼴·?mock) 검사 내용은 그대로다.
  // 다른 스위트 열넷은 이미 이렇게 하고 있었다 — 빠진 곳만 맞춘다
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await ctx.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const settle = async () => {
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { try { localStorage.setItem('pogo_consent', 'denied'); } catch {} });
    // 2026-09-11 v2.57.0 선택자가 `.consent-deny` 였다 — 실제 클래스는 `.consent__deny` 다(BEM).
    // 맞는 게 없으니 click() 이 **기본 30초** 를 꽉 기다렸고, .catch() 가 그걸 조용히 삼켰다.
    // settle() 을 여덟 번 부르므로 이 스위트 혼자 240초를 거기에 썼다 (실측 253초 중).
    // 없어도 되는 클릭에는 짧은 한도를 둔다 — 선택자가 또 어긋나도 30초가 아니라 1.5초만 잃는다
    await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
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
  // v3.0.0 바탕과 카드가 뒤집혔다 — 꺼진 바탕(#fafafa) 위에 흰 카드가 뜬다
  ok('토큰 --surface (흰 카드 #ffffff)', design.surface === '#ffffff', design.surface);
  ok('토큰 --line (#e5e5eb)', design.line === '#e5e5eb', design.line);
  ok('토큰 --muted (보라 기 도는 회색 #64647a)', design.muted === '#64647a', design.muted);
  // 2026-09-12 v3.0.0 스타일 레퍼런스(yceffort.kr)의 인디고로 갈아끼웠다.
  // 초록은 --t-grass(풀 타입)로만 남는다 — 브랜드색과 타입색이 같아 생기던 혼동도 같이 사라졌다
  ok('토큰 --accent = 브랜드 인디고 (#6366f1)', design.accent === '#6366f1', design.accent);
  ok('의미 색 여섯 벌 있음', ['brand', 'brand-2', 'point', 'warn', 'caution', 'off'].every((k) => design[k]),
    JSON.stringify({ brand: design.brand, warn: design.warn }));
  ok('토큰 --tap 이 손가락 크기 44px', design.tapPx === 44, `${design.tap} = ${design.tapPx}px`);
  // 2026-09-12 v3.6.0 Inter → 갈무리(Galmuri11). 한글까지 한 글꼴이 그리고, Pretendard 는 뒤로 물러나
  // 긴 산문(약관·안내문·패치노트)에서만 쓰인다 (styles/base.css)
  ok('본문 글꼴 Galmuri11 우선 · Pretendard 로 폴백', /^"?Galmuri11/.test(design.font) && /Pretendard/.test(design.font), design.font.slice(0, 48));
  // 도트 글꼴은 설계 격자의 정수배에서만 또렷하다 — Galmuri11 은 11 · 14 · 22px 이라 14px 로 내렸다
  ok('본문 14px (도트 격자)', design.size === '14px', design.size);

  // 2. 서비스 홈 — 타일 · 이모지 아이콘 · 탭 줄 숨김
  // 2026-09-10 v2.47.0 '내 포켓몬' 타일과 '육성 플래너' 타일을 하나로 합쳐 10 → 9 가 됐다
  // 2026-09-11 v2.58.0 🔎 검색식 만들기가 늘어 10 이다. ☰ 메뉴와 홈 타일은 **같은 수**여야 한다 —
  // 같은 화면인데 문이 한쪽에만 있으면 메뉴를 안 여는 사람은 그 화면이 있는 줄도 모른다
  ok('홈 타일 9개', (await page.locator('.home__tile').count()) === 9);
  // 2026-09-12 v3.6.0 이모지 → 도트 아이콘 SVG (scripts/components/pxicon.js).
  // 아홉 타일 전부 도트 그림이어야 한다 — 하나라도 이모지로 남으면 그 줄만 기기 글꼴로 그려진다
  const pxIcons = await page.locator('.home__icon svg.pxi').count();
  ok('홈 아이콘이 도트 그림 9개', pxIcons === 9, String(pxIcons));
  ok('홈에서 탭 줄 숨김', await page.locator('#tabs').isHidden());
  const tile = await page.locator('.home__tile').first().evaluate((n) => {
    const s = getComputedStyle(n);
    return { r: s.borderRadius, bg: s.backgroundColor, bw: s.borderTopWidth };
  });
  // 2026-09-12 v3.6.0 도트 디자인 — 모서리 0 · 테두리 2px (styles/pixel.css)
  ok('타일 모서리 0 · 2px 테두리', tile.r === '0px' && tile.bw === '2px', JSON.stringify(tile));
  ok('홈에서 뒤로가기 버튼 숨김', await page.locator('.app-bar__head .icon-btn').isHidden());

  // 3. 헤더 버튼이 이모지 아이콘 · 44px 정사각 통일
  // 2026-09-10 v2.47.0 화면 테마 버튼이 늘었다. 좁은 화면에서는 CSS 가 감추므로(로고가 잘려서)
  // **보이는 것만** 센다 — hidden 속성이 아니라 실제 크기로 걸러야 그 규칙까지 함께 지킨다
  const btns = await page.locator('.app-bar .app-bar__actions .icon-btn').evaluateAll((ns) =>
    ns.filter((n) => !n.hidden && n.getBoundingClientRect().width > 0)
      .map(n => ({ t: n.textContent.trim(), svg: !!n.querySelector('svg.pxi'), w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height })));
  // v2.29.0 계정(👤)을 빼고 그 자리에 KR/EN 토글 — 로그인·마이페이지는 ☰ 메뉴 한 곳으로 모았다
  const wide = page.viewportSize().width >= 1100;
  // 2026-09-12 v3.4.0 ★ 즐겨찾기 버튼을 뺐다 — 기능을 통째로 걷어냈다 (components/favs.js 머리말).
  // 넓은 화면은 🔍 도 감춘다(옆 검색바가 같은 일을 한다, v2.66.0)
  // 2026-09-12 v3.6.0 아이콘 버튼 둘은 도트 그림(svg.pxi)이라 글자가 없다 — 가운데 EN 만 글자다
  ok(`헤더 아이콘 3개 (${wide ? '🌗' : '🔍'} EN ☰)`,
    btns.length === 3 && btns.map(b => b.t).join('') === 'EN' && btns[0].svg && btns[2].svg,
    JSON.stringify(btns.map(b => (b.svg ? 'svg' : b.t))));
  ok('헤더 버튼 44×44 통일', btns.every(b => Math.round(b.w) === 44 && Math.round(b.h) === 44), JSON.stringify(btns));
  ok('헤더에 텍스트 버튼 없음', !(await page.locator('.app-bar').textContent()).includes('메뉴'));

  // 4. 탭 줄 복구 — 홈 타일 → D-MAX → 탭으로 PvE → PvP
  await page.click('.home__tile:has-text("D-MAX")');
  await page.waitForFunction(() => location.hash === '#/dmax', null, { timeout: 5000 });
  await page.waitForTimeout(300);
  // 2026-09-11 v2.61.0 랭킹 탭 줄과 바로가기(📕 🧭 ★)를 걷어냈다 — 왼쪽 메뉴가 늘 펼쳐져 있어
  // 같은 곳으로 가는 길이 화면에 두 벌이었다. 이동은 메뉴와 주소가 맡는다
  ok('랭킹 화면에 탭 줄이 없다', await page.locator('#tabs').isHidden());
  ok('바로가기도 없다', (await page.locator('#tabs .tabs__item--quick').count()) === 0);
  // v2.30.0 상단 바는 늘 로고, 화면 이름은 본문 헤더로 (좁은 화면도 PC 와 같은 규칙)
  ok('상단 바는 로고', (await page.locator('#app-title').textContent()).trim() === 'POGO PLAN');
  ok('화면 헤더 = D-MAX', (await page.locator('#page-head h2').textContent()) === 'D-MAX');
  // 메뉴로 옮겨 다닌다 (탭 줄이 하던 일). 좁은 화면은 메뉴가 드로어 안이라 먼저 연다
  if (!wide) { await page.click('#menu-toggle'); await page.waitForTimeout(350); }
  await page.click('.nav-menu a:has-text("레이드 · PvE")');
  await page.waitForFunction(() => location.hash === '#/pve', null, { timeout: 5000 });
  await page.waitForTimeout(400);
  ok('메뉴로 PvE 이동 (주소·제목 동기화)', (await page.locator('#page-head h2').textContent()) === '레이드 · PvE');
  ok('메뉴에서 현재 위치 표시', (await page.locator('.nav-menu [aria-current="page"] .drawer__label').first().textContent()) === '레이드 · PvE');
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
  // 2026-09-12 v3.6.0 도트 디자인 — 곡선을 없앴다 (styles/pixel.css)
  ok('상세 모서리 각진 카드', modal.radius === '0px', modal.radius);
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
  ok('검색 카드 배경 = --surface', sheet.bg === 'rgb(255, 255, 255)', sheet.bg);
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
  ok('현재 항목 = --accent (브랜드 인디고)', cur === 'rgb(99, 102, 241)', cur);
  ok('드로어 서비스 홈 항목', (await page.locator('.nav-menu a .drawer__label').first().textContent()) === '서비스 홈');
  await page.click('.nav-menu a:has-text("서비스 홈")');
  await page.waitForTimeout(400);
  ok('서비스 홈으로 이동', (await page.locator('.home__tile').count()) === 9 && !(await page.evaluate(() => location.hash)));

  // 8. 2026-09-12 v2.66.0 마지막 탭 줄(플래너)도 걷어냈다 — 이동은 왼쪽 메뉴 하나가 맡는다.
  // 주소와 화면 이름은 그대로 산다
  await page.goto(BASE + '?mock=1#/planner/collection', { waitUntil: 'domcontentloaded' });
  await settle();
  ok('화면 안 탭 줄이 없다', (await page.locator('#tabs .tabs__item').count()) === 0);
  ok('내 포켓몬 화면 이름', (await page.locator('#page-head h2').textContent()) === '내 포켓몬');
  ok('브레드크럼에 부모(육성 플래너)', (await page.locator('.page-head__crumb-up').textContent()) === '육성 플래너');

  // 8b. 2026-09-12 v2.63.0 타입 & 상성 화면을 접었다 — 상세 팝업이 같은 표를 이미 보여 준다.
  //     공유된 옛 주소(#/types?t=…)가 죽지 않고 도감으로 넘어가는지 본다
  await page.goto(BASE + '?mock=1#/types?t=water,dark', { waitUntil: 'domcontentloaded' });
  await settle();
  ok('옛 상성 주소는 도감으로', (await page.evaluate(() => document.body.dataset.route)) === 'dex',
    await page.evaluate(() => location.hash));
  ok('메뉴에 타입 & 상성이 없다', !(await page.locator('.nav-menu .drawer__label').allTextContents()).includes('타입 & 상성'));

  // 8c. 2026-09-12 v2.66.0 도구는 각자 주소를 가진다 — 버튼을 누르는 일이 곧 화면 이동이라
  // 뒤로가기로 랭킹에 돌아오고, 링크를 보내면 상대도 같은 도구를 본다.
  // 개체값 순위는 리그에 딸린 정보라 왼쪽, 덱 짜기는 리그와 상관없는 다른 일이라 오른쪽
  await page.goto(BASE + '?mock=1#/pvp', { waitUntil: 'domcontentloaded' });
  await settle();
  const pvpTools = await page.locator('.controls__row .tool-btn').allTextContents();
  ok('개체값 순위가 앞, 덱 짜기가 뒤', pvpTools.join('|') === '🧬 개체값 순위|🃏 덱 짜기', pvpTools.join('|'));
  // 2026-09-12 v2.67.0 오른쪽 덩이(.controls__rest)가 줄의 마지막이고 margin-left:auto 로 밀린다.
  // 좁은 화면(이 검사는 390px)에서는 줄이 접혀 자리가 달라지므로 기하가 아니라 구조로 확인한다
  ok('도구는 줄의 오른쪽 덩이에 있다', await page.evaluate(() => {
    const row = document.querySelector('.controls__row--tools');
    const rest = row && row.querySelector(':scope > .controls__rest');
    if (!rest || row.lastElementChild !== rest) return false;
    // margin-left:auto 는 computed 로 읽으면 px 로 풀리므로, 실제로 오른쪽 끝에 붙었는지로 본다
    return Math.abs(rest.getBoundingClientRect().right - row.getBoundingClientRect().right) < 2;
  }));
  await page.click('.tool-btn:has-text("개체값 순위")');
  await settle();
  ok('주소가 바뀐다', (await page.evaluate(() => location.hash)) === '#/pvp/ivrank', await page.evaluate(() => location.hash));
  ok('개체값 순위 화면이 열린다', (await page.locator('.ivrank__pick').count()) === 1);
  ok('눌린 표시', (await page.locator('.tool-btn[aria-pressed="true"]').textContent()) === '🧬 개체값 순위');
  await page.goBack();
  await settle();
  ok('뒤로가기로 랭킹 복귀', (await page.evaluate(() => location.hash)) === '#/pvp' && (await page.locator('.ivrank__pick').count()) === 0);
  // 솔플 계산기도 같은 규칙 — 계산기 화면에는 아무 일도 안 하던 [일반|전체] 세그먼트를 그리지 않는다
  await page.goto(BASE + '?mock=1#/pve/solo', { waitUntil: 'domcontentloaded' });
  await settle();
  ok('솔플 계산기 화면 이름', (await page.locator('#page-head h2').textContent()) === '솔플 계산기');
  ok('일반·전체 세그먼트는 없다', !(await page.locator('#controls .seg button').allTextContents()).includes('일반'));

  // 8d. 2026-09-12 v2.64.0 이동 목록이 두 덩이로 읽히는가 (주요 기능 · 부가 기능)
  {
    // 2026-09-12 v2.65.0 덩이 이름을 '주요/부가' 에서 **하려는 일** 로 바꿨다
    const secs = await page.locator('.nav-menu__sec').allTextContents();
    ok('메뉴가 세 덩이', secs.join('|') === '지금 뭐 하지|뭘 데려갈까|뭘 키울까', secs.join('|'));
    const groups = await page.evaluate(() => {
      const out = {};
      let key = null;
      for (const n of document.querySelector('.nav-menu').children) {
        if (n.classList.contains('nav-menu__sec')) { key = n.textContent; out[key] = []; continue; }
        if (key) out[key].push(n.querySelector('.drawer__label')?.textContent || '');
      }
      return out;
    });
    ok('지금 뭐 하지 = 시간에 매인 것', groups['지금 뭐 하지'].join('|') === '이벤트 일정|레이드 보스|알 부화', groups['지금 뭐 하지'].join('|'));
    ok('뭘 데려갈까 = 고르려고 보는 것', groups['뭘 데려갈까'].join('|') === '포켓몬 도감|D-MAX|레이드 · PvE|배틀 · PvP', groups['뭘 데려갈까'].join('|'));
    // v2.66.0 덩이 이름을 '뭘 키울까' 로 바꿨다 — 같은 이름의 화면(내 포켓몬)이 그 안에 생겨
    // 덩이 제목과 항목이 똑같은 글자가 됐다. 내 포켓몬은 육성 플래너 아래 한 칸 들여쓴 자식이다
    ok('뭘 키울까 = 내 박스', groups['뭘 키울까'].join('|') === '육성 플래너|내 포켓몬|검색식 만들기', groups['뭘 키울까'].join('|'));
    ok('내 포켓몬은 육성 플래너의 자식', (await page.locator('.nav-menu .drawer__item--sub').allTextContents()).join('|').includes('내 포켓몬'),
      (await page.locator('.nav-menu .drawer__item--sub').allTextContents()).join('|'));
  }

  // 8e. 배틀 PvP 의 컨트롤 — 2026-09-12 v3.2.0 리그 세그먼트가 화면 머리 오른쪽으로 올라갔다
  // (D-MAX 의 [전체|딜러|탱커]와 같은 자리). 리그는 목록을 거르는 값이 아니라 이 화면이 어느
  // 리그를 말하는가 자체라, 필터 줄이 아니라 제목과 같은 높이다. 본문에는 도구 줄과 타입 필터만 남는다
  {
    await page.goto(BASE + '?mock=1#/pvp', { waitUntil: 'domcontentloaded' });
    await settle();
    const order = await page.evaluate(() => [...document.querySelectorAll('#controls > *')].map((n) =>
      n.querySelector('.tool-btn') ? '도구' : '타입'));
    ok('본문 컨트롤은 도구 → 타입 두 줄', order.join(' → ') === '도구 → 타입', order.join(' → '));
    const headSeg = (await page.locator('#page-head-actions .seg button').allTextContents()).join('|');
    ok('리그 세그먼트가 화면 머리에', headSeg === '리틀|슈퍼|하이퍼|마스터', headSeg);
    ok('본문에 남은 리그 줄이 없다', (await page.locator('#controls .seg').count()) === 0);
  }

  // 8f. 2026-09-12 v3.4.0 ★ 즐겨찾기를 통째로 걷어냈다 — 담을 수는 있는데 담은 뒤에 할 수 있는
  // 일이 없었다(그 일은 육성 플래너가 한다). 조각이 하나도 남지 않았는지 센다.
  // 계정에 담아 둔 목록(AUTH.favs)은 건드리지 않았다 — 다시 만들 때 그대로 살아 있어야 한다
  {
    await page.goto(BASE + '?mock=1#/dex', { waitUntil: 'domcontentloaded' });
    await settle();
    const favBits = await page.evaluate(() => ({
      headerButton: !!document.getElementById('fav-toggle'),
      digestCard: !!document.getElementById('fav-digest'),
      popup: document.querySelectorAll('.fav-pop').length,
      stars: document.querySelectorAll('.dex__fav, .detail__fav, .fav').length,
      menuRow: [...document.querySelectorAll('.nav-menu .drawer__label')].some((n) => n.textContent.includes('즐겨찾기')),
      favsRoute: typeof ROUTES !== 'undefined' && ROUTES.some((r) => r.id === 'favs'),
      dataKept: typeof AUTH !== 'undefined' && AUTH.favs instanceof Set,
    }));
    ok('헤더 ★ 버튼이 없다', !favBits.headerButton, JSON.stringify(favBits));
    ok('본문 즐겨찾기 카드·팝업이 없다', !favBits.digestCard && favBits.popup === 0, JSON.stringify(favBits));
    ok('목록·상세에 ★ 가 없다', favBits.stars === 0, JSON.stringify(favBits));
    ok('메뉴에 즐겨찾기 줄이 없다', !favBits.menuRow, JSON.stringify(favBits));
    ok('라우트 표에서도 빠졌다', !favBits.favsRoute, JSON.stringify(favBits));
    ok('계정에 담아 둔 목록은 그대로 (AUTH.favs)', favBits.dataKept, JSON.stringify(favBits));
  }

  // 8g. 2026-09-12 v2.64.0 화면마다 제목과 부제가 있는가 — 제목만 있으면 "여기가 어디인지" 는
  //     알아도 "여기서 무엇을 하는지" 는 모른다. 좁은 화면에서도 보인다(전에는 CSS 가 감췄다)
  for (const hash of ['#/dex', '#/dmax', '#/pve', '#/pvp', '#/schedule', '#/raids', '#/eggs',
    '#/finder', '#/ivrank', '#/release', '#/changes', '#/privacy', '#/terms']) {
    await page.goto(BASE + '?mock=1' + hash, { waitUntil: 'domcontentloaded' });
    await settle();
    const head = await page.evaluate(() => {
      const box = document.getElementById('page-head');
      const desc = document.querySelector('.page-head__desc');
      return {
        title: box && !box.hidden ? (box.querySelector('h2')?.textContent || '').trim() : '',
        desc: desc && !desc.hidden && desc.offsetHeight > 0 ? desc.textContent.trim() : '',
      };
    });
    ok(`${hash} 제목·부제`, head.title.length > 0 && head.desc.length > 0, JSON.stringify(head));
    // 2026-09-12 v2.65.0 머리와 본문 사이에 선이 있는가 — 여백만으로는 위계가 서지 않았다.
    // v2.66.0 선은 **필터 줄 아래**로 내려간다: 제목 · 부제 · 필터가 한 덩이(화면 머리)고 그 아래가 결과다.
    // 필터가 없는 화면만 머리 자체에 긋는다. 어느 쪽이든 "한 화면에 선은 정확히 하나" 여야 한다
    const ruled = await page.evaluate(() => {
      const found = [];
      const head = document.getElementById('page-head');
      if (head && !head.hidden && getComputedStyle(head).backgroundImage !== 'none') found.push('head');
      const controls = document.querySelector('.layout:not([hidden]) #controls');
      if (controls && controls.childElementCount && parseFloat(getComputedStyle(controls).borderBottomWidth) > 0) found.push('controls');
      for (const row of document.querySelectorAll('#page:not([hidden]) .page__filters')) {
        if (parseFloat(getComputedStyle(row).borderBottomWidth) > 0) found.push('filters');
      }
      return found.join('+');
    });
    ok(`${hash} 머리·본문 구분선 하나`, ruled.split('+').filter(Boolean).length === 1, ruled || '없음');
  }

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
  ok('본문 14px 유지 (rem 으로 옮겨도 같은 크기)', base.body === 14, String(base.body));
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
  await dark.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await dark.route(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr/, (r) => r.abort());
  const dp = await dark.newPage();
  await dp.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await dp.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  const dtok = await dp.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim(), accent: cs.getPropertyValue('--accent').trim() };
  });
  ok('다크 --bg (잉크블랙 #0a0a0f)', dtok.bg === '#0a0a0f', dtok.bg);
  ok('다크 --accent (#818cf8)', dtok.accent === '#818cf8', dtok.accent);
  await dark.close();

  ok('페이지 오류 없음', errors.length === 0, errors.join(' | ').slice(0, 200));
  for (const [s, n, e] of results) console.log(s, n, e || '');
  console.log(`${results.filter(r => r[0] === 'PASS').length}/${results.length} passed`);
  await browser.close();
  if (results.some(r => r[0] === 'FAIL')) process.exit(1);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
