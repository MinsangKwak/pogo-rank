'use strict';

// 2026-09-03 v2.0.0: 빌드 주입 데이터(TYPE_KO·PVP_DATA·…·DEX_DATA·BOSS_LIST·SPRITE_IDS)는
// 외부 dist/data.js 로 분리 — index.html이 <script src="data.js">로 먼저 로드한다
// 스프라이트는 base64 인라인 대신 개별 png(dist/sprites/) + lazy 로딩

// ── 정적 상수 ──
const LEAGUES = [
  { id: 'little', name: '리틀', cp: 500 },
  { id: 'great', name: '슈퍼', cp: 1500 },
  { id: 'ultra', name: '하이퍼', cp: 2500 },
  { id: 'master', name: '마스터', cp: 10000 },
];
const LEAGUE_KO = { little: '리틀', great: '슈퍼', ultra: '하이퍼', master: '마스터' };

// 목록 기본 표시 개수 (더보기로 펼침)
const SHOW = 10;
