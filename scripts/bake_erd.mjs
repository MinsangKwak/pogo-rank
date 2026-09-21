// scripts/bake_erd.mjs — docs/server-erd.html 을 png 로 굽는다.
//
// 뷰포트 높이를 낮게 잡는다 — fullPage 는 max(내용, 뷰포트) 라 크게 잡으면 아래가 빈 채로 찍힌다.
// moncamp-structure 와 같은 방식이다 — 그림을 손으로 그리면 표가 바뀌어도 그림이 안 바뀐다.
// 원본(html)을 고치고 이걸 돌린다.
//
//   node scripts/bake_erd.mjs
'use strict';
// CommonJS 라 이름 있는 import 가 안 된다 — 기본 내보내기에서 꺼낸다
import playwright from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = playwright;
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../docs/server-erd.html');
const out = resolve(here, '../docs/server-erd.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 400 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`구웠다: ${out}`);
