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

const BASE = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const MIN = 3.0;

const PATHS = [
  '', 'dex', 'dmax', 'pve', 'pvp', 'game-updates', 'schedule', 'raids', 'eggs',
  'finder', 'planner', 'pvp/deck', 'dmax/deck', 'pvp/ivrank', 'pve/solo',
  'release', 'changes', 'privacy', 'terms', 'settings', 'mon/149',
];

// 화면 안에서 재는 일은 브라우저가 한다 — 색 합성(투명도·겹침)은 거기서만 정확하다.
const AUDIT = (min) => {
  const lum = (rgb) => {
    const c = rgb.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  // 브라우저는 color-mix() 를 `color(srgb .94 .86 .83)` 로 돌려준다 — 0~1 이라 255 로 펴야 한다.
  // 이걸 rgb() 처럼 읽으면 어떤 색이든 거의 검정이 되어, 멀쩡한 글자가 전부 걸린다(실제로 그랬다).
  const parse = (value) => {
    const m = value.match(/[\d.]+/g);
    if (!m) return null;
    const unit = value.startsWith('color(') ? 255 : 1;
    return { rgb: [+m[0] * unit, +m[1] * unit, +m[2] * unit], a: m[3] === undefined ? 1 : +m[3] };
  };
  // 뒤에 깔린 바탕을 조상까지 거슬러 찾는다 — 투명한 부모는 제 부모의 색을 보여 준다
  const backdrop = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage !== 'none') return null;   // 그림이 깔리면 잴 수 없다 — 건너뛴다
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0.85) return bg.rgb;
    }
    // 끝까지 투명하면 body 의 바탕이 보이는 것이다 — 흰색이라고 치면 다크에서 전부 오검출된다
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body && body.a > 0.85 ? body.rgb : [255, 255, 255];
  };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.1) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || !bg || fg.a < 0.5) continue;
    const [a, b] = [lum(fg.rgb), lum(bg)];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < min) {
      const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
      bad.push(`${ratio.toFixed(2)} · ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} · 글자 ${hex(fg.rgb)} / 바탕 ${hex(bg)} · "${text.slice(0, 22)}"`);
    }
  }
  return [...new Set(bad)];
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const bad = [];
let visited = 0;

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true, colorScheme: theme });
  const page = await context.newPage();
  for (const path of PATHS) {
    try {
      await page.goto(`${BASE}#/${path}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(700);
      for (const one of await page.evaluate(AUDIT, MIN)) bad.push(`${theme} #/${path} → ${one}`);
      visited += 1;
    } catch (error) {
      bad.push(`${theme} #/${path} → [열리지 않음] ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}
await browser.close();

console.log(`훑은 화면 ${visited}장 · 기준 명암비 ${MIN} · ${BASE}`);
if (bad.length) {
  console.error(`\n안 보이는 글자 ${bad.length}군데:`);
  for (const one of bad.slice(0, 40)) console.error(`  ${one}`);
  if (bad.length > 40) console.error(`  … 그리고 ${bad.length - 40}군데 더`);
  process.exit(1);
}
console.log('명암비 기준 아래로 떨어지는 글자 없음 ✅');
