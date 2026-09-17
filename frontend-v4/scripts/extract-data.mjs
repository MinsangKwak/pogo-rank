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
const readGlobal = (key) => vm.runInContext(`typeof ${key} === 'undefined' ? undefined : ${key}`, sandbox);

// 파일 하나 = 같이 바뀌는 표 묶음
const BUNDLES = {
  dex: ['DEX_DATA', 'TYPE_KO', 'TYPE_EN', 'FORM_LABELS', 'SPRITE_IDS', 'SPRITE_ANIM_IDS'],
  max: ['DMAX_DATA', 'DMAX_TANK', 'DMAX_TIER', 'MAX_POOL'],
  pve: ['PVE_DATA', 'PVE_EASY', 'BOSS_LIST'],
  pvp: ['PVP_DATA', 'VALUE_DATA', 'SHEET_DATA'],
  gameday: ['GAMEDAY', 'MOVE_CHANGES'],
  'fav-events': ['FAV_EVENTS'],
  updates: ['GAME_UPDATES', 'GAME_ARCHIVE'],
  meta: ['RANK_DELTA_DATE', 'RANK_FRESH_DAYS', 'DATA_FETCHED', 'DATA_STALE'],
};

mkdirSync(out, { recursive: true });
const manifest = { built: new Date().toISOString(), files: {} };
let total = 0;

for (const [name, keys] of Object.entries(BUNDLES)) {
  const payload = {};
  for (const key of keys) {
    const value = readGlobal(key);
    if (value === undefined) {
      console.error(`전역 ${key} 를 v3 번들에서 못 찾았습니다 — 이름이 바뀌었는지 확인하세요.`);
      process.exit(1);
    }
    payload[key] = value;
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
