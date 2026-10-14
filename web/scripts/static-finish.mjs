// ─────────────────────────────────────────────────────────────────────────────
// scripts/static-finish.mjs — 정적 내보내기(out/)를 Cloudflare Pages 에 올리기 전에 마무리하고 잰다 (2026-10-15)
//
//   node scripts/static-finish.mjs        (web/ 에서, `BUILD_TARGET=static next build` 뒤)
//
// ① ads.txt — 게시자 ID 가 없는 빌드에서는 경로가 404 를 내는데, 정적 내보내기는 그 본문('Not Found')을 파일로 굽는다.
//    그대로 올리면 Cloudflare 가 200 으로 'Not Found' 를 준다 — AdSense 가 잘못된 ads.txt 로 읽는다. 한 줄 꼴이 아니면 지운다
// ② 꼭 있어야 하는 파일이 있는지 — _headers · _redirects · 404.html · index.html. 하나라도 없으면 세운다(빈 판을 올리지 않는다)
// ③ Cloudflare Pages 무료 한도 — 파일 2만 개, 한 파일 25MiB. 넘으면 올리는 중에 실패하니 여기서 먼저 세운다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out';
const fail = (message) => { console.error(`정적 마무리 실패 — ${message}`); process.exit(1); };

if (!existsSync(OUT)) fail('out/ 이 없습니다 — BUILD_TARGET=static next build 를 먼저 돌립니다');

const ads = join(OUT, 'ads.txt');
if (existsSync(ads) && !/^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0\n?$/.test(readFileSync(ads, 'utf8'))) {
  rmSync(ads);
  console.log('ads.txt — 게시자 ID 가 없는 빌드라 지웠습니다');
}

for (const need of ['_headers', '_redirects', '404.html', 'index.html']) {
  if (!existsSync(join(OUT, need))) fail(`${need} 가 없습니다`);
}
if (!readFileSync(join(OUT, '_headers'), 'utf8').includes('Strict-Transport-Security')) fail('_headers 에 보안 헤더가 없습니다');

let files = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) { walk(path); continue; }
    files += 1;
    if (info.size > 25 * 1024 * 1024) fail(`${path} 가 25MiB 를 넘습니다 (${info.size} 바이트)`);
  }
};
walk(OUT);
if (files > 20000) fail(`파일이 ${files}개 — Cloudflare Pages 한도 2만 개를 넘습니다`);
console.log(`정적 마무리 — 파일 ${files}개 · _headers · _redirects · 404.html 확인`);
