// ─────────────────────────────────────────────────────────────────────────────
// screens/SoloCalc.tsx — 🧮 솔플 레이드 계산기 (v3 views/ifsolo.js renderSoloCalc)
//
// 잡고 싶은 보스 한 마리를 고르면 **혼자 제한 시간 안에 잡을 수 있는지**와,
// 모자라면 딜이 얼마나 모자라는지를 낸다.
//
// 난이도는 고르는 값이 아니라 보스별 절대값이다 — 클래스·진화 단계로 자동 판정하고,
// 배지를 탭하면 한 단계씩 수동으로 돌린다. 셈은 lib/solo.ts 에 있다.
//
// [내 덱 검증] 은 넣은 순서 그대로 시뮬레이션한다 — 그 순서가 곧 출전 순서다.
//
// 주소가 보스를 싣는다(/pve/solo?boss=이름) — 팝업의 '상대할 때' 카드가 이 주소로 보내면 도착하자마자 그 보스가 골라져 있다 (2026-10-13).
// 이 화면 위에서 팝업을 열고 또 누르면 경로는 그대로이고 질의만 바뀐다 — 그래서 처음 한 번이 아니라 이동 때마다 읽는다 (lib/useSearch.ts, Codex PR #361).
// 같은 보스면 다시 고르지 않는다(덱 · 난이도가 날아간다). 주소에서 보스를 지운 뒤에는 되돌리지 않는다 — 검색창이 답한다
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useEffect, useMemo, useState } from 'react';
import { useDex, useMax, usePve, usePvp } from '../lib/data';
import { Slot } from '../components/Slots';
import { Seg, Sprite, ToolBtn } from '../components/Bits';
import { Row } from '../components/Row';
import { buildBossIndex, monSearch, type BossEntry } from '../lib/search';
import {
  BUFFS, SOLO_TIERS, buildSoloPlan, damageInTime, inferTier, marginText,
  maxCp, raidCp, scaledPool, simulateRevive, type SoloPlan, type SoloTier,
} from '../lib/solo';
import { useFavs } from '../lib/useFavs';
import type { OpenMon } from '../lib/mon';
import { track, trackSearchPick } from '../lib/track';
import { useSearch } from '../lib/useSearch';
import type { PveRow } from '../types/data';

/** 주소의 보스 이름(?boss=) — 없으면 null */
export function readHashBoss(search: string): string | null {
  const raw = search.startsWith('?') ? new URLSearchParams(search.slice(1)).get('boss') : null;
  return raw?.trim() || null;
}

/** 주소의 난이도(?tier=t5 · mega …) — SOLO_TIERS 에 있는 것만. 보스판 카드가 아는 난이도를 넘긴다 (Codex, PR #361) */
export function readHashTier(search: string): string | null {
  const raw = search.startsWith('?') ? new URLSearchParams(search.slice(1)).get('tier') : null;
  return raw && SOLO_TIERS.some((one) => one.id === raw) ? raw : null;
}

export default function SoloCalc({ onOpen }: { onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const { favs } = useFavs();

  const [boss, setBoss] = useState<BossEntry | null>(null);
  const [tierOverride, setTierOverride] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'mine'>('auto');
  const [lv50, setLv50] = useState(false);
  const [buff, setBuff] = useState('none');
  const [myDeck, setMyDeck] = useState<PveRow[]>([]);
  const [bossTerm, setBossTerm] = useState('');
  const [deckTerm, setDeckTerm] = useState('');
  const [fillNote, setFillNote] = useState('');

  const tierId = boss ? (tierOverride ?? inferTier(dex.DEX_DATA, boss)) : 't3';
  const tier = SOLO_TIERS.find((one) => one.id === tierId) ?? SOLO_TIERS[1] as SoloTier;

  const bossHits = useMemo(() => {
    const query = bossTerm.trim();
    if (!query) return [];
    return monSearch(buildBossIndex(dex, max, pve, pvp), query);
  }, [bossTerm, dex, max, pve, pvp]);

  // 평가 가능한 어태커 = 이 보스 상대 카운터 풀에 있는 포켓몬 (수치가 있어야 시뮬레이션이 된다)
  const pool = useMemo(
    () => (boss ? scaledPool(dex.DEX_DATA, pve.PVE_DATA, boss, { lv50, buff }) : []),
    [boss, dex, pve, lv50, buff],
  );
  const deckHits = useMemo(() => {
    const query = deckTerm.trim();
    if (!query) return [];
    return monSearch(pool.filter((one) => !myDeck.some((member) => member.name === one.name)), query, 6);
  }, [deckTerm, pool, myDeck]);

  const pickBoss = (next: BossEntry) => {
    setBoss(next);
    setTierOverride(null);   // 새 보스면 자동 판정으로 리셋
    setBossTerm('');
    setMyDeck([]);
    setFillNote('');
    track('solo_calc_boss', { boss: next.name });
  };

  // 주소에 실린 보스(?boss=) — 이름이 정확히 맞는 것만. 모르는 이름이면 빈 화면 그대로(검색창이 답한다)
  const search = useSearch();
  useEffect(() => {
    const wanted = readHashBoss(search);
    if (!wanted) return;
    // 주소가 난이도를 알면 자동 판정 대신 그것 — 5성 레이드는 15,000, 자동 판정은 전설을 4성(9,000)으로 본다.
    // 같은 보스라도 주소의 난이도를 그대로 따른다 — 옛 링크(?boss=디아루가)로 4성에 서 있다가 카드의 &tier=t5 로 오면 15,000,
    // 뒤로 가서 다시 ?boss=디아루가 가 되면 자동 판정으로 되돌린다. 같은 주소는 어디서 왔든 같은 셈이어야 한다 (Codex, PR #361)
    const tier = readHashTier(search);
    if (wanted !== boss?.name) {
      const found = buildBossIndex(dex, max, pve, pvp).find((one) => one.name === wanted);
      if (!found) return;
      pickBoss(found);
    }
    setTierOverride(tier);
    // 주소가 바뀔 때만 — 보스 · 묶음이 바뀌어도 주소의 것으로 되돌리지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const raid = boss ? raidCp(dex.DEX_DATA, boss, tier) : null;
  const full = boss ? maxCp(dex.DEX_DATA, boss) : null;

  return (
    <>
      <Slot name="headActions">
        <ToolBtn label="🧮 솔플 계산기" on onClick={() => { track('tool_solo', { on: 0 }); go('/pve'); }} />
      </Slot>
      <section className="solo-workbench">
      <div className="solo-workbench__setup">
        <div className="solo-workbench__heading"><span>01 · RAID TARGET</span><h2>어떤 보스에 도전하나요?</h2><p>보스를 선택하면 현재 조건에 맞는 추천 덱과 예상 클리어 시간을 계산해요.</p></div>
        <label className="solo-workbench__label" htmlFor="solo-boss-search">레이드 보스 검색</label>
        <input id="solo-boss-search" className="boss__search" type="search" placeholder="보스 이름 검색 (예: 메가거북왕, 자시안)"
          value={bossTerm} onChange={(event) => setBossTerm(event.target.value)} />
        <div className="boss__sugg">
          {bossTerm.trim() ? (bossHits.length
            ? bossHits.map((hit) => (
              <button key={hit.name} className="boss__rec" onClick={() => { trackSearchPick(hit.name, 'solo_boss'); pickBoss(hit); }}>
                <Sprite id={hit.sprite} /><span>{hit.name}</span>
              </button>
            ))
            : <p className="empty">검색 결과가 없어요.</p>) : null}
        </div>
        {boss ? (
          <div className="boss__selected">
            <Sprite id={boss.sprite} />
            <b>{boss.name}</b>
            <div className="boss__cp">
              <span className="meta">{boss.types.map((type) => dex.TYPE_KO[type] ?? type).join('·')}</span>
              <span className="meta">{[raid ? `레이드 CP ${raid.toLocaleString()}` : '', full ? `풀강 최대 CP ${full.toLocaleString()}` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            {/* 자동 판정된 난이도 배지 — 탭하면 한 단계씩 수동 변경 */}
            <button className="tag boss__tier" title="탭하면 난이도 수동 변경"
              onClick={() => {
                const at = SOLO_TIERS.findIndex((one) => one.id === tierId);
                setTierOverride(SOLO_TIERS[(at + 1) % SOLO_TIERS.length]?.id ?? null);
              }}>{`${tier.label}${tierOverride ? '' : ' 자동'}`}</button>
            <button className="boss__clear" aria-label="선택 해제"
              onClick={() => { setBoss(null); setTierOverride(null); setMyDeck([]); }}>✕</button>
          </div>
        ) : null}
        <div className="solo-workbench__conditions"><div className="solo-workbench__heading"><span>02 · BATTLE CONDITIONS</span><h2>배틀 조건 설정</h2></div>
        <div className="solo__opts">
          <div className="solo-workbench__option"><span>계산 방식</span><Seg items={[{ id: 'auto', label: '추천 덱' }, { id: 'mine', label: '내 덱 검증' }]} value={mode}
            onPick={(id) => setMode(id as 'auto' | 'mine')} /></div>
          <div className="solo-workbench__option"><span>포켓몬 레벨</span><Seg items={[{ id: 'off', label: '레벨40' }, { id: 'on', label: '풀강50' }]} value={lv50 ? 'on' : 'off'}
            onPick={(id) => setLv50(id === 'on')} /></div>
          <div className="solo-workbench__option"><span>공격 보너스</span><Seg items={BUFFS.map((one) => ({ id: one.id, label: one.label }))} value={buff} onPick={setBuff} /></div>
        </div>
        </div>
      </div>
      <div className="solo-workbench__results">
      <div className="solo-workbench__heading"><span>03 · SIMULATION</span><h2>솔플 분석 결과</h2><p>실험 기능 · 기절 전 이탈 후 부활해 재입장하는 조건으로 계산해요.</p></div>

      {!boss ? (
        <div className="solo-workbench__empty">
          <span className="solo-workbench__target" aria-hidden="true">◎</span>
          <h3>도전할 보스를 먼저 골라주세요</h3>
          <p>추천 포켓몬부터 제한 시간 내 공략 가능성까지<br />한곳에서 확인할 수 있어요.</p>
          <div className="solo-workbench__preview"><span>예상 클리어 시간</span><span>추천 출전 순서</span><span>부족한 피해량</span></div>
          <button className="uchip" onClick={() => document.getElementById('solo-boss-search')?.focus()}>보스 검색하기 ↑</button>
        </div>
      ) : mode === 'mine' ? (
        <>
          <div className="row-head"><h2>내 덱</h2><span className="meta">{`${myDeck.length}/6 · 넣는 순서대로 출전`}</span></div>
          {/* ★ 담아 둔 종에서 덱을 채운다 — 이 보스 상대 평가 가능한 풀(효율순) 중 즐겨찾기한 것만 */}
          <div className="solo__fill">
            <button className="uchip" onClick={() => {
              const room = 6 - myDeck.length;
              const owned = pool.filter((one) => favs.includes(Number(dex.DEX_DATA.dex[String(one.sprite)] ?? one.sprite))
                && !myDeck.some((member) => member.name === one.name));
              const picked = owned.slice(0, Math.max(room, 0));
              track('solo_fill_favs', { n: picked.length });
              if (!picked.length) {
                setFillNote(room > 0 ? '즐겨찾기 중 이 보스 상대 상위 목록에 든 포켓몬이 없어요.' : '덱이 이미 6마리예요.');
                return;
              }
              setFillNote('');
              setMyDeck((now) => [...now, ...picked]);
            }}>{`★ 즐겨찾기에서 채우기 (${favs.length})`}</button>
          </div>
          <input className="boss__search" type="search" placeholder="내 어태커 검색해서 추가 (예: 자시안, 메가Y 뮤츠)"
            value={deckTerm} onChange={(event) => { setDeckTerm(event.target.value); setFillNote(''); }} />
          <div className="boss__sugg">
            {fillNote ? <p className="empty">{fillNote}</p> : deckTerm.trim() ? (deckHits.length
              ? deckHits.map((hit) => (
                <button key={hit.name} className="boss__rec" onClick={() => {
                  if (myDeck.length >= 6) return;
                  trackSearchPick(hit.name, 'solo_deck');
                  setMyDeck((now) => [...now, hit]);
                  setDeckTerm('');
                }}>
                  <Sprite id={hit.sprite} /><span>{hit.name}</span>
                </button>
              ))
              : <p className="empty">이 보스 상대 상위 목록에 없어 평가할 수 없는 포켓몬이에요.</p>) : null}
          </div>
          {myDeck.length ? (
            <ul className="row-list">
              {myDeck.map((member, index) => (
                <Row
                  key={`${member.sprite}-${index}`}
                  sprite={member.sprite} name={member.name} en={member.en} types={member.types}
                  rank={String(index + 1)}
                  score={member.dps.toFixed(1)} sub={`DPS · TDO ${member.tdo}`}
                  lines={[member.fast, member.charged]}
                  onOpen={() => setMyDeck((now) => now.filter((_, at) => at !== index))}
                />
              ))}
            </ul>
          ) : null}
          {!myDeck.length
            ? <p className="empty">공격 포켓몬을 추가하면 덱의 예상 클리어 시간을 계산해요.</p>
            /* 판정 카드만 — 목록은 위의 내 덱이 대신한다 */
            : <Result boss={boss} tier={tier} mode={mode} plan={{ ...simulateRevive(myDeck, tier), squad: myDeck, possible: simulateRevive(myDeck, tier).time <= tier.time }} typeKo={dex.TYPE_KO} cardOnly onOpen={onOpen} />}
        </>
      ) : (
        <Result boss={boss} tier={tier} mode={mode} plan={buildSoloPlan(pool, tier)} typeKo={dex.TYPE_KO} onOpen={onOpen} />
      )}
      </div>
      </section>
    </>
  );
}

/** 판정 카드 + 필요 개체 목록 (v3 soloResultNodes) */
function Result({ boss, tier, mode, plan, typeKo, cardOnly = false, onOpen }: {
  boss: BossEntry; tier: SoloTier; mode: 'auto' | 'mine'; plan: SoloPlan | null;
  typeKo: Record<string, string>; cardOnly?: boolean;
  onOpen: OpenMon;
}) {
  if (!plan) return <p className="empty">데이터가 없어요.</p>;
  const typeLabel = boss.types.map((type) => typeKo[type] ?? type).join('·');
  const bossLabel = `${boss.name} (${typeLabel}) ${tier.label} 기준 (체력 ${tier.hp.toLocaleString()} — 티어 고정값)`;
  // 딜 총량 결론 줄: 제한 시간 내 최대 딜 vs 보스 체력
  const dealt = damageInTime(plan.squad, tier);
  const gap = dealt - tier.hp;
  const damageLine = gap >= 0
    ? `제한 시간 내 이 덱의 총 딜 약 ${dealt.toLocaleString()} / 보스 체력 ${tier.hp.toLocaleString()} → 딜 여유 ${gap.toLocaleString()} (+${Math.round((gap / tier.hp) * 100)}%)`
    : `제한 시간 내 이 덱의 최대 딜 약 ${dealt.toLocaleString()} / 보스 체력 ${tier.hp.toLocaleString()} → ${(-gap).toLocaleString()} (${Math.round((-gap / tier.hp) * 100)}%) 모자라서 못 잡음`;

  const card = plan.possible ? (
    <div className="solo__card solo__ok">
      <p className="solo__verdict">{`💪 계산상 솔플 가능 — 추천 ${plan.squad.length}마리, 약 ${plan.time}초`}</p>
      <p className="solo__why">{`${bossLabel} · 기절 직전 이탈 → 부활(5~6초) → 같은 덱 재진입 · 총 ${plan.cycles}사이클${plan.revives ? ` · 부활 ${plan.revives}회 (부활약·회복약 챙기세요)` : ' · 부활 없이 한 번에'}`}</p>
      <p className="solo__stats">{`${marginText(plan, tier)} (제한 ${tier.time}초 중 약 ${plan.time}초) · 아래 출전 순서를 기준으로 계산했어요.`}</p>
      <p className="solo__stats">{damageLine}</p>
    </div>
  ) : (
    <div className="solo__card solo__no">
      <p className="solo__verdict">🙅 계산상 솔플이 어려워요</p>
      <p className="solo__why">{`${bossLabel} — ${mode === 'mine' ? '이 덱으로는' : '추천 덱을 부활시켜 재투입해도'} 약 ${plan.time}초 (${marginText(plan, tier)}). 다른 트레이너와 함께 도전하거나 강화·버프 조건을 확인해 보세요.`}</p>
      <p className="solo__stats">아래는 현재 조건에서 예상 클리어 시간이 가장 짧은 구성이에요.</p>
      <p className="solo__stats">{damageLine}</p>
    </div>
  );
  if (cardOnly) return card;

  return (
    <>
      {card}
      <div className="row-head">
        <h2>{`필요 개체 ${plan.squad.length}마리 (이 순서로)`}</h2>
        <span className="meta">{`${boss.name} 상대 DPS순`}</span>
      </div>
      <ul className="row-list">
        {plan.squad.map((member, index) => (
          <Row
            key={`${member.sprite}-${index}`}
            sprite={member.sprite} name={member.name} en={member.en} types={member.types}
            rank={String(index + 1)}
            score={member.dps.toFixed(1)} sub={`DPS · TDO ${member.tdo}`}
            lines={[member.fast, member.charged]}
            onOpen={() => onOpen(member)}
          />
        ))}
      </ul>
    </>
  );
}
