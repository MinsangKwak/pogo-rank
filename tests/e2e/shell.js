'use strict';
// v2.26.0 앱 셸 회귀 — 스크롤 잠금 · PC 헤더 분리 · 드로어 중복 · 카드 보기 · 버튼 반응
// v2.28.0 PC 카드 뷰 — 랭킹·도감·레이드 보스·즐겨찾기가 넓은 화면에서 카드로 서는가 (모바일은 줄 그대로)
//
// 스크롤 잠금이 남는 버그는 재현 경로가 다양해서(브라우저가 dialog 를 직접 닫는 경우 등)
// "여는 방법 × 닫는 방법" 을 조합으로 훑는다. 하나라도 잠금이 남으면 그 화면은 영영 못 움직인다.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  for (const [w, h, label] of [[1440, 900, 'PC'], [390, 844, '모바일']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    ctx.setDefaultTimeout(6000);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    const wide = w >= 1100;  // 2026-09-09 v2.38.0 태블릿·PC 공통 임계값(1100px) — PC 는 1440px~ 이 더 넓을 뿐 갈래는 같다

    const go = async (hash = '') => {
      await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
      await page.locator('#consent .consent__deny').click().catch(() => {});
      await page.waitForTimeout(350);
    };
    // 실제로 굴려 본다 — style 만 보면 다른 원인(가로 넘침·덮개)을 놓친다
    const canScroll = async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.mouse.move(w / 2, h / 2);
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(250);
      return page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollHeight <= de.clientHeight + 4 || window.scrollY > 4;   // 짧은 화면은 통과
      });
    };

    // ── 화면을 한 번씩만 돌면서 두 가지를 같이 본다: 실제로 굴러가는가 + 휠을 가로채는 요소가 있는가
    //   `overflow-x: auto` 만 적으면 CSS 규칙상 세로도 auto 가 되어 스크롤 컨테이너가 된다.
    //   거기에 1px 이라도 세로 넘침이 있으면 커서가 그 위에 있는 동안 휠이 페이지로 가지 않는다
    //   (v2.26.0 탭 줄에서 실제로 났던 버그 — PC 에서 탭 줄이 화면 한가운데 와 더 잘 걸렸다).
    const screens = ['', '#/dmax', '#/pve', '#/pvp', '#/dex', '#/types', '#/favs',
      '#/planner', '#/planner/collection', '#/schedule', '#/raids', '#/eggs', '#/release', '#/privacy', '#/terms'];
    const stuck = [];
    const traps = [];
    for (const hash of screens) {
      await go(hash);
      if (!(await canScroll())) stuck.push(hash || '(홈)');
      const found = await page.evaluate(() => {
        const bad = [];
        for (const node of document.querySelectorAll('*')) {
          const style = getComputedStyle(node);
          if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
          const over = node.scrollHeight - node.clientHeight;
          // 일부러 세로로 긴 상자(팝업 본문·드로어·사이드바)는 제외 — 넘침이 아주 작은 것만 덫이다
          if (over <= 0 || over > 24) continue;
          bad.push(`${node.tagName}${node.id ? '#' + node.id : ''}.${String(node.className).split(' ')[0]}(+${over}px)`);
        }
        return bad;
      });
      if (found.length) traps.push(`${hash || '(홈)'}: ${found.join(' ')}`);
    }
    ok(`${label} 모든 화면 스크롤 가능`, stuck.length === 0, stuck.join(' '));
    ok(`${label} 휠을 가로채는 요소 없음`, traps.length === 0, traps.join(' | ').slice(0, 220));

    // ── 오버레이를 열고 여러 방법으로 빠져나와도 잠금이 남지 않는가
    const lockLeft = async () => page.evaluate(() => document.body.style.overflow === 'hidden' && !document.querySelector('dialog[open]'));
    const opens = [
      ['검색', async () => page.click('#search-toggle')],
      ['드로어', async () => page.click('#menu-toggle')],
      ['상세', async () => page.locator('#content .row, #page .dex__row').first().click()],
    ];
    const closes = [
      ['Esc', async () => page.keyboard.press('Escape')],
      ['뒤로가기', async () => page.goBack()],
      ['해시 이동', async () => page.evaluate(() => navigateHash('#/dex'))],
    ];
    const leaks = [];
    for (const [openName, open] of opens) {
      for (const [closeName, close] of closes) {
        await go('#/pve');
        await open().catch(() => {});
        await page.waitForTimeout(400);
        await close().catch(() => {});
        await page.waitForTimeout(500);
        if (await lockLeft()) leaks.push(`${openName}→${closeName}`);
      }
    }
    ok(`${label} 오버레이 9가지 여닫기 후 잠금 없음`, leaks.length === 0, leaks.join(' '));

    // ── 잠금이 남더라도 다음 화면 이동에서 저절로 풀리는가 (자가 복구)
    await go('#/dex');
    await page.evaluate(() => { document.body.style.overflow = 'hidden'; });
    await page.evaluate(() => navigateHash('#/types'));
    await page.waitForTimeout(400);
    ok(`${label} 잠금이 남아도 이동하면 풀린다`, (await page.evaluate(() => document.body.style.overflow)) === '');

    // ── 헤더 배치
    await go('#/pve');
    const bar = await page.locator('#app-title').textContent();
    const headVisible = await page.locator('#page-head').isVisible();
    // v2.30.0 좁은 화면도 같은 규칙 — 상단 바는 로고, 화면 이름은 본문 헤더
    ok(`${label} 상단 바는 로고`, bar === 'POGO PLAN', bar);
    ok(`${label} 화면 헤더 보임`, headVisible && (await page.locator('#page-head h2').textContent()) === '레이드 · PvE');
    const headTop = (await page.locator('#page-head').boundingBox()).y;
    const contentTop = (await page.locator('#content').boundingBox()).y;
    ok(`${label} 헤더가 컨텐츠보다 위`, headTop < contentTop, `${Math.round(headTop)} < ${Math.round(contentTop)}`);
    // 2026-09-09 v2.37.0 PC 는 사이드바가 늘 있어 ← 뒤로가기가 필요 없다 — 그래서 숨긴다. 좁은 화면은 그대로 있다
    if (wide) ok('PC 뒤로가기 버튼 숨김 (사이드바로 충분)', !(await page.locator('.app-bar__head .icon-btn').isVisible()));
    else ok('모바일 뒤로가기 버튼 유지', await page.locator('.app-bar__head .icon-btn').isVisible());
    // 로고를 누르면 서비스 홈
    await page.click('#app-logo');
    await page.waitForTimeout(500);
    ok(`${label} 로고 → 서비스 홈`, (await page.evaluate(() => location.hash)) === '' && (await page.evaluate(() => document.body.dataset.route)) === 'home');

    // ── 드로어 중복
    await page.click('#menu-toggle');
    await page.waitForTimeout(500);
    // 드로어에 사이드바·이동 목록과 겹치는 항목이 남아 있지 않은가.
    // 일정표 아코디언은 v2.21.0 app-shell.js 가 이미 감춘다(이동 목록의 "이벤트 일정"과 같은 곳).
    const scheduleInDrawer = await page.locator('#drawer-backdrop details:has(#schedule-body)').isVisible();
    ok(`${label} 드로어에 일정표 중복 없음`, !scheduleInDrawer);
    // 좁은 화면에서는 이동 목록 자체가 드로어 안에 있으므로(설계) PC 에서만 본다
    // 2026-09-09 v2.40.0 아이콘이 라벨 글자에서 span 으로 떨어져 나왔다 — 이름만 꺼내 비교한다
    // (예전처럼 textContent 를 통째로 쓰면 "🏠서비스 홈" 과 "서비스 홈" 이 서로 달라 중복을 놓친다)
    const dup = await page.evaluate(() => {
      const nameOf = (node) => (node.querySelector('.drawer__label') || node).textContent.replace(/^[^가-힣A-Za-z]+/, '').trim();
      const nav = new Set([...document.querySelectorAll('.nav-menu a')].map(nameOf));
      return [...document.querySelectorAll('#drawer-backdrop .drawer__item')]
        .filter((n) => !n.closest('.nav-menu'))
        .map(nameOf)
        .filter((t) => nav.has(t));
    });
    if (wide) ok('PC 드로어와 사이드바에 같은 항목 없음', dup.length === 0, dup.join(' '));
    // 2026-09-09 v2.37.0 PC 는 ☰ 메뉴에 마이페이지·기준 안내·트레이너 코드만 남고,
    // 패치노트·QA 제보·약관·통계 설정 등은 사이드바(알 부화 아래, .app-nav__extra)로 옮긴다.
    // 좁은 화면은 전부 그대로 드로어 안에 있다(회귀 없음)
    if (wide) {
      ok('PC 사이드바에 보조 항목 구역 있음', await page.locator('.app-nav .app-nav__extra').count() === 1);
      ok('PC 사이드바 보조 항목에 패치노트', await page.locator('.app-nav__extra #menu-release').isVisible());
      ok('PC 드로어엔 패치노트 등이 없음', (await page.locator('#drawer-backdrop #menu-release').count()) === 0);
      const drawerKids = await page.evaluate(() =>
        [...document.querySelectorAll('#drawer-backdrop .drawer__panel > *')].map((n) => n.id).filter(Boolean));
      ok('PC 드로어에 잡다한 항목 없음(마이페이지·기준안내·트레이너코드만)', !drawerKids.includes('drawer-extra'), drawerKids.join(' '));
    } else {
      ok('모바일 드로어에 패치노트 그대로', await page.locator('#drawer-backdrop #menu-release').count() === 1);
      ok('모바일은 사이드바 보조 구역 없음(사이드바 자체가 없다)', (await page.locator('.app-nav__extra').count()) === 0);
      // 2026-09-09 v2.40.0 좁은 화면 ☰ 메뉴는 세 덩이 — 마이페이지(계정) · 서비스(이동) · 정보(그 밖)
      const secs = await page.locator('#drawer-backdrop .drawer__sec').allTextContents();
      ok('모바일 메뉴에 서비스·정보 구역 제목', secs.some((t) => t.includes('서비스')) && secs.some((t) => t.includes('정보')), secs.join(' / '));
      ok('정보 항목이 카드 한 장으로 묶임', (await page.locator('#drawer-backdrop .drawer__group #menu-release').count()) === 1);
      ok('계정 카드가 이동 목록보다 위', await page.evaluate(() => {
        const account = document.getElementById('account');
        const nav = document.querySelector('#drawer-backdrop .nav-menu');
        return !!(account && nav) && (account.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }));
    }
    // 항목 한 줄 = 아이콘 + 이름 (아이콘은 서비스 홈 타일과 같은 그림 — router.js ROUTES 한 곳에서 온다)
    ok(`${label} 메뉴 항목에 아이콘 칸`, await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.nav-menu .drawer__item')];
      return rows.length > 0 && rows.every((n) => n.querySelector('.drawer__ico')?.textContent.trim() && n.querySelector('.drawer__label'));
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // ── 그리드 보기는 카드 (v2.29.2 라벨: 열 개수가 아니라 보기 방식)
    await go('#/dex');
    // 넓은 화면은 그리드가 기본, 좁은 화면은 리스트가 기본이다 — 그리드가 아니면 그리드 칸을 누른다
    // 2026-09-09 v2.40.0 .dex__layout 은 이제 두 칸짜리 세그먼트 컨트롤(묶음)이다 — 칸을 눌러야 한다
    const layoutBtn = page.locator('.dex__layout button').last();
    if (!(await page.locator('.dex__list.is-grid').count())) await layoutBtn.click().catch(() => {});
    await page.waitForTimeout(500);
    const card = await page.locator('.dex__list.is-grid .dex__row').first().evaluate((n) => {
      const s = getComputedStyle(n);
      return { dir: s.flexDirection, radius: s.borderRadius, border: s.borderTopWidth, w: Math.round(n.getBoundingClientRect().width) };
    }).catch(() => null);
    ok(`${label} 그리드는 카드`, !!card && card.dir === 'column' && parseFloat(card.radius) >= 8 && parseFloat(card.border) >= 1, JSON.stringify(card));
    const spriteSize = await page.locator('.dex__list.is-grid .sprite').first().evaluate((n) => Math.round(n.getBoundingClientRect().width)).catch(() => 0);
    ok(`${label} 카드 그림이 크다 (리스트보다)`, spriteSize >= 56, `${spriteSize}px`);

    // ── v2.28.0 PC 카드 뷰 — 랭킹 목록도 카드인가 (모바일은 줄 그대로여야 한다)
    for (const hash of ['#/dmax', '#/pve', '#/pvp']) {
      await go(hash);
      const shape = await page.locator('#content .row').first().evaluate((n) => {
        const s = getComputedStyle(n);
        const list = getComputedStyle(n.parentElement);
        return { dir: s.flexDirection, display: s.display, radius: parseFloat(s.borderRadius),
                 border: parseFloat(s.borderTopWidth), cols: list.gridTemplateColumns.split(' ').length };
      });
      if (wide) {
        ok(`PC ${hash} 랭킹이 카드`, shape.display === 'flex' && shape.dir === 'column' && shape.radius >= 8 && shape.border >= 1, JSON.stringify(shape));
        ok(`PC ${hash} 여러 열로 놓임`, shape.cols >= 2, String(shape.cols));
      } else {
        ok(`모바일 ${hash} 랭킹은 줄 (기존 유지)`, shape.display === 'grid' && shape.radius < 1, JSON.stringify(shape));
      }
    }
    // 도감·레이드 보스·즐겨찾기는 PC 에서 카드가 기본 (wideCards, dom.js)
    for (const hash of ['#/dex', '#/raids', '#/favs']) {
      // 앞 검사에서 보기 방식 토글을 눌러 저장된 선택이 남아 있다 — 기본값을 보려면 지우고 들어간다
      await page.evaluate(() => { try { localStorage.removeItem('pogo_dex_cols'); } catch { /* 저장 불가 환경 */ } });
      await go(hash);
      const grid = await page.locator('#page .dex__list').first().evaluate((n) => n.classList.contains('is-grid'));
      ok(`${label} ${hash} 카드 기본값`, grid === wide, String(grid));
    }

    // ── 버튼 반응: 가리켜도 자리가 움직이지 않아야 한다
    const btn = page.locator('#menu-toggle');
    const before = await btn.boundingBox();
    await btn.hover();
    await page.waitForTimeout(300);
    const after = await btn.boundingBox();
    ok(`${label} hover 로 버튼이 이동하지 않음`, Math.abs(before.x - after.x) < 0.5 && Math.abs(before.y - after.y) < 0.5);
    const hasTransition = await btn.evaluate((n) => getComputedStyle(n).transitionDuration !== '0s');
    ok(`${label} 버튼에 전환 효과 있음`, hasTransition);

    ok(`${label} 페이지 오류 없음`, errs.length === 0, errs.join(' | ').slice(0, 160));
    await ctx.close();
  }

  // ── v2.40.1 폭을 오가도 메뉴 항목이 사라지지 않는가 (창 크기 조절 · 태블릿 회전 · 폴더블)
  // 좁은 화면에서 정보 카드에 담아 둔 아코디언을, 넓은 화면으로 돌아갈 때 카드째 들어내면서
  // 함께 잃어버리던 버그가 있었다 — 첫 로딩만으로는 안 드러나고 왕복해야 나온다
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(BASE + '#/dex', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click().catch(() => {});
    await page.waitForTimeout(500);
    const menuState = () => page.evaluate(() => ({
      note: !!document.querySelector('.drawer__panel #note-acc'),
      trainer: !!document.querySelector('.drawer__panel #trainer-acc'),
      nav: document.querySelectorAll('.nav-menu .drawer__item').length,
      navMenus: document.querySelectorAll('.nav-menu').length,
      extras: document.querySelectorAll('#drawer-extra').length,
    }));
    for (const [w, wLabel] of [[390, '모바일'], [1440, 'PC 복귀'], [390, '모바일 재방문'], [1440, 'PC 재복귀']]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(450);
      const s = await menuState();
      ok(`폭 왕복 ${wLabel}(${w}) 기준 안내·트레이너 코드 유지`, s.note && s.trainer, JSON.stringify(s));
      ok(`폭 왕복 ${wLabel}(${w}) 이동 목록 11개·한 벌`, s.nav === 11 && s.navMenus === 1, JSON.stringify(s));
      ok(`폭 왕복 ${wLabel}(${w}) #drawer-extra 한 벌(복제 아님)`, s.extras === 1, JSON.stringify(s));
    }
    ok('폭 왕복 중 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 160));
    await ctx.close();
  }

  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
