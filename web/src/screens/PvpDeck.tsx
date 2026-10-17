// ─────────────────────────────────────────────────────────────────────────────
// screens/PvpDeck.tsx — 🃏 PvP 덱 짜기 (v3 views/ifsolo.js renderPvpDeck · v6 피그마 13)
//
// 두 덩이로 읽힌다.
//   ① 진짜 추천 덱 3종 — 상대 입력 없이 리그 메타만으로. 컨셉이 서로 다르고 이유를 적는다
//        정석 코어  점수 + 약점 상호 보완 그리디
//        안티 메타  리그 상위 10마리 상대 평균 상성순
//        타입 분산  방어 타입이 안 겹치게
//      v6 는 셋을 접이식 대신 **전략 칩**으로 고른다 — 한 번에 한 덱만 보여 비교가 빠르다
//   ② 커스텀 덱 짜기 — 자주 만나는 상대를 슬롯에 넣으면 그 셋을 두루 받아치는 덱과 카운터.
//      상대 넣기 · 추천 덱 한 칸 바꾸기는 공용 교체 팝업(components/SwapDialog.tsx)이다
//
// 맞춤 덱은 **리그 점수 × 상대별 fit 의 기하평균**으로 고른다. 곱을 쓰는 이유 —
// 한 상대에게 극단적으로 강해도 다른 상대에게 0에 가깝게 약하면 곱이 작아져 걸러진다
// (산술평균이면 극단값이 평균을 끌어올려 버린다).
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useMemo, useState } from 'react';
import { useDex, useMax, usePve, usePvp } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { Slot } from '../components/Slots';
import { PxChips, PxTabs, ToolBtn } from '../components/Bits';
import { RankRow, RankList } from '../components/Row';
import { CandList, CandRow, DataTable, Grade, SecHead, SlotCard } from '../components/ToolBits';
import SwapDialog from '../components/SwapDialog';
import { PixelIcon } from '../components/PixelIcon';
import { LEAGUES } from '../lib/leagues';
import { LEAGUE_KO } from '../lib/ivrank';
import { buildBossIndex, type BossEntry } from '../lib/search';
import { josa, makeDeckTools } from '../lib/deck';
import { count, num, word } from '../lib/cell';
import { track, trackSearchPick } from '../lib/track';
import type { OpenMon } from '../lib/mon';
import type { LeagueKey, PvpRow } from '../types/data';

const SLOT_ROLE = ['선봉', '교체', '마무리'] as const;

/** 상성 계수를 세 단계로 — 유리(>1) · 보통(=1) · 주의(<1). 표의 칸과 공통 약점 문장이 같은 기준을 쓴다 */
function fitGrade(fit: number): { label: string; tone: 'mint' | 'orange' | 'muted' } {
  if (fit > 1) return { label: '유리', tone: 'mint' };
  if (fit < 1) return { label: '주의', tone: 'orange' };
  return { label: '보통', tone: 'muted' };
}

export default function PvpDeck({ onOpen }: { onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const league = useRankStore((s) => s.league);
  const set = useRankStore((s) => s.set);
  const [foes, setFoes] = useState<BossEntry[]>([]);
  const [strategy, setStrategy] = useState(0);
  // 맞춤 덱에서 손으로 바꾼 칸 — 상대가 바뀌면 추천이 바뀌므로 함께 비운다
  const [override, setOverride] = useState<Record<number, PvpRow>>({});
  // 카운터 TOP 3 를 펼친 상대
  const [openFoe, setOpenFoe] = useState<string | null>(null);
  // 교체 팝업 — 상대 칸(foe) 또는 추천 덱 칸(deck)
  const [swap, setSwap] = useState<{ kind: 'foe' | 'deck'; index: number } | null>(null);

  const tools = useMemo(() => makeDeckTools(dex.DEX_DATA.chart, dex.TYPE_KO, dex.DEX_DATA.dex), [dex]);
  const pool = pvp.PVP_DATA[league] ?? [];
  const ko = (type: string) => dex.TYPE_KO[type] ?? type;

  const recs = useMemo(() => {
    const top = tools.topBySpecies(pool, 20);   // 종 단위 중복을 뺀 리그 점수 상위 20
    const meta = top.slice(0, 10);              // 그중 상위 10 = '지금 메타'
    const balanced = tools.buildBalanced(top);
    const anti = tools.buildAntiMeta(top, balanced);
    const spread = tools.buildSpread(top, [...balanced, ...anti]);
    const lead = balanced[0]?.name ?? '';
    return [
      {
        title: '정석 코어', tag: '점수 상위 + 약점 상호 보완', deck: balanced,
        reason: tools.recReason(balanced, `${LEAGUE_KO[league]}리그 점수 1위 ${josa(lead, '을', '를')} 중심으로, 서로 약점을 반감해주는 조합을 골랐어요`),
      },
      {
        title: '안티 메타', tag: '리그 상위 10마리 저격', deck: anti,
        reason: tools.recReason(anti, `지금 메타 상위 10마리(${meta.slice(0, 3).map((one) => one.name).join('·')} 등) 상대 평균 상성이 가장 좋은 조합이에요`),
      },
      {
        title: '타입 분산', tag: '방어 타입 안 겹침', deck: spread,
        reason: tools.recReason(spread, '방어 타입이 겹치지 않아 상대가 한 타입 기술로 셋을 다 뚫지 못해요'),
      },
    ];
  }, [tools, pool, league]);
  const rec = recs[strategy] ?? recs[0]!;

  // 맞춤 덱 — 리그 점수 × 상대별 fit 의 기하평균. 같은 종은 파티에 1마리라 종 단위로 거른다
  const ranked = useMemo(() => {
    if (!foes.length) return [] as { candidate: PvpRow; fit: number }[];
    return pool.map((candidate) => {
      const fits = foes.map((foe) => tools.foeFit(candidate, foe));
      const fit = fits.reduce((product, value) => product * value, 1) ** (1 / fits.length);
      return { candidate, fit, total: candidate.score * fit };
    }).sort((left, right) => right.total - left.total);
  }, [foes, pool, tools]);
  const autoDeck = useMemo(() => {
    const seen = new Set<string>();
    const out: { candidate: PvpRow; fit: number }[] = [];
    for (const entry of ranked) {
      if (seen.has(tools.speciesKey(entry.candidate))) continue;
      seen.add(tools.speciesKey(entry.candidate));
      out.push(entry);
      if (out.length === 3) break;
    }
    return out;
  }, [ranked, tools]);
  // 손으로 바꾼 칸을 얹는다 — fit 은 같은 셈으로 다시 낸다
  const deck = autoDeck.map((entry, index) => {
    const mine = override[index];
    if (!mine) return entry;
    const fits = foes.map((foe) => tools.foeFit(mine, foe));
    return { candidate: mine, fit: fits.reduce((product, value) => product * value, 1) ** (1 / fits.length) };
  });

  const putFoe = (index: number, foe: BossEntry) => {
    trackSearchPick(foe.name, 'pvp_deck');
    track('pvp_deck_foe', { mon: foe.name });
    setOverride({});
    setFoes((now) => {
      const next = [...now];
      if (index < next.length) next[index] = foe; else next.push(foe);
      return next.slice(0, 3);
    });
  };
  const removeFoe = (index: number) => { setOverride({}); setFoes((now) => now.filter((_, at) => at !== index)); };

  // 분석 — 추천 덱 누구도 상성 우위가 없는 상대(구멍) · 공격 · 방어 타입 추천 (v3 DeckAnalysis 의 문장 그대로)
  const holes = foes.filter((foe) => !deck.some(({ candidate }) => tools.foeFit(candidate, foe) > 1));
  const hits: Record<string, number> = {};
  for (const type of tools.typeKeys) for (const foe of foes) if (tools.against(type, foe.types) >= 1.6) hits[type] = (hits[type] ?? 0) + 1;
  const bestAtk = Object.entries(hits).sort((left, right) => right[1] - left[1]).slice(0, 3);
  const foeStab = [...new Set(foes.flatMap((foe) => foe.types))];
  const guards = tools.typeKeys
    .map((type) => [type, foeStab.filter((stab) => (dex.DEX_DATA.chart[stab]?.[type] ?? 1) < 1).length] as const)
    .filter(([, n]) => n >= 2).sort((left, right) => right[1] - left[1]).slice(0, 3);

  const countersOf = (foe: BossEntry) => {
    // 상성 계수 × 리그 점수가 높은 순 — 상성만 좋고 실전 성능이 낮은 픽이 위로 오지 않게
    const seen = new Set<string>();
    const out: { candidate: PvpRow; fit: number }[] = [];
    for (const entry of pool.map((candidate) => ({ candidate, fit: tools.foeFit(candidate, foe) }))
      .sort((left, right) => right.fit * right.candidate.score - left.fit * left.candidate.score)) {
      if (seen.has(tools.speciesKey(entry.candidate))) continue;
      seen.add(tools.speciesKey(entry.candidate));
      out.push(entry);
      if (out.length === 3) break;
    }
    return out;
  };

  const openMon = (mon: PvpRow) => onOpen({ sprite: mon.sprite, name: mon.name, en: mon.en, types: mon.types });

  /** 추천 덱 카드 한 장 — 전략 덱과 맞춤 덱이 같은 모양 */
  const deckCard = (mon: PvpRow, index: number, score: string, note: string, onSwap?: () => void) => (
    <SlotCard key={`${mon.sprite}-${index}`} compact index={index} role={SLOT_ROLE[index] ?? ''} roleTone="purple"
      sprite={mon.sprite} name={word(mon.name)} types={mon.types.map(ko).join(' · ')} moves={[mon.fast, mon.charged].filter(Boolean).join(' · ')}
      metric="SCORE" value={score} note={note} onOpen={() => openMon(mon)} onSwap={onSwap} />
  );

  // 교체 팝업 후보 — 상대 칸은 보스 색인 전체(이미 든 상대는 뺀다), 덱 칸은 상대 기준 점수순(같은 종은 뺀다)
  const swapCandidates = swap?.kind === 'foe'
    ? buildBossIndex(dex, max, pve, pvp).filter((entry) => !foes.some((foe, at) => at !== swap.index && foe.name === entry.name))
      .map((entry) => ({ sprite: entry.sprite, name: entry.name, types: entry.types }))
    : swap ? ranked.filter(({ candidate }) => !deck.some((one, at) => at !== swap.index && tools.speciesKey(one.candidate) === tools.speciesKey(candidate)))
      .map(({ candidate, fit }) => ({ sprite: candidate.sprite, name: candidate.name, en: candidate.en, types: candidate.types, note: `리그 점수 ${num(candidate.score, 1)} · 상성 ×${num(fit, 2)}` }))
      : [];

  return (
    <>
      <Slot name="headActions">
        <ToolBtn label="🃏 덱 짜기" on onClick={() => { track('tool_pvpdeck', { on: 0 }); go('/pvp'); }} />
        <ToolBtn label="🧬 개체값 순위" onClick={() => { track('tool_ivrank', { on: 1 }); go('/pvp/ivrank'); }} />
      </Slot>

      <div className="pxt pxt-pvp" id="page-pvp-deck" data-route="pvp-deck">
        {/* 리그 — 순위 화면과 같은 store 값. 리그가 바뀌면 손으로 바꾼 칸은 뜻을 잃는다 */}
        <div className="pxt-leagues"><PxTabs label="리그" items={LEAGUES.map((one) => ({ id: one.id, label: one.name }))} value={league}
          onPick={(id) => { set('league', id as LeagueKey); setOverride({}); }} /></div>

        {/* ① 전략 셋 — 칩으로 고르고 한 덱만 보여 준다 */}
        <section className="pxt-sec" aria-labelledby="pvp-rec-title">
          <SecHead id="pvp-rec-title" title="리그 추천 덱" note={`${LEAGUE_KO[league]}리그 메타 기준 · 실험 기능`} />
          <PxChips label="전략" items={recs.map((one, index) => ({ id: String(index), label: one.title }))} value={String(strategy)}
            onPick={(id) => { setStrategy(Number(id)); track('pvp_deck_strategy', { id: Number(id) }); }} />
          <p className="px-caption">{rec.tag}</p>
          <div className="px-grid px-grid--3 pxt-slots">
            {rec.deck.map((mon, index) => deckCard(mon, index, num(mon.score, 1), '리그 점수'))}
          </div>
          <p className="px-body px-muted pxt-reason">{`💬 ${rec.reason}`}</p>
        </section>

        {/* ② 상대 1~3마리 */}
        <section className="pxt-sec pxt-foes" aria-labelledby="pvp-foe-title">
          <SecHead id="pvp-foe-title" title="상대 포켓몬 1–3마리" note="상대를 추가할수록 추천이 구체적이에요." />
          <CandList label="상대 포켓몬 세 칸">
            {[0, 1, 2].map((index) => {
              const foe = foes[index];
              return (
                <CandRow key={index} sprite={foe?.sprite ?? null} name={foe ? word(foe.name) : `상대 ${index + 1}`} muted={!foe}
                  lines={[foe ? foe.types.map(ko).join(' · ') : '아직 비어 있어요']}
                  onOpen={foe ? () => onOpen({ sprite: foe.sprite, name: foe.name, types: foe.types }) : undefined}
                  ops={<>
                    <button type="button" className="px-btn px-btn--sm px-skin pxt-foe-pick" aria-label={`상대 ${index + 1} ${foe ? '변경' : '추가'}`} onClick={() => setSwap({ kind: 'foe', index })}>{foe ? '상대 변경 ↗' : '상대 추가'}</button>
                    {foe ? <button type="button" className="px-btn px-btn--sm px-btn--icon px-skin" aria-label={`${foe.name} 빼기`} onClick={() => removeFoe(index)}><PixelIcon name="close" /></button> : null}
                  </>} />
              );
            })}
          </CandList>
        </section>

        {!foes.length ? (
          <p className="px-body px-muted">상대 포켓몬을 1~3마리 넣어 보세요. 상대의 타입 상성을 고려한 덱을 추천해요.</p>
        ) : deck.length ? (
          <>
            {/* ③ 맞춤 추천 덱 */}
            <section className="pxt-sec" aria-labelledby="pvp-deck-title">
              <SecHead id="pvp-deck-title" title="맞춤 추천 덱" note={`상대 ${count(foes.length)}마리 기준`} />
              <div className="px-grid px-grid--3 pxt-slots">
                {deck.map(({ candidate, fit }, index) => deckCard(candidate, index, num(candidate.score, 1), `리그 점수 · 상성 계수 ×${num(fit, 2)}`, () => setSwap({ kind: 'deck', index })))}
              </div>
            </section>

            {/* ④ 상대별 대응력 — 내 팀 × 상대. 모바일은 줄 카드로(tools.css) */}
            <section className="pxt-sec" aria-labelledby="pvp-matrix-title">
              <SecHead id="pvp-matrix-title" title="상대별 대응력" note="자속 타입만 보는 근사치 · 유리 / 보통 / 주의" />
              <DataTable rowHead="내 팀" columns={foes.map((foe) => ({ key: foe.name, label: foe.name }))}
                rows={deck.map(({ candidate }) => ({
                  key: String(candidate.sprite), head: candidate.name,
                  cells: Object.fromEntries(foes.map((foe) => { const grade = fitGrade(tools.foeFit(candidate, foe)); return [foe.name, <Grade label={grade.label} tone={grade.tone} />]; })),
                }))} />
              <div className="pxt-matrix__notes">
                <p className="px-body">{holes.length
                  ? `⚠️ 주의할 공통 약점 — ${holes.map((foe) => foe.name).join('·')}를 확실히 이기는 픽이 없어요. 아래 카운터에서 ${holes.map((foe) => `${tools.topAtkType(foe)} 기술`).join('·')} 픽으로 한 자리 바꿔보세요.`
                  : `✅ 상대 ${count(foes.length)}마리 모두 상성 우위 픽이 있는 구성이에요.`}</p>
                {bestAtk.length ? <p className="px-caption">{`공격 기술 추천: ${bestAtk.map(([type, n]) => `${ko(type)}(${count(n)}마리 약점)`).join(' · ')} — 이 타입의 기술을 가진 포켓몬을 우선 추천해요.`}</p> : null}
                {guards.length ? <p className="px-caption">{`방어에 유리한 타입: ${guards.map(([type, n]) => `${ko(type)}(자속 ${count(n)}종 반감)`).join(' · ')}`}</p> : null}
              </div>
            </section>

            {/* ⑤ 상대별 카운터 TOP 3 — 펼치면 순위 줄 셋 */}
            <section className="pxt-sec" aria-labelledby="pvp-counter-title">
              <SecHead id="pvp-counter-title" title="상대별 추천 카운터" note="각 상대를 눌러 TOP 3를 확인하세요." />
              <div className="pxt-counters">
                {foes.map((foe) => {
                  const open = openFoe === foe.name;
                  return (
                    <article key={foe.name} className="px-skin px-drop px-card pxt-counter">
                      <CandList>
                        <CandRow sprite={foe.sprite} name={word(foe.name)} lines={[`${foe.types.map(ko).join(' · ')} · ${tools.topAtkType(foe)} 기술이 가장 아파요`]}
                          ops={<button type="button" className="px-btn px-btn--sm px-skin" aria-expanded={open} onClick={() => setOpenFoe(open ? null : foe.name)}>{open ? '접기' : 'TOP 3 ↗'}</button>} />
                      </CandList>
                      {open ? (
                        <RankList>
                          {countersOf(foe).map(({ candidate, fit }, index) => (
                            <RankRow key={candidate.sprite} sprite={candidate.sprite} name={candidate.name} en={candidate.en} types={candidate.types}
                              rank={index + 1} score={`×${num(fit, 2)}`} label="상성 계수" sub={`리그 점수 ${num(candidate.score, 1)}`}
                              lines={[tools.counterWhy(candidate, foe)]} onOpen={() => openMon(candidate)} />
                          ))}
                        </RankList>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>

      {swap ? (
        <SwapDialog
          title={swap.kind === 'foe' ? '상대 포켓몬' : '포켓몬 교체'}
          subtitle={swap.kind === 'foe' ? `상대 ${swap.index + 1} · 자주 만나는 포켓몬` : `슬롯 0${swap.index + 1} · ${SLOT_ROLE[swap.index] ?? ''} 후보 · 상대 ${count(foes.length)}마리 기준`}
          current={swap.kind === 'foe' ? foes[swap.index]?.sprite ?? null : deck[swap.index]?.candidate.sprite ?? null}
          candidates={swapCandidates}
          onPick={(candidate) => {
            if (swap.kind === 'foe') {
              const found = buildBossIndex(dex, max, pve, pvp).find((entry) => entry.sprite === candidate.sprite && entry.name === candidate.name);
              if (found) putFoe(swap.index, found);
            } else {
              const found = pool.find((row) => row.sprite === candidate.sprite && row.name === candidate.name);
              if (found) setOverride((now) => ({ ...now, [swap.index]: found }));
            }
            setSwap(null);
          }}
          onClose={() => setSwap(null)} />
      ) : null}
    </>
  );
}
