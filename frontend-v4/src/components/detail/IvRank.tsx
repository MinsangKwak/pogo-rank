// ─────────────────────────────────────────────────────────────────────────────
// components/detail/IvRank.tsx — 'PvP 라면 이 개체값' (v3 components/ivrank.js ivrankDetailNode)
//
// PvP 는 CP 상한이 있어 **공격이 낮을수록 레벨을 더 올릴 수 있다.** 그래서 100% 개체가 1위가 아니다.
// 이 종이 PvP 순위에 없으면 아무것도 만들지 않는다 — 모든 종에 붙이면 "이 화면에 왜 이게 있지" 가 된다.
//
// 조합이 4,096개라 한 리그를 세는 데 제법 든다. useMemo 로 종·리그가 바뀔 때만 다시 센다.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useDex, usePvp } from '../../lib/data';
import { calcCp, cpmAt } from '../../lib/cp';
import type { DexForm, LeagueKey } from '../../types/data';

const IVRANK_LEAGUES: [LeagueKey, number | null][] = [['little', 500], ['great', 1500], ['ultra', 2500], ['master', null]];
const LEAGUE_KO: Record<LeagueKey, string> = { little: '리틀', great: '슈퍼', ultra: '하이퍼', master: '마스터' };
const MAX_LEVEL = 50;

/** CP 상한을 넘지 않는 가장 높은 레벨. CP 는 레벨에 단조 증가하므로 반씩 좁혀 찾는다 */
function bestLevel(form: DexForm, cpms: readonly number[], cap: number | null, a: number, d: number, h: number): number | null {
  if (cap == null) return MAX_LEVEL;
  let low = 1, high = MAX_LEVEL, best: number | null = null;
  while (low <= high) {
    const level = Math.floor(Math.round(low + high) / 2 * 2) / 2;   // 0.5 단위로 맞춘다
    if (calcCp(form, cpms, level, a, d, h) <= cap) { best = level; low = level + 0.5; }
    else high = level - 0.5;
  }
  return best;
}

/** 스탯 곱 1위 조합 — 공격 × 방어 × (내림한) 체력 */
function bestIv(form: DexForm, cpms: readonly number[], cap: number | null) {
  let top: { ivs: [number, number, number]; level: number; cp: number; product: number } | null = null;
  for (let a = 0; a <= 15; a += 1) for (let d = 0; d <= 15; d += 1) for (let h = 0; h <= 15; h += 1) {
    const level = bestLevel(form, cpms, cap, a, d, h);
    if (level == null) continue;   // Lv1 CP 가 이미 상한을 넘는다 (리틀리그의 전설 등)
    // **반레벨은 보간해야 한다** — cpms[floor(level)-1] 로 잘랐더니 Lv15.5 가 Lv15 로 계산돼
    // 슈퍼리그 1위가 v3 의 1/15/14 대신 0/5/13 으로 나왔다
    const m = cpmAt(cpms, level);
    const product = (form.atk + a) * m * ((form.def + d) * m) * Math.floor((form.hp + h) * m);
    if (!top || product > top.product) top = { ivs: [a, d, h], level, cp: calcCp(form, cpms, level, a, d, h), product };
  }
  return top;
}

export default function IvRank({ form, sprite }: { form: DexForm; sprite: number }) {
  const { data: pvp } = usePvp();
  const { data: dex } = useDex();
  const cpms = dex.DEX_DATA.cpms;

  const rows = useMemo(() => {
    const out: { league: LeagueKey; rank: number; ivs: string; level: number; cp: number }[] = [];
    for (const [league, cap] of IVRANK_LEAGUES) {
      const hit = (pvp.PVP_DATA[league] ?? []).find((row) => row.sprite === sprite);
      if (!hit) continue;
      const best = bestIv(form, cpms, cap);
      if (!best) continue;
      out.push({ league, rank: hit.rank, ivs: best.ivs.join('/'), level: best.level, cp: best.cp });
    }
    return out;
  }, [form, sprite, cpms, pvp]);

  if (!rows.length) return null;
  return (
    <details className="detail__acc ivrank__detail">
      <summary>🧬 PvP 라면 이 개체값<span className="ivrank__badge ivrank__badge--pvp">PvP</span></summary>
      <div className="detail__acc-body">
        <p className="meta ivrank__why">
          PvP 는 CP 상한이 있어 공격이 낮을수록 레벨을 더 올릴 수 있어요. 그래서 100% 개체가 1위가 아니에요.
        </p>
        {rows.map((row) => (
          <div key={row.league} className="ivrank__pick-row">
            <span className="ivrank__pick-lg">{LEAGUE_KO[row.league]}리그<span className="meta"> 순위 {row.rank}위</span></span>
            <b>{row.ivs}</b>
            <span className="meta">Lv{row.level} · CP {row.cp.toLocaleString()}</span>
          </div>
        ))}
        <p className="meta ivrank__more">🧬 PvP 개체값 순위 화면에서 내 개체가 몇 위인지 볼 수 있어요.</p>
      </div>
    </details>
  );
}
