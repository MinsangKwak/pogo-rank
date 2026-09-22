// ─────────────────────────────────────────────────────────────────────────────
// scripts/extract-data.mjs — v3 번들에서 데이터를 뽑아 JSON 으로 가른다
//
// 왜 이 방식인가 (계획 문서 Phase 1 의 다리)
//   최종안은 backend/build.py 가 js_data() 대신 json.dump() 로 바로 JSON 을 쓰는 것이다.
//   다만 build.py 를 고치면 **운영 중인 v3 빌드가 같이 흔들린다.** 그래서 전환 기간에는
//   v3 가 이미 만들어 낸 dist/data.js · dist/data-lazy.js 를 vm 으로 실행해 전역을 꺼내 쓴다.
//   이렇게 하면 JSON 이 v3 가 화면에 쓰는 값과 **정의상 같다** — 동등성 검증이 공짜다.
//   Phase 1 을 정식으로 끝낼 때 이 파일을 지우고 build.py 쪽으로 옮긴다.
//
// 가르는 기준은 "파일 크기" 가 아니라 **"같이 바뀌는가"** 다 (계획 문서 데이터 계층).
//   dex 는 거의 안 바뀌고 gameday 는 매주 바뀐다 — 한 덩어리로 두면 일정 하나에 985KB 를 다시 받는다.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { mergeSchedule } from './merge-schedule.mjs';
// 2026-09-22 v5 Phase 1 — 손으로 적는 자료는 content/ 가 가진다.
// 전에는 v3 화면 코드를 vm 으로 돌려 꺼냈다. 자료가 화면 코드 안에 살면 그 화면을 못 지운다
import { SCHEDULE_CATS, SCHEDULE_MONTHS } from '../../content/schedule.mjs';
import { RELEASE_NOTES } from '../../content/release-notes.mjs';
import { RELEASE_NOTES_EN } from '../../content/release-notes.en.mjs';
import { I18N_EN, I18N_PATTERNS } from '../../content/i18n.en.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const distV3 = resolve(repo, 'dist');
const out = resolve(here, '../public/data');

for (const name of ['data.js', 'data-lazy.js']) {
  if (!existsSync(resolve(distV3, name))) {
    console.error(`dist/${name} 이 없습니다 — 저장소 루트에서 python3 backend/build.py 를 먼저 돌리세요.`);
    process.exit(1);
  }
}

// v3 번들은 모듈이 아니라 전역 선언 덩어리다.
// **주의** — `const` 는 렉시컬 선언이라 sandbox 객체의 속성이 되지 않는다(`var` 만 된다).
// 그래서 값은 sandbox 를 뒤지지 말고 컨텍스트 안에서 이름을 **평가해서** 꺼낸다
const sandbox = vm.createContext({});
for (const name of ['data.js', 'data-lazy.js']) {
  vm.runInContext(readFileSync(resolve(distV3, name), 'utf8'), sandbox, { filename: name });
}
// content/ 의 자료를 sandbox 에 넣는다. 아래 코드는 그대로 전역 이름으로 읽는다.
// 정규식은 JSON 에 안 담기므로 본문·플래그로 펴 둔다 (읽는 쪽이 new RegExp 로 되세운다)
{
  const flatPatterns = I18N_PATTERNS.map((row) => [row[0].source, row[0].flags, row[1]]);
  const put = {
    SCHEDULE_CATS, SCHEDULE_MONTHS, RELEASE_NOTES, RELEASE_NOTES_EN, I18N_EN,
    __i18nPatterns: flatPatterns,
  };
  vm.runInContext(
    Object.entries(put).map(([name, value]) => `var ${name} = ${JSON.stringify(value)};`).join('\n'),
    sandbox, { filename: 'content' },
  );
}

// 2026-09-22 v5 Phase 1 — 설정은 환경변수가 원본이다.
// 전에는 build.py 가 .env 를 읽어 dist/index.html 에 박아 넣은 값을 **정규식으로 도로 긁어내고**
// 있었다. v3 의 HTML 이 v4 데이터의 전달자였던 셈이라, 그 HTML 을 못 지웠다.
// 이제 같은 자리(.env · CI 시크릿)를 직접 본다 — build.py read_config() 와 같은 이름들이다.
{
  // build.py load_dotenv() 와 같은 규칙. 이미 있는 환경변수를 덮지 않는다(CI 가 이긴다)
  const envPath = resolve(repo, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const text = line.trim();
      if (!text || text.startsWith('#') || !text.includes('=')) continue;
      const [key, ...rest] = text.split('=');
      const value = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (process.env[key.trim()] === undefined) process.env[key.trim()] = value;
    }
  }
  const env = (name) => process.env[name] ?? '';
  // 판 번호는 release/version.json 이 원본. dev 채널 접미사는 build.py 와 같은 규칙이다
  const version = JSON.parse(readFileSync(resolve(repo, 'release/version.json'), 'utf8'));
  const appVersion = version.app + (env('BUILD_CHANNEL') === 'dev' ? '-dev' : '');
  // 데이터 기준일은 게임 마스터가 들고 있다 (build.py 도 같은 값을 HTML 에 박았다)
  const gmPath = resolve(repo, 'data/gm.json');
  const dataTimestamp = existsSync(gmPath) ? JSON.parse(readFileSync(gmPath, 'utf8')).timestamp ?? '' : '';

  let firebase = {};
  try { firebase = JSON.parse(env('FIREBASE_CONFIG_JSON') || '{}'); }
  catch { console.error('FIREBASE_CONFIG_JSON 이 JSON 이 아닙니다 — 빈 값으로 둡니다 (로그인 UI 가 안 뜹니다)'); }

  vm.runInContext([
    `var CONTACT_EMAIL = ${JSON.stringify(env('CONTACT_EMAIL'))};`,
    `var ADMIN_UID = ${JSON.stringify(env('ADMIN_UID'))};`,
    `var ADMIN_EMAIL = ${JSON.stringify(env('ADMIN_EMAIL'))};`,
    `var COLLECT_URL = ${JSON.stringify(env('COLLECT_URL').replace(/\/+$/, ''))};`,
    `var FIREBASE_CONFIG = ${JSON.stringify(firebase)};`,
    `var APP_VERSION = ${JSON.stringify(appVersion)};`,
    `var DATA_TIMESTAMP = ${JSON.stringify(dataTimestamp)};`,
    `var RELEASE_VER = ${JSON.stringify(version.release)};`,
  ].join('\n'), sandbox, { filename: 'config' });
}

const readGlobal = (key) => vm.runInContext(`typeof ${key} === 'undefined' ? undefined : ${key}`, sandbox);

// 월 일정표는 손으로 적은 표(SCHEDULE_MONTHS)에 자동 수집분(data/schedule.json, backend/schedule_build.py)을 합친다.
// 같은 자리는 손 줄이 이기고, 자동분은 빈 자리만 채운다 (merge-schedule.mjs). 파일이 없으면 손 표만 나간다 —
// 빌드를 --meta-only 로 돌린 자리에서도 v4 가 서야 한다
{
  const path = resolve(repo, 'data/schedule.json');
  const auto = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).months ?? {} : {};
  const merged = mergeSchedule(readGlobal('SCHEDULE_MONTHS'), auto);
  const autoCount = Object.values(merged).reduce((sum, month) => sum + month.items.filter((item) => item.auto).length, 0);
  vm.runInContext(`var __scheduleMerged = ${JSON.stringify(merged)};`, sandbox, { filename: 'schedule-merge' });
  console.log(`  일정표: 손 ${Object.keys(readGlobal('SCHEDULE_MONTHS') ?? {}).length}달 + 자동 ${Object.keys(auto).length}달 → ${Object.keys(merged).length}달, 자동 줄 ${autoCount}개`);
}

// 파일 하나 = 같이 바뀌는 표 묶음.
// 값은 전역 이름이거나 [실을 이름, 전역에서 꺼낼 경로] 다 —
// 'usage' 는 VALUE_DATA 전체(319KB)가 아니라 그 안의 한 가지만 필요해서 경로로 집는다.
// 순위 화면 셋이 모두 '활용 N곳' 배지에 쓰므로 따로 가른다
const BUNDLES = {
  dex: ['DEX_DATA', 'TYPE_KO', 'TYPE_EN', 'FORM_LABELS', 'SPRITE_IDS', 'SPRITE_ANIM_IDS'],
  max: ['DMAX_DATA', 'DMAX_TANK', 'DMAX_TIER', 'MAX_POOL'],
  pve: ['PVE_DATA', 'PVE_EASY', 'PVE_BY_TYPE', 'BOSS_LIST'],
  pvp: ['PVP_DATA', 'VALUE_DATA', 'SHEET_DATA'],
  gameday: ['GAMEDAY', 'MOVE_CHANGES'],
  'fav-events': ['FAV_EVENTS'],
  updates: ['GAME_UPDATES', 'GAME_ARCHIVE'],
  // usage 가 아니라 usage_places 다 — usage(80종)는 요약이고 **원본은 usage_places(333종)** 이다.
  // 배지 숫자가 v3 와 하나 어긋나 찾았다: '거다이맥스 고릴타' 가 13곳인데 12곳으로 나왔고,
  // 나머지 1곳은 원종 '고릴타' 줄에 있었다 (v3 usagePlacesOf 가 이 표를 먼저 본다)
  usage: [['USAGE_PLACES', 'VALUE_DATA.usage_places'], ['METER', 'VALUE_DATA.meter']],
  // RELEASE_VER 은 **본문이 아니라 판 번호 하나**다 — 셸의 빨간 점이 첫 화면부터 이 값을 봐야 해서
  // 50KB 본문(release.json)이 아니라 여기 함께 싣는다
  meta: ['RANK_DELTA_DATE', 'RANK_FRESH_DAYS', 'DATA_FETCHED', 'DATA_STALE', 'CONTACT_EMAIL', 'RELEASE_VER', 'APP_VERSION', 'DATA_TIMESTAMP', 'FIREBASE_CONFIG', 'ADMIN_UID', 'ADMIN_EMAIL', 'COLLECT_URL'],
  // 패치노트는 첫 화면이 한 글자도 안 쓴다 — 제 묶음으로 갈라 그 화면을 열 때만 받는다 (v3 v3.46.0 과 같은 판단)
  release: ['RELEASE_NOTES', 'RELEASE_VER', 'RELEASE_NOTES_EN'],
  // 영문 사전도 EN 을 켠 사람만 받는다. **규칙(I18N_PATTERNS)은 정규식이라 JSON 에 그대로 못 담는다** —
  // [본문, 플래그, 번역틀] 로 펴서 싣고 읽는 쪽이 다시 세운다 (lib/i18n.ts)
  i18n: ['I18N_EN', ['I18N_PATTERNS', '__i18nPatterns']],
  // 손으로 적은 표에 자동 수집분을 합친 것 — 위 병합 블록이 만든다 (v4.7.2 WBS-224)
  schedule: [['SCHEDULE_MONTHS', '__scheduleMerged'], 'SCHEDULE_CATS'],
};

mkdirSync(out, { recursive: true });
const manifest = { built: new Date().toISOString(), files: {} };
let total = 0;

for (const [name, keys] of Object.entries(BUNDLES)) {
  const payload = {};
  for (const entry of keys) {
    const [name, path] = Array.isArray(entry) ? entry : [entry, entry];
    const value = readGlobal(path);
    if (value === undefined) {
      console.error(`${path} 를 v3 번들에서 못 찾았습니다 — 이름이 바뀌었는지 확인하세요.`);
      process.exit(1);
    }
    payload[name] = value;
  }
  const text = JSON.stringify(payload);
  // 해시는 파일명이 아니라 매니페스트에 둔다 — 정적 호스팅에서 경로가 하나면 캐시 무효화를 쿼리로 한다
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
  writeFileSync(resolve(out, `${name}.json`), text);
  manifest.files[name] = { hash, bytes: text.length };
  total += text.length;
  console.log(`  ${name}.json  ${(text.length / 1024).toFixed(0)}KB  ${hash}`);
}

writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
// ── PWA 정적 파일 (아이콘 · manifest) ────────────────────────────────────────
// assets/ 의 것을 그대로 옮긴다. 아이콘은 그림 파일이라 저장소에 두 벌 두지 않고,
// 데이터와 같은 규칙으로 빌드 때 가져온다 (public/ 의 이 파일들은 .gitignore 에 있다)
{
  const from = resolve(repo, 'assets');
  const to = resolve(here, '../public');
  for (const name of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'og.png', 'og-design.png', 'og-dev.png', 'logo.svg']) {
    copyFileSync(resolve(from, name), resolve(to, name));
  }
  console.log('  PWA·브랜드 정적 파일 7개 (assets/ 에서)');
}

console.log(`데이터 ${Object.keys(BUNDLES).length}개 · 합계 ${(total / 1024).toFixed(0)}KB`);
