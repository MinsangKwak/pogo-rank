'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// data.js — 프론트 전역에서 쓰는 정적 상수
//
// build.py의 SCRIPTS 목록에서 가장 먼저 이어붙는 파일이다. 모든 js가 하나의 <script>로
// 합쳐지므로 이 파일 첫 줄의 'use strict'가 번들 전체에 적용된다 — 위치를 옮기지 말 것.
//
// 제공하는 전역
//   LEAGUES     PvP 리그 정의 배열. 배열 순서가 곧 리그 토글(seg)에 보이는 순서다
//   LEAGUE_KO   리그 id → 한글 이름. 배열을 훑지 않고 이름만 바로 꺼낼 때 쓴다
//   SHOW        목록 기본 표시 개수. list()가 이만큼만 보여주고 나머지는 더보기로 감춘다
//
// 의존하는 전역
//   없음 (빌드가 주입하는 데이터는 아래 주석대로 별도 파일에서 들어온다)
// ─────────────────────────────────────────────────────────────────────────────

// 2026-09-03 v2.0.0: 빌드 주입 데이터(TYPE_KO·PVP_DATA·…·DEX_DATA·BOSS_LIST·SPRITE_IDS)는
// 외부 dist/data.js 로 분리 — index.html이 <script src="data.js">로 먼저 로드한다
// 스프라이트는 base64 인라인 대신 개별 png(dist/sprites/) + lazy 로딩

// ── 정적 상수 ──
// id는 PVP_DATA의 키이자 state.league에 담기는 값, name은 화면에 보이는 한글 이름,
// cp는 그 리그의 CP 상한 (빌드 쪽 (cp_cap, league_id) 짝과 같은 값이다)
const LEAGUES = [
  { id: 'little', name: '리틀', cp: 500 },
  { id: 'great', name: '슈퍼', cp: 1500 },
  { id: 'ultra', name: '하이퍼', cp: 2500 },
  { id: 'master', name: '마스터', cp: 10000 },
];
const LEAGUE_KO = { little: '리틀', great: '슈퍼', ultra: '하이퍼', master: '마스터' };

// 목록 기본 표시 개수 (더보기로 펼침)
const SHOW = 10;
