// ─────────────────────────────────────────────────────────────────────────────
// lib/useBossBoard.ts — 이번 주 보스판과 추천 셈의 재료를 한 번에 (2026-10-13)
//
// 홈(components/WeekBosses.tsx · HotMons.tsx)과 팝업(components/detail/VsCard.tsx)이 같은 판 · 같은 추천을 본다.
// 홈은 데이터 Suspense 밖이라 묶음이 오기 전에도 그려야 한다 — 그래서 '…Soft' 훅으로 받고, 안 온 것은 비워 둔다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useEffect, useMemo, useState } from 'react';
import { useDexSoft, useGamedaySoft, useMaxSoft, usePveSoft, usePvpSoft } from './data';
import { useRankStore } from '../stores/rank';
import { bossBoard, type BossCard } from './bossBoard';
import { bossCounters, type BossCounters, type BossKind, type CounterSource } from './bossCounters';
import { useMaxSlidesSoft } from './weekBosses';

/**
 * 이번 주 보스판 — 홈 배너와 같은 맥스 일정 + gameday 레이드. '지금' 은 처음 그릴 때 한 번.
 * **다 돌려준다** — 장 수 상한(BOARD_MAX)은 홈 카드 줄이 그릴 때만 자른다. 여기서 자르면 일곱 번째 보스의 팝업 '상대할 때' 카드와
 * '많이 보는 포켓몬' 의 이유가 같이 사라진다 (Codex, PR #361)
 */
/** '지금' 을 다시 재는 틈 — 맥스 먼데이 06:00 · 섀도우 10:00/20:00 · 레이드 10:00 경계를 탭을 열어 둔 채로도 넘긴다 */
export const BOARD_TICK_MS = 60 * 1000;

export function useBossBoard(): { board: BossCard[]; nowMs: number } {
  // 처음은 그릴 때 한 번(서버 그림과 첫 그림이 같아야 한다), 그 뒤 1분마다 — 탭을 열어 둔 채 경계를 넘으면
  // 'D-1' 이 '진행 중' 으로, 끝난 보스는 빠지고, 섀도우의 다음 주말이 바뀐다 (Codex, PR #361)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), BOARD_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const slides = useMaxSlidesSoft();
  const gameday = useGamedaySoft();
  const dex = useDexSoft();
  const pve = usePveSoft();
  // 폼 이름('오리진폼 기라티나')으로 그림 · 타입 찾기 — 지금 레이드 목록(gameday)과 레이드 성능표(pve)에서. 둘 다 안 왔으면 원종으로 선다
  const lookup = useMemo(() => {
    const table = new Map<string, { sprite: number; types: readonly string[] }>();
    for (const rows of Object.values(pve?.PVE_DATA ?? {})) for (const row of rows) if (!table.has(row.name)) table.set(row.name, { sprite: row.sprite, types: row.types });
    for (const rows of Object.values(gameday?.GAMEDAY.raids ?? {})) for (const row of rows) if (!table.has(row.name)) table.set(row.name, { sprite: row.sprite, types: row.types ?? [] });
    return (name: string) => table.get(name) ?? null;
  }, [pve, gameday]);
  const board = useMemo(() => bossBoard({
    slides,
    events: gameday?.GAMEDAY.events,
    names: dex?.DEX_DATA.names,
    en: dex?.DEX_DATA.en,
    forms: dex?.DEX_DATA.forms,
    megas: dex?.DEX_DATA.megas,
    dexTable: dex?.DEX_DATA.dex,
    lookup,
  }, nowMs, { max: Infinity }), [slides, gameday, dex, lookup, nowMs]);
  return { board, nowMs };
}

/** 추천 셈의 재료 — 묶음이 하나라도 안 왔으면 null (그때는 추천 줄을 비워 둔다) */
export function useCounterSource(): CounterSource | null {
  const dex = useDexSoft();
  const max = useMaxSoft();
  const pve = usePveSoft();
  const pvp = usePvpSoft();
  // D-MAX 화면의 [맥스 참가 가능 다른 유닛] 체크를 따른다 — 팝업의 '보스로 만났을 때' 와 같은 규칙 (2026-10-06)
  const showJoin = useRankStore((s) => s.maxShowJoin);
  return useMemo(() => (dex && max && pve && pvp ? {
    chart: dex.DEX_DATA.chart, typeKo: dex.TYPE_KO, dexTable: dex.DEX_DATA.dex,
    dmax: max.DMAX_DATA, pve: pve.PVE_DATA, sheet: pvp.SHEET_DATA.pve, showJoin,
  } : null), [dex, max, pve, pvp, showJoin]);
}

/** 한 보스의 추천 `limit` 마리 — 재료가 없으면 null */
export function countersOf(src: CounterSource | null, kind: BossKind, types: readonly string[], limit: number): BossCounters | null {
  return src ? bossCounters(kind, types, src, limit) : null;
}
