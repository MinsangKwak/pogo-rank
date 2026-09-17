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
// **조각이 셋으로 갈려 선다** (v3 셸의 자리 그대로, components/Slots.tsx):
//   #screen-tabs       [전체|딜러|탱커] · [일반|전체] · [리틀|슈퍼|하이퍼|마스터]
//   #controls          타입 필터 접이식 (속성 칩)
//   #page-head-actions [미구현] 체크 · 도구 버튼 · 보기 전환
// 처음에 셋을 전부 본문에 그렸더니 CSS 가 자리를 못 찾아 화면이 통째로 어긋났다.
//
// 고른 칩·세그먼트는 useRankStore 에 있다 (화면을 옮겼다 돌아와도 그대로여야 해서).
// ─────────────────────────────────────────────────────────────────────────────
import { useMax, usePve, usePvp, useDex } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { usePrefStore, readCols } from '../stores/pref';
import { Chips, CheckToggle, FilterBox, ScreenTabs, ToolBtn, ViewToggle, type ChipDef } from '../components/Bits';
import { Slot } from '../components/Slots';
import BossAcc from '../components/BossAcc';
import { Row, RowHead, RowList, RowMore, ROW_SHOW, TierHead, TIER_ORDER, useExpanded } from '../components/Row';
import { track } from '../lib/track';
import { Fragment } from 'react';
import type { LeagueKey } from '../types/data';

// ⓘ 안내 — v3 티어표 머리의 정보점과 같은 글이다 (등급 기준이 탭이 아니라 전 종이라는 오해가 잦았다)
const DMAX_INFO = '등급은 이 탭이 아니라 전 종을 통틀어 매깁니다 — 전 종 최고 점수 대비 90% 이상 S, 80% 이상 A, 70% 이상 B, 그 아래 C. 그래서 탭을 옮겨도 글자가 바뀌지 않아요. 순위는 이 탭 안에서만 셉니다. 점수 = 공격 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2 × 내구 보정(방어 × 체력 ÷ 1000 의 네제곱근). 내구를 약하게 섞는 이유는 화력만 보면 진화 단계가 짧은 개체가 앞서기 때문이에요 — 맥스 배틀은 버티면서 맥스 페이즈를 여러 번 도는 싸움이라 내구가 실제로 값을 합니다.';

/**
 * 속성 칩 — **표에 있는 키가 아니라 18타입 전부**를 세운다 (v3 maxSubmenu · pve bossItems).
 * 처음에 `Object.keys(table)` 로 만들었더니 데이터가 없는 속성만큼 칩이 사라져,
 * 같은 줄이 화면마다 다른 길이로 섰다.
 */
function typeChips(typeKo: Record<string, string>, allLabel = '전체'): ChipDef[] {
  return [{ id: 'overall', label: allLabel },
    ...Object.keys(typeKo).map((key) => ({ id: key, label: typeKo[key] ?? key, type: key }))];
}

/** 보기 전환 한 벌 — 화면마다 키가 따로다(pogo_max_cols …). 섞이면 한쪽을 고칠 때 다른 쪽이 따라 바뀐다 */
function useView(screen: string) {
  const saved = usePrefStore((s) => s.cols[screen]) ?? readCols(screen);
  const setCols = usePrefStore((s) => s.setCols);
  return { view: saved, toggle: () => setCols(screen, saved === 'grid' ? 'list' : 'grid') };
}

export function Dmax({ onOpen }: { onOpen: (sprite: number, en?: string) => void }) {
  const { data: max } = useMax();
  const { data: dex } = useDex();
  const boss = useRankStore((s) => s.maxBoss);
  const axis = useRankStore((s) => s.maxAxis);
  const unrel = useRankStore((s) => s.maxShowUnrel);
  const set = useRankStore((s) => s.set);
  const { view, toggle } = useView('max');

  const table = axis === 'tank' ? max.DMAX_TANK : axis === 'dealer' ? max.DMAX_DATA : max.DMAX_TIER;
  const all = table[boss] ?? [];
  const rows = all.filter((row) => unrel || !row.unrel);
  const typeName = boss === 'overall' ? '' : (dex.TYPE_KO[boss] ?? boss);
  const title = axis === 'tank'
    ? (boss === 'overall' ? 'D-MAX 탱커 (중립 · 순수 내구)' : `${typeName} 보스 상대 D-MAX 탱커`)
    : axis === 'dealer'
      ? (boss === 'overall' ? 'D-MAX 딜러' : `${typeName} 보스 상대 맥스 어태커`)
      : `D-MAX 티어표 (${boss === 'overall' ? '전체' : typeName})`;
  // 탱커 표가 없는 빌드에서는 탱커 버튼을 아예 안 세운다 (v3 hasTank)
  const hasTank = Object.keys(max.DMAX_TANK ?? {}).length > 0;
  const axes = [{ id: 'all', label: '전체' }, { id: 'dealer', label: '딜러' },
    ...(hasTank ? [{ id: 'tank', label: '탱커' }] : [])];

  return (
    <>
      <Slot name="tabs">
        <ScreenTabs items={axes} value={axis} onPick={(id) => {
          set('maxAxis', id as 'all' | 'dealer' | 'tank');
          track('sub_max_' + id);
        }} />
      </Slot>
      <Slot name="bossAcc">
        <BossAcc onOpen={onOpen} onGoBoss={(next) => { set('maxBoss', next); set('maxAxis', 'dealer'); }} />
      </Slot>
      <Slot name="controls">
        {/* 라벨이 축마다 다르다 — 전체는 **맥스무브** 속성, 딜러·탱커는 **보스** 속성이다 */}
        <FilterBox label={axis === 'all' ? '맥스무브 속성' : '보스 속성'}>
          <Chips items={typeChips(dex.TYPE_KO)} value={boss} onPick={(id) => set('maxBoss', id)} />
        </FilterBox>
      </Slot>
      <Slot name="headActions">
        {/* 표에 미구현이 한 줄도 없는 칩에서는 아예 안 그린다 (v3 maxHasUnreleased) */}
        {all.some((row) => row.unrel) ? (
          <CheckToggle
            text="미구현"
            title="게임 파일에 데이터는 있지만 아직 못 쓰는 개체를 함께 봐요 — 왼쪽에 빨간 막대가 서고, 순위는 그것들이 나왔다고 가정한 가상 판이 돼요"
            checked={unrel}
            onChange={(next) => set('maxShowUnrel', next)}
          />
        ) : null}
        <ToolBtn label="🧩 덱 짜기" onClick={() => { location.hash = '#/dmax/deck'; }} />
        <ViewToggle view={view} onToggle={toggle} />
      </Slot>

      <RowHead title={title} meta={`${rows.length}종`} info={DMAX_INFO} />
      {/* 티어표는 **티어별로 묶어** 그린다 — v3 renderTierList.
          한 줄로 이어 붙이면 "몇 위인가" 만 남고 "어느 급인가" 가 사라진다 */}
      {axis === 'all'
        ? TIER_ORDER.map((tier) => {
          const group = rows.filter((row) => row.tier === tier);
          if (!group.length) return null;   // 그 티어에 아무도 없으면 머리글도 만들지 않는다
          return (
            // 묶는 <div> 를 두면 `.tier__head + .row-list` 형제 규칙이 끊긴다 — Fragment 로 납작하게 편다
            <Fragment key={tier}>
              <TierHead tier={tier} count={group.length} />
              <RowList view={view}>
                {group.map((row, index) => (
                  <Row
                    key={`${row.sprite}-${index}`}
                    sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                    rank={String(rows.indexOf(row) + 1)}
                    unrel={row.unrel}
                    delta={row.d}
                    onOpen={() => onOpen(row.sprite, row.en)}
                    score={`${row.pct ?? Math.round(row.score)}%`}
                    sub={`공격 ${row.atk} · 위력 ${row.power}${row.stab ? ' · 자속' : ''} · 내구 ${row.bulk ?? 0}`}
                    lines={[row.fast, `${dex.TYPE_KO[row.charged] ?? row.charged} 타입`]}
                  />
                ))}
              </RowList>
            </Fragment>
          );
        })
        : (
          <RowList view={view}>
            {rows.map((row, index) => (
              <Row
                key={`${row.sprite}-${index}`}
                sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                rank={String(index + 1)}
                unrel={row.unrel}
                delta={row.d}
                onOpen={() => onOpen(row.sprite, row.en)}
                score={String(row.dmg ?? Math.round(row.score))}
                sub={`맥스 피해 · 내구 ${row.bulk}`}
                lines={[row.fast, `${dex.TYPE_KO[row.charged] ?? row.charged} 타입`]}
              />
            ))}
          </RowList>
        )}
    </>
  );
}

export function Pve({ onOpen }: { onOpen: (sprite: number, en?: string) => void }) {
  const { data: pve } = usePve();
  const { data: dex } = useDex();
  const mode = useRankStore((s) => s.pveMode);
  const boss = useRankStore((s) => s.boss);
  const easyBoss = useRankStore((s) => s.easyBoss);
  const set = useRankStore((s) => s.set);
  const { view, toggle } = useView('pve');

  const table = mode === 'easy' ? pve.PVE_EASY : pve.PVE_DATA;
  const picked = mode === 'easy' ? easyBoss : boss;
  const rows = table[picked] ?? table['overall'] ?? [];
  const typeName = picked === 'overall' ? '전체' : (dex.TYPE_KO[picked] ?? picked);
  // v3 tier.js · pve.js 의 문구 그대로 — 같은 표가 모드마다 다른 이름으로 불린다
  const title = mode === 'easy'
    ? (picked === 'overall' ? '레이드 일반 티어표 (전체)' : `${typeName} 타입 일반 티어표`)
    : (picked === 'overall' ? '레이드 어태커 전체 (자체 계산)' : `${typeName} 타입 레이드 성능`);

  return (
    <>
      <Slot name="tabs">
        <ScreenTabs
          items={[{ id: 'easy', label: '일반' }, { id: 'all', label: '전체' }]}
          value={mode}
          onPick={(id) => { set('pveMode', id as 'easy' | 'all'); track('sub_pve_' + id); }}
        />
      </Slot>
      <Slot name="controls">
        <FilterBox>
          <Chips
            items={typeChips(dex.TYPE_KO)}
            value={picked}
            onPick={(id) => set(mode === 'easy' ? 'easyBoss' : 'boss', id)}
          />
        </FilterBox>
      </Slot>
      <Slot name="headActions">
        <ToolBtn label="🧮 솔플 계산기" onClick={() => { location.hash = '#/pve/solo'; }} />
        <ViewToggle view={view} onToggle={toggle} />
      </Slot>

      <RowHead
        title={title}
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
            // 묶는 <div> 를 두면 `.tier__head + .row-list` 형제 규칙이 끊긴다 — Fragment 로 납작하게 편다
            <Fragment key={tier}>
              <TierHead tier={tier} count={group.length} />
              <RowList view={view}>
                {group.map((row) => (
                  <Row
                    key={`${row.sprite}-${row.name}`}
                    sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                    rank={String(rows.indexOf(row) + 1)}
                    unrel={row.unrel} delta={row.d}
                    onOpen={() => onOpen(row.sprite, row.en)}
                    score={`${row.ratio ?? Math.round(row.score)}점`}
                    sub={`DPS ${row.dps} · TDO ${row.tdo}`}
                    lines={[row.fast, row.charged]}
                  />
                ))}
              </RowList>
            </Fragment>
          );
        })
        : (
          <RowList view={view}>
            {rows.map((row, index) => (
              <Row
                key={`${row.sprite}-${index}`}
                sprite={row.sprite} name={row.name} en={row.en} types={row.types}
                rank={String(index + 1)}
                unrel={row.unrel} delta={row.d}
                onOpen={() => onOpen(row.sprite, row.en)}
                score={row.dps.toFixed(1)}
                sub={`DPS · TDO ${row.tdo}`}
                lines={[row.fast, row.charged]}
              />
            ))}
          </RowList>
        )}
    </>
  );
}

// v3 data.js LEAGUES 와 같은 한 벌 — 세그먼트에 서는 이름은 '리그' 를 뗀 짧은 쪽이다
const LEAGUES: readonly { id: LeagueKey; name: string; cp: string }[] = [
  { id: 'little', name: '리틀', cp: '500' },
  { id: 'great', name: '슈퍼', cp: '1500' },
  { id: 'ultra', name: '하이퍼', cp: '2500' },
  { id: 'master', name: '마스터', cp: '10000' },
];

export function Pvp({ onOpen }: { onOpen: (sprite: number, en?: string) => void }) {
  const { data: pvp } = usePvp();
  const { data: dex } = useDex();
  const league = useRankStore((s) => s.league);
  const pvpType = useRankStore((s) => s.pvpType);
  const set = useRankStore((s) => s.set);
  const { view, toggle } = useView('pvp');
  const { isOpen, toggle: toggleMore } = useExpanded();

  const ranking = pvp.PVP_DATA[league] ?? [];
  // 이 리그 랭킹에 한 마리라도 있는 속성만 칩으로 만든다 (v3 presentTypes)
  const present = new Set(ranking.flatMap((mon) => mon.types));
  const chipItems: ChipDef[] = [{ id: 'all', label: '전체' },
    ...Object.keys(dex.TYPE_KO).filter((key) => present.has(key))
      .map((key) => ({ id: key, label: dex.TYPE_KO[key] ?? key, type: key }))];

  const rows = pvpType === 'all' ? ranking : ranking.filter((mon) => mon.types.includes(pvpType));
  const name = LEAGUES.find((one) => one.id === league)?.name ?? league;
  const cp = LEAGUES.find((one) => one.id === league)?.cp ?? '';
  const title = pvpType === 'all' ? `${name}리그 전체 순위` : `${name}리그 · ${dex.TYPE_KO[pvpType] ?? pvpType} 타입`;
  // 리그나 속성을 바꾸면 키가 달라져 저절로 접힌다 (v3 list() 의 키 규칙과 같다)
  const listKey = `pvp-${league}-${pvpType}`;

  return (
    <>
      <Slot name="tabs">
        <ScreenTabs
          items={LEAGUES.map((one) => ({ id: one.id, label: one.name }))}
          value={league}
          onPick={(id) => set('league', id as LeagueKey)}
        />
      </Slot>
      <Slot name="controls">
        <FilterBox>
          <Chips items={chipItems} value={pvpType} onPick={(id) => set('pvpType', id)} />
        </FilterBox>
      </Slot>
      <Slot name="headActions">
        <ToolBtn label="🧬 개체값 순위" onClick={() => { location.hash = '#/pvp/ivrank'; }} />
        <ToolBtn label="🃏 덱 짜기" onClick={() => { location.hash = '#/pvp/deck'; }} />
        <ViewToggle view={view} onToggle={toggle} />
      </Slot>

      <RowHead title={title} meta={`CP ${cp} · 상위 ${ranking.length} 기준`} />
      {/* v3 는 10줄만 펴고 나머지는 [더보기] 뒤에 둔다 — 40줄을 다 세우면 첫 화면이 스크롤 넉 장이 된다 */}
      <RowList view={view}>
        {(isOpen(listKey) ? rows : rows.slice(0, ROW_SHOW)).map((row, index) => (
          <Row
            key={`${row.sprite}-${row.rank}`}
            sprite={row.sprite} name={row.name} en={row.en} types={row.types}
            rank={String(index + 1)}
            delta={row.d}
            onOpen={() => onOpen(row.sprite, row.en)}
            score={row.score.toFixed(1)}
            // 속성으로 걸렀을 때만 원래 전체 순위를 덧붙인다 — 앞 번호가 속성 안의 순위로 바뀌어서다
            sub={pvpType === 'all' ? undefined : `전체 ${row.rank}위`}
            lines={[row.fast, row.charged]}
          />
        ))}
        <RowMore total={rows.length} expanded={isOpen(listKey)} onToggle={() => toggleMore(listKey)} />
      </RowList>
    </>
  );
}
