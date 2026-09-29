// ─────────────────────────────────────────────────────────────────────────────
// lib/hotMons.ts — "이번 주 많이 본 포켓몬" (2026-09-29)
//
// 서버가 상세 팝업을 연 수를 도감 번호로 모아 준다 (GET /v1/mons/hot · server/src/lib/hot.ts hotMons).
// 여기서는 번호를 도감 이름표(useDexSoft)에 대어 이름 · 타입을 붙이고, 이름표에 없는 번호는 뺀다 —
// 번호만 있는 줄을 그리면 화면에 '#0' 같은 것이 선다 (CLAUDE.md §1).
// 문턱은 없다(주인 결정 — 지금 수치 그대로). 7일 창이 비면 누적(서비스 시작부터)을 다시 묻는다.
// 열 자리가 남으면 남은 맥스 일정의 다이맥스 · 거다이맥스 보스로 채운다(주인 결정 — 검색이 늘어야 한다). 그래도 비면 홈이 구역을 안 그린다.
// 첫 그림은 서버 그림과 같아야 하므로(하이드레이션) 붙은 뒤에 한 번 받고, 탭이 살아 있는 동안은 다시 안 받는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useEffect, useMemo, useState } from 'react';
import { useDexSoft, useMetaSoft } from './data';
import { fetchHotMons, type HotMon, type HotMons } from './serverApi';
import { fillBosses, useMaxSlidesSoft, type FillBoss } from './weekBosses';

/** 화면 한 줄 — 순위표 줄에 이름 · 타입이 붙은 것 */
export interface HotMonRow extends HotMon { name: string; types: readonly string[] }

export const HOT_MON_MAX = 10;
/** 이번 주 창 · 누적 창(관리자 통계의 긴 끝과 같은 400일 — 서비스 시작부터) */
export const HOT_MON_WEEK = 7;
export const HOT_MON_ALL = 400;

/** 번호 → 이름표. 이름표에 없는 번호(폼 전용 · 오류)는 버린다. 순서는 서버가 정한 그대로(본 사람 → 횟수) */
export function rankMons(
  rows: readonly HotMon[],
  names: Readonly<Record<string, string>> | undefined,
  forms: Readonly<Record<string, { types?: readonly string[] } | undefined>> | undefined,
  max = HOT_MON_MAX,
): HotMonRow[] {
  if (!names) return [];
  const out: HotMonRow[] = [];
  for (const row of rows) {
    const name = names[String(row.dex)];
    if (!name || !Number.isInteger(row.dex) || row.dex <= 0) continue;
    out.push({ ...row, name, types: [...(forms?.[String(row.dex)]?.types ?? [])] });
    if (out.length >= max) break;
  }
  return out;
}

let cached: Promise<HotMons> | null = null;

/** 이번 주가 비면 누적으로 — 초기엔 한 주 안에 아무도 안 열었을 수 있다 (2026-09-29 주인 결정) */
type Fetcher = (days: number, limit: number, channel: 'prod' | 'dev') => Promise<HotMons>;
export async function loadHotMons(channel: 'prod' | 'dev', fetcher: Fetcher = fetchHotMons): Promise<HotMons> {
  const week = await fetcher(HOT_MON_WEEK, HOT_MON_MAX, channel);
  if (week.rows.length) return week;
  return fetcher(HOT_MON_ALL, HOT_MON_MAX, channel);
}

/** 미리보기 판(-dev)은 dev 채널의 기록을 본다 — 수집기(lib/collect.ts)가 채널을 가르는 것과 같은 규칙 */
export const hotChannel = (appVersion: string | undefined): 'prod' | 'dev' => (appVersion?.endsWith('-dev') ? 'dev' : 'prod');

/** 홈이 쓴다. 이름표 · 판 번호(meta)가 오기 전에는 빈 줄 — 그때는 아직 구역을 안 그린다. allTime 은 누적으로 떨어졌다는 뜻, fill 은 남은 자리를 메운 맥스 보스 */
export function useHotMons(): { rows: HotMonRow[]; window: number; allTime: boolean; fill: FillBoss[] } {
  const dex = useDexSoft();
  const meta = useMetaSoft();
  const version = meta?.APP_VERSION;
  const [got, setGot] = useState<HotMons | null>(null);
  useEffect(() => {
    // 판 번호가 와야 채널을 안다 — 먼저 운영으로 물었다가 dev 로 다시 묻지 않는다
    if (version === undefined) return undefined;
    let alive = true;
    cached ??= loadHotMons(hotChannel(version));
    void cached.then((body) => { if (alive) setGot(body); });
    return () => { alive = false; };
  }, [version]);
  const rows = useMemo(() => rankMons(got?.rows ?? [], dex?.DEX_DATA.names, dex?.DEX_DATA.forms), [got, dex]);
  const slides = useMaxSlidesSoft();
  // 응답이 오기 전엔 채우지 않는다 — 먼저 보스만 섰다가 순위가 끼어들면 칩이 밀린다
  const fill = useMemo(() => (got ? fillBosses(slides, HOT_MON_MAX - rows.length, new Set(rows.map((row) => row.dex))) : []), [got, slides, rows]);
  const window = got?.window ?? HOT_MON_WEEK;
  return { rows, window, allTime: window >= HOT_MON_ALL, fill };
}
