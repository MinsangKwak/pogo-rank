// ─────────────────────────────────────────────────────────────────────────────
// screens/PvpDeck.tsx — 🃏 PvP 덱 짜기 (v3 views/ifsolo.js renderPvpDeck)
//
// 두 덩이로 읽힌다.
//   ① 진짜 추천 덱 3종 — 상대 입력 없이 리그 메타만으로. 컨셉이 서로 다르고 이유를 적는다
//        정석 코어  점수 + 약점 상호 보완 그리디
//        안티 메타  리그 상위 10마리 상대 평균 상성순
//        타입 분산  방어 타입이 안 겹치게
//   ② 커스텀 덱 짜기 — 자주 만나는 상대를 슬롯에 넣으면 그 셋을 두루 받아치는 덱과 카운터
//
// 맞춤 덱은 **리그 점수 × 상대별 fit 의 기하평균**으로 고른다. 곱을 쓰는 이유 —
// 한 상대에게 극단적으로 강해도 다른 상대에게 0에 가깝게 약하면 곱이 작아져 걸러진다
// (산술평균이면 극단값이 평균을 끌어올려 버린다).
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useMemo, useRef, useState } from 'react';
import { useDex, useMax, usePve, usePvp } from '../lib/data';
import { useRankStore } from '../stores/rank';
import { Slot } from '../components/Slots';
import { ScreenTabs, Sprite, ToolBtn } from '../components/Bits';
import { Row } from '../components/Row';
import { LEAGUES } from '../lib/leagues';
import { LEAGUE_KO } from '../lib/ivrank';
import { buildBossIndex, monSearch, type BossEntry } from '../lib/search';
import { josa, makeDeckTools, type DeckMon } from '../lib/deck';
import { track } from '../lib/track';
import type { OpenMon } from '../lib/mon';
import type { LeagueKey, PvpRow } from '../types/data';

/** 슬롯 3칸을 다 채우면 나오는 분석 카드 — 추천 덱 vs 상대 덱의 차이를 한눈에 */
function DeckAnalysis({ tools, deck, foes, typeKo, chart }: {
  tools: ReturnType<typeof makeDeckTools>;
  deck: { candidate: PvpRow }[];
  foes: BossEntry[];
  typeKo: Record<string, string>;
  chart: Record<string, Record<string, number>>;
}) {
  const ko = (type: string) => typeKo[type] ?? type;
  // 공격 타입 추천: 상대 몇 마리에게 효과가 굉장한지 빈도순 (1.6배 이상을 '약점' 으로 본다)
  const hits: Record<string, number> = {};
  for (const type of tools.typeKeys) {
    for (const foe of foes) if (tools.against(type, foe.types) >= 1.6) hits[type] = (hits[type] ?? 0) + 1;
  }
  const bestAtk = Object.entries(hits).sort((left, right) => right[1] - left[1]).slice(0, 3);
  // 받이 타입 추천: 상대 자속 공격을 2종 이상 반감하는 타입
  const foeStab = [...new Set(foes.flatMap((foe) => foe.types))];
  const guards = tools.typeKeys
    .map((type) => [type, foeStab.filter((stab) => (chart[stab]?.[type] ?? 1) < 1).length] as const)
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1]).slice(0, 3);
  // 구멍: 추천 덱 누구도 상성 우위가 없는 상대
  const holes = foes.filter((foe) => !deck.some(({ candidate }) => tools.foeFit(candidate, foe) > 1));

  return (
    <div className="solo__card">
      <p className="solo__verdict">🧠 상대 덱 분석 &amp; 구성 가이드</p>
      <p className="solo__why">{`상대: ${foes.map((foe) => `${foe.name}(${foe.types.map(ko).join('·')})`).join(' / ')}`}</p>
      {bestAtk.length ? (
        <p className="solo__stats">{`공격 기술 추천: ${bestAtk.map(([type, count]) => `${ko(type)}(${count}마리 약점)`).join(' · ')} — 이 타입 기술을 가진 픽 위주로.`}</p>
      ) : null}
      {guards.length ? (
        <p className="solo__stats">{`몸으로 받기 좋은 타입: ${guards.map(([type, count]) => `${ko(type)}(자속 ${count}종 반감)`).join(' · ')}`}</p>
      ) : null}
      <p className="solo__stats">{`역할 분담: ${deck.map(({ candidate }) => {
        const good = foes.filter((foe) => tools.foeFit(candidate, foe) > 1).map((foe) => foe.name);
        return `${candidate.name} → ${good.length ? good.join('·') : '확실한 우위 없음'}`;
      }).join(' / ')}`}</p>
      {holes.length
        ? <p className="solo__why">{`⚠️ ${holes.map((foe) => foe.name).join('·')}를 확실히 이기는 픽이 없어요 — 아래 카운터 목록에서 ${holes.map((foe) => `${tools.topAtkType(foe)} 기술`).join('·')} 픽으로 한 자리 바꿔보세요.`}</p>
        : <p className="solo__why">✅ 상대 3마리 모두 상성 우위 픽이 있는 구성이에요.</p>}
    </div>
  );
}

export default function PvpDeck({ onOpen }: { onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const league = useRankStore((s) => s.league);
  const set = useRankStore((s) => s.set);
  const [foes, setFoes] = useState<BossEntry[]>([]);
  const [term, setTerm] = useState('');
  // 첫 번째만 기본으로 펼치고, 접었다 편 상태를 기억한다 (v3 state.recAccOpen)
  const [accOpen, setAccOpen] = useState<Record<number, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  const tools = useMemo(() => makeDeckTools(dex.DEX_DATA.chart, dex.TYPE_KO, dex.DEX_DATA.dex), [dex]);
  const pool = pvp.PVP_DATA[league] ?? [];

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

  // 맞춤 덱 — 리그 점수 × 상대별 fit 의 기하평균. 같은 종은 파티에 1마리라 종 단위로 거른다
  const deck = useMemo(() => {
    if (!foes.length) return [] as { candidate: PvpRow; fit: number }[];
    const ranked = pool.map((candidate) => {
      const fits = foes.map((foe) => tools.foeFit(candidate, foe));
      const fit = fits.reduce((product, value) => product * value, 1) ** (1 / fits.length);
      return { candidate, fit, total: candidate.score * fit };
    }).sort((left, right) => right.total - left.total);
    const seen = new Set<string>();
    const out: { candidate: PvpRow; fit: number }[] = [];
    for (const entry of ranked) {
      if (seen.has(tools.speciesKey(entry.candidate))) continue;
      seen.add(tools.speciesKey(entry.candidate));
      out.push(entry);
      if (out.length === 3) break;
    }
    return out;
  }, [foes, pool, tools]);

  const hits = useMemo(() => {
    const query = term.trim();
    if (!query) return [];
    // 이미 슬롯에 넣은 포켓몬은 후보에서 제외
    const pool2 = buildBossIndex(dex, max, pve, pvp).filter((entry) => !foes.some((foe) => foe.name === entry.name));
    return monSearch(pool2, query, 6);
  }, [term, foes, dex, max, pve, pvp]);

  // v3 row() 는 뷰가 넘기지 않아도 순위 변동 ▲▼ 를 스스로 붙인다 — 덱 줄도 예외가 아니다
  const deckRow = (mon: DeckMon & { score: number; en: string; fast: string; charged: string; d?: number }, index: number, score: string, sub: string, why?: string) => (
    <Row
      key={`${mon.sprite}-${index}`}
      sprite={mon.sprite} name={mon.name} en={mon.en} types={mon.types}
      rank={String(index + 1)}
      delta={mon.d}
      onOpen={() => onOpen(mon)}
      score={score} sub={sub}
      lines={why ? [why] : [mon.fast, mon.charged]}
      linesClass={why ? 'row__counter' : undefined}
    />
  );

  return (
    <>
      <Slot name="tabs">
        <ScreenTabs items={LEAGUES.map((one) => ({ id: one.id, label: one.name }))} value={league}
          onPick={(id) => set('league', id as LeagueKey)} />
      </Slot>
      <Slot name="headActions">
        <ToolBtn label="🃏 덱 짜기" on onClick={() => { track('tool_pvpdeck', { on: 0 }); location.hash = '#/pvp'; }} />
        <ToolBtn label="🧬 개체값 순위" onClick={() => { track('tool_ivrank', { on: 1 }); location.hash = '#/pvp/ivrank'; }} />
      </Slot>

      <div className="row-head"><h2>PvP 덱 짜기</h2><span className="meta">실험 기능</span></div>

      {recs.map((rec, index) => (
        <details key={rec.title} className="schedule deck__acc"
          open={accOpen[index] ?? index === 0}
          onToggle={(event) => {
            // **여는 순간 값을 꺼내 둔다.** setState 의 갱신 함수는 나중에 불리는데,
            // 그때 event.currentTarget 은 이미 null 이라 그 안에서 읽으면 화면이 통째로 선다
            const open = (event.currentTarget as HTMLDetailsElement).open;
            setAccOpen((now) => ({ ...now, [index]: open }));
          }}>
          <summary>{`🃏 추천 덱 ${index + 1} — ${rec.title}`}<span className="schedule__today">{rec.tag}</span></summary>
          <div className="schedule__body is-starless">
            <ul className="row-list">
              {rec.deck.map((mon, slot) => deckRow(mon, slot, mon.score.toFixed(1), '리그 점수'))}
            </ul>
            <p className="deck__reason">{`💬 ${rec.reason}`}</p>
          </div>
        </details>
      ))}

      <div className="row-head"><h2>PvP 커스텀 덱 짜기</h2><span className="meta">상대 기준 맞춤 추천</span></div>

      <div className="deck__slots">
        {[0, 1, 2].map((index) => {
          const foe = foes[index];
          return foe ? (
            <button key={index} className="deck__slot is-filled" title="누르면 제거"
              onClick={() => setFoes((now) => now.filter((_, at) => at !== index))}>
              <Sprite id={foe.sprite} />
              <span className="slot__name">{foe.name}</span>
              <span className="slot__close">✕</span>
            </button>
          ) : (
            <button key={index} className="deck__slot" aria-label="상대 추가"
              onClick={() => searchRef.current?.focus()}>
              <span className="slot__plus">+</span>
            </button>
          );
        })}
      </div>

      {/* 3칸 다 차면 검색창을 숨긴다 */}
      {foes.length < 3 ? (
        <>
          <input ref={searchRef} className="boss__search" type="search" placeholder="상대 포켓몬 검색해서 슬롯 채우기"
            value={term} onChange={(event) => setTerm(event.target.value)} />
          <div className="boss__sugg">
            {hits.map((hit) => (
              <button key={hit.name} className="boss__rec" onClick={() => {
                if (foes.length >= 3) return;
                track('pvp_deck_foe', { mon: hit.name });
                setFoes((now) => [...now, hit]);
                setTerm('');
              }}>
                <Sprite id={hit.sprite} />
                <span>{hit.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!foes.length ? (
        <p className="empty">자주 만나는 상대를 [+]에 1~3마리 채우면, 그 셋을 두루 잘 받아치는 맞춤 덱을 짜 줘요.</p>
      ) : deck.length ? (
        <>
          <div className="row-head"><h2>맞춤 추천 덱</h2><span className="meta">{`상대 ${foes.length}마리 기준`}</span></div>
          <div className="is-starless">
            <ul className="row-list">
              {deck.map(({ candidate, fit }, index) => deckRow(candidate, index, candidate.score.toFixed(1), `상성 계수 ×${fit.toFixed(2)}`))}
            </ul>
          </div>
        </>
      ) : null}

      {foes.length === 3 && deck.length
        ? <DeckAnalysis tools={tools} deck={deck} foes={foes} typeKo={dex.TYPE_KO} chart={dex.DEX_DATA.chart} />
        : null}

      {foes.map((foe) => {
        // 상성 계수 × 리그 점수가 높은 순 — 상성만 좋고 실전 성능이 낮은 픽이 위로 오지 않게
        const seen = new Set<string>();
        const counters: { candidate: PvpRow; fit: number }[] = [];
        for (const entry of pool.map((candidate) => ({ candidate, fit: tools.foeFit(candidate, foe) }))
          .sort((left, right) => right.fit * right.candidate.score - left.fit * left.candidate.score)) {
          if (seen.has(tools.speciesKey(entry.candidate))) continue;
          seen.add(tools.speciesKey(entry.candidate));
          counters.push(entry);
          if (counters.length === 3) break;
        }
        return (
          <Fragment key={foe.name}>
            <div className="row-head"><h2>{`${foe.name} 카운터`}</h2><span className="meta">상위 3</span></div>
            <div className="is-starless">
              <ul className="row-list">
                {counters.map(({ candidate, fit }, index) =>
                  deckRow(candidate, index, `×${fit.toFixed(2)}`, '상성 계수', tools.counterWhy(candidate, foe)))}
              </ul>
            </div>
          </Fragment>
        );
      })}
    </>
  );
}
