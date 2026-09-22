// scripts/bake_html.mjs — docs 의 html 한 장을 png 로 굽는다.
//
// moncamp-structure · server-erd 와 같은 방식이다 — 그림을 손으로 그리면 표가 바뀌어도 그림이 안 바뀐다.
// 원본(html)을 고치고 이걸 돌린다. 뷰포트 높이는 낮게 — fullPage 는 max(내용, 뷰포트) 라 크게 잡으면 아래가 빈다.
//
//   node scripts/bake_html.mjs docs/hardening-2026-09-22.html            # 같은 이름의 .png
//   node scripts/bake_html.mjs docs/x.html docs/y.png
'use strict';
// CommonJS 라 이름 있는 import 가 안 된다 — 기본 내보내기에서 꺼낸다
import playwright from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = playwright;
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [srcArg, outArg] = process.argv.slice(2);
if (!srcArg) {
  console.error('쓰는 법: node scripts/bake_html.mjs <html> [png]');
  process.exit(2);
}
const src = resolve(srcArg);
const out = resolve(outArg ?? src.replace(/\.html$/, '.png'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 400 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`구웠다: ${out}`);
