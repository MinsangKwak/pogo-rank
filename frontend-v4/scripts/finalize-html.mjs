// ─────────────────────────────────────────────────────────────────────────────
// scripts/finalize-html.mjs — 빌드된 dist/index.html 을 **채널에 맞춰** 손본다
//
// v3 는 backend/build.py 가 하던 일이다. 여기서도 같은 규칙, 같은 값을 쓴다 —
// 두 판이 같은 도메인을 쓰는 동안 한쪽만 색인되거나 한쪽만 집계되면 숫자를 믿을 수 없다.
//
//   운영(prod) GA 조각을 넣고, robots 는 index, follow 그대로
//   미리보기(dev) GA 를 빼고, robots 를 noindex 로 **바꿔 끼우고**(두 줄이 공존하지 않게),
//              탭 제목 앞에 [dev] 를 달고, 공유 카드 주소를 dev.moncamp.kr 로 돌린다
//
// **왜 Vite 의 %ENV% 치환을 안 쓰나** — 그쪽은 .env 파일을 보는 길이라 CI 환경변수와
// 어긋날 자리가 생긴다. 빌드 뒤에 한 번 손보는 쪽이 눈에 보이고, 로컬에서 그대로 돌려 볼 수 있다.
//
// 쓰는 법: node scripts/finalize-html.mjs [dist/index.html]
//   BUILD_CHANNEL=dev|prod (기본 prod) · GA_ID=G-...
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? resolve(here, '../dist/index.html'));
const channel = process.env['BUILD_CHANNEL'] === 'dev' ? 'dev' : 'prod';
const gaId = (process.env['GA_ID'] ?? '').trim();

const SITE_URL = 'https://moncamp.kr/';
const DEV_SITE_URL = 'https://dev.moncamp.kr/';
const ROBOTS_INDEX = '<meta name="robots" content="index, follow, max-image-preview:large">';
const ROBOTS_NOINDEX = '<meta name="robots" content="noindex, nofollow">';

let html = readFileSync(target, 'utf8');

// ── GA — 운영에서 측정 ID 가 있을 때만 넣는다. 없으면 자리표시자를 지운다 ──────
if (html.indexOf('__GA_SNIPPET__') === -1) throw new Error('index.html 에 __GA_SNIPPET__ 자리가 없습니다');
const snippet = readFileSync(resolve(here, 'ga-snippet.html'), 'utf8').replace('__GA_ID__', gaId);
html = html.replace('__GA_SNIPPET__', channel === 'prod' && gaId ? snippet.trimEnd() : '');

// ── robots — **정확히 한 줄**이어야 바꿔 끼울 수 있다 ────────────────────────
const robotsCount = html.split(ROBOTS_INDEX).length - 1;
if (robotsCount !== 1) throw new Error(`robots 메타가 ${robotsCount} 줄입니다 — 정확히 하나여야 합니다`);

if (channel === 'dev') {
  html = html.replace(ROBOTS_INDEX, ROBOTS_NOINDEX);
  // 탭 제목 앞에 [dev] — 실서비스 탭과 미리보기 탭이 나란히 떠 있을 때 제목만 보고 갈려야 한다
  html = html.replace('<title>', '<title>[dev] ');
  // 미리보기의 공유 카드가 실서비스를 가리키면 안 된다 — 색인은 어차피 막지만,
  // 링크를 붙였을 때 엉뚱한 곳으로 가는 것을 막으려는 것이다
  html = html.split(SITE_URL).join(DEV_SITE_URL);
  // 공유 카드 그림도 갈아 끼운다 — 주소만 바꾸면 카드 그림이 실서비스와 똑같아,
  // 슬랙·카톡에 붙였을 때 어느 쪽 링크인지 **그림만 보고는 알 수가 없다**.
  // dev 판에는 빨간 테두리와 [DEV] 띠, 아래에 주소가 찍혀 있다 (frontend/static/og-dev.png)
  html = html.split('og-design.png').join('og-dev.png');
  html = html.split('도트 캠프와 함께하는 포켓몬 GO 가이드')
             .join('개발 미리보기 — 검색 색인 안 함');
}

// ── 데이터 미리 받기 — JS 를 다 받아 실행한 뒤에야 manifest → dex → meta 를 차례로 부르면
//    첫 내용이 그려지기까지 왕복이 셋 더 든다(LCP 3~4초, v4.4.2 측정). 어느 화면이든 반드시 쓰는 셋을
//    HTML 이 먼저 받아 두면 JS 가 도착했을 때 이미 손에 있다. 주소는 lib/data.ts 가 만드는 것과
//    글자 하나까지 같아야 브라우저가 같은 요청으로 본다 (as=fetch 는 crossorigin 이 있어야 짝이 맞는다)
const manifestPath = resolve(dirname(target), 'data/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
// manifest.json 은 index.html 이 이미 미리 받는다 — 해시가 붙는 둘만 여기서 끼운다
const preload = ['dex', 'meta'].map((name) => `${name}.json?v=${manifest.files[name]?.hash ?? 'dev'}`)
  .map((path) => `    <link rel="preload" as="fetch" href="/data/${path}" crossorigin>`).join('\n');
// 화면별 묶음은 주소(해시)를 봐야 안다 — HTML 을 읽는 즉시 도는 한 줄 스크립트가 해시에 맞는
// 묶음을 preload 로 건다. 해시 표는 빌드 때 여기서 박는다 (lib/data.ts 의 주소와 같은 모양)
const ROUTE_BUNDLES = {
  '': ['max', 'pve', 'updates'], dex: ['usage'], dmax: ['max', 'gameday'], 'dmax/deck': ['max'],
  pve: ['pve', 'gameday'], 'pve/solo': ['pve', 'gameday'], pvp: ['pvp'], 'pvp/deck': ['pvp'], 'pvp/ivrank': ['pvp'],
  raids: ['gameday'], eggs: ['gameday'], schedule: ['schedule'], 'game-updates': ['updates'], release: ['release'],
};
const hashes = Object.fromEntries(Object.entries(manifest.files).map(([name, one]) => [name, one.hash]));
const routeScript = `    <script>(function(){var H=${JSON.stringify(hashes)},R=${JSON.stringify(ROUTE_BUNDLES)};`
  + `var p=(location.hash||'').replace(/^#\\/?/,'').split('?')[0].replace(/\\/$/,'');`
  + `var need=R[p]||R[p.split('/')[0]]||[];for(var i=0;i<need.length;i++){if(!H[need[i]])continue;`
  + `var l=document.createElement('link');l.rel='preload';l.as='fetch';l.crossOrigin='anonymous';`
  + `l.href='/data/'+need[i]+'.json?v='+H[need[i]];document.head.appendChild(l);}})();</script>`;
if (html.indexOf('rel="modulepreload"') === -1) throw new Error('index.html 에 modulepreload 줄이 없습니다 — 미리 받기를 끼울 자리가 없다');
html = html.replace(/(\s*<link rel="modulepreload")/, `\n${preload}\n${routeScript}$1`);

writeFileSync(target, html);
const ga = channel === 'prod' && gaId ? `GA ${gaId}` : 'GA 없음';
console.log(`finalize ok: ${channel} · ${ga} · robots ${channel === 'dev' ? 'noindex' : 'index'} · ${target}`);
