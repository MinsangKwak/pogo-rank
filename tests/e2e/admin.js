'use strict';
// v3.40.0 🔑 관리자 지정 회귀 — 관리자가 '규칙에 박힌 한 명' 에서 '루트 + 루트가 지정한 사람' 으로 늘었다
//
// 이 스위트가 지키려는 것
//   - 패널이 역할로 나뉘는가 (승인 대기 / 관리자 N명 / 승인된 친구 N명)
//   - 루트에게만 [관리자 지정]·[관리자 해제] 가 보이는가 — **위임 관리자에게는 안 보인다**
//     (권한이 스스로 번지면 되돌릴 사람이 없어진다. firestore.rules 도 같은 규칙)
//   - 지정하면 allowlist 문서에 admin: true 가 붙고, 그 사람이 다음 로그인에 관리자가 되는가
//   - 해제하면 되돌아가는가 — 승인된 친구로는 남는다
//   - 루트 본인 줄에는 해제 버튼이 없는가 (자기를 잠가 버리는 길을 만들지 않는다)
//   - **미구현은 관리자만** — 승인된 친구여도 체크가 없고 흐린 줄도 없다
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');

suite(async () => {
  const browser = await launch();
  const errs = [];

  // 팝업을 여는 데까지 — 어느 계정으로 들어가든 같은 절차다
  const openPanel = async (page) => {
    await page.click('#menu-toggle');
    await page.waitForTimeout(300);
    await page.click('.drawer__item:has-text("가입 승인")');
    await page.waitForSelector('.admin__row', { timeout: 6000 });
    await page.waitForTimeout(300);
  };
  const sections = (page) => page.$$eval('.detail__sec h3', (nodes) => nodes.map((node) => node.textContent.trim()));

  // ── 1. 루트 관리자 ────────────────────────────────────────────────────────
  const rootCtx = await newContext(browser, { viewport: { width: 1280, height: 1000 } });
  const root = await rootCtx.newPage();
  root.on('pageerror', (e) => errs.push('root: ' + e));
  root.on('dialog', (dialog) => dialog.accept());
  await root.goto('http://localhost:5503/?mock=1#/dmax', { waitUntil: 'domcontentloaded' });
  await waitSplash(root);
  await root.waitForTimeout(1300);

  const rootAuth = await root.evaluate(() => ({ status: AUTH.status, admin: AUTH.admin, root: AUTH.adminRoot }));
  ok('루트로 로그인된다', rootAuth.admin === true && rootAuth.root === true, JSON.stringify(rootAuth));
  ok('루트에게 [미구현] 체크가 보인다', (await root.locator('.check-toggle').count()) === 1);

  await openPanel(root);
  let heads = await sections(root);
  ok('패널이 역할로 나뉜다', heads.some((h) => h.startsWith('관리자')) && heads.some((h) => h.startsWith('승인된 친구')),
    heads.join(' / '));
  ok('루트 본인 줄에 역할 딱지가 있다',
    await root.evaluate(() => (document.querySelector('.admin__row.is-admin .admin__badge')?.textContent ?? '').includes('루트')));
  ok('루트 본인 줄에는 버튼이 없다',
    (await root.locator('.admin__row.is-admin .admin__act').count()) === 0);
  ok('친구 줄에 [관리자 지정] 이 있다', (await root.locator('.admin__act:has-text("관리자 지정")').count()) === 1);

  // 지정 → allowlist 에 admin: true
  await root.click('.admin__act:has-text("관리자 지정")');
  await root.waitForTimeout(900);
  heads = await sections(root);
  ok('지정하면 관리자가 2명이 된다', heads.some((h) => h === '관리자 2명'), heads.join(' / '));
  ok('지정하면 버튼이 [관리자 해제] 로 바뀐다', (await root.locator('.admin__act:has-text("관리자 해제")').count()) === 1);
  const seeded = await root.evaluate(() => JSON.parse(localStorage.getItem('pogo_mock_db') || '{}'));
  const friendDoc = seeded.allowlist?.['friend@mock.local'];
  ok('allowlist 문서에 admin: true 가 붙는다', friendDoc?.admin === true, JSON.stringify(friendDoc));
  ok('승인 자체는 그대로다', friendDoc?.approved === true);

  // ── 2. 지정받은 사람이 관리자가 된다 ──────────────────────────────────────
  const friendCtx = await newContext(browser, { viewport: { width: 1280, height: 1000 } });
  const friend = await friendCtx.newPage();
  friend.on('pageerror', (e) => errs.push('friend: ' + e));
  await friend.addInitScript((db) => { try { localStorage.setItem('pogo_mock_db', db); } catch {} }, JSON.stringify(seeded));
  await friend.goto('http://localhost:5503/?mock=friend#/dmax', { waitUntil: 'domcontentloaded' });
  await waitSplash(friend);
  await friend.waitForTimeout(1400);
  const friendAuth = await friend.evaluate(() => ({ admin: AUTH.admin, root: AUTH.adminRoot }));
  ok('지정받으면 관리자다', friendAuth.admin === true, JSON.stringify(friendAuth));
  ok('그래도 루트는 아니다', friendAuth.root === false);
  ok('위임 관리자에게도 [미구현] 체크가 보인다', (await friend.locator('.check-toggle').count()) === 1);
  // **핵심** — 위임 관리자는 남을 관리자로 만들지 못한다
  await openPanel(friend);
  ok('위임 관리자에게는 [관리자 지정] 이 없다',
    (await friend.locator('.admin__act:has-text("관리자 지정")').count()) === 0);
  ok('위임 관리자에게는 [관리자 해제] 도 없다',
    (await friend.locator('.admin__act:has-text("관리자 해제")').count()) === 0);
  ok('왜 안 보이는지 적혀 있다',
    await friend.evaluate(() => document.querySelector('.detail')?.textContent.includes('루트 관리자만')));
  await friendCtx.close();

  // ── 3. 해제하면 되돌아간다 ────────────────────────────────────────────────
  await root.click('.admin__act:has-text("관리자 해제")');
  await root.waitForTimeout(900);
  heads = await sections(root);
  ok('해제하면 관리자가 1명으로', heads.some((h) => h === '관리자 1명'), heads.join(' / '));
  ok('해제해도 승인된 친구로는 남는다', heads.some((h) => h === '승인된 친구 1명'), heads.join(' / '));
  await rootCtx.close();

  // ── 4. 관리자가 아닌 승인 친구 ────────────────────────────────────────────
  const plainCtx = await newContext(browser, { viewport: { width: 1280, height: 1000 } });
  const plain = await plainCtx.newPage();
  plain.on('pageerror', (e) => errs.push('plain: ' + e));
  // 저장값을 켜 둔 채로 — 화면이 저장값이 아니라 **관리자 여부**를 본다는 것을 못 박는다
  await plain.addInitScript(() => { try { localStorage.setItem('pogo_max_unrel', '1'); } catch {} });
  await plain.goto('http://localhost:5503/?mock=friend#/dmax', { waitUntil: 'domcontentloaded' });
  await waitSplash(plain);
  await plain.waitForTimeout(1400);
  const plainAuth = await plain.evaluate(() => ({ status: AUTH.status, admin: AUTH.admin }));
  ok('승인은 됐지만 관리자는 아니다', plainAuth.status === 'ok' && plainAuth.admin === false, JSON.stringify(plainAuth));
  ok('관리자가 아니면 체크가 없다', (await plain.locator('.check-toggle').count()) === 0);
  ok('관리자가 아니면 흐린 줄도 없다', (await plain.locator('.row.is-unreleased').count()) === 0);
  ok('안내에 [미구현] 붙임말이 없다',
    !(await plain.evaluate(() => (document.getElementById('note')?.textContent ?? '').includes('[미구현]'))));
  ok('가입 승인 메뉴 자체가 없다', (await plain.locator('.drawer__item:has-text("가입 승인")').count()) === 0);
  await plainCtx.close();

  ok('JS 오류 없음', errs.length === 0, errs.join(' | '));
  await finish(browser);
});
