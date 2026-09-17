// ─────────────────────────────────────────────────────────────────────────────
// screens/Ranks.tsx — D-MAX · 레이드 PvE · 배틀 PvP 순위표
//
// 세 화면이 **같은 줄 모양**을 쓴다 (v3 components/row.js 가 그랬듯).
// v3 는 세 화면의 렌더러가 각자 줄을 만들고 있어, 줄 하나를 고치면 세 곳을 같이 고쳐야 했다.
// 여기서는 <RankList> 하나에 데이터만 갈아 끼운다.
//
// 고른 칩·세그먼트는 useRankStore 에 있다 — 화면을 옮겼다 돌아와도 그대로여야 해서다.
// ─────────────────────────────────────────────────────────────────────────────
import { useMax, usePve, usePvp, useDex } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { Sprite, TypeDot, Chips, Seg } from '../components/Bits';
import type { LeagueKey } from '../types/data';

interface RankItem {
  sprite: number;
  name: string;
  types: string[];
  fast: string;
  charged: string;
  unrel?: boolean;
  metrics: [string, string][];   // [라벨, 값]
}

function RankList({ rows }: { rows: RankItem[] }) {
  return (
    <div className="list">
      {rows.map((row, index) => (
        <div key={`${row.sprite}-${index}`} className={`row${row.unrel ? ' is-unreleased' : ''}`}>
          <span className="row__rank">{index + 1}</span>
          <Sprite id={row.sprite} />
          <span className="row__main">
            <span className="row__name"><b>{row.name}</b></span>
            <span className="row__moves">{row.fast} · {row.charged}</span>
          </span>
          <span className="row__types">{row.types.map((type) => <TypeDot key={type} type={type} />)}</span>
          <span className="row__metrics">
            {row.metrics.map(([label, value]) => (
              <span key={label} className="row__metric"><em>{label}</em><b>{value}</b></span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 보스 타입 칩 — 세 화면이 같은 표를 쓴다 */
function bossChips(keys: string[], typeKo: Record<string, string>) {
  return keys.map((key) => ({ id: key, label: key === 'overall' ? '전체' : (typeKo[key] ?? key) }));
}

export function Dmax() {
  const { data: max } = useMax();
  const { data: dex } = useDex();
  const boss = useRankStore((s) => s.maxBoss);
  const axis = useRankStore((s) => s.maxAxis);
  const unrel = useRankStore((s) => s.maxShowUnrel);
  const set = useRankStore((s) => s.set);

  const table = axis === 'tank' ? max.DMAX_TANK : axis === 'dps' ? max.DMAX_DATA : max.DMAX_TIER;
  const rows = (table[boss] ?? []).filter((row) => unrel || !row.unrel);

  return (
    <>
      <div className="controls" id="controls">
        <Seg
          items={[{ id: 'all', label: '전체(티어표)' }, { id: 'dps', label: '딜러' }, { id: 'tank', label: '탱커' }]}
          value={axis}
          onPick={(id) => set('maxAxis', id as 'all' | 'dps' | 'tank')}
        />
        <Chips items={bossChips(Object.keys(table), dex.TYPE_KO)} value={boss} onPick={(id) => set('maxBoss', id)} />
        <label className="chips__item">
          <input type="checkbox" checked={unrel} onChange={(event) => set('maxShowUnrel', event.target.checked)} />
          {' '}미구현 포함
        </label>
      </div>
      <RankList rows={rows.map((row) => ({
        sprite: row.sprite, name: row.name, types: row.types, fast: row.fast, charged: row.charged, unrel: row.unrel,
        metrics: [
          ...(row.tier ? [['티어', row.tier] as [string, string]] : []),
          ['점수', Math.round(row.score).toLocaleString()],
          ['내구', String(row.bulk)],
        ],
      }))} />
    </>
  );
}

export function Pve() {
  const { data: pve } = usePve();
  const { data: dex } = useDex();
  const mode = useRankStore((s) => s.pveMode);
  const boss = useRankStore((s) => s.boss);
  const easyBoss = useRankStore((s) => s.easyBoss);
  const set = useRankStore((s) => s.set);

  const table = mode === 'easy' ? pve.PVE_EASY : pve.PVE_DATA;
  const picked = mode === 'easy' ? easyBoss : boss;
  const rows = table[picked] ?? table['overall'] ?? [];

  return (
    <>
      <div className="controls" id="controls">
        <Seg
          items={[{ id: 'easy', label: '일반' }, { id: 'all', label: '전체' }]}
          value={mode}
          onPick={(id) => set('pveMode', id as 'easy' | 'all')}
        />
        <Chips
          items={bossChips(Object.keys(table), dex.TYPE_KO)}
          value={picked}
          onPick={(id) => set(mode === 'easy' ? 'easyBoss' : 'boss', id)}
        />
      </div>
      <RankList rows={rows.map((row) => ({
        sprite: row.sprite, name: row.name, types: row.types, fast: row.fast, charged: row.charged, unrel: row.unrel,
        metrics: [['DPS', row.dps.toFixed(1)], ['TDO', String(row.tdo)], ['종합', Math.round(row.score).toLocaleString()]],
      }))} />
      <p className="detail__foot">
        순위는 DPS 만이 아니라 버티는 힘(TDO)까지 묶은 종합 점수 순이에요.
        복합 타입 보스 보정은 자기 타입이 아니라 <b>실제로 쓰는 기술 타입</b>으로 계산해요 (v3.58.0).
      </p>
    </>
  );
}

const LEAGUE_KO: Record<LeagueKey, string> = {
  little: '리틀컵', great: '슈퍼리그', ultra: '하이퍼리그', master: '마스터리그',
};

export function Pvp() {
  const { data: pvp } = usePvp();
  const league = useRankStore((s) => s.league);
  const set = useRankStore((s) => s.set);
  const rows = pvp.PVP_DATA[league] ?? [];

  return (
    <>
      <div className="controls" id="controls">
        <Seg
          items={(Object.keys(LEAGUE_KO) as LeagueKey[]).map((key) => ({ id: key, label: LEAGUE_KO[key] }))}
          value={league}
          onPick={(id) => set('league', id as LeagueKey)}
        />
      </div>
      <RankList rows={rows.slice(0, 120).map((row) => ({
        sprite: row.sprite, name: row.name, types: row.types, fast: row.fast, charged: row.charged,
        metrics: [['점수', row.score.toFixed(1)]],
      }))} />
    </>
  );
}
