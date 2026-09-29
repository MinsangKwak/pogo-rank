// ─────────────────────────────────────────────────────────────────────────────
// lib/hotMons.ts — "이번 주 많이 본 포켓몬" (2026-09-29)
//
// 서버가 상세 팝업을 연 수를 도감 번호로 모아 준다 (GET /v1/mons/hot · server/src/lib/hot.ts hotMons).
// 여기서는 번호를 도감 이름표(useDexSoft)에 대어 이름 · 타입을 붙이고, 이름표에 없는 번호는 뺀다 —
// 번호만 있는 줄을 그리면 화면에 '#0' 같은 것이 선다 (CLAUDE.md §1).
// 문턱은 없다(주인 결정 — 지금 수치 그대로). 줄이 하나도 없으면 홈이 구역을 안 그린다.
// 첫 그림은 서버 그림과 같아야 하므로(하이드레이션) 붙은 뒤에 한 번 받고, 탭이 살아 있는 동안은 다시 안 받는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useEffect, useMemo, useState } from 'react';
import { useDexSoft, useMetaSoft } from './data';
import { fetchHotMons, type HotMon, type HotMons } from './serverApi';

/** 화면 한 줄 — 순위표 줄에 이름 · 타입이 붙은 것 */
export interface HotMonRow extends HotMon { name: string; types: readonly string[] }

export const HOT_MON_MAX = 8;

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

/** 미리보기 판(-dev)은 dev 채널의 기록을 본다 — 수집기(lib/collect.ts)가 채널을 가르는 것과 같은 규칙 */
export const hotChannel = (appVersion: string | undefined): 'prod' | 'dev' => (appVersion?.endsWith('-dev') ? 'dev' : 'prod');

/** 홈이 쓴다. 이름표 · 판 번호(meta)가 오기 전에는 빈 줄 — 그때는 아직 구역을 안 그린다 */
export function useHotMons(): { rows: HotMonRow[]; window: number } {
  const dex = useDexSoft();
  const meta = useMetaSoft();
  const version = meta?.APP_VERSION;
  const [got, setGot] = useState<HotMons | null>(null);
  useEffect(() => {
    // 판 번호가 와야 채널을 안다 — 먼저 운영으로 물었다가 dev 로 다시 묻지 않는다
    if (version === undefined) return undefined;
    let alive = true;
    cached ??= fetchHotMons(7, HOT_MON_MAX, hotChannel(version));
    void cached.then((body) => { if (alive) setGot(body); });
    return () => { alive = false; };
  }, [version]);
  const rows = useMemo(() => rankMons(got?.rows ?? [], dex?.DEX_DATA.names, dex?.DEX_DATA.forms), [got, dex]);
  return { rows, window: got?.window ?? 7 };
}
