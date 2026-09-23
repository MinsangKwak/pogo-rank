'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// check_contrast.mjs — **안 보이는 글자를 찾는다.**
//
// v4.3.0 카드 컨셉으로 갈아끼우면서 같은 사고를 두 번 냈다. 둘 다 모양이 같았다:
//   1. 홈 타일 — 바탕색만 밝게 바뀌고 글자는 흰색 그대로라 흰 글자가 흰 바탕에 놓였다
//   2. 상세 머리줄 — 뒤따르는 `background` 단축이 금박 그림을 지워 같은 일이 났다
// 색을 한 벌 갈아끼우면 **글자와 바탕이 따로 움직인다.** 사람이 46장을 다 눈으로 볼 수는 없다.
//
// 기준은 3.0 이다. WCAG 의 4.5 가 아니라 더 낮게 잡은 이유는, 여기서 찾으려는 것이
// "읽기 불편함" 이 아니라 **"아예 안 보임"** 이기 때문이다. 접근성 감사는 따로 할 일이고,
// 이 그물은 배포를 세워야 할 사고만 건진다.
//
//   node scripts/check_contrast.mjs                 # 로컬 미리보기 (기본)
//   node scripts/check_contrast.mjs https://dev.moncamp.kr/
// ─────────────────────────────────────────────────────────────────────────────

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;

import { AUDIT, MIN } from './lib/contrast_audit.mjs';
// 앱이 다 붙은 뒤에 잰다 — v4(해시)든 Next.js(경로)든 같은 방법으로 (lib/visit.mjs)
import { detectRouting, labelOf, visit } from './lib/visit.mjs';

const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');

const PATHS = [
  '', 'dex', 'dmax', 'pve', 'pvp', 'game-updates', 'schedule', 'raids', 'eggs',
  'finder', 'planner', 'pvp/deck', 'dmax/deck', 'pvp/ivrank', 'pve/solo',
  'release', 'changes', 'privacy', 'terms', 'settings', 'mon/149',
];

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const bad = [], known = [];
let visited = 0;
let routing = 'hash';

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: theme });
  const page = await context.newPage();
  if (theme === 'light') routing = await detectRouting(page, BASE);
  for (const path of PATHS) {
    const where = `${theme} ${labelOf(path)}`;
    try {
      await visit(page, BASE, routing, path);
      // v4.4.2 content-visibility:auto 로 건너뛴 카드도 재게 전부 켠다 (check_screens 와 같은 이유)
      await page.addStyleTag({ content: '* { content-visibility: visible !important; }' }).catch(() => {});
      const found = await page.evaluate(AUDIT, MIN);
      for (const one of found.bad) bad.push(`${where} → ${one}`);
      for (const one of found.known) known.push(`${where} → ${one}`);
      visited += 1;
    } catch (error) {
      bad.push(`${where} → [열리지 않음] ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}
await browser.close();

console.log(`훑은 화면 ${visited}장 · 기준 명암비 ${MIN} · ${BASE} (${routing === 'path' ? '경로 주소 · Next.js' : '해시 주소 · v4'})`);
if (known.length) {
  console.log(`\n알려진 한계 ${known.length}군데 (게임 원작 타입색 — CLAUDE.md §1-b, 고치지 않는다):`);
  for (const one of [...new Set(known)].slice(0, 8)) console.log(`  ${one}`);
}
if (bad.length) {
  console.error(`\n안 보이는 글자 ${bad.length}군데:`);
  for (const one of bad.slice(0, 40)) console.error(`  ${one}`);
  if (bad.length > 40) console.error(`  … 그리고 ${bad.length - 40}군데 더`);
  process.exit(1);
}
console.log('명암비 기준 아래로 떨어지는 글자 없음 ✅');
