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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

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
// 월 일정표는 data.js 가 아니라 **화면 코드 안**에 손으로 적혀 있다 (components/schedule.js SCHEDULE_MONTHS).
// 그 파일은 맨 끝에서 renderSchedule() 을 불러 DOM 을 건드리므로, 표를 선언하는 앞부분만 잘라 실행한다.
// 손으로 다시 옮겨 적지 않는다 — 실제 일정이라 한 글자만 어긋나도 틀린 날짜를 내보내게 된다
{
  const path = 'frontend/scripts/components/schedule.js';
  const text = readFileSync(resolve(repo, path), 'utf8');
  const cut = text.indexOf('const SCHEDULE_ITEMS');
  // 못 찾으면 **여기서** 멈춘다. indexOf 가 -1 이면 slice 가 첫 줄만 잘라 내고,
  // 그러면 아래 전역 검사가 'SCHEDULE_MONTHS 를 번들에서 못 찾았습니다' 라고 엉뚱한 곳을 가리킨다
  if (cut < 0) {
    console.error(`${path} 에서 'const SCHEDULE_ITEMS' 를 못 찾았습니다 — 그 앞까지가 표 선언이라 보고 자르는 중입니다.`);
    console.error('v3 쪽에서 이름이나 차례가 바뀌었다면 이 자르는 기준도 같이 고쳐야 합니다.');
    process.exit(1);
  }
  vm.runInContext(text.slice(0, text.indexOf('\n', cut)), sandbox, { filename: 'schedule.js' });
}

// 패치노트 본문과 판 번호도 **화면 코드 안**에 손으로 적혀 있다.
//   scripts/release-notes.js        RELEASE_NOTES (160판)
//   components/release.js           RELEASE_VER  (빨간 점 판정에 쓰는 문자열 하나)
// 둘 다 파일 전체를 돌리면 화면을 건드리므로 필요한 선언만 잘라 실행한다.
// 손으로 옮겨 적지 않는다 — 사용자가 그대로 읽는 문구라 한 글자만 어긋나도 기록이 틀어진다
{
  vm.runInContext(readFileSync(resolve(repo, 'frontend/scripts/release-notes.js'), 'utf8'), sandbox, { filename: 'release-notes.js' });
  const path = 'frontend/scripts/components/release.js';
  const text = readFileSync(resolve(repo, path), 'utf8');
  const line = text.split('\n').find((one) => one.startsWith('const RELEASE_VER'));
  if (!line) {
    console.error(`${path} 에서 'const RELEASE_VER' 을 못 찾았습니다 — 이름이 바뀌었는지 확인하세요.`);
    process.exit(1);
  }
  vm.runInContext(line, sandbox, { filename: 'release.js' });
}

// 문의 이메일은 저장소에 없다 — 빌드가 환경변수에서 읽어 dist/index.html 에 박아 넣는다.
// 그 값을 그대로 꺼내 쓴다 (약관·개인정보처리방침의 문의처가 이 한 곳을 본다).
// 비어 있으면 v3 와 같이 '사이트 운영자' 로 적힌다
{
  const html = readFileSync(resolve(distV3, 'index.html'), 'utf8');
  const hit = /const CONTACT_EMAIL = "([^"]*)"/.exec(html);
  vm.runInContext(`var CONTACT_EMAIL = ${JSON.stringify(hit?.[1] ?? '')};`, sandbox, { filename: 'index.html' });
}

const readGlobal = (key) => vm.runInContext(`typeof ${key} === 'undefined' ? undefined : ${key}`, sandbox);

// 파일 하나 = 같이 바뀌는 표 묶음.
// 값은 전역 이름이거나 [실을 이름, 전역에서 꺼낼 경로] 다 —
// 'usage' 는 VALUE_DATA 전체(319KB)가 아니라 그 안의 한 가지만 필요해서 경로로 집는다.
// 순위 화면 셋이 모두 '활용 N곳' 배지에 쓰므로 따로 가른다
const BUNDLES = {
  dex: ['DEX_DATA', 'TYPE_KO', 'TYPE_EN', 'FORM_LABELS', 'SPRITE_IDS', 'SPRITE_ANIM_IDS'],
  max: ['DMAX_DATA', 'DMAX_TANK', 'DMAX_TIER', 'MAX_POOL'],
  pve: ['PVE_DATA', 'PVE_EASY', 'BOSS_LIST'],
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
  meta: ['RANK_DELTA_DATE', 'RANK_FRESH_DAYS', 'DATA_FETCHED', 'DATA_STALE', 'CONTACT_EMAIL', 'RELEASE_VER'],
  // 패치노트는 첫 화면이 한 글자도 안 쓴다 — 제 묶음으로 갈라 그 화면을 열 때만 받는다 (v3 v3.46.0 과 같은 판단)
  release: ['RELEASE_NOTES', 'RELEASE_VER'],
  schedule: ['SCHEDULE_MONTHS', 'SCHEDULE_CATS'],
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
console.log(`데이터 ${Object.keys(BUNDLES).length}개 · 합계 ${(total / 1024).toFixed(0)}KB`);
