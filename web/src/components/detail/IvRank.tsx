// ─────────────────────────────────────────────────────────────────────────────
// components/detail/IvRank.tsx — 'PvP 추천 개체값' (v3 components/ivrank.js ivrankDetailNode · v6 D02)
//
// PvP 는 CP 상한이 있어 **공격이 낮을수록 레벨을 더 올릴 수 있다.** 그래서 100% 개체가 1위가 아니다.
// 이 종이 PvP 순위에 없으면 아무것도 만들지 않는다 — 모든 종에 붙이면 "이 화면에 왜 이게 있지" 가 된다.
//
// 조합이 4,096개라 한 리그를 세는 데 제법 든다. useMemo 로 종·리그가 바뀔 때만 다시 센다.
// 순위 목록은 여기 펼치지 않는다 (CLAUDE.md §3-1) — 리그별 최선 한 줄씩과 개체값 순위 화면으로 가는 단추뿐이다
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useDex, usePvp } from '../../lib/data';
// 셈은 개체값 순위 화면과 **한 벌을 같이 쓴다** — 표를 캐시해 두므로 같은 종을 두 번 세지 않는다
import { IVRANK_LEAGUES, LEAGUE_KO, ivRankTable } from '../../lib/ivrank';
import { count, num } from '../../lib/cell';
import { go } from '../../lib/nav';
import { track } from '../../lib/track';
import { routeHref } from '../../routes';
import { PixelIcon } from '../PixelIcon';
import { Actions, RankList, Sec } from './Pieces';
import type { DexForm, LeagueKey } from '../../types/data';

export default function IvRank({ form, sprite, onLeave }: { form: DexForm; sprite: number; onLeave?: (() => void) | undefined }) {
  const { data: pvp } = usePvp();
  const { data: dex } = useDex();
  const cpms = dex.DEX_DATA.cpms;

  const rows = useMemo(() => {
    const out: { league: LeagueKey; rank: number; ivs: string; level: number; cp: number }[] = [];
    for (const [league, cap] of IVRANK_LEAGUES) {
      const hit = (pvp.PVP_DATA[league] ?? []).find((row) => row.sprite === sprite);
      if (!hit) continue;
      const best = ivRankTable(form, cpms, cap, 0)[0];
      if (!best) continue;
      out.push({ league, rank: hit.rank, ivs: best.ivs.join('/'), level: best.level, cp: best.cp });
    }
    return out;
  }, [form, sprite, cpms, pvp]);

  if (!rows.length) return null;
  return (
    <Sec  title={<>PvP 추천 개체값<span className="px-badge px-skin px-badge--blue">PvP</span></>}>
      <p className="px-caption">
        CP 상한이 있는 리그에서는 공격 개체값이 낮을 때 레벨을 더 높일 수 있는 경우가 있어요. 따라서 개체값 100%가 항상 1위는 아니에요.
      </p>
      <RankList items={rows.map((row) => ({
        key: row.league,
        where: <>{`${LEAGUE_KO[row.league]}리그`}<span className="px-caption">{` 순위 ${num(row.rank)}위`}</span></>,
        rank: row.ivs, note: `Lv${num(row.level)} · CP ${count(row.cp)}`,
      }))} />
      <Actions>
        <button type="button" className="px-btn px-btn--sm px-skin"
          onClick={() => { track('detail_more', { to: 'ivrank', mon: String(sprite) }); onLeave?.(); go(routeHref('ivrank')); }}>
          PvP 개체값 순위 열기 <PixelIcon name="arrow" />
        </button>
      </Actions>
    </Sec>
  );
}
