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
}

writeFileSync(target, html);
const ga = channel === 'prod' && gaId ? `GA ${gaId}` : 'GA 없음';
console.log(`finalize ok: ${channel} · ${ga} · robots ${channel === 'dev' ? 'noindex' : 'index'} · ${target}`);
