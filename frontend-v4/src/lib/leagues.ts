// ─────────────────────────────────────────────────────────────────────────────
// lib/leagues.ts — 리그 한 벌 (v3 data.js LEAGUES · LEAGUE_KO)
//
// 세그먼트에 서는 이름은 '리그' 를 뗀 짧은 쪽이다 — [리틀|슈퍼|하이퍼|마스터].
// 순위표 · 개체값 순위 · 덱 짜기 셋이 같은 표를 본다 (리그는 이 화면들이 공유하는 축이다).
// ─────────────────────────────────────────────────────────────────────────────
import type { LeagueKey } from '../types/data';

export const LEAGUES: readonly { id: LeagueKey; name: string; cp: string }[] = [
  { id: 'little', name: '리틀', cp: '500' },
  { id: 'great', name: '슈퍼', cp: '1500' },
  { id: 'ultra', name: '하이퍼', cp: '2500' },
  { id: 'master', name: '마스터', cp: '10000' },
];
