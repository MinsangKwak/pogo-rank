// ─────────────────────────────────────────────────────────────────────────────
// screens/Ranks.tsx — D-MAX · 레이드 PvE · 배틀 PvP 순위표
//
// 세 화면이 같은 <Row> 를 쓴다 (v3 components/row.js 가 그랬듯).
// **점수 칸과 보조줄이 화면마다 다르다** — v3 의 각 뷰가 넘기던 그대로 옮겼다:
//   D-MAX 티어표  점수 `100%`(전 종 1위 대비 pct) · 보조 `공격 201 · 위력 450 · 자속 · 내구 27`
//   D-MAX 딜러    점수 맥스 피해(dmg)           · 보조 `맥스 피해 · 내구 27`
//   D-MAX 탱커    점수 EHP(ehp)                · 보조 `EHP · 받는 배율 ×2 · 체력 403 × 방어 145` — 기술 줄 없음
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
import { go } from '../lib/nav';

import { useMax, usePve, usePvp, useDex, useUsage } from '../lib/data';
import { BASE } from '../lib/base';
import { useRankStore } from '../stores/rank';
import { usePrefStore, readCols } from '../stores/pref';
import { PxChips, PxSwitch, PxTabs, PxViewSwitch, Sprite, type ChipDef } from '../components/Bits';
import { Slot } from '../components/Slots';
import BossAcc from '../components/BossAcc';
import { NameNode, RankList, RankMore, RankRow, RowHead, ROW_SHOW, TierHead, TIER_ORDER, useExpanded, useFocusRow } from '../components/Row';
import MonCard, { PokemonNumberRibbon } from '../components/MonCard';
import { PixelIcon } from '../components/PixelIcon';
import { dexNoOf } from '../lib/mon';
import { usageCountFor } from '../lib/usage';
import { track } from '../lib/track';
import { useAuthStore } from '../stores/auth';
import { LEAGUES } from '../lib/leagues';
import type { OpenMon } from '../lib/mon';
import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { DmaxRow, PveRow, PvpRow, LeagueKey } from '../types/data';
import { num, word, lines as keep } from '../lib/cell';
import { maxVisible } from '../lib/maxVisible';

// ⓘ 안내 — v3 티어표 머리의 정보점과 같은 글이다 (등급 기준이 탭이 아니라 전 종이라는 오해가 잦았다)
const DMAX_INFO = '등급은 전체 포켓몬의 최고 점수를 기준으로 정해요. 최고 점수 대비 90% 이상은 S, 80% 이상은 A, 70% 이상은 B, 그 미만은 C예요. 타입 탭을 바꿔도 등급은 같고, 순위만 해당 탭 안에서 다시 표시해요. 점수 = 공격 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2 × 내구 보정(방어 × 체력 ÷ 1000의 네제곱근). 맥스 페이즈를 반복해서 사용할 수 있는 생존력을 고려해 내구를 일부 반영해요. \'맥스 참가\' 검왕 자시안 · 방패왕 자마젠타 · 무한다이노는 다이맥스를 못 하지만 맥스 배틀에 참가해 전용 기술(거수참 · 거수탄 · 다이맥스포)을 써요 — 위력은 다이맥스의 맥스어택과 같은 350으로 계산하고, [맥스 참가 가능 다른 유닛] 체크를 켜면 함께 보여요. 등급의 100% 기준은 다이맥스 · 거다이맥스 출시분 1위라 맥스 참가 줄은 100%를 넘을 수 있어요.';

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
  return { view: saved, pick: (next: 'grid' | 'list') => setCols(screen, next) };
}

/**
 * D-MAX 한 줄의 점수·보조·기술 칸 — **축마다 행 모양이 다르다.**
 *   all     티어표(DMAX_TIER)  pct · atk · power · stab · bulk
 *   dealer  딜러(DMAX_DATA)    dmg · bulk · fast · charged
 *   tank    탱커(DMAX_TANK)    ehp · hp · def · mult — 기술 칸은 비어 있다
 * 탱커가 딜러 가지를 그대로 타서 `NaN 맥스 피해 · 내구 undefined` 로 나왔다 (2026-09-19 제보).
 * 세 축을 한 함수에 두고 검사(test/rankcells.test.ts)가 실데이터 모양으로 확인한다.
 */
/** 'YYYY-MM-DD' → '11/14' — 출시 예정 표식에 쓴다 */
export function soonLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function dmaxCells(axis: 'all' | 'dealer' | 'tank', boss: string, row: DmaxRow, typeKo: Record<string, string>) {
  // 다이맥스 없이 참가하는 종은 이름에 접두어가 없어 표 안에서 설명이 필요하다 — 기술 줄 끝에 한 마디 (2026-10-06)
  const joinNote = row.join ? '다이맥스 없이 참가' : '';
  // 공지된 출시일 전에 먼저 올린 폼 — '11/14 출시 예정' (2026-10-09)
  const soonNote = row.soon ? `${soonLabel(row.soon)} 출시 예정` : '';
  if (axis === 'tank') {
    const body = `체력 ${num(row.hp)} × 방어 ${num(row.def)}`;
    return {
      score: num(row.ehp),
      label: 'EHP',
      // 보스를 고르면 그 타입에 받는 배율이 한 칸 더 붙는다
      sub: boss === 'overall' ? `EHP · ${body}` : `EHP · 받는 배율 ×${num(row.mult)} · ${body}`,
      lines: keep(joinNote, soonNote),
    };
  }
  // 기술이 비어 있으면 줄 자체를 세우지 않는다 — `— 타입` 은 없는 정보를 있는 척한다
  const moves = keep(row.fast, row.charged && `${word(typeKo[row.charged] ?? row.charged)} 타입`, joinNote, soonNote);
  if (axis === 'all') {
    return {
      score: `${num(row.pct ?? Math.round(row.score))}%`,
      label: '점수',
      sub: `공격 ${num(row.atk)} · 위력 ${num(row.power)}${row.stab ? ' · 자속' : ''} · 내구 ${num(row.bulk ?? 0)}`,
      lines: moves,
    };
  }
  return { score: num(row.dmg ?? Math.round(row.score)), label: '맥스 피해', sub: `맥스 피해 · 내구 ${num(row.bulk)}`, lines: moves };
}

/**
 * 레이드 한 줄의 칸 — **모드마다 점수 칸의 뜻이 다르다** (v3 tier.js vs pve.js).
 *   easy  일반 `66점` = 같은 속성 최강 어태커 대비 % + 티어 묶음
 *   all   전체 `14.3` = DPS 그대로, 티어 없이 한 줄로
 * 처음에 전체 쪽 문법을 양쪽에 썼더니 v3 의 66점이 14.3 으로 나왔다.
 */
export function pveCells(mode: 'easy' | 'all', row: PveRow) {
  const moves = keep(row.fast, row.charged);
  if (mode === 'easy') {
    return { score: `${num(row.ratio ?? Math.round(row.score))}점`, label: '점수', sub: `DPS ${num(row.dps)} · TDO ${num(row.tdo)}`, lines: moves };
  }
  return { score: num(row.dps, 1), label: 'DPS', sub: `DPS · TDO ${num(row.tdo)}`, lines: moves };
}

// 배틀 한 줄의 칸 — 속성 칩을 고른 동안만 전체 순위를 곁들인다.
export function pvpCells(pvpType: string, row: PvpRow) {
  return {
    score: num(row.score, 1),
    label: '점수',
    sub: pvpType === 'all' ? undefined : `전체 ${num(row.rank)}위`,
    lines: keep(row.fast, row.charged),
  };
}

// ── v6 공통 조각 ───────────────────────────────────────────────────────────────

/** 카드 아래 초록 한 줄 — '기술 · 점수 95.0' 처럼 **라벨과 값**을 같이 적는다 (값만 적으면 무엇의 수치인지 모른다) */
function metaOf(cells: { score: string; label?: string; lines: string[] }): string {
  return [cells.lines[0], `${cells.label ?? '점수'} ${cells.score}`].filter(Boolean).join(' · ');
}

/** 줄 · 카드에 얹는 배지 — 미구현 · [지금 N위] · 활용 N곳 (옛 Row 의 row__badges 와 같은 규칙) */
function RankBadges({ name, unrel, nowRank }: { name: string; unrel?: boolean; nowRank?: number }) {
  // '활용 N곳' — 이 종이 상위 30위에 드는 순위표 수 (v3 usageBadge). 1곳뿐이면 안 붙인다 — 모든 줄에 붙으면 뜻이 없다
  const { data } = useUsage();
  const count = usageCountFor(data.USAGE_PLACES, name);
  if (!unrel && nowRank == null && count < 2) return null;
  return (
    <>
      {unrel ? <span className="px-badge px-skin px-badge--muted px-badge--ko">미구현</span> : null}
      {/* 가정으로 매긴 번호 옆에 **오늘의 자리**를 같이 둔다 — 무엇이 바뀌었는지가 줄에서 바로 읽힌다 */}
      {nowRank != null ? (
        <span className="px-badge px-skin px-badge--yellow px-badge--ko" title={`미구현이 없으면 ${nowRank}위 — 이 표는 미구현이 나왔다고 가정한 순위예요`}>{`지금 ${nowRank}위`}</span>
      ) : null}
      {count >= 2 ? (
        <span className={`px-badge px-skin px-badge--ko ${count >= 5 ? 'px-badge--mint' : 'px-badge--blue'}`}
          title="이 포켓몬이 상위 30위에 드는 순위표 수 (PvE 19표 · PvP 4리그 · D-MAX 19표)">{`활용 ${count}곳`}</span>
      ) : null}
    </>
  );
}

/** 순위 한 칸 — 보기에 따라 카드(MonCard) 또는 줄(RankRow). 두 모양이 같은 값을 받는다 */
function RankItem({ view, row, rank, cells, nowRank, delta, unrel, dexTable, onOpen }: {
  view: 'grid' | 'list';
  row: { sprite: number; name: string; en?: string; types: readonly string[] };
  rank: number;
  cells: { score: string; label?: string; sub?: string; lines: string[] };
  nowRank?: number; delta?: number; unrel?: boolean;
  dexTable: Readonly<Record<string, number>>;
  onOpen: () => void;
}) {
  const badges = <RankBadges name={row.name} unrel={unrel} nowRank={nowRank} />;
  if (view === 'grid') {
    const no = dexNoOf(row.sprite, dexTable);
    return (
      <li className={unrel ? 'is-unreleased' : undefined}>
        <MonCard sprite={row.sprite} {...(no !== null ? { dex: no } : {})} name={row.name} en={row.en} types={row.types} rank={rank}
          meta={metaOf(cells)} badges={badges} from="순위" onOpen={onOpen} />
      </li>
    );
  }
  return (
    <RankRow sprite={row.sprite} name={row.name} en={row.en} types={row.types} rank={rank}
      score={cells.score} label={cells.label} sub={cells.sub} lines={cells.lines} badges={badges}
      unrel={unrel} delta={delta} onOpen={onOpen} />
  );
}

/** 탭 줄 — 왼쪽 탭, 오른쪽 도구 단추 (피그마 08 'D-MAX 덱 짜기 →' · '계산 기준 ⓘ') */
function TabBar({ tabs, tools, routeToolsOnly = false }: { tabs: ReactNode; tools?: ReactNode; routeToolsOnly?: boolean }) {
  return (
    <div className="rk-bar">
      {tabs}
      {tools ? <div className={`rk-bar__tools${routeToolsOnly ? ' rk-route-cta' : ''}`}>{tools}</div> : null}
    </div>
  );
}

/** '계산 기준' 안내 — 단추를 누르면 본문 위에 판으로 펼친다 (옛 ⓘ 는 말풍선(title)뿐이라 휴대폰에서 읽을 길이 없었다) */
function InfoNote({ open, text, onClose }: { open: boolean; text: string; onClose: () => void }) {
  if (!open) return null;
  return (
    <section className="px-note px-skin px-drop rk-info" id="rk-info">
      <p className="px-note__title">계산 기준</p>
      <p className="px-note__body">{text}</p>
      <div className="px-note__actions"><button type="button" className="px-btn px-btn--sm px-skin" onClick={onClose}>닫기</button></div>
    </section>
  );
}

export function Dmax({ onOpen }: { onOpen: OpenMon }) {
  const { data: max } = useMax();
  const { data: dex } = useDex();
  const boss = useRankStore((s) => s.maxBoss);
  const axis = useRankStore((s) => s.maxAxis);
  const checked = useRankStore((s) => s.maxShowUnrel);
  const set = useRankStore((s) => s.set);
  const { view, pick } = useView('max');
  const [info, setInfo] = useState(false);
  // **[미구현] 은 실험 기능이다** (v3 maxUnrelAllowed). 켜 둔 값이 저장소에 남아 있어도
  // 깃발이 없으면 안 보여 준다 — 체크만 감추면 옛 값이 그대로 살아 미구현 줄이 새어 나간다.
  // 운영을 돕는 admin 이 아니라 먼저 써 보는 beta 를 본다 (stores/auth.ts 머리말).
  // 게임에 없는 개체가 일반 화면에 뜨는 것은 v3.61.2 에 긴급으로 막았던 바로 그 자리다
  const beta = useAuthStore((s) => s.beta);
  const unrel = checked && beta;
  // [맥스 참가 가능 다른 유닛] — 다이맥스 없이 참가하는 종은 체크를 켜야 보인다 (lib/maxVisible.ts)
  const showJoin = useRankStore((s) => s.maxShowJoin);

  const table = axis === 'tank' ? max.DMAX_TANK : axis === 'dealer' ? max.DMAX_DATA : max.DMAX_TIER;
  const all = table[boss] ?? [];
  // **[미구현] 을 켜면 표가 "만약 이들이 나온다면" 의 가상 순위가 된다** (v3.49.0 maxVisible · maxRank).
  //   미구현도 번호를 받고, 그 위에 낀 만큼 아래 출시분이 밀린다 (지금 1위가 5위가 되는 식).
  //   밀린 줄에는 [지금 N위] 딱지가 붙어 무엇이 바뀌었는지를 줄에서 바로 읽게 한다.
  //   가상 순위에서는 어제 대비 변동(▲▼)을 감춘다 — 그 숫자는 **실제 순위**가 움직인 이야기라,
  //   가정으로 매긴 번호 바로 아래 놓이면 한 줄에서 두 '움직임' 이 서로 다른 말을 한다
  const rows = maxVisible(all, { unrel, join: showJoin });
  // 상세의 '더보기' 로 왔으면 그 줄로 내려가 밝힌다 — 표는 전부 그려지므로 펼칠 것이 없다
  const focus = useRankStore((s) => s.focus);
  const clearFocus = useCallback(() => set('focus', ''), [set]);
  useFocusRow(focus, clearFocus, rows.length > 0);
  // 보이는 차례(shown) ↔ 출시분만 센 차례(released). 체크가 꺼져 있으면 둘이 같은 값이다
  const nowRankOf = new Map<number, number>();
  if (unrel) {
    let released = 0;
    rows.forEach((row, at) => {
      if (!row.unrel) released += 1;
      // 미구현 줄에는 '지금' 이 없다 — 오늘 겨루는 자리가 아예 없으니 딱지도 없다
      if (!row.unrel && at + 1 !== released) nowRankOf.set(at, released);
    });
  }
  // 지금 고른 속성에 미구현이 있기는 한가 — **세 표를 다 본다** (v3 maxHasUnreleased).
  // 보고 있는 표만 보면 축을 옮길 때 체크가 나타났다 사라진다
  const hasUnrel = [max.DMAX_TIER, max.DMAX_DATA, max.DMAX_TANK]
    .some((one) => (one?.[boss] ?? []).some((row) => row.unrel));
  const hasJoin = [max.DMAX_TIER, max.DMAX_DATA, max.DMAX_TANK]
    .some((one) => (one?.[boss] ?? []).some((row) => row.join));
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

  const item = (row: DmaxRow, rank: number) => (
    <RankItem key={`${row.sprite}-${rank}`} view={view} row={row} rank={rank}
      cells={dmaxCells(axis, boss, row, dex.TYPE_KO)}
      unrel={row.unrel} nowRank={nowRankOf.get(rank - 1)} delta={unrel ? 0 : row.d}
      dexTable={dex.DEX_DATA.dex} onOpen={() => onOpen(row)} />
  );

  return (
    <>
      <Slot name="tabs">
        <TabBar
          tabs={<PxTabs label="역할" items={axes} value={axis} onPick={(id) => { set('maxAxis', id as 'all' | 'dealer' | 'tank'); track('sub_max_' + id); }} />}
          tools={(
            <>
              <button type="button" className="px-btn px-btn--primary px-skin rk-route-cta" onClick={() => { go('/dmax/deck'); }}>D-MAX 덱 짜기 →</button>
              <button type="button" className="px-btn px-skin" aria-expanded={info} aria-controls="rk-info" onClick={() => setInfo(!info)}>
                계산 기준 <PixelIcon name="info" />
              </button>
            </>
          )}
        />
      </Slot>
      <Slot name="bossAcc">
        <BossAcc onOpen={onOpen} onGoBoss={(next) => { set('maxBoss', next); set('maxAxis', 'dealer'); }} />
      </Slot>
      <Slot name="controls">
        {/* 라벨이 축마다 다르다 — 전체는 **맥스무브** 속성, 딜러·탱커는 **보스** 속성이다 */}
        <PxChips label={axis === 'all' ? '맥스무브 속성' : '보스 속성'} items={typeChips(dex.TYPE_KO)} value={boss} onPick={(id) => set('maxBoss', id)} />
        <div className="rk-toggles">
          {/* [맥스 참가 가능 다른 유닛] — 다이맥스는 못 하지만 맥스 배틀에 참가하는 종. 표에 그런 줄이 없는 칩에서는 안 그린다 */}
          {hasJoin ? (
            <PxSwitch text="맥스 참가 가능 다른 유닛"
              title="다이맥스는 못 하지만 맥스 배틀에 참가하는 검왕 자시안 · 방패왕 자마젠타 · 무한다이노를 함께 보여요"
              checked={showJoin} onChange={(next) => set('maxShowJoin', next)} />
          ) : null}
          {/* 표에 미구현이 한 줄도 없는 칩에서는 아예 안 그린다 (v3 maxHasUnreleased) */}
          {beta && hasUnrel ? (
            <PxSwitch text="미구현 포함"
              title="게임 데이터에 등록된 미출시 포켓몬을 포함해요. 출시를 가정한 순위가 표시돼요"
              checked={checked} onChange={(next) => set('maxShowUnrel', next)} />
          ) : null}
          <PxViewSwitch view={view} onPick={pick} />
        </div>
      </Slot>

      <InfoNote open={info} text={DMAX_INFO} onClose={() => setInfo(false)} />
      <RowHead title={title} meta={`${rows.length}종`} hypo={unrel} />
      {/* 티어표는 **티어별로 묶어** 그린다 — v3 renderTierList.
          한 줄로 이어 붙이면 "몇 위인가" 만 남고 "어느 급인가" 가 사라진다 */}
      {axis === 'all'
        ? TIER_ORDER.map((tier) => {
          const group = rows.filter((row) => row.tier === tier);
          if (!group.length) return null;   // 그 티어에 아무도 없으면 머리글도 만들지 않는다
          return (
            <Fragment key={tier}>
              <TierHead tier={tier} count={group.length} />
              <RankList view={view}>{group.map((row) => item(row, rows.indexOf(row) + 1))}</RankList>
            </Fragment>
          );
        })
        : <RankList view={view}>{rows.map((row, index) => item(row, index + 1))}</RankList>}
      {/* 바닥 안내 둘 — 딜러 점수와 탱커 점수는 같은 자로 잴 수 없다는 것을 표 아래에서 한 번 더 말한다 */}
      <div className="px-grid px-grid--2 rk-notes">
        <section className="px-note px-skin px-drop">
          <p className="px-note__title">딜러 평가</p>
          <p className="px-note__body">맥스 기술 피해량, 공격 능력치, 타입 보정을 기준으로 비교합니다.</p>
        </section>
        <section className="px-note px-skin px-drop">
          <p className="px-note__title">탱커 평가</p>
          <p className="px-note__body">내구성과 EHP를 기준으로 비교합니다. 딜러 점수와 직접 비교하지 않아요.</p>
        </section>
      </div>
    </>
  );
}

/** 레이드 표 — 데스크톱은 열 여섯(순위 · 포켓몬 · 추천 기술 · DPS · TDO · 점수), 휴대폰은 CSS 가 줄을 카드로 편다 (data-label) */
export function PveTable({ rows, mode, dexTable, rankOf, onOpen }: { rows: PveRow[]; mode: 'easy' | 'all'; dexTable: Readonly<Record<string, number>>; rankOf: (row: PveRow, index: number) => number; onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const typeLine = (types: readonly string[]) => types.map((type) => dex.TYPE_KO[type] ?? type).join(' · ');
  return (
    <div className="rk-tablewrap px-skin px-drop">
      <table className="px-table rk-table">
        <thead>
          <tr>
            <th scope="col">순위</th><th scope="col">포켓몬</th><th scope="col">추천 기술</th>
            <th scope="col" className="is-num">DPS</th><th scope="col" className="is-num">TDO</th>
            {mode === 'easy' ? <th scope="col" className="is-num">점수</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const cells = pveCells(mode, row);
            const no = dexNoOf(row.sprite, dexTable);
            return (
              <tr key={`${row.sprite}-${row.name}`} className={row.unrel ? 'is-unreleased' : undefined} tabIndex={0} role="button"
                aria-label={`${row.name} 상세 보기`} onClick={() => onOpen(row)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(row); } }}>
                <td data-label="순위" className="rk-table__rank"><PokemonNumberRibbon rank={rankOf(row, index)} /></td>
                <td data-label="포켓몬" className="rk-table__mon">
                  <span className="px-ball px-ball--sm"><Sprite id={row.sprite} /></span>
                  <span className="rk-row__main">
                    <span className="rk-row__name"><NameNode name={row.name} en={row.en} labels={dex.FORM_LABELS} /></span>
                    <span className="rk-row__types">{no !== null ? `#${String(no).padStart(3, '0')} · ` : ''}{typeLine(row.types)}</span>
                    <span className="rk-row__badges"><RankBadges name={row.name} unrel={row.unrel} /></span>
                  </span>
                </td>
                <td data-label="추천 기술" className="rk-table__moves">{cells.lines.length ? cells.lines.join(' · ') : '—'}</td>
                <td data-label="DPS" className="is-num rk-table__metric">{num(row.dps, 1)}</td>
                <td data-label="TDO" className="is-num rk-table__metric">{num(row.tdo)}</td>
                {mode === 'easy' ? <td data-label="점수" className="is-num rk-table__metric rk-table__score">{cells.score}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pve({ onOpen }: { onOpen: OpenMon }) {
  const { data: pve } = usePve();
  const { data: dex } = useDex();
  const mode = useRankStore((s) => s.pveMode);
  const boss = useRankStore((s) => s.boss);
  const easyBoss = useRankStore((s) => s.easyBoss);
  const set = useRankStore((s) => s.set);
  const { view, pick } = useView('pve');

  // **두 탭은 거르는 범위만 다르다 — 묶는 기준은 같다.**
  //   일반  그 타입 포켓몬 중 전설·환상·UB·메가·섀도우를 뺀 것
  //   전체  그 타입 포켓몬 전부
  // 전체가 PVE_DATA(보스 타입 카운터)를 쓰고 있었다 — [전기] 를 눌렀는데 땅 타입인 그란돈·
  // 한카리아스가 "전기 타입 레이드 성능" 이라는 이름으로 나왔다 (2026-09-18 제보).
  // 카운터 표는 지운 게 아니라 제 자리에 남겼다: 솔플 계산기(보스를 고르면 카운터)와
  // 상세의 활용처가 그것을 쓴다. 이 화면의 타입 칩은 "그 타입" 하나만 뜻한다
  const table = mode === 'easy' ? pve.PVE_EASY : pve.PVE_BY_TYPE;
  const picked = mode === 'easy' ? easyBoss : boss;
  const rows = table[picked] ?? table['overall'] ?? [];
  const typeName = picked === 'overall' ? '전체' : (dex.TYPE_KO[picked] ?? picked);
  // v3 tier.js · pve.js 의 문구 그대로 — 같은 표가 모드마다 다른 이름으로 불린다
  const title = mode === 'easy'
    ? (picked === 'overall' ? '레이드 일반 티어표 (전체)' : `${typeName} 타입 일반 티어표`)
    : (picked === 'overall' ? '레이드 어태커 전체 (자체 계산)' : `${typeName} 타입 레이드 성능`);
  // 같은 표를 두 번 거른 것이라, 무엇을 더 보고 있는지 한 줄로 밝힌다
  const meta = mode === 'easy'
    ? `${rows.length}종 · 전설·환상·메가·섀도우 제외`
    : `${rows.length}종 · 전설·메가·섀도우 포함 · 자체 계산`;

  // 카드 보기 한 칸 — 표 보기는 PveTable 이 그린다
  const card = (row: PveRow, rank: number) => (
    <RankItem key={`${row.sprite}-${row.name}`} view="grid" row={row} rank={rank} cells={pveCells(mode, row)}
      unrel={row.unrel} delta={row.d} dexTable={dex.DEX_DATA.dex} onOpen={() => onOpen(row)} />
  );
  const list = (group: PveRow[], rankOf: (row: PveRow, index: number) => number) => (view === 'grid'
    ? <RankList view="grid">{group.map((row, index) => card(row, rankOf(row, index)))}</RankList>
    : <PveTable rows={group} mode={mode} dexTable={dex.DEX_DATA.dex} rankOf={rankOf} onOpen={onOpen} />);

  return (
    <>
      <Slot name="tabs">
        <TabBar
          tabs={<PxTabs label="범위" items={[{ id: 'easy', label: '일반' }, { id: 'all', label: '전체' }]} value={mode}
            onPick={(id) => { set('pveMode', id as 'easy' | 'all'); track('sub_pve_' + id); }} />}
          routeToolsOnly
          tools={<button type="button" className="px-btn px-btn--primary px-skin" onClick={() => { go('/pve/solo'); }}>솔플 계산기 →</button>}
        />
      </Slot>
      <Slot name="controls">
        <PxChips label="타입" items={typeChips(dex.TYPE_KO)} value={picked} onPick={(id) => set(mode === 'easy' ? 'easyBoss' : 'boss', id)} />
        <div className="rk-toggles"><PxViewSwitch view={view} onPick={pick} /></div>
      </Slot>

      {/* 안내 판 — 지금 탭이 무엇을 넣고 뺐는지 (피그마 10) */}
      <section className="px-note px-skin px-drop rk-info">
        <p className="px-note__body">
          {mode === 'easy'
            ? '일반 순위 기준 — 전설·환상·메가·섀도우 폼을 제외합니다. 전체 탭에서는 해당 폼을 포함합니다.'
            : '전체 순위 기준 — 전설·환상·메가·섀도우 폼을 포함합니다. 일반 탭에서는 해당 폼을 제외합니다.'}
        </p>
      </section>
      <RowHead title={title} meta={meta} />
      {/* 점수 칸의 뜻은 모드마다 다르다 — 그 갈래는 pveCells 안에 적어 뒀다 */}
      {mode === 'easy'
        ? TIER_ORDER.map((tier) => {
          const group = rows.filter((row) => row.tier === tier);
          if (!group.length) return null;
          return (
            <Fragment key={tier}>
              <TierHead tier={tier} count={group.length} />
              {/* **번호는 그 티어 묶음 안의 순번이다** (v3 renderTierList 가 넘기는 index).
                  D-MAX 티어표는 반대로 탭 전체 순위를 쓴다 — 등급이 절대 기준이라
                  묶음 안 순번을 쓰면 B 티어 첫 카드가 '1' 로 찍혀 근거와 어긋난다(v3.30.1) */}
              {list(group, (_row, index) => index + 1)}
            </Fragment>
          );
        })
        : list(rows, (_row, index) => index + 1)}
    </>
  );
}

export function Pvp({ onOpen }: { onOpen: OpenMon }) {
  const { data: pvp } = usePvp();
  const { data: dex } = useDex();
  const league = useRankStore((s) => s.league);
  const pvpType = useRankStore((s) => s.pvpType);
  const set = useRankStore((s) => s.set);
  const { view, pick } = useView('pvp');
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
  // 리그나 속성을 바꾸면 키가 달라져 저절로 접힌다 (v3 list() 의 키 규칙과 같다)
  const listKey = `pvp-${league}-${pvpType}`;
  // 상세의 '더보기' 로 왔으면 그 줄로 — 접힌 꼬리(ROW_SHOW 밖)에 있으면 먼저 펼친다
  const focus = useRankStore((s) => s.focus);
  const clearFocus = useCallback(() => set('focus', ''), [set]);
  const focusAt = focus ? rows.findIndex((row) => row.name === focus) : -1;
  const open = isOpen(listKey);
  useEffect(() => {
    if (focusAt >= ROW_SHOW && !open) toggleMore(listKey);
  }, [focusAt, open, listKey, toggleMore]);
  useFocusRow(focus, clearFocus, rows.length > 0 && (focusAt < ROW_SHOW || open));
  const shown = open ? rows : rows.slice(0, ROW_SHOW);
  const typeLabel = pvpType === 'all' ? '' : ` · ${dex.TYPE_KO[pvpType] ?? pvpType} 타입`;
  const title = open ? `${name}리그 전체 순위${typeLabel}` : `${name}리그 TOP ${Math.min(ROW_SHOW, rows.length)}${typeLabel}`;
  // 리그 탭 글자 — '리틀 · 500' 처럼 CP 한도를 같이 적는다. 마스터는 한도가 없다 (피그마 12)
  const leagueTabs = LEAGUES.map((one) => ({ id: one.id, label: `${one.name} · ${one.id === 'master' ? '무제한' : Number(one.cp).toLocaleString('ko-KR')}` }));
  // TEAM SYNERGY 판 — 이 리그 상위 세 마리의 그림
  const top3 = ranking.slice(0, 3);

  return (
    <>
      <Slot name="tabs">
        <TabBar tabs={<PxTabs label="리그" items={leagueTabs} value={league} onPick={(id) => set('league', id as LeagueKey)} />} />
      </Slot>
      <Slot name="controls">
        <PxChips label="타입" items={chipItems} value={pvpType} onPick={(id) => set('pvpType', id)} />
        <div className="rk-toggles"><PxViewSwitch view={view} onPick={pick} /></div>
      </Slot>

      <RowHead title={title} meta={`종합 점수 · CP ${league === 'master' ? '무제한' : cp} · 상위 ${ranking.length} 기준`} />
      {/* v3 는 10줄만 펴고 나머지는 [더보기] 뒤에 둔다 — 40줄을 다 세우면 첫 화면이 스크롤 넉 장이 된다 */}
      <RankList view={view}>
        {shown.map((row, index) => (
          <RankItem key={`${row.sprite}-${row.rank}`} view={view} row={row} rank={index + 1} cells={pvpCells(pvpType, row)}
            delta={row.d} dexTable={dex.DEX_DATA.dex} onOpen={() => onOpen(row)} />
        ))}
      </RankList>
      <RankMore total={rows.length} expanded={open} onToggle={() => toggleMore(listKey)} />

      {/* 아래 두 판 — 순위표 다음 할 일로 이끈다: 덱 짜기 · 개체값 순위 (피그마 12) */}
      <div className="rk-notes rk-notes--pvp">
        <section className="px-note px-skin px-drop rk-synergy">
          <p className="px-eyebrow">TEAM SYNERGY</p>
          <p className="px-note__title">한 마리의 강함보다, 세 마리의 균형.</p>
          <p className="px-note__body">{`${name}리그 상위 ${top3.length}마리를 바탕으로, 상대에 맞는 세 마리를 골라 보세요.`}</p>
          <div className="rk-synergy__row">
            <ul className="rk-synergy__balls" aria-label={`${name}리그 상위 ${top3.length}마리`}>
              {top3.map((row) => (
                <li key={row.sprite}>
                  <button type="button" className="px-ball px-ball--sm rk-synergy__ball" aria-label={`${row.name} 상세 보기`} onClick={() => onOpen(row)}>
                    <img src={`${BASE}sprites/${row.sprite}.png`} alt="" width="48" height="48" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-note__actions rk-route-cta">
              <button type="button" className="px-btn px-btn--primary px-skin" onClick={() => { go('/pvp/deck'); }}>PvP 덱 짜기 →</button>
            </div>
          </div>
        </section>
        <section className="px-note px-skin px-drop">
          <p className="px-note__title">내 개체값도 확인해 보세요</p>
          <p className="px-note__body">같은 포켓몬도 개체값에 따라 리그 적합도가 달라집니다.</p>
          <div className="px-note__actions rk-route-cta">
            <button type="button" className="px-btn px-skin" onClick={() => { go('/pvp/ivrank'); }}>PvP 개체값 순위 →</button>
          </div>
        </section>
      </div>
    </>
  );
}
