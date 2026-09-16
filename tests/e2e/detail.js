'use strict';
// v3.50.0 상세 팝업 재설계 회귀 — 요약 · 배틀 정보 · 진화 탭 + CP 계산기 화면 + 하단 고정 버튼
//
// 이 스위트가 지키려는 것
//   - 머리줄(포켓몬 상세 · 링크 복사)과 ✕ 가 카드 위쪽에 있고, 스크롤해도 제자리인가
//   - 왼쪽 정보 칸에 #도감번호 · 이름 · 영문명 · 타입 알약이 있는가
//   - 탭 셋(요약 · 배틀 정보 · 진화)이 있고, 누르면 그 내용만 보이는가 · 탭마다 스크롤 위치를 기억하는가
//   - 요약: CP 카드(큰 숫자 + 2×2 표) · 포획 CP 세그먼트(레이드/야생 · 맥스는 있는 종만) · 기술
//   - 배틀 정보: 약점·내성 두 카드 · 활용 순위 줄 · 보스로 만났을 때
//   - 진화: 진화 계열을 누르면 **같은 창**에서 바뀌고, ← 로 돌아오면 탭 · 계산기 입력값이 그대로인가
//   - CP 계산기: 숫자 입력 · ± · 프리셋이 CP 를 바꾸고, 초기화 · 상세로 돌아가기가 동작하는가
//   - 머리줄 [포켓몬 도감] 이 팝업을 닫고 도감으로 가는가 (v3.50.1 하단 → 머리줄 · 공유는 하단 왼쪽)
//   - 공유를 누르면 "복사됨" 으로 바뀌어도 카드 밖으로 새지 않는가 · 메가 폼 테두리 · 큰 그림 움직임(회귀)
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
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
  const text = (sel) => page.locator(sel).first().textContent().then((t) => (t ?? '').trim());
  const tab = (id) => page.click(`.detail__tab[data-tab="${id}"]`).then(() => page.waitForTimeout(250));
  const state = () => page.evaluate(() => { const b = document.querySelector('.detail--mon'); return b ? { tab: b.dataset.tab, screen: b.dataset.screen, sprite: b.dataset.sprite } : null; });

  await go('#/mon/16');   // 구구 — 맥스 배틀에 안 나오는 종 (포획 CP 세그먼트가 레이드·야생 둘)
  await page.waitForSelector('.detail--mon', { timeout: 8000 });
  await page.waitForTimeout(400);

  // ── 머리줄 · ✕ · 정보 칸
  ok('머리줄 제목 [포켓몬 상세]', (await text('.detail__bar-title')) === '포켓몬 상세');
  const closeBox = await page.locator('.modal__close').boundingBox();
  const barBox = await page.locator('.detail__bar').boundingBox();
  ok('✕ 가 머리줄 안에 (카드 위쪽)', closeBox.y >= barBox.y - 2 && closeBox.y + closeBox.height <= barBox.y + barBox.height + 2, `close ${closeBox.y} bar ${barBox.y}~${barBox.y + barBox.height}`);
  ok('도감번호 배지', (await text('.detail__dexno')) === '#0016');
  ok('이름', (await text('.detail__info h2')) === '구구');
  const pills = await page.locator('.detail__types .detail__type-pill').allTextContents();
  ok('타입 알약 2개', pills.join('·') === '노말·비행', pills.join('·'));
  // 2026-09-16 v3.50.1 타입 배지는 그림 왼쪽 위 모서리에 겹친다 (v2.35.0 자리) — 정보 칸이 아니다
  const typesBox = await page.locator('.detail__types').boundingBox();
  const spriteBox = await page.locator('.detail__side .sprite-box').boundingBox();
  ok('타입 배지가 그림 왼쪽 위 모서리에 겹침', typesBox.x <= spriteBox.x + 2 && typesBox.y <= spriteBox.y + 2, `types ${typesBox.x},${typesBox.y} vs sprite ${spriteBox.x},${spriteBox.y}`);
  ok('머리줄 오른쪽에 [포켓몬 도감]', await page.locator('.detail__bar .detail__bar-dex').isVisible());
  // 2026-09-16 v3.50.2 ✕ 와 [포켓몬 도감] 이 같은 줄·같은 높이·0.6rem 간격 ("세로 높이는 맞춰줘라")
  const dexBox = await page.locator('.detail__bar-dex').boundingBox();
  ok('✕ 와 [포켓몬 도감] 높이·줄이 같다', Math.abs(closeBox.y - dexBox.y) < 1 && Math.abs(closeBox.height - dexBox.height) < 1, `close ${closeBox.y}/${closeBox.height} dex ${dexBox.y}/${dexBox.height}`);
  ok('✕ 와 [포켓몬 도감] 간격 6px', Math.abs((closeBox.x - (dexBox.x + dexBox.width)) - 6) < 1.5, String(closeBox.x - (dexBox.x + dexBox.width)));
  ok('하단 왼쪽에 [링크 복사]', await page.locator('.detail__dock .detail__share').isVisible() && (await text('.detail__share-text')) === '링크 복사');
  ok('탭 셋', (await page.locator('.detail__tab').allTextContents()).join('|') === '요약|배틀 정보|진화');
  ok('처음 탭은 요약', (await state()).tab === 'summary');

  // ── 요약: CP 카드 · 포획 CP 세그먼트 · 기술
  ok('CP 만렙 큰 숫자', (await text('.detail__cp-big b')) === '769');
  const tiles = await page.locator('.detail__cp-tile b').allTextContents();
  ok('2×2 표 숫자 4개', tiles.join('|') === '388|486|583|632', tiles.join('|'));
  const segs = await page.locator('.detail__catch-seg button').allTextContents();
  ok('포획 CP 세그먼트 — 맥스 배틀에 안 나오는 종은 레이드·야생만', segs.join('|') === '레이드|야생', segs.join('|'));
  ok('레이드 = 평시·부스트 두 줄, 100% 388 · 최저 있음', (await page.locator('.detail__catch-row').count()) === 2
    && (await text('.detail__catch-val b')) === '388' && /최저 \d/.test(await text('.detail__catch-floor')));
  await page.locator('.detail__catch-seg button', { hasText: '야생' }).click();
  await page.waitForTimeout(150);
  ok('야생으로 바꾸면 최저 CP 가 없다', (await page.locator('.detail__catch-floor').count()) === 0 && (await text('.detail__catch-val b')) === '583');
  const catchAcc = page.locator('.detail__acc--catch');
  ok('조건 설명은 접혀 있음', !(await catchAcc.evaluate((n) => n.open)));
  await catchAcc.locator('summary').click();
  await page.waitForTimeout(200);
  ok('누르면 열림', await catchAcc.evaluate((n) => n.open));
  const moveLabels = await page.locator('.detail__moves .move-list__row em').allTextContents();
  ok('기술 두 줄 — 일반 기술 · 스페셜 기술', moveLabels.join('|') === '일반 기술|스페셜 기술', moveLabels.join('|'));
  ok('요약에서는 배틀 정보 내용이 숨어 있음', await page.locator('.detail__pane[data-pane="battle"]').isHidden());

  // ── 배틀 정보 탭 · 탭별 스크롤 기억
  await tab('battle');
  ok('배틀 정보 탭으로', (await state()).tab === 'battle' && await page.locator('.detail__pane[data-pane="battle"]').isVisible());
  ok('약점·내성 두 카드', (await page.locator('.detail__match h3').allTextContents()).join('|') === '약점 (더 큰 데미지)|내성 (덜 받는 데미지)');
  ok('활용 순위 카드', (await page.locator('.detail__card h3', { hasText: '활용 순위' }).count()) === 1);
  ok('보스로 만났을 때 — 추천 후보 줄', (await page.locator('.detail__boss .detail__rec').count()) >= 3);
  await page.evaluate(() => { document.querySelector('.detail__scroll').scrollTop = 140; });
  await page.waitForTimeout(100);
  await tab('summary');
  const summaryTop = await page.evaluate(() => document.querySelector('.detail__scroll').scrollTop);
  await tab('battle');
  const battleTop = await page.evaluate(() => document.querySelector('.detail__scroll').scrollTop);
  ok('탭마다 스크롤 위치를 기억 (요약 0 · 배틀 140)', summaryTop === 0 && Math.abs(battleTop - 140) <= 2, `${summaryTop} / ${battleTop}`);

  // ── CP 계산기 화면
  await page.click('.detail__dock-calc');
  await page.waitForTimeout(250);
  ok('계산기 화면으로', (await state()).screen === 'calc' && (await text('.detail__bar-title')) === 'CP 계산기');
  ok('계산기 화면에서 탭·내용이 숨고 하단은 [초기화][상세로 돌아가기]', await page.locator('.detail__tabs').isHidden()
    && await page.locator('.detail__dock-return').isVisible() && await page.locator('.detail__dock-calc').isHidden());
  const nums = () => page.locator('.detail__calc-num').evaluateAll((ns) => ns.map((n) => n.value));
  ok('기본값 Lv30 · 15/15/15', (await nums()).join('/') === '30/15/15/15', (await nums()).join('/'));
  const cpAt = (level, a, d, h) => page.evaluate(([lv, ai, di, hi]) => calcCp(DEX_DATA.forms[16], lv, ai, di, hi).toLocaleString(), [level, a, d, h]);
  ok('예상 CP = calcCp(30, 15/15/15)', (await text('.detail__calc-cp')) === await cpAt(30, 15, 15, 15));
  await page.locator('.detail__calc-preset[data-level="40"]').click();
  await page.waitForTimeout(100);
  ok('프리셋 40 → 레벨 40 · CP 갱신', (await nums())[0] === '40' && (await text('.detail__calc-cp')) === await cpAt(40, 15, 15, 15)
    && (await page.locator('.detail__calc-preset[data-level="40"]').getAttribute('aria-pressed')) === 'true');
  await page.locator('.detail__calc-row', { hasText: '공격 IV' }).locator('.detail__calc-step').first().click();
  await page.waitForTimeout(100);
  ok('공격 IV − → 14', (await nums())[1] === '14' && (await text('.detail__calc-cp')) === await cpAt(40, 14, 15, 15));
  await page.locator('.detail__calc-num').first().fill('25.5');
  await page.locator('.detail__calc-num').first().press('Enter');
  await page.waitForTimeout(150);
  ok('레벨 숫자 직접 입력 25.5', (await nums())[0] === '25.5' && (await text('.detail__calc-cp')) === await cpAt(25.5, 14, 15, 15), (await nums())[0]);
  await page.locator('.detail__calc-num').first().fill('99');
  await page.locator('.detail__calc-num').first().press('Enter');
  await page.waitForTimeout(150);
  ok('범위 밖(99)은 50 으로', (await nums())[0] === '50' && (await page.locator('.detail__calc-stepper').first().locator('.detail__calc-step').nth(1).isDisabled()));
  await page.locator('.detail__calc-num').first().fill('25.5');
  await page.locator('.detail__calc-num').first().press('Enter');
  await page.waitForTimeout(100);
  ok('개체값 요약 줄', /개체값 9\d% · 14 \/ 15 \/ 15/.test(await text('.detail__calc-iv-sum')), await text('.detail__calc-iv-sum'));

  // ── 진화 탐색: 같은 창에서 바뀌고, ← 로 돌아오면 탭 · 입력값이 그대로
  await page.click('.detail__dock-return');
  await page.waitForTimeout(250);
  ok('상세로 돌아오면 배틀 정보 탭 그대로', (await state()).screen === 'detail' && (await state()).tab === 'battle');
  await tab('evo');
  ok('진화 계열 3단계', (await page.locator('.evo__mon').count()) === 3 && (await page.locator('.evo__mon.is-now').count()) === 1);
  await page.locator('.evo__mon').nth(1).click();   // 피죤
  await page.waitForTimeout(500);
  ok('같은 창에서 피죤으로 바뀜 (팝업 하나)', (await page.locator('dialog.modal[open]').count()) === 1 && (await text('.detail__dexno')) === '#0017' && (await state()).sprite === '17');
  ok('주소도 #/mon/17', await page.evaluate(() => location.hash) === '#/mon/17');
  ok('← 돌아가기 줄에 이전 포켓몬 이름', /구구로 돌아가기/.test(await text('.detail__back')), await text('.detail__back'));
  ok('바뀐 포켓몬은 요약 탭부터', (await state()).tab === 'summary');
  await page.click('.detail__back');
  await page.waitForTimeout(500);
  ok('돌아오면 구구 · 진화 탭 그대로', (await text('.detail__dexno')) === '#0016' && (await state()).tab === 'evo' && (await page.locator('.detail__back').count()) === 0);
  await page.click('.detail__dock-calc');
  await page.waitForTimeout(200);
  ok('계산기 입력값도 그대로 (25.5 · 14/15/15)', (await nums()).join('/') === '25.5/14/15/15', (await nums()).join('/'));
  await page.click('.detail__dock-reset');
  await page.waitForTimeout(150);
  ok('초기화 → 30 · 15/15/15', (await nums()).join('/') === '30/15/15/15');
  await page.click('.detail__dock-return');
  await page.waitForTimeout(200);

  // ── 추천 후보를 눌러도 같은 창에서 바뀐다
  await tab('battle');
  await page.locator('.detail__boss .detail__rec').first().click();
  await page.waitForTimeout(500);
  ok('추천 후보 → 같은 창에서 바뀜 + ← 줄', (await page.locator('dialog.modal[open]').count()) === 1 && (await page.locator('.detail__back').count()) === 1 && (await state()).sprite !== '16');
  await page.click('.detail__back');
  await page.waitForTimeout(400);
  ok('돌아오면 구구 · 배틀 정보 탭', (await state()).sprite === '16' && (await state()).tab === 'battle');

  // ── 공유 버튼: 복사됨으로 바뀌어도 카드 밖으로 안 샌다
  await page.locator('.detail__share').click();
  await page.waitForTimeout(200);
  const shareBox = await page.locator('.detail__share').boundingBox();
  const modalBox = await page.locator('.modal__box').boundingBox();
  ok('공유 버튼(복사됨 상태)이 카드 안에 있음', shareBox.x >= modalBox.x && shareBox.x + shareBox.width <= modalBox.x + modalBox.width + 1
    && await page.locator('.detail__share.is-copied').count() === 1, `${shareBox.x}+${shareBox.width} vs ${modalBox.x}+${modalBox.width}`);

  // ── 머리줄 [포켓몬 도감]: 팝업을 닫고 도감으로
  await page.click('.detail__bar-dex');
  await page.waitForTimeout(700);
  ok('도감으로 이동 · 팝업 닫힘', await page.evaluate(() => location.hash) === '#/dex' && (await page.locator('dialog.modal[open]').count()) === 0);

  // ── 메가 폼: 진화 탭의 ⚡ 메가를 누르면 색 테두리 + 폼 라벨
  await go('#/mon/6');   // 리자몽
  await page.waitForSelector('.detail--mon', { timeout: 8000 });
  await page.waitForTimeout(400);
  const megaSegs = await page.locator('.detail__catch-seg button').allTextContents();
  ok('맥스 배틀에 나오는 종은 세그먼트 셋', megaSegs.join('|') === '맥스 배틀|레이드|야생', megaSegs.join('|'));
  await tab('evo');
  await page.locator('.evo__mon.form-tag--mega').first().click();
  await page.waitForTimeout(500);
  const megaBorder = await page.locator('.detail__side .sprite-box').evaluate((n) => getComputedStyle(n).borderColor);
  ok('메가 폼 그림 테두리 색', megaBorder !== 'rgba(0, 0, 0, 0)' && megaBorder !== 'rgb(232, 233, 235)', megaBorder);
  ok('폼 라벨이 번호 옆에', /^메가/.test(await text('.detail__tags .form-tag')), await text('.detail__tags .form-tag'));
  ok('메가 폼 CP 카드도 정상', /^[\d,]+$/.test(await text('.detail__cp-big b')));

  // ── 2026-09-12 v2.67.0 상세의 큰 그림만 움직인다 (GIF 는 정지 png 의 13배라 한 번에 한 장만)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await go('#/mon/6');
  await page.waitForFunction(() => {
    const img = document.querySelector('.sprite-box .sprite');
    return img && /sprites-anim\/\d+\.gif$/.test(img.getAttribute('src') || '');
  }, null, { timeout: 8000 }).catch(() => {});
  const heroSrc = await page.locator('.sprite-box .sprite').getAttribute('src');
  ok('상세 큰 그림이 움직이는 그림으로 바뀐다', /sprites-anim\/6\.gif$/.test(heroSrc || ''), heroSrc);
  await go('#/dex');
  await page.waitForSelector('#page .dex__row .sprite', { timeout: 8000 });
  const listAnim = await page.locator('#page .dex__row .sprite').evaluateAll(
    (ns) => ns.filter((n) => /sprites-anim\//.test(n.getAttribute('src') || '')).length);
  ok('목록 그림도 움직인다 (v3.18.0 기본)', listAnim > 0, String(listAnim));

  // ── 2026-09-16 v3.50.0 같은 주소를 다시 그려도(로그인 판정 · 잠시 써보기) 열린 팝업이 닫히지 않는다.
  // auth.js 가 로그인이 끝나면 도감 화면을 다시 그리는데, renderPage 가 매번 팝업을 소리 없이 닫아
  // 도감에서 상세를 연 직후 로그인이 끝나면 팝업이 사라졌다 — 주소가 바뀌었을 때만 닫는다
  await page.locator('#page .dex__row').first().click();
  await page.waitForTimeout(400);
  await page.evaluate(() => renderPage());
  await page.waitForTimeout(200);
  ok('같은 주소 다시 그리기 뒤에도 팝업 유지', (await page.locator('dialog.modal[open]').count()) === 1);
  await page.evaluate(() => navigateHash('#/raids'));
  await page.waitForTimeout(600);
  ok('다른 주소로 가면 팝업이 닫힌다', (await page.locator('dialog.modal[open]').count()) === 0 && await page.evaluate(() => location.hash) === '#/raids');

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await finish(browser);
});
