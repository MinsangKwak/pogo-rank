'use strict';
// v2.32.0 상세 팝업 헤더 카드형 재배치 회귀
//
// 이 스위트가 지키려는 것
//   - #도감번호 · 이름+★ · 타입 알약이 새 자리(.detail__info)에 다 있는가
//   - 공유·저장 아이콘이 오른쪽 위(.detail__top-actions)에 있고 이름 줄과 겹치지 않는가
//   - CP 가 문장이 아니라 카드(큰 숫자 + 2×2 표)로 나오는가, 숫자가 실제로 맞는가
//   - 포획 CP · CP 계산기 행이 여전히 열리고 닫히는가 (모양만 바뀌고 동작은 그대로)
//   - 공유를 누르면 "복사됨" 으로 바뀌어도 원 밖으로 글자가 새지 않는가
//   - 메가 폼처럼 색 테두리가 있는 그림도 새 배경(동심원)과 같이 깨지지 않는가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/?mock=1';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  const go = async (hash) => {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
    await page.locator('#consent .consent__deny').click().catch(() => {});
    await page.waitForTimeout(500);
  };

  await go('#/dex');
  await page.fill('#page .boss__search', '구구');
  await page.waitForTimeout(400);
  await page.locator('#page .dex__row').first().click();
  await page.waitForSelector('dialog.modal[open]', { timeout: 8000 });
  await page.waitForTimeout(400);

  // ── 정보 칸: 도감번호 · 이름+★ · 타입 알약
  ok('도감번호 배지', (await page.locator('.detail__dexno').textContent()) === '#0016');
  ok('이름 옆에 ★', await page.locator('.detail__name-row .fav').isVisible());
  const pills = await page.locator('.detail__type-pill').allTextContents();
  ok('타입 알약 2개', pills.join('·') === '노말·비행', pills.join('·'));
  const pillColor = await page.locator('.detail__type-pill').first().evaluate((n) => getComputedStyle(n).backgroundColor);
  ok('타입 알약이 배경색을 채움 (투명 아님)', pillColor !== 'rgba(0, 0, 0, 0)', pillColor);

  // ── 오른쪽 위 아이콘: 이름 줄과 안 겹치는가
  const nameBox = await page.locator('.detail__name-row').boundingBox();
  const actionsBox = await page.locator('.detail__top-actions').boundingBox();
  ok('공유 버튼이 이름 줄 오른쪽에 (안 겹침)', actionsBox.x >= nameBox.x + nameBox.width - 4, `${actionsBox.x} vs ${nameBox.x + nameBox.width}`);

  // ── CP 카드
  const cpBig = await page.locator('.detail__cp-big b').textContent();
  ok('CP 만렙 큰 숫자', cpBig === '769', cpBig);
  const tiles = await page.locator('.detail__cp-tile b').allTextContents();
  ok('2×2 표 숫자 4개', tiles.join('|') === '388|486|583|632', tiles.join('|'));

  // ── 아코디언: 모양은 바뀌어도 여닫는 동작은 그대로
  const catchAcc = page.locator('.detail__acc--catch');
  ok('포획 CP 행에 강조 스타일', await catchAcc.evaluate((n) => getComputedStyle(n).borderColor) !== 'rgb(232, 233, 235)');
  ok('처음엔 닫혀 있음', !(await catchAcc.evaluate((n) => n.open)));
  await catchAcc.locator('summary').click();
  await page.waitForTimeout(250);
  ok('누르면 열림', await catchAcc.evaluate((n) => n.open));
  ok('열리면 꺾쇠가 90도 돎', (await catchAcc.locator('summary').evaluate((n) => getComputedStyle(n, '::after').transform)) !== 'none');
  await catchAcc.locator('summary').click();
  await page.waitForTimeout(250);
  ok('다시 누르면 닫힘', !(await catchAcc.evaluate((n) => n.open)));

  // ── 공유 버튼: 복사됨으로 바뀌어도 원 밖으로 안 샌다 (모달 가로 안에 있어야 한다)
  await page.locator('.detail__share:not(.detail__plan)').click();
  await page.waitForTimeout(200);
  const shareBox = await page.locator('.detail__share:not(.detail__plan)').boundingBox();
  const modalBox = await page.locator('.modal__box').boundingBox();
  ok('공유 버튼(복사됨 상태)이 모달 안에 있음', shareBox.x >= modalBox.x && shareBox.x + shareBox.width <= modalBox.x + modalBox.width + 1,
    `${shareBox.x}+${shareBox.width} vs ${modalBox.x}+${modalBox.width}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 메가 폼: 색 테두리 + 새 동심원 배경이 같이 있어도 안 깨지는가
  await go('#/dex');
  await page.fill('#page .boss__search', '리자몽');
  await page.waitForTimeout(400);
  await page.locator('#page .dex__row').first().click();
  await page.waitForSelector('dialog.modal[open]', { timeout: 8000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const box = document.querySelector('.modal__box');
    const evo = box.querySelector('.evo');
    if (evo) box.scrollTop = evo.getBoundingClientRect().top + box.scrollTop - 80;
  });
  await page.waitForTimeout(200);
  await page.locator('.evo__mon.form-tag--mega').first().click();
  await page.waitForTimeout(400);
  const megaBorder = await page.locator('.sprite-box').evaluate((n) => getComputedStyle(n).borderColor);
  ok('메가 폼 그림 테두리 색 유지', megaBorder !== 'rgba(0, 0, 0, 0)' && megaBorder !== 'rgb(232, 233, 235)', megaBorder);
  const cpBigMega = await page.locator('.detail__cp-big b').textContent();
  ok('메가 폼 CP 카드도 정상 표시', /^[\d,]+$/.test(cpBigMega), cpBigMega);

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
