// ─────────────────────────────────────────────────────────────────────────────
// screens/Ranks.tsx — D-MAX · 레이드 PvE · 배틀 PvP 순위표
//
// 세 화면이 같은 <Row> 를 쓴다 (v3 components/row.js 가 그랬듯).
// **점수 칸과 보조줄이 화면마다 다르다** — v3 의 각 뷰가 넘기던 그대로 옮겼다:
//   D-MAX 티어표  점수 `100%`(전 종 1위 대비 pct) · 보조 `공격 201 · 위력 450 · 자속 · 내구 27`
//   D-MAX 딜러    점수 맥스 피해(dmg)           · 보조 `맥스 피해 · 내구 27`
//   PvE           점수 DPS                       · 보조 `DPS · TDO 149`
//   PvP           점수 점수(100점 만점)          · 보조 없음
// 숫자만 옮기고 라벨을 지어내면 같은 값이 다른 말을 하게 된다 — 그래서 문구까지 그대로 가져왔다.
//
// 고른 칩·세그먼트는 useRankStore 에 있다 (화면을 옮겼다 돌아와도 그대로여야 해서).
// ─────────────────────────────────────────────────────────────────────────────
import { useMax, usePve, usePvp, useDex } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { Chips, Seg } from '../components/Bits';
import { Row, RowHead, RowList, TierHead, TIER_ORDER } from '../components/Row';
import type { LeagueKey } from '../types/data';

/** 보스 타입 칩 — 세 화면이 같은 표를 쓴다 */
function bossChips(keys: string[], typeKo: Record<string, string>) {
  return keys.map((key) => ({ id: key, label: key === 'overall' ? '전체' : (typeKo[key] ?? key) }));
}

export function Dmax({ onOpen }: { onOpen: (sprite: number) => void }) {
  const { data: max } = useMax();
  const { data: dex } = useDex();
  const boss = useRankStore((s) => s.maxBoss);
  const axis = useRankStore((s) => s.maxAxis);
  const unrel = useRankStore((s) => s.maxShowUnrel);
  const set = useRankStore((s) => s.set);

  const table = axis === 'tank' ? max.DMAX_TANK : axis === 'dps' ? max.DMAX_DATA : max.DMAX_TIER;
  const rows = (table[boss] ?? []).filter((row) => unrel || !row.unrel);
  const typeName = boss === 'overall' ? '' : (dex.TYPE_KO[boss] ?? boss);
  const title = axis === 'tank'
    ? (boss === 'overall' ? 'D-MAX 탱커 (중립 · 순수 내구)' : `${typeName} 보스 상대 D-MAX 탱커`)
    : axis === 'dps'
      ? (boss === 'overall' ? 'D-MAX 딜러' : `${typeName} 보스 상대 맥스 어태커`)
      : `D-MAX 티어표 (${boss === 'overall' ? '전체' : typeName})`;

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
      <RowHead title={title} meta={`${rows.length}종`} />
      {/* 티어표는 **티어별로 묶어** 그린다 — v3 renderTierList.
          한 줄로 이어 붙이면 "몇 위인가" 만 남고 "어느 급인가" 가 사라진다 */}
      {axis === 'all'
        ? TIER_ORDER.map((tier) => {
          const group = rows.filter((row) => row.tier === tier);
          if (!group.length) return null;   // 그 티어에 아무도 없으면 머리글도 만들지 않는다
          return (
            <div key={tier}>
              <TierHead tier={tier} count={group.length} />
              <RowList>
                {group.map((row, index) => (
                  <Row
                    key={`${row.sprite}-${index}`}
                    sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                    rank={String(rows.indexOf(row) + 1)}
                    unrel={row.unrel}
                    delta={row.d}
                    onOpen={() => onOpen(row.sprite)}
                    score={`${row.pct ?? Math.round(row.score)}%`}
                    sub={`공격 ${row.atk} · 위력 ${row.power}${row.stab ? ' · 자속' : ''} · 내구 ${row.bulk ?? 0}`}
                    lines={[row.fast, `${dex.TYPE_KO[row.charged] ?? row.charged} 타입`]}
                  />
                ))}
              </RowList>
            </div>
          );
        })
        : (
          <RowList>
            {rows.map((row, index) => (
              <Row
                key={`${row.sprite}-${index}`}
                sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                rank={String(index + 1)}
                unrel={row.unrel}
                delta={row.d}
                onOpen={() => onOpen(row.sprite)}
                score={String(row.dmg ?? Math.round(row.score))}
                sub={`맥스 피해 · 내구 ${row.bulk}`}
                lines={[row.fast, `${dex.TYPE_KO[row.charged] ?? row.charged} 타입`]}
              />
            ))}
          </RowList>
        )}
      <p className="detail__foot">
        티어는 전 종을 통틀어 매겨요 — 전 종 최고 점수 대비 90% 이상 S, 80% 이상 A, 70% 이상 B, 그 아래 C.
        순위는 이 탭 안에서만 세요.
      </p>
    </>
  );
}

export function Pve({ onOpen }: { onOpen: (sprite: number) => void }) {
  const { data: pve } = usePve();
  const { data: dex } = useDex();
  const mode = useRankStore((s) => s.pveMode);
  const boss = useRankStore((s) => s.boss);
  const easyBoss = useRankStore((s) => s.easyBoss);
  const set = useRankStore((s) => s.set);

  const table = mode === 'easy' ? pve.PVE_EASY : pve.PVE_DATA;
  const picked = mode === 'easy' ? easyBoss : boss;
  const rows = table[picked] ?? table['overall'] ?? [];
  const typeName = picked === 'overall' ? '전체' : (dex.TYPE_KO[picked] ?? picked);

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
      <RowHead
        title={mode === 'easy' ? `레이드 티어표 (${typeName})` : `레이드 딜러 (${typeName})`}
        meta={mode === 'easy' ? `${rows.length}종 · 전설·환상·메가·섀도우 제외` : `자체 계산 · 상위 ${rows.length}`}
      />
      {/* **모드마다 점수 칸의 뜻이 다르다** (v3 tier.js vs pve.js) —
          일반: `66점` = 같은 속성 최강 어태커 대비 % + 티어 묶음
          전체: `14.3` = DPS 그대로, 티어 없이 한 줄로
          처음에 전체 쪽 문법을 양쪽에 썼더니 v3 의 66점이 14.3 으로 나왔다 */}
      {mode === 'easy'
        ? TIER_ORDER.map((tier) => {
          const group = rows.filter((row) => row.tier === tier);
          if (!group.length) return null;
          return (
            <div key={tier}>
              <TierHead tier={tier} count={group.length} />
              <RowList>
                {group.map((row) => (
                  <Row
                    key={`${row.sprite}-${row.name}`}
                    sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                    rank={String(rows.indexOf(row) + 1)}
                    unrel={row.unrel} delta={row.d}
                    onOpen={() => onOpen(row.sprite)}
                    score={`${row.ratio ?? Math.round(row.score)}점`}
                    sub={`DPS ${row.dps} · TDO ${row.tdo}`}
                    lines={[row.fast, row.charged]}
                  />
                ))}
              </RowList>
            </div>
          );
        })
        : (
          <RowList>
            {rows.map((row, index) => (
              <Row
                key={`${row.sprite}-${index}`}
                sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                rank={String(index + 1)}
                unrel={row.unrel} delta={row.d}
                onOpen={() => onOpen(row.sprite)}
                score={row.dps.toFixed(1)}
                sub={`DPS · TDO ${row.tdo}`}
                lines={[row.fast, row.charged]}
              />
            ))}
          </RowList>
        )}
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
const LEAGUE_CP: Record<LeagueKey, string> = {
  little: '500', great: '1500', ultra: '2500', master: '제한 없음',
};

export function Pvp({ onOpen }: { onOpen: (sprite: number) => void }) {
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
      <RowHead title={LEAGUE_KO[league]} meta={`CP ${LEAGUE_CP[league]} · 상위 ${rows.length} 기준`} />
      <RowList>
        {rows.slice(0, 120).map((row) => (
          <Row
            key={row.sprite + '-' + row.rank}
            sprite={row.sprite} name={row.name} en={row.en} types={row.types}
            rank={String(row.rank)}
            onOpen={() => onOpen(row.sprite)}
            score={row.score.toFixed(1)}
            lines={[row.fast, row.charged]}
          />
        ))}
      </RowList>
      <p className="detail__foot">PvPoke 시뮬레이션 점수(100점 만점)예요.</p>
    </>
  );
}
