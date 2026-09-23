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
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useMemo, useState } from 'react';
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
import type { PveRow } from '../types/data';

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

  const raid = boss ? raidCp(dex.DEX_DATA, boss, tier) : null;
  const full = boss ? maxCp(dex.DEX_DATA, boss) : null;

  return (
    <>
      <Slot name="headActions">
        <ToolBtn label="🧮 솔플 계산기" on onClick={() => { track('tool_solo', { on: 0 }); go('/pve'); }} />
      </Slot>
      <Slot name="controls">
        <div className="solo__opts">
          <Seg items={[{ id: 'auto', label: '추천 덱' }, { id: 'mine', label: '내 덱 검증' }]} value={mode}
            onPick={(id) => setMode(id as 'auto' | 'mine')} />
          <Seg items={[{ id: 'off', label: '레벨40' }, { id: 'on', label: '풀강50' }]} value={lv50 ? 'on' : 'off'}
            onPick={(id) => setLv50(id === 'on')} />
          <Seg items={BUFFS.map((one) => ({ id: one.id, label: one.label }))} value={buff} onPick={setBuff} />
        </div>
        <input className="boss__search" type="search" placeholder="보스 이름 검색 (예: 메가거북왕, 자시안)"
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
      </Slot>

      <div className="row-head"><h2>솔플 레이드 계산기</h2><span className="meta">실험 기능 · 부활 후 재도전 기준</span></div>

      {!boss ? (
        <p className="empty">잡고 싶은 보스를 검색해서 골라주세요. 예: 메가거북왕을 고르면 풀·전기 정예 덱이 나와요.</p>
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
