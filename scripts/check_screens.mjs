'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// check_screens.mjs — **모든 화면의 글자를 훑어 NaN · undefined 를 찾는다.**
//
// 단위 검사(datasweep)는 표의 줄을 본다. 표에 없는 자리는 못 본다 —
// 머리글 · 상세 · 도구(솔플 계산기 · 덱 · 개체값 순위) · 로그아웃 상태가 그렇다.
// 여기서는 브라우저를 띄워 **화면에 실제로 그려진 글자**를 본다. 마지막 그물이다.
//
//   node scripts/check_screens.mjs                 # 로컬 미리보기 (기본)
//   node scripts/check_screens.mjs https://dev.moncamp.kr/
//
// 나가는 값: 한 군데라도 새면 1, 깨끗하면 0. 배포 전 확인에 그대로 쓴다.
// ─────────────────────────────────────────────────────────────────────────────

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');

// 라우터 표(routes.ts)와 같은 순서. 도구 화면까지 모두 든다.
const PATHS = [
  '', 'dex', 'dmax', 'pve', 'pvp', 'game-updates', 'schedule', 'raids', 'eggs',
  'finder', 'planner', 'pvp/deck', 'dmax/deck', 'pvp/ivrank', 'pve/solo',
  'release', 'changes', 'privacy', 'terms', 'settings',
  // 상세 — 폼이 있는 것과 없는 것을 하나씩 (상세는 표 밖의 칸이 가장 많다)
  'mon/6', 'mon/94', 'mon/888',
];

// 새면 안 되는 글자. lib/cell.ts 의 LEAK 과 같은 잣대다.
const LEAK = /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object Object\]/;

// 화면 글자에서 새는 대목만 줄 단위로 추려 온다.
//
// 따옴표(`) 안은 뺀다 — 패치노트가 "`NaN 맥스 피해` 로 나오던 자리" 처럼 **버그를 인용**하기 때문이다.
// 진짜로 새는 칸에는 따옴표가 붙지 않으므로, 이 한 줄로 인용문만 정확히 걸러진다.
async function scan(page, where, bad) {
  const text = await page.evaluate(() => document.body.innerText || '');
  for (const line of text.split('\n')) {
    if (LEAK.test(line.replace(/`[^`]*`/g, ''))) bad.push(`${where} → ${line.trim()}`);
  }
  const errors = await page.evaluate(() => window.__screenErrors || []);
  for (const one of errors) bad.push(`${where} → [콘솔] ${one}`);
}

// 한 화면 안의 탭 · 칩을 하나씩 눌러 가며 본다 — 상태는 주소에 안 남아서 눌러야 열린다.
async function clickThrough(page, where, selector, label, bad) {
  const count = await page.locator(selector).count();
  for (let index = 0; index < count; index += 1) {
    const one = page.locator(selector).nth(index);
    const name = (await one.innerText().catch(() => '')).trim() || String(index);
    await one.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(120);
    await scan(page, `${where} · ${label} ${name}`, bad);
  }
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const bad = [];
let visited = 0;

for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  const context = await browser.newContext({ viewport: size, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  // 콘솔 오류도 같이 모은다 — 화면이 비어서 안 새는 것과 멀쩡한 것은 다르다
  await page.addInitScript(() => {
    window.__screenErrors = [];
    window.addEventListener('error', (event) => window.__screenErrors.push(String(event.message)));
  });
  const tag = size.width < 500 ? '모바일' : 'PC';

  for (const path of PATHS) {
    const where = `${tag} #/${path}`;
    try {
      await page.goto(`${BASE}#/${path}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(600);
      await scan(page, where, bad);
      visited += 1;
      // 순위 화면만 탭·칩이 있다. 없으면 그냥 지나간다.
      if (['dmax', 'pve', 'pvp'].includes(path)) {
        await clickThrough(page, where, '.seg.js-screen-tab button', '탭', bad);
        await clickThrough(page, where, '.chips__item', '칩', bad);
      }
    } catch (error) {
      bad.push(`${where} → [열리지 않음] ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}

await browser.close();

console.log(`훑은 화면 ${visited}장 · 기준 ${BASE}`);
if (bad.length) {
  console.error(`\n새는 자리 ${bad.length}군데:`);
  for (const one of bad.slice(0, 40)) console.error(`  ${one}`);
  if (bad.length > 40) console.error(`  … 그리고 ${bad.length - 40}군데 더`);
  process.exit(1);
}
console.log('NaN · undefined 없음 ✅');
