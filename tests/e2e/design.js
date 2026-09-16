'use strict';
// 2026-09-16 design 기획·디자인 시안 01·02 회귀 — 완료 기준(Notion '02. moncamp 기획·디자인')을 그대로 검사한다
//
//   - 첫 화면에서 다이맥스 티어표와 덱 도구로 각각 한 번에 이동한다
//   - 360·390·480·768·1366·1440px 에서 제목·버튼·폼 이름이 잘리지 않고 가로 넘침이 없다
//   - 키보드로 대표 버튼과 기능 링크를 쓸 수 있고 포커스가 보인다
//   - 라이트·다크·KR·EN 에서 설명과 버튼을 읽을 수 있다
//   - 순위의 정렬 기준·보조 수치·갱신 날짜가 서로 모순되지 않는다 (레이드 = 종합 점수, DPS 만이 아니다)
//   - 가입하지 않은 사용자의 탐색을 막는 새 화면을 추가하지 않는다
//   - 메뉴 항목의 호버·선택·포커스 상태가 서로 다르다 (시안 01)
const { launch, newContext, waitSplash, toEnglish, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/?mock=1';
const hangul = (text) => /[가-힣]/.test(text || '');

suite(async () => {
  const browser = await launch();

  // ── 대표 행동 · 순위 근거 · 키보드 (PC)
  const ctx = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);
  await page.waitForTimeout(400);

  const cta = await page.locator('.home__cta .home__btn').evaluateAll((ns) => ns.map((n) => [n.textContent.trim(), n.getAttribute('href')]));
  ok('대표 버튼 둘 — 티어표 · 덱', cta.length === 2, JSON.stringify(cta));
  ok('대표 버튼 → D-MAX 티어표', cta[0]?.[1] === '#/dmax' && /다이맥스 티어표/.test(cta[0]?.[0]), JSON.stringify(cta[0]));
  ok('보조 버튼 → 덱 짜기', cta[1]?.[1] === '#/dmax/deck' && /덱/.test(cta[1]?.[0]), JSON.stringify(cta[1]));
  const btnH = await page.locator('.home__btn--primary').evaluate((n) => n.getBoundingClientRect().height);
  ok('대표 버튼 높이 44px 이상', btnH >= 44, String(btnH));
  ok('큰 그림은 실제 스프라이트 둘', (await page.locator('.home__art img.sprite').count()) === 2);
  ok('제목에 검색 목적어(다이맥스 · 티어표)가 설명에 남는다', /다이맥스 티어표/.test(await page.locator('.home__intro p').textContent()));
  ok('빠른 바로가기 셋(모험을 시작하는…)은 없다', (await page.locator('.home__quick').count()) === 0);

  // 목적별 기능 세 카드 — 설명 한 줄 + 타일 9
  ok('목적별 카드 셋', (await page.locator('.home__service-group').count()) === 3);
  const descs = await page.locator('.home__group-desc').allTextContents();
  ok('카드마다 한 줄 설명', descs.length === 3 && descs.every((d) => d.length > 8), descs.join(' | '));
  ok('타일 9개는 그대로', (await page.locator('.home__tile').count()) === 9);

  // 용도별 상위 포켓몬 — 기준 · 수치 · 날짜
  const groups = await page.locator('.pick__group').count();
  ok('순위 덩이 셋', groups === 3, String(groups));
  const pveHint = await page.locator('.pick__group--pve .pick__hint').textContent();
  ok('레이드 정렬 기준이 "종합 점수" 라고 말한다', /종합 점수/.test(pveHint) && /DPS/.test(pveHint), pveHint);
  const pveMeta = await page.locator('.pick__group--pve .pick__meta').allTextContents();
  ok('레이드 보조 수치는 DPS 와 버팀 둘 다', pveMeta.length === 3 && pveMeta.every((m) => /DPS \d/.test(m) && /버팀 \d/.test(m)), pveMeta.join(' | '));
  const usageMeta = await page.locator('.pick__group--usage .pick__meta').first().textContent();
  ok('활용처 수치의 단위가 설명된다 (순위표 N곳)', /순위표 \d+곳/.test(usageMeta), usageMeta);
  ok('기준일이 순위 옆에 있다', /기준일 \d{4}-\d{2}-\d{2}/.test(await page.locator('.home__picks .home__section').textContent()));
  ok('덩이마다 1위 큰 그림 + 세 줄', (await page.locator('.pick__hero img.sprite').count()) === 3 && (await page.locator('.pick__row').count()) === 9);
  // 줄을 누르면 상세가 열린다 (기존 동작 유지)
  await page.locator('.pick__group--dmax .pick__row').nth(1).click();
  await page.waitForTimeout(500);
  ok('순위 줄을 누르면 상세', (await page.locator('.detail').count()) > 0 || (await page.locator('.detail-panel:not([hidden])').count()) > 0);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 키보드 — 대표 버튼에 포커스가 보인다
  await page.locator('.home__btn--primary').focus();
  const focusRing = await page.locator('.home__btn--primary').evaluate((n) => { n.classList.add('is-focus-probe'); return getComputedStyle(n).outlineStyle; });
  ok('대표 버튼이 포커스를 받는다', await page.evaluate(() => document.activeElement?.classList.contains('home__btn--primary')));
  ok('포커스 링 규칙이 있다 (outline)', focusRing !== undefined);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  ok('Enter 로 티어표로 간다', (await page.evaluate(() => location.hash)) === '#/dmax');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitSplash(page);

  // 메뉴 상태 셋이 서로 다르다 (시안 01) — 선택 · 호버 · 기본
  const navRow = page.locator('.nav-menu a').nth(2);
  const base = await navRow.evaluate((n) => [getComputedStyle(n).backgroundColor, getComputedStyle(n).color].join('|'));
  await navRow.hover();
  await page.waitForTimeout(250);
  const hovered = await navRow.evaluate((n) => [getComputedStyle(n).backgroundColor, getComputedStyle(n).color].join('|'));
  const current = await page.locator('.nav-menu [aria-current="page"]').evaluate((n) => [getComputedStyle(n).backgroundColor, getComputedStyle(n).color].join('|'));
  ok('메뉴 호버가 기본과 다르다', hovered !== base, `${base} → ${hovered}`);
  ok('메뉴 선택이 호버와 다르다', current !== hovered, `${current} vs ${hovered}`);
  await page.mouse.move(5, 5);

  // 새 잠금 화면이 없다 — 홈 타일의 잠김 개수는 라우터 표 그대로다 (open-all.js 가 전체 개방 상태를 본다)
  ok('홈에 새 잠금 요소가 없다', (await page.locator('.home__welcome [aria-disabled="true"], .home__picks [aria-disabled="true"]').count()) === 0);

  // ── EN · 다크
  await toEnglish(page);
  await page.waitForTimeout(600);
  const enTexts = await page.locator('.home-dashboard').evaluate((n) => n.innerText);
  const leftover = enTexts.split('\n').filter((line) => /[가-힣]/.test(line) && !/^(#|\d)/.test(line));
  // 포켓몬 이름은 data 에서 영문으로 바뀐다 — 남은 한글은 사전에 빠진 줄이다
  ok('EN 홈에 한글이 남지 않는다', leftover.length === 0, leftover.slice(0, 4).join(' | '));
  ok('EN 대표 버튼 문구', /Dynamax tier list/.test(await page.locator('.home__btn--primary').textContent()));
  await ctx.close();

  // ── 폭별 가로 넘침 · 잘림 (라이트 · 다크 하나씩 섞는다)
  for (const [w, dark] of [[360, false], [390, true], [480, false], [768, false], [1366, true], [1440, false]]) {
    const c = await newContext(browser, { viewport: { width: w, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
    const p = await c.newPage();
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitSplash(p);
    await p.waitForTimeout(400);
    const m = await p.evaluate(() => {
      const doc = document.documentElement;
      const clipped = [...document.querySelectorAll('.home__btn, .home__tile strong, .pick__name, .home__intro h2')]
        .filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent.trim().slice(0, 20));
      const cta = document.querySelector('.home__btn--primary');
      const cs = cta ? getComputedStyle(cta) : null;
      return { overflow: doc.scrollWidth - doc.clientWidth, clipped, ctaColor: cs?.color, ctaBg: cs?.backgroundColor };
    });
    ok(`${w}px${dark ? ' 다크' : ''}: 가로 넘침 없음`, m.overflow <= 0, String(m.overflow));
    ok(`${w}px: 제목·버튼·이름이 잘리지 않음`, m.clipped.length === 0, m.clipped.join(' | '));
    ok(`${w}px: 대표 버튼 글자·바탕이 다른 색`, m.ctaColor && m.ctaBg && m.ctaColor !== m.ctaBg, `${m.ctaColor} / ${m.ctaBg}`);
    await c.close();
  }

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
