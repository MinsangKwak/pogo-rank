// ─────────────────────────────────────────────────────────────────────────────
// components/detail/FormGuide.tsx — 상세 팝업 v2 의 카드들 (2026-09-30)
//
// 서비스의 목표는 **다이맥스 · 거다이맥스 우선 육성**이다 (주인 결정). 팝업은 그 답을 먼저 준다.
//   BossLine   진화 계열 아래 — 이 계열이 보스로 서는 맥스 일정 (지금 잡을 수 있는가)
//   TrainCard  육성 추천 — 맥스 배틀 · 레이드용이면 ① 다이맥스 · 거다이맥스 ② 일반 · 전설, PvP 에서만 쓰이면 일반 · 전설
//   FormGuide  폼별 정보 — 요약 한 줄씩. 일반은 눌러 펼치고, 다이맥스 · 거다이맥스는 D-MAX 화면의 그 줄로 간다
//   FormStats  배틀 정보 맨 위 — 지금 보는 폼의 성적 (맥스 폼: 티어 · 딜러 · 탱커 / 일반: PvP 리그 · 레이드)
// 요약만 보이고 자세한 것은 더보기로 — 순위 화면에서 그 줄을 찾아 밝힌다 (stores/rank.ts focus)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useMemo, type ReactNode } from 'react';
import { useDex, useMax, usePve, usePvp, useUsage } from '../../lib/data';
import { dday } from '../../lib/maxSlides';
import { useMaxSlidesSoft } from '../../lib/weekBosses';
import { usageMeterOf } from '../../lib/usage';
import { num } from '../../lib/cell';
import { go } from '../../lib/nav';
import { track } from '../../lib/track';
import { useRankStore } from '../../stores/rank';
import { josa } from '../../lib/deck';
import { PxIcon } from '../PxIcon';
import { bossNow, formKeyOf, formRows, formSummary, FORM_KO, maxBoardOf, maxIndex, placesOf, speciesOf, tierIndex, tierLine, type FormRow } from '../../lib/formGuide';
import { useAuthStore } from '../../stores/auth';
import { trainPlan, type PlanPick } from '../../lib/trainPlan';
import type { MonRef } from '../../lib/mon';
import type { LeagueKey } from '../../types/data';

type Switch = (next: MonRef) => void;

const toMon = (one: { name: string; sprite: number; en: string; types: readonly string[] }): MonRef =>
  ({ sprite: one.sprite, name: one.name, en: one.en, types: one.types });

/** 전 종 점수 한 줄 — 0 점은 '그 판에 못 나간다' 는 뜻이라 적지 않는다 (메가는 PvP 0) */
function meterText(meter: ReturnType<typeof usageMeterOf>): string {
  if (!meter) return '';
  const parts = [meter.pve > 0 ? `레이드 ${meter.pve}` : '', meter.pvp > 0 ? `PvP ${meter.pvp}` : ''].filter(Boolean);
  return parts.length ? `전 종 점수 · ${parts.join(' · ')}` : '';
}

const LEAGUE_KO: Record<string, string> = { little: '리틀컵', great: '슈퍼리그', ultra: '하이퍼리그', master: '마스터리그' };

/** 순위 화면으로 — 판을 고르고 그 줄을 밝히게 한 뒤 팝업을 닫는다 */
function useBoard(onLeave?: () => void) {
  const set = useRankStore((s) => s.set);
  return {
    toMax(row: Pick<FormRow, 'name' | 'places' | 'moveType' | 'tier'>) {
      const board = maxBoardOf(row);
      set('maxAxis', board.axis);
      set('maxBoss', board.boss);
      set('focus', row.name);
      track('detail_more', { to: 'dmax', mon: row.name });
      onLeave?.();
      go('/dmax');
    },
    // 육성 추천의 맥스 묶음 — 그 보스 타입의 딜러 표. 이 계열 맥스 폼이 서 있으면 그 줄을 밝힌다
    toMaxBoss(boss: string, name: string) {
      set('maxAxis', 'dealer');
      set('maxBoss', boss);
      set('focus', name);
      track('detail_more', { to: 'dmax', mon: name || boss });
      onLeave?.();
      go('/dmax');
    },
    // 육성 추천의 레이드 묶음 — 레이드 '전체' 탭의 그 공격 타입 칸(전설 포함).
    // focus 는 두지 않는다 — 레이드 화면은 그 줄을 밝히지 않아, 남겨 두면 다음에 연 D-MAX · PvP 가 엉뚱한 줄을 밝힌다
    toPve(type: string, name: string) {
      set('pveMode', 'all');
      set('boss', type);
      track('detail_more', { to: 'pve', mon: name });
      onLeave?.();
      go('/pve');
    },
    toPvp(name: string, league: LeagueKey) {
      set('league', league);
      set('pvpType', 'all');
      set('focus', name);
      track('detail_more', { to: 'pvp', mon: name });
      onLeave?.();
      go('/pvp');
    },
  };
}

// 티어 글자 → 순서. 글자가 없는 칸(티어 미정)은 맨 뒤
const tierOrder = (tier: string) => { const at = 'SABC'.indexOf(tier); return at < 0 ? 4 : at; };

/**
 * 요약 팝업의 바닥 — '자세한 건 도감을 참고하세요!' 와 옮겨 갈 곳 셋.
 *   도감에서 자세히  도감 화면으로 옮겨 이 포켓몬의 자세한 팝업을 연다 (App.tsx openDeep)
 *   D-MAX          계열의 맥스 폼 중 티어표에서 가장 높은 것의 칸 · 줄로. 맥스 폼이 없으면 D-MAX 첫 화면
 *   PvP            계열에서 가장 높은 리그 순위의 줄로. 없으면 PvP 첫 화면
 */
export function DeepDock({ mon, dexNo, onDeep, onLeave }: { mon: MonRef; dexNo: number | null; onDeep?: (pick: MonRef) => void; onLeave?: () => void }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pvp } = usePvp();
  const board = useBoard(onLeave);
  const index = useMemo(() => maxIndex(max), [max]);
  const tiers = useMemo(() => tierIndex(max), [max]);
  const family = (dexNo != null ? dex.DEX_DATA.evo[String(dexNo)]?.flat() : undefined) ?? (dexNo != null ? [dexNo] : []);
  const stems = [...new Set([speciesOf(mon.name), ...family.map((id) => dex.DEX_DATA.names[String(id)]).filter(Boolean) as string[]])];
  // 계열의 맥스 폼 중 티어표 순위가 가장 높은 것 — 요약의 폼별 정보가 말한 그 칸으로 간다
  const maxPick = stems.flatMap((stem) => [`거다이맥스 ${stem}`, `다이맥스 ${stem}`])
    .map((name) => ({ name, tier: tiers.get(name) ?? null }))
    .filter((one) => one.tier)
    // 티어(S · A · B · C)가 먼저다 — 순위는 칸 안의 순서라 칸이 다르면 견줄 수 없다 (한산한 칸의 C티어 1위가 붐비는 칸의 S티어 3위를 이긴다) (Codex, PR #273)
    .sort((left, right) => tierOrder(left.tier!.tier) - tierOrder(right.tier!.tier) || left.tier!.rank - right.tier!.rank)[0];
  const pvpPick = stems.flatMap((name) => (Object.keys(LEAGUE_KO) as LeagueKey[])
    .map((league) => ({ name, league, at: (pvp.PVP_DATA[league] ?? []).findIndex((row) => row.name === name) })))
    .filter((one) => one.at >= 0)
    .sort((left, right) => left.at - right.at)[0];
  return (
    <div className="detail__deep">
      <p className="detail__deep-hint">자세한 건 도감을 참고하세요!</p>
      <div className="detail__dock-row">
        <button type="button" className="detail__dock-btn detail__dock-btn--accent detail__deep-dex" onClick={() => onDeep?.(mon)}>
          <PxIcon emoji="📕" /><span className="btn-label">도감에서 자세히</span>
        </button>
        <button type="button" className="detail__dock-btn detail__deep-max" onClick={() => {
          if (maxPick) { board.toMax({ name: maxPick.name, places: [], moveType: index.get(maxPick.name)?.charged ?? '', tier: maxPick.tier }); return; }
          track('detail_more', { to: 'dmax', mon: mon.name });
          onLeave?.();
          go('/dmax');
        }}>
          <PxIcon emoji="⚡" /><span className="btn-label">D-MAX 순위</span>
        </button>
        <button type="button" className="detail__dock-btn detail__deep-pvp" onClick={() => {
          if (pvpPick) { board.toPvp(pvpPick.name, pvpPick.league); return; }
          track('detail_more', { to: 'pvp', mon: mon.name });
          onLeave?.();
          go('/pvp');
        }}>
          <PxIcon emoji="⚔️" /><span className="btn-label">PvP 순위</span>
        </button>
      </div>
    </div>
  );
}

/** 이 계열이 보스로 서는 가장 이른 맥스 일정 — 없으면 아무것도 안 그린다 */
export function BossLine({ dexNo }: { dexNo: number | null }) {
  const { data: dex } = useDex();
  const slides = useMaxSlidesSoft();
  const family = dexNo != null ? dex.DEX_DATA.evo[String(dexNo)] : undefined;
  const boss = bossNow(slides, new Set<number>(family?.flat() ?? (dexNo != null ? [dexNo] : [])));
  if (!boss) return null;
  return (
    <p className="detail__formguide-boss">
      <span className="tag">{dday(boss.slide)}</span>
      <span>{`맥스 배틀 · ${boss.name}${boss.dex !== dexNo ? ' (같은 진화 계열)' : ''} · ${boss.slide.short}`}</span>
    </p>
  );
}

/** 육성 추천 — 계열 전체가 어디서 쓰이는지로 갈라 권한다 (lib/trainPlan.ts) */
export function TrainCard({ mon, dexNo, stem, onLeave }: { mon: MonRef; dexNo: number | null; stem: string; onLeave?: () => void }) {
  const { data: dex } = useDex();
  const board = useBoard(onLeave);
  const { data: max } = useMax();
  const { data: usage } = useUsage();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const plan = useMemo(() => {
    const family = dexNo != null ? dex.DEX_DATA.evo[String(dexNo)] : undefined;
    const names = family?.flat().map((id) => dex.DEX_DATA.names[String(id)]).filter(Boolean) as string[] | undefined;
    return trainPlan({
      stems: [...new Set([stem, ...(names ?? [])])],
      types: mon.types,
      places: usage.USAGE_PLACES, meter: usage.METER,
      dmax: max.DMAX_DATA, pve: pve.PVE_DATA, pvp: pvp.PVP_DATA,
      chart: dex.DEX_DATA.chart, typeKo: dex.TYPE_KO,
      dexOf: (sprite) => dex.DEX_DATA.dex[String(sprite)] ?? (sprite < 10000 ? sprite : null),
      maxForm: formKeyOf(mon.name) === 'dmax' || formKeyOf(mon.name) === 'gmax',
    });
  }, [dex, max, usage, pve, pvp, dexNo, stem, mon.types, mon.name]);
  // **문장으로 푼다 — 왜 → 그래서 → 순위** (2026-09-30 주인 제보: '물 타입 보스 기준' 제목과 순위만으로는 기승전결이 없어 무슨 말인지 모른다).
  //   첫 문장: 이 포켓몬이 어떤 타입 기술로 어떤 타입 보스를 잘 잡는지
  //   묶음 첫 줄: 그래서 이 목록이 무엇의 순위인지, 이 계열은 몇 위인지
  // 문장은 한 줄씩 따로 그린다 — 영어 화면의 사전이 문장 단위로 찾는다 (content/i18n.en.mjs)
  const ko = (type: string) => dex.TYPE_KO[type] ?? type;
  const target = (type: string) => (type === 'overall' ? '모든 보스' : `${ko(type)} 타입 보스`);
  const lead: string[] = (() => {
    if (plan.pve) {
      const { maxType, atkType } = plan.pve;
      if (maxType === 'overall') return [`${josa(stem, '은', '는')} 한 타입에 치우치지 않고 여러 보스를 두루 상대해요.`, '그래서 모든 보스 기준 딜러 순위를 바로 찾아볼 수 있어요.'];
      return [
        atkType ? `${josa(stem, '은', '는')} ${ko(atkType)} 타입 기술로 ${ko(maxType)} 타입 보스를 잘 잡아요.` : `${josa(stem, '이', '가')} 가장 활약하는 상대는 ${ko(maxType)} 타입 보스예요.`,
        `그래서 ${ko(maxType)} 타입 보스를 잡을 때 키울 포켓몬을 순위 화면에서 바로 찾아볼 수 있어요.`,
      ];
    }
    return [];
  })();
  const ownLine = (rows: readonly PlanPick[], none: string) => {
    const own = rows.find((row) => row.own);
    return own ? `이 계열에서는 ${josa(own.name, '이', '가')} ${own.note}예요.` : none;
  };
  const say = (lines: readonly string[]) => lines.filter(Boolean).map((line) => <span key={line}>{line}</span>);
  // **목록은 팝업에 두지 않는다 — 순위 화면으로 옮겨 가는 단추만** (2026-09-30 주인 결정: 여기서 다 보여 주면 순위 화면을 안 쓴다).
  // 설명(왜 · 그래서 · 이 계열은 몇 위)만 두고, 나머지는 그 판의 그 칸으로 보낸다
  const group = (key: string, tag: ReactNode, title: string, lines: readonly string[], go: ReactNode) => (
    <details key={key} className="detail__train-group" open>
      <summary className="detail__train-head">
        {tag}
        <span className="detail__train-title">{title}</span>
      </summary>
      <p className="detail__train-say">{say(lines)}</p>
      <div className="detail__train-go">{go}</div>
    </details>
  );
  const maxFirst = !!plan.pve?.max.length;
  const raidLines = (() => {
    if (!plan.pve) return [];
    const { maxType, raidType } = plan.pve;
    const head = raidType === maxType || !maxFirst
      ? [`레이드에서도 ${target(raidType)}를 잡을 때 쓰여요.`]
      : [`레이드에서는 ${target(raidType)}를 상대로 더 많이 쓰여요.`];
    return [...head, ownLine(plan.pve.base, ''), '다이맥스 없이 오래 쓸 일반·전설 딜러는 레이드 순위에서 골라 보세요.'];
  })();
  // PvP 에서만 쓰이는 계열은 카드를 세우지 않는다 — 리그 순위 목록을 보여 줄 까닭이 없다 (2026-09-30 주인 결정).
  // 이 서비스의 육성 추천은 레이드 · 맥스(다이맥스 우선) 답이다. PvP 성적은 자세히 보기의 배틀 정보에 있다
  if (!plan.pve) return null;

  return (
    <section className="detail__card detail__train">
      <h3>육성 추천</h3>
      {lead.length ? <p className="detail__train-lead">{say(lead)}</p> : null}
      {maxFirst ? group('max', <span className="form-tag form-tag--max">먼저 키우기</span>, '다이맥스 · 거다이맥스',
        [ownLine(plan.pve.max, '이 계열의 맥스 폼은 아직 이 순위에 없어요.'), `맥스 배틀에서 ${target(plan.pve.maxType)}를 잡는 딜러 순위는 D-MAX 화면에서 볼 수 있어요.`],
        <button type="button" className="detail__form-go" onClick={() => board.toMaxBoss(plan.pve!.maxType, plan.pve!.max.find((row) => row.own)?.name ?? '')}>D-MAX 순위에서 보기 ›</button>) : null}
      {plan.pve.base.length
        ? group('raid', <span className="form-tag">{maxFirst ? '다음으로' : '추천'}</span>, '레이드용 일반 · 전설', raidLines,
          <button type="button" className="detail__form-go" onClick={() => board.toPve(plan.pve!.raidAtk, stem)}>레이드 순위에서 보기 ›</button>)
        : null}
    </section>
  );
}

/**
 * 폼별 정보 — 일반 · 메가 · 다이맥스 · 거다이맥스를 한 목록에. 어느 폼을 보고 있어도 같은 목록이 선다.
 * baseLabel 은 일반 줄의 이름표 (섀도우 폼을 보고 있으면 그 라벨)
 */
export default function FormGuide({ mon, dexNo, baseLabel, onSwitch, onLeave }: {
  mon: MonRef; dexNo: number | null; baseLabel: string; onSwitch: Switch; onLeave?: () => void;
}) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: usage } = useUsage();
  const board = useBoard(onLeave);
  const index = useMemo(() => maxIndex(max), [max]);
  const tiers = useMemo(() => tierIndex(max), [max]);
  const species = dexNo != null ? dex.DEX_DATA.names[String(dexNo)] : undefined;
  // 메가 줄은 원종 이름일 때만 — 섀도우 리자몽에서 '메가X 섀도우 리자몽' 같은 없는 폼을 만들지 않는다 (Codex, PR #267)
  const megas = (dexNo != null && speciesOf(mon.name) === species ? dex.DEX_DATA.megas[String(dexNo)] ?? [] : [])
    .map((one) => ({ ...one, types: dex.DEX_DATA.forms[String(one.sprite)]?.types ?? [] }));
  const baseTypes = dexNo != null ? dex.DEX_DATA.forms[String(dexNo)]?.types : undefined;
  const rows = formRows({ ...mon, dexNo, baseTypes }, index, usage.USAGE_PLACES, dex.TYPE_KO, tiers, megas);

  return (
    <section className="detail__card detail__formguide">
      <h3>폼별 정보</h3>
      <div className="detail__formrows">
        {rows.map((row) => {
          const on = row.name === mon.name;
          const label = row.key === 'base' ? baseLabel : row.label;
          const kind = row.key === 'mega' ? ' form-tag--mega' : row.key === 'base' ? '' : ' form-tag--max';
          const tag = <span className={`form-tag${kind}`}>{label}</span>;
          if (row.key === 'dmax' || row.key === 'gmax') {
            // 맥스 폼은 팝업에서 요약만 — 더보기는 D-MAX 화면의 그 줄 (2026-09-30 주인 요청)
            return (
              <button key={row.name} type="button" className={`detail__form detail__formrow${on ? ' is-now' : ''}`}
                onClick={() => board.toMax(row)}>
                {tag}
                <span className="detail__formrow-use">{formSummary(row, dex.TYPE_KO)}</span>
                {row.unrel ? <span className="tag">미출시</span> : null}
                <span className="detail__formrow-go">D-MAX 더보기 ›</span>
              </button>
            );
          }
          const meter = meterText(usageMeterOf(usage.METER, row.name));
          return (
            // 일반 · 메가는 눌러서 펼친다 — 활용처 전부와 전 종 점수, 그 폼으로 바꿔 보기
            <details key={row.name} className={`detail__form${on ? ' is-now' : ''}`}>
              <summary className="detail__formrow">
                {tag}
                <span className="detail__formrow-use">{!row.places.length && meter ? meter : formSummary(row, dex.TYPE_KO)}</span>
                {row.unrel ? <span className="tag">미출시</span> : null}
                <span className="detail__formrow-go">더보기</span>
              </summary>
              <div className="detail__form-body">
                {/* 요약 줄이 이미 점수를 말했으면 펼친 곳에서 되풀이하지 않는다 */}
                {meter && row.places.length ? <p className="detail__form-meter">{meter}</p> : null}
                {row.places.length ? (
                  <div className="detail__ranks">
                    {row.places.map((one) => (
                      <div key={one.key} className={`detail__rank-row${one.rank <= 3 ? ' is-top' : ''}`}>
                        <span className="detail__rank-where">{one.label}</span>
                        <b className="detail__rank-no">{`${one.rank}위`}</b>
                      </div>
                    ))}
                  </div>
                ) : <p className="detail__none-text">순위표 상위 30위 밖이에요.</p>}
                {!on ? (
                  <button type="button" className="detail__form-go" onClick={() => onSwitch(toMon(row))}>{`${label} 폼으로 보기 ›`}</button>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

/** 지금 보는 폼의 성적 — 배틀 정보 맨 위. 맥스 폼은 D-MAX 표, 일반은 PvP 리그 · 레이드 */
export function FormStats({ mon, dexNo, baseLabel, onLeave }: { mon: MonRef; dexNo: number | null; baseLabel: string; onLeave?: () => void }) {
  const { data: dex } = useDex();
  const slides = useMaxSlidesSoft();
  const { data: max } = useMax();
  const { data: pvp } = usePvp();
  const { data: usage } = useUsage();
  const board = useBoard(onLeave);
  const idx = useMemo(() => maxIndex(max), [max]);
  // 미구현 체크는 실험 기능(beta)에서만 산다 — Ranks.tsx Dmax 와 같은 판정 (순위를 D-MAX 화면과 같게 센다)
  const showUnrel = useRankStore((s) => s.maxShowUnrel);
  const beta = useAuthStore((s) => s.beta);
  const withUnrel = showUnrel && beta;
  const tiers = useMemo(() => tierIndex(max, withUnrel), [max, withUnrel]);
  const key = formKeyOf(mon.name);

  if (key === 'dmax' || key === 'gmax') {
    // 맨 앞은 기술 타입 칸의 티어 · 순위 ('풀 A티어 · 2위') — 전체 순위가 아니라 그 타입에서 몇 티어인지가 궁금한 것이다 (2026-09-30 주인 결정)
    const spot = tiers.get(mon.name) ?? null;
    const places = placesOf(usage.USAGE_PLACES, mon.name, dex.TYPE_KO).filter((one) => one.group === '맥스');
    const best = places.find((one) => !one.key.endsWith(':overall'));
    const lines = [
      spot ? tierLine(spot, dex.TYPE_KO) : '',
      best ? `가장 강한 상대 · ${best.where} 보스 딜러 ${best.rank}위` : '',
    ].filter(Boolean);
    const moveType = idx.get(mon.name)?.charged ?? '';
    // 게임에 아직 없는 맥스 폼 — 맥스 표에 줄이 없거나 미구현 줄뿐이다. '순위에 없다' 가 아니라 '아직 안 나왔다' 가 맞는 말이고,
    // 곧 맥스 배틀이 열리면 그 날짜가 가장 궁금한 것이다 (2026-09-30 주인 제보: 태우지네)
    const row = idx.get(mon.name);
    if (!row || (row.unrel && !withUnrel)) {
      // 보고 있는 폼과 같은 종류(다이맥스 ↔ 거다이맥스)의 일정만 — 다른 폼의 배틀을 이 폼의 첫 등장으로 알리지 않는다 (Codex, PR #269)
      const soon = dexNo != null ? bossNow(slides.filter((one) => one.gmax === (key === 'gmax')), new Set([dexNo])) : null;
      return (
        <section className="detail__card detail__formstats">
          <h3><span className="form-tag form-tag--max">{FORM_KO[key]}</span> 이 폼의 성적</h3>
          <p className="detail__none-text">
            {soon?.slide.live ? '이번 주 맥스 배틀에서 처음 등장해요 · 수치는 등장 후 계산 예정이에요.' : '추후 등장 후 수치 계산 예정이에요.'}
          </p>
          {soon ? (
            <p className="detail__formguide-boss">
              <span className="tag">{dday(soon.slide)}</span>
              <span>{`${soon.slide.live ? '맥스 배틀 진행 중' : '곧 맥스 배틀 시작'} · ${soon.name} · ${soon.slide.short}`}</span>
            </p>
          ) : null}
          {soon ? (
            <button type="button" className="detail__form-go" onClick={() => { track('detail_more', { to: 'schedule', mon: mon.name }); onLeave?.(); go('/schedule'); }}>일정 보기 ›</button>
          ) : null}
        </section>
      );
    }
    return (
      <section className="detail__card detail__formstats">
        <h3><span className="form-tag form-tag--max">{FORM_KO[key]}</span> 이 폼의 성적</h3>
        {lines.length
          ? <ul className="detail__stat-lines">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
          : <p className="detail__none-text">D-MAX 순위표 상위권 밖이에요.</p>}
        <button type="button" className="detail__form-go" onClick={() => board.toMax({ name: mon.name, places, moveType, tier: spot })}>D-MAX 더보기 ›</button>
      </section>
    );
  }

  // 일반 — PvP 리그마다 몇 위인지, 레이드는 가장 높은 세 곳
  const leagues = (Object.keys(LEAGUE_KO) as LeagueKey[])
    .map((league) => ({ league, at: (pvp.PVP_DATA[league] ?? []).findIndex((row) => row.name === mon.name) }))
    .filter((one) => one.at >= 0);
  const raids = placesOf(usage.USAGE_PLACES, mon.name, dex.TYPE_KO).filter((one) => one.group === '레이드').slice(0, 3);
  const meter = meterText(usageMeterOf(usage.METER, mon.name));
  if (!leagues.length && !raids.length && !meter) return null;
  // 메가를 보고 있으면 그 라벨 ('메가X') — 일반이라고 적으면 어느 폼의 성적인지 틀린다
  const label = key === 'mega' ? (mon.name.split(' ')[0] ?? FORM_KO.mega) : baseLabel;
  return (
    <section className="detail__card detail__formstats">
      <h3><span className={`form-tag${key === 'mega' ? ' form-tag--mega' : ''}`}>{label}</span> 이 폼의 성적</h3>
      {meter ? <p className="detail__form-meter">{meter}</p> : null}
      {raids.length ? (
        <div className="detail__stat-group">
          <h4 className="detail__train-head">레이드</h4>
          {raids.map((one) => (
            <div key={one.key} className="detail__rank-row">
              <span className="detail__rank-where">{`${one.where} 보스 상대`}</span>
              <b className="detail__rank-no">{`${one.rank}위`}</b>
            </div>
          ))}
        </div>
      ) : null}
      {leagues.length ? (
        <div className="detail__stat-group">
          <h4 className="detail__train-head">PvP</h4>
          {leagues.map(({ league, at }) => (
            <button key={league} type="button" className="detail__rank-row detail__stat-go" onClick={() => board.toPvp(mon.name, league)}>
              <span className="detail__rank-where">{`${LEAGUE_KO[league]} · 점수 ${num(pvp.PVP_DATA[league]?.[at]?.score)}`}</span>
              <b className="detail__rank-no">{`${at + 1}위`}</b>
              <span className="detail__rec-go" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
