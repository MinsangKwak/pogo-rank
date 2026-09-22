'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// check-stories.mjs — **스토리북 전량을 라이트·다크로 훑는다.**
//
// 배포 전 그물(scripts/check_screens.mjs · check_contrast.mjs)은 **화면**을 본다.
// 화면에 아직 안 붙은 조각, 그리고 화면에서는 나오기 어려운 상태(빈 값 · 긴 이름 · 0 변동)는
// 그 그물 밖이다. 스토리가 바로 그 상태들을 세워 두므로, 같은 잣대를 여기에도 댄다.
//
// 재는 자는 배포 전 검문과 **같은 함수**다 (scripts/lib/contrast_audit.mjs).
// 베끼면 다음에 예외 하나를 더할 때 한쪽에만 들어간다.
//
//   npm run build-storybook && npx http-server storybook-static -p 4189   # 아무 정적 서버나
//   node scripts/check-stories.mjs http://localhost:4189/
//
// **쿼리스트링을 지우는 서버를 쓰지 않는다** — `serve` 는 cleanUrls 로 `?id=` 를 버려서
// 모든 스토리가 "No Preview" 로 열린다. 그러면 이 검문이 빈 화면을 훑고 통과한다.
//
// 나가는 값: 한 군데라도 새면 1, 깨끗하면 0.
// ─────────────────────────────────────────────────────────────────────────────

import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { AUDIT, MIN } from '../../scripts/lib/contrast_audit.mjs';
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://localhost:4189/').replace(/\/?$/, '/');

// 새면 안 되는 글자. lib/cell.ts 의 LEAK 과 같은 잣대다
const LEAK = /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object Object\]/;

// 스토리가 정말 그려졌는지 보는 말. 이게 보이면 서버나 주소가 잘못된 것이다
const NO_PREVIEW = 'No Preview';

// 스토리북이 스토리를 꽂는 자리. 자식이 생기면 그려진 것이다
const READY = () => {
  const root = document.querySelector('#storybook-root, #root');
  return !!root && root.children.length > 0;
};

// 움직임을 멎게 한다 — 색을 **멎은 뒤에** 재려고
const STILL = '*, *::before, *::after { transition: none !important; animation: none !important; }';

// 깨진 값의 **이름**을 일부러 적어 둔 스토리. 샘 검사만 비켜 간다 (명암비는 그대로 받는다).
// 구멍이 아니다 — 비켜 간 스토리를 아래에서 이름까지 찍는다. 조용한 예외가 그물을 헐게 한다
const LEAK_DEMO = 'leak-demo';

const index = await (await fetch(`${BASE}index.json`)).json();
const stories = Object.values(index.entries).filter((one) => one.type === 'story');
if (!stories.length) {
  console.error('스토리를 하나도 못 찾았다 — 먼저 npm run build-storybook 을 돌린다');
  process.exit(1);
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const bad = [], known = [];
const skipped = new Set();
let visited = 0;

// 테마는 addon-themes 가 <html data-theme> 로 갈아 끼운다 (.storybook/preview.tsx)
for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  for (const story of stories) {
    const url = `${BASE}iframe.html?viewMode=story&id=${encodeURIComponent(story.id)}&globals=theme:${encodeURIComponent(theme)}`;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      // **그려질 때까지 기다린다.** 400ms 만 쉬고 재면 아직 빈 판을 훑고 통과한다 —
      // 느린 회선에서는 'No Preview' 도 샌 글자도 없는 빈 화면이 깨끗해 보인다
      await page.waitForFunction(READY, null, { timeout: 15000 }).catch(() => {});
      // **트랜지션을 끈 뒤에 잰다.** 테마를 갈아 끼우면 색이 라이트에서 다크로 흘러가는데,
      // 그 중간 프레임을 재면 있지도 않은 색이 잡힌다 (실측: 배포판에서 #e3665b/#746869 —
      // 라이트와 다크를 섞은 값이었다. 멎은 뒤에는 #ff8a7d/#251518 로 기준을 훌쩍 넘는다)
      await page.addStyleTag({ content: STILL }).catch(() => {});
      await page.waitForTimeout(250);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes(NO_PREVIEW)) { bad.push(`${theme} ${story.id} → [안 그려짐] 주소나 서버를 확인한다`); continue; }
      if (story.tags?.includes(LEAK_DEMO)) skipped.add(story.id);
      else {
        const leak = LEAK.exec(text);
        if (leak) bad.push(`${theme} ${story.id} → [샘] ${leak[0]}`);
      }
      const found = await page.evaluate(AUDIT, MIN);
      for (const one of found.bad) bad.push(`${theme} ${story.id} → ${one}`);
      for (const one of found.known) known.push(`${theme} ${story.id} → ${one}`);
      visited += 1;
    } catch (error) {
      bad.push(`${theme} ${story.id} → [열리지 않음] ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}
await browser.close();

console.log(`훑은 스토리 ${visited}판(${stories.length}개 × 2테마) · 기준 명암비 ${MIN} · ${BASE}`);
if (skipped.size) {
  console.log(`\n샘 검사를 비켜 간 스토리 ${skipped.size}개 (깨진 값의 이름을 일부러 적은 자리 — ${LEAK_DEMO}):`);
  for (const one of skipped) console.log(`  ${one}`);
}
if (known.length) {
  console.log(`\n알려진 한계 ${known.length}군데 (게임 원작 타입색 — CLAUDE.md §1-b, 고치지 않는다):`);
  for (const one of [...new Set(known)].slice(0, 8)) console.log(`  ${one}`);
}
if (bad.length) {
  console.error(`\n잡힌 자리 ${bad.length}군데:`);
  for (const one of bad.slice(0, 40)) console.error(`  ${one}`);
  if (bad.length > 40) console.error(`  … 그리고 ${bad.length - 40}군데 더`);
  process.exit(1);
}
console.log('빈 값도 새지 않고, 묻히는 글자도 없음 ✅');
