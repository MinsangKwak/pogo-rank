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
import { useMemo } from 'react';
import { useDex, useMax, usePve, usePvp, useUsage } from '../../lib/data';
import { dday } from '../../lib/maxSlides';
import { useMaxSlidesSoft } from '../../lib/weekBosses';
import { usageMeterOf } from '../../lib/usage';
import { num } from '../../lib/cell';
import { go } from '../../lib/nav';
import { track } from '../../lib/track';
import { useRankStore } from '../../stores/rank';
import { Sprite } from '../Bits';
import { NameNode } from '../Row';
import { bossNow, formKeyOf, formRows, formSummary, FORM_KO, maxBoardOf, maxIndex, placesOf, tierIndex, type FormRow } from '../../lib/formGuide';
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
    toMax(row: Pick<FormRow, 'name' | 'places' | 'moveType'>) {
      const board = maxBoardOf(row);
      set('maxAxis', board.axis);
      set('maxBoss', board.boss);
      set('focus', row.name);
      track('detail_more', { to: 'dmax', mon: row.name });
      onLeave?.();
      go('/dmax');
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

function Picks({ rows, onSwitch }: { rows: readonly PlanPick[]; onSwitch: Switch }) {
  const { data } = useDex();
  return (
    <div className="detail__recs">
      {rows.map((row) => (
        <button key={row.name} type="button" className="detail__rec detail__pick" onClick={() => onSwitch(toMon(row))}>
          <Sprite id={row.sprite} />
          <span className="detail__pick-main">
            <span className="detail__rec-name"><NameNode name={row.name} labels={data.FORM_LABELS} /></span>
            <span className="detail__pick-note">{row.own ? `이 계열 · ${row.note}` : row.note}</span>
          </span>
          <span className="detail__rec-go" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}

/** 육성 추천 — 계열 전체가 어디서 쓰이는지로 갈라 권한다 (lib/trainPlan.ts) */
export function TrainCard({ mon, dexNo, stem, onSwitch }: { mon: MonRef; dexNo: number | null; stem: string; onSwitch: Switch }) {
  const { data: dex } = useDex();
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
    });
  }, [dex, max, usage, pve, pvp, dexNo, stem, mon.types]);
  // 판 이름은 제목 옆 작은 글자로 — 제목에 이어 붙이면 좁은 화면에서 두 줄로 꺾였다 (390px 실측)
  const boss = (type: string) => (type === 'overall' ? null : <span className="detail__train-where">{`${dex.TYPE_KO[type] ?? type} 보스 상대`}</span>);

  return (
    <section className="detail__card detail__train">
      <h3>육성 추천</h3>
      {plan.pve ? (
        <div className="detail__train-part">
          <p className="detail__card-sub">맥스 배틀 · 레이드용 — 다이맥스 · 거다이맥스부터 키우세요</p>
          {plan.pve.max.length ? (
            <>
              <h4 className="detail__train-head">
                <span className="form-tag form-tag--max">1순위</span>다이맥스 · 거다이맥스{boss(plan.pve.maxType)}
              </h4>
              <Picks rows={plan.pve.max} onSwitch={onSwitch} />
            </>
          ) : null}
          {plan.pve.base.length ? (
            <>
              <h4 className="detail__train-head">
                <span className="form-tag">{plan.pve.max.length ? '2순위' : '추천'}</span>레이드 · 일반 · 전설{boss(plan.pve.raidType)}
              </h4>
              <Picks rows={plan.pve.base} onSwitch={onSwitch} />
            </>
          ) : null}
        </div>
      ) : null}
      {plan.pvp ? (
        <div className="detail__train-part">
          <p className="detail__card-sub">PvP용 — 일반 · 전설 개체로 키우세요 (맥스 폼은 트레이너 배틀에서 다이맥스하지 않아요)</p>
          <h4 className="detail__train-head"><span className="form-tag">PvP</span>{`${LEAGUE_KO[plan.pvp.league] ?? plan.pvp.league} · 일반 · 전설`}</h4>
          <Picks rows={plan.pvp.base} onSwitch={onSwitch} />
        </div>
      ) : null}
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
  const megas = (dexNo != null ? dex.DEX_DATA.megas[String(dexNo)] ?? [] : [])
    .map((one) => ({ ...one, types: dex.DEX_DATA.forms[String(one.sprite)]?.types ?? [] }));
  const rows = formRows({ ...mon, dexNo }, index, usage.USAGE_PLACES, dex.TYPE_KO, tiers, megas);

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
                <span className="detail__formrow-use">{formSummary(row)}</span>
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
                <span className="detail__formrow-use">{!row.places.length && meter ? meter : formSummary(row)}</span>
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
                ) : <p className="detail__none-text">순위표 상위 30위에 이 폼이 선 곳이 없어요.</p>}
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
export function FormStats({ mon, baseLabel, onLeave }: { mon: MonRef; baseLabel: string; onLeave?: () => void }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pvp } = usePvp();
  const { data: usage } = useUsage();
  const board = useBoard(onLeave);
  const idx = useMemo(() => maxIndex(max), [max]);
  const key = formKeyOf(mon.name);

  if (key === 'dmax' || key === 'gmax') {
    const tierRow = (max.DMAX_TIER['overall'] ?? []).find((row) => row.name === mon.name) as { tier?: string; pct?: number } | undefined;
    const dealAt = (max.DMAX_DATA['overall'] ?? []).findIndex((row) => row.name === mon.name);
    const tankAt = (max.DMAX_TANK['overall'] ?? []).findIndex((row) => row.name === mon.name);
    const deal = dealAt >= 0 ? max.DMAX_DATA['overall']?.[dealAt] : undefined;
    const tank = tankAt >= 0 ? max.DMAX_TANK['overall']?.[tankAt] : undefined;
    const places = placesOf(usage.USAGE_PLACES, mon.name, dex.TYPE_KO).filter((one) => one.group === '맥스');
    const best = places.find((one) => !one.key.endsWith(':overall'));
    const lines = [
      tierRow?.tier ? `D-MAX ${tierRow.tier}티어${tierRow.pct != null ? ` · 전 종 1위 대비 ${num(tierRow.pct)}%` : ''}` : '',
      deal ? `딜러 전체 ${dealAt + 1}위 · 맥스 피해 ${num(deal.dmg)}` : '',
      tank ? `탱커 전체 ${tankAt + 1}위 · EHP ${num(tank.ehp)}` : '',
      best ? `가장 강한 판 · ${best.where} 보스 ${best.rank}위` : '',
    ].filter(Boolean);
    const moveType = idx.get(mon.name)?.charged ?? '';
    return (
      <section className="detail__card detail__formstats">
        <h3><span className="form-tag form-tag--max">{FORM_KO[key]}</span> 이 폼의 성적</h3>
        {lines.length
          ? <ul className="detail__stat-lines">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
          : <p className="detail__none-text">D-MAX 순위표 상위에 이 폼이 선 곳이 없어요.</p>}
        <button type="button" className="detail__form-go" onClick={() => board.toMax({ name: mon.name, places, moveType })}>D-MAX 더보기 ›</button>
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
