// ─────────────────────────────────────────────────────────────────────────────
// scripts/compare-v3.mjs — v3 와 v4 의 **화면 구조**를 나란히 떠서 비교한다
//
// 왜 필요한가. "첫 줄 글자가 같다" 로는 레이아웃이 깨진 것을 못 잡는다.
// 클래스명을 맞춰도 **태그와 겹침(nesting)** 이 다르면 CSS 가 다른 그림을 그린다 —
// `.row__main` 이 div 가 아니라 span 이라서 이름이 세로로 쪼개졌던 적이 있다.
// 그래서 보이는 요소만 골라 `태그#아이디.클래스 [display 폭x높이]` 로 찍고 줄줄이 맞대 본다.
//
// 쓰는 법 (dist 와 dist/react 를 같은 서버로 띄워 둔 채)
//   python3 -m http.server 5503 -d dist &
//   node frontend-v4/scripts/compare-v3.mjs 390          # 모든 화면, 깊이 2
//   node frontend-v4/scripts/compare-v3.mjs 1440 dmax 5  # 한 화면, 깊이 5
//
// 한 줄이 밀리면 뒤가 전부 어긋나 보이므로 공통 부분(LCS)으로 짝을 맞춘다 — **빠진 줄만** ✗ 로 선다.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SCREENS = [['', 'home'], ['#/dex', 'dex'], ['#/dmax', 'dmax'], ['#/pve', 'pve'], ['#/pvp', 'pvp'], ['#/raids', 'raids'], ['#/eggs', 'eggs'], ['#/schedule', 'schedule']];

const dump = `(() => {
  const sig = (n) => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
    (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/).slice(0, 3).join('.') : '');
  const DEPTH = Number(window.__depth || 2);
  const walk = (n, d, out) => {
    if (d > DEPTH) return out;
    for (const c of n.children) {
      if (['SCRIPT','STYLE','NOSCRIPT','SVG','svg'].includes(c.tagName)) continue;
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      // display:contents 인 껍데기(#root · 묶음 div)는 상자가 없다 — 제 줄을 내주지 않고 아이만 같은 깊이로
      if (cs.display === 'contents') { walk(c, d, out); continue; }
      const r = c.getBoundingClientRect();
      out.push('  '.repeat(d) + sig(c) + '  [' + cs.display + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ']');
      walk(c, d + 1, out);
    }
    return out;
  };
  return walk(document.body, 0, []).join('\\n');
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const width = Number(process.argv[2] || 390);
  const only = process.argv[3];
  const depth = Number(process.argv[4] || 2);
  const ctx = await b.newContext({ viewport: { width, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.addInitScript(`window.__depth = ${depth};`);
  const get = async (base, hash) => {
    await p.goto(base + hash, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2200);
    return p.evaluate(dump);
  };
  // 한 줄이 밀리면 그 뒤가 전부 어긋나 보인다 — 공통 부분(LCS)으로 짝을 맞춰 **빠진 줄만** 표시한다
  const align = (a, c) => {
    const key = (line) => line.replace(/\d+x\d+/, '');
    const n = a.length, m = c.length;
    const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1)
      for (let j = m - 1; j >= 0; j -= 1)
        table[i][j] = key(a[i]) === key(c[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (key(a[i]) === key(c[j])) out.push([a[i++], c[j++]]);
      else if (table[i + 1][j] >= table[i][j + 1]) out.push([a[i++], '']);
      else out.push(['', c[j++]]);
    }
    while (i < n) out.push([a[i++], '']);
    while (j < m) out.push(['', c[j++]]);
    return out;
  };

  let bad = 0;
  for (const [hash, label] of SCREENS) {
    if (only && only !== label) continue;
    const a = (await get('http://localhost:5503/?mock=1', hash)).split('\n');
    const c = (await get('http://localhost:5503/react/', hash)).split('\n');
    console.log(`\n══════ ${label} @${width}px ══════`);
    for (const [L, R] of align(a, c)) {
      const same = L && R;
      if (!same) bad += 1;
      console.log((same ? '  ' : '✗ ') + L.padEnd(62) + '│ ' + R);
    }
  }
  console.log(`\n>>> 어긋난 줄 ${bad}`);
  await b.close();
})();
