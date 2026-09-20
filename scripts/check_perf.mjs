'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// scripts/check_perf.mjs — 화면 넉 장을 **실제 조절**(4G 1.6Mbps · RTT 150ms · CPU 4배)로 연다
//
// 세 가지를 잰다 — 본문이 보이기까지(ms) · 레이아웃 이동(CLS)과 그 출처 · 긴 작업(50ms+).
// Lighthouse 의 시뮬레이션은 요청 그래프를 추정해 값이 흔들리고(v4.4.2 에서 같은 빌드가 2.6s ↔ 5.4s),
// 로컬 미리보기는 HTTP/1.1 이라 여섯 연결을 다투는 모양이 운영(HTTP/2)과 다르다.
// 그래서 배포된 두 주소를 **같은 조절로 나란히** 재는 것이 제일 믿을 만하다:
//   node scripts/check_perf.mjs https://dev.moncamp.kr/ https://moncamp.kr/
// 주소 하나면 그 주소만 잰다. 판정은 안 한다 — 숫자를 나란히 놓고 사람이 본다.
// ─────────────────────────────────────────────────────────────────────────────
import pw from '/opt/node22/lib/node_modules/playwright/index.js';

const SITES = process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:4173/'];
// 화면 → 「본문이 왔다」고 볼 요소. 스플래시·바닥글이 아니라 데이터가 있어야 서는 것
const PAGES = [
  ['home', '', '.pick__group'], ['hero', '', '.home__welcome h2'], ['dex', 'dex', '.dex__row'],
  ['dmax', 'dmax', '#boss-acc-title'], ['raids', 'raids', '.gameday__intro .note'], ['schedule', 'schedule', '.schedule__month-nav'],
];
const RUNS = 3;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const browser = await pw.chromium.launch({ args: ['--ignore-certificate-errors'] });
for (const [name, path, sel] of PAGES) {
  const cols = [];
  for (const base of SITES) {
    const shown = []; let cls = 0; let long = 0; let sources = '';
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.addInitScript(() => {
        window.__cls = []; window.__long = 0;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: e.value, src: (e.sources || []).map((s) => s.node && (s.node.tagName + (s.node.id ? '#' + s.node.id : '') + '.' + String(s.node.className).split(' ')[0])).filter(Boolean).slice(0, 2) }); }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: 'longtask', buffered: true });
      });
      const t0 = Date.now();
      await page.goto(`${base.replace(/\/?$/, '/')}#/${path}`, { waitUntil: 'commit' });
      await page.locator(sel).first().waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
      shown.push(Date.now() - t0);
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ cls: window.__cls, long: Math.round(window.__long) }));
      const total = r.cls.reduce((a, e) => a + e.v, 0);
      if (total > cls) { cls = total; sources = r.cls.filter((e) => e.v > 0.02).map((e) => e.src.join('>')).join(' · '); }
      long = Math.max(long, r.long);
      await ctx.close();
    }
    const host = new URL(base).host.replace('localhost:4173', 'local');
    cols.push(`${host.padEnd(16)} ${String(median(shown)).padStart(5)}ms  CLS ${cls.toFixed(3)}  긴작업 ${String(long).padStart(3)}ms${cls > 0.1 ? `  ← ${sources}` : ''}`);
  }
  console.log(`${name.padEnd(9)}${cols.join('   │   ')}`);
}
await browser.close();
