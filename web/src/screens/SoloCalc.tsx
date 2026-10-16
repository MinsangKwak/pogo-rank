// ─────────────────────────────────────────────────────────────────────────────
// screens/SoloCalc.tsx — 🧮 솔플 레이드 계산기 (v3 views/ifsolo.js renderSoloCalc · v6 피그마 11)
//
// 잡고 싶은 보스 한 마리를 고르면 **혼자 제한 시간 안에 잡을 수 있는지**와,
// 모자라면 딜이 얼마나 모자라는지를 낸다.
//
// 난이도는 고르는 값이 아니라 보스별 절대값이다 — 클래스·진화 단계로 자동 판정하고,
// 등급 칩을 누르면 수동으로 바꾼다. 셈은 lib/solo.ts 에 있다.
//
// [내 덱 검증] 은 넣은 순서 그대로 시뮬레이션한다 — 그 순서가 곧 출전 순서다. 한 칸의 [변경] 은 공용 교체 팝업(SwapDialog)이다.
//
// 주소가 보스를 싣는다(/pve/solo?boss=이름) — 팝업의 '상대할 때' 카드가 이 주소로 보내면 도착하자마자 그 보스가 골라져 있다 (2026-10-13).
// 이 화면 위에서 팝업을 열고 또 누르면 경로는 그대로이고 질의만 바뀐다 — 그래서 처음 한 번이 아니라 이동 때마다 읽는다 (lib/useSearch.ts, Codex PR #361).
// 같은 보스면 다시 고르지 않는다(덱 · 난이도가 날아간다). 주소에서 보스를 지운 뒤에는 되돌리지 않는다 — 검색창이 답한다
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useEffect, useMemo, useState } from 'react';
import { useDex, useMax, usePve, usePvp } from '../lib/data';
import { Slot } from '../components/Slots';
import { PxChips, ToolBtn } from '../components/Bits';
import { RankRow, RankList } from '../components/Row';
import { CandList, CandRow, Field, MetricTile, Note, PickedCard, SearchBox, SecHead } from '../components/ToolBits';
import SwapDialog from '../components/SwapDialog';
import { PixelIcon } from '../components/PixelIcon';
import { buildBossIndex, monSearch, type BossEntry } from '../lib/search';
import {
  BUFFS, SOLO_TIERS, buildSoloPlan, damageInTime, inferTier, marginText,
  maxCp, raidCp, scaledPool, simulateRevive, type SoloPlan, type SoloTier,
} from '../lib/solo';
import { count, num, percent, word } from '../lib/cell';
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

const DECK_SIZE = 6;
const RESULT_ID = 'solo-result';

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
  const [fillNote, setFillNote] = useState('');
  // 교체 팝업이 열린 칸(0~5) — 비어 있는 칸이면 '추가', 든 칸이면 '변경'
  const [swap, setSwap] = useState<number | null>(null);

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
  const typeKo = (type: string) => dex.TYPE_KO[type] ?? type;

  // 셈 — 추천 덱은 풀에서, 내 덱은 넣은 순서 그대로. 즉시 계산이라 단추는 결과로 내려가기만 한다
  const plan: SoloPlan | null = !boss ? null
    : mode === 'mine'
      ? (myDeck.length ? { ...simulateRevive(myDeck, tier), squad: myDeck, possible: simulateRevive(myDeck, tier).time <= tier.time } : null)
      : buildSoloPlan(pool, tier);
  const squad = mode === 'mine' ? myDeck : (plan?.squad ?? []);
  // 덱 한 줄의 조건 — 레벨 · 버프는 풀 전체에 같은 값으로 적용된다(scaledPool)
  const buffLabel = BUFFS.find((one) => one.id === buff)?.label ?? '';
  const condition = `Lv.${lv50 ? '50' : '40'} · ${buffLabel}`;

  const fillFavs = () => {
    const room = DECK_SIZE - myDeck.length;
    // ★ 담아 둔 종에서 덱을 채운다 — 이 보스 상대 평가 가능한 풀(효율순) 중 즐겨찾기한 것만
    const owned = pool.filter((one) => favs.includes(Number(dex.DEX_DATA.dex[String(one.sprite)] ?? one.sprite))
      && !myDeck.some((member) => member.name === one.name));
    const picked = owned.slice(0, Math.max(room, 0));
    track('solo_fill_favs', { n: picked.length });
    if (!picked.length) {
      setFillNote(room > 0 ? '즐겨찾기 중 이 보스 상대 상위 목록에 든 포켓몬이 없어요.' : `덱이 이미 ${DECK_SIZE}마리예요.`);
      return;
    }
    setFillNote('');
    setMyDeck((now) => [...now, ...picked]);
  };

  const scrollToResult = () => {
    track('solo_calc_run', { mode });
    document.getElementById(RESULT_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  return (
    <>
      <Slot name="headActions">
        <ToolBtn label="🧮 솔플 계산기" on onClick={() => { track('tool_solo', { on: 0 }); go('/pve'); }} />
      </Slot>

      <div className="pxt pxt-solo" id="page-solo" data-route="pve-solo">
        <span className="px-badge px-skin px-badge--ko px-badge--orange pxt-solo__flag">실험적 계산 · 결과는 참고용</span>

        {/* 01 · 보스 · 등급 */}
        <section className="px-panel px-skin px-drop pxt-target" aria-label="레이드 보스">
          <SearchBox id="solo-boss-search" value={bossTerm} placeholder="보스 이름 검색 (예: 메가거북왕, 자시안)" label="레이드 보스 검색" onChange={setBossTerm} />
          {bossTerm.trim() ? (bossHits.length ? (
            <CandList label="검색 결과">
              {bossHits.map((hit) => (
                <CandRow key={hit.name} sprite={hit.sprite} name={word(hit.name)} lines={[hit.types.map(typeKo).join(' · ')]}
                  ops={<button type="button" className="px-btn px-btn--sm px-skin" onClick={() => { trackSearchPick(hit.name, 'solo_boss'); pickBoss(hit); }}>선택</button>} />
              ))}
            </CandList>
          ) : <p className="px-body px-muted">검색 결과가 없어요.</p>) : null}
          {boss ? (
            <PickedCard sprite={boss.sprite} name={word(boss.name)}
              lines={[boss.types.map(typeKo).join(' · '), [raid != null ? `레이드 CP ${count(raid)}` : '', full != null ? `풀강 최대 CP ${count(full)}` : ''].filter(Boolean).join(' · ') || '종족값 정보가 없어요']}
              onClear={() => { setBoss(null); setTierOverride(null); setMyDeck([]); }} />
          ) : null}
          <Field label={`레이드 등급${boss && !tierOverride ? ' · 자동 판정' : ''}`}>
            <PxChips label="레이드 등급" items={SOLO_TIERS.map((one) => ({ id: one.id, label: one.label }))} value={tierId} onPick={setTierOverride} />
          </Field>
        </section>

        {/* 02 · 조건 */}
        <section className="px-panel px-skin px-drop pxt-conds" aria-label="배틀 조건">
          <Field label="계산 방식"><PxChips label="계산 방식" items={[{ id: 'auto', label: '추천 덱' }, { id: 'mine', label: '내 덱 검증' }]} value={mode} onPick={(id) => setMode(id as 'auto' | 'mine')} /></Field>
          <Field label="포켓몬 레벨"><PxChips label="포켓몬 레벨" items={[{ id: 'off', label: '레벨 40' }, { id: 'on', label: '풀강 50' }]} value={lv50 ? 'on' : 'off'} onPick={(id) => setLv50(id === 'on')} /></Field>
          <Field label="공격 보너스"><PxChips label="공격 보너스" items={BUFFS.map((one) => ({ id: one.id, label: one.label }))} value={buff} onPick={setBuff} /></Field>
        </section>

        {!boss ? (
          <Note title="도전할 보스를 먼저 골라주세요"
            actions={<button type="button" className="px-btn px-skin" onClick={() => document.getElementById('solo-boss-search')?.focus()}>보스 검색하기 ↑</button>}>
            추천 포켓몬부터 제한 시간 내 공략 가능성까지 한곳에서 확인할 수 있어요.
          </Note>
        ) : (
          <>
            {/* 03 · 덱 · 출전 순서 — 내 덱 검증은 여섯 칸을 직접 채우고, 추천 덱은 셈이 고른 순서를 순위 줄로 보여 준다 */}
            <section className="px-panel px-skin px-drop pxt-deck" aria-labelledby="solo-deck-title">
              <SecHead id="solo-deck-title" title={mode === 'mine' ? '내 덱 · 출전 순서' : '추천 덱 · 출전 순서'}
                note={mode === 'mine' ? `${count(myDeck.length)} / ${DECK_SIZE}마리 · 기술과 레벨 확인` : `${count(squad.length)}마리 · ${boss.name} 상대 DPS순`} />
              {mode === 'mine' ? (
                <CandList ordered>
                  {Array.from({ length: DECK_SIZE }, (_, index) => {
                    const member = myDeck[index];
                    return (
                      <CandRow key={member ? `${member.sprite}-${index}` : `empty-${index}`} no={String(index + 1).padStart(2, '0')}
                        sprite={member?.sprite ?? null} name={member ? word(member.name) : '비어 있어요'} muted={!member}
                        lines={member ? [`${condition} · DPS ${num(member.dps, 1)} · TDO ${num(member.tdo)}`, [member.fast, member.charged].filter(Boolean).join(' · ')] : ['이 보스 상대 상위 목록에서 골라요']}
                        onOpen={member ? () => onOpen(member) : undefined}
                        ops={<>
                          <button type="button" className="px-btn px-btn--sm px-skin" onClick={() => setSwap(index)}>{member ? '변경' : '추가'}</button>
                          {member ? <button type="button" className="px-btn px-btn--sm px-btn--icon px-skin" aria-label={`${member.name} 빼기`} onClick={() => setMyDeck((now) => now.filter((_, at) => at !== index))}><PixelIcon name="close" /></button> : null}
                        </>} />
                    );
                  })}
                </CandList>
              ) : squad.length ? (
                <RankList>
                  {squad.map((member, index) => (
                    <RankRow key={`${member.sprite}-${index}`} sprite={member.sprite} name={member.name} en={member.en} types={member.types}
                      rank={index + 1} score={num(member.dps, 1)} label="DPS" sub={`TDO ${num(member.tdo)} · ${condition}`}
                      lines={[member.fast, member.charged]} onOpen={() => onOpen(member)} />
                  ))}
                </RankList>
              ) : <p className="px-body px-muted">평가할 수 있는 어태커가 없어요.</p>}
              {fillNote ? <p className="px-caption" role="status">{fillNote}</p> : null}
              <div className="pxt-actions">
                {mode === 'mine' ? <button type="button" className="px-btn px-skin" onClick={fillFavs}>{`★ 즐겨찾기로 채우기 (${count(favs.length)})`}</button> : null}
                <button type="button" className="px-btn px-btn--primary px-skin" disabled={!plan} onClick={scrollToResult}>솔플 가능성 계산 →</button>
              </div>
            </section>

            {/* 04 · 결과 */}
            <Result id={RESULT_ID} boss={boss} tier={tier} mode={mode} plan={plan} typeKo={typeKo} />
          </>
        )}
      </div>

      {swap != null && boss ? (
        <SwapDialog subtitle={`슬롯 ${String(swap + 1).padStart(2, '0')} · ${boss.name} 상대 어태커`} current={myDeck[swap]?.sprite ?? null}
          candidates={pool.filter((one) => !myDeck.some((member, at) => at !== swap && member.name === one.name))
            .map((one) => ({ sprite: one.sprite, name: one.name, en: one.en, types: one.types, note: `DPS ${num(one.dps, 1)} · TDO ${num(one.tdo)}` }))}
          onPick={(candidate) => {
            const row = pool.find((one) => one.sprite === candidate.sprite && one.name === candidate.name) ?? pool.find((one) => one.sprite === candidate.sprite);
            if (!row) return;
            trackSearchPick(row.name, 'solo_deck');
            setFillNote('');
            setMyDeck((now) => {
              const next = [...now];
              if (swap < next.length) next[swap] = row; else next.push(row);
              return next.slice(0, DECK_SIZE);
            });
            setSwap(null);
          }}
          onClose={() => setSwap(null)} />
      ) : null}
    </>
  );
}

/** 판정 판 — 제목 · 한 줄 · 지표 넷 · 다음 조건 (v3 soloResultNodes 의 문장을 그대로 싣는다) */
function Result({ id, boss, tier, mode, plan, typeKo }: {
  id: string; boss: BossEntry; tier: SoloTier; mode: 'auto' | 'mine'; plan: SoloPlan | null; typeKo: (type: string) => string;
}) {
  if (!plan) {
    return (
      <div id={id}>
        <Note title={mode === 'mine' ? '덱이 비어 있어요' : '데이터가 없어요'} live>
          {mode === 'mine' ? '공격 포켓몬을 추가하면 덱의 예상 클리어 시간을 계산해요.' : '이 보스 상대 평가할 수 있는 어태커 자료가 아직 없어요.'}
        </Note>
      </div>
    );
  }
  const typeLabel = boss.types.map(typeKo).join('·');
  const bossLabel = `${boss.name} (${typeLabel}) ${tier.label} 기준 (체력 ${count(tier.hp)} — 티어 고정값)`;
  // 딜 총량 결론 줄: 제한 시간 내 최대 딜 vs 보스 체력
  const dealt = damageInTime(plan.squad, tier);
  const gap = dealt - tier.hp;
  const damageLine = gap >= 0
    ? `제한 시간 내 이 덱의 총 딜 약 ${count(dealt)} / 보스 체력 ${count(tier.hp)} → 딜 여유 ${count(gap)} (+${percent(gap, tier.hp)})`
    : `제한 시간 내 이 덱의 최대 딜 약 ${count(dealt)} / 보스 체력 ${count(tier.hp)} → ${count(-gap)} (${percent(-gap, tier.hp)}) 모자라서 못 잡음`;
  const over = plan.time > tier.time;
  const lead = plan.possible
    ? `계산상 솔플 가능 — ${mode === 'mine' ? '이 덱' : `추천 ${count(plan.squad.length)}마리`}로 약 ${count(plan.time)}초. ${marginText(plan, tier)} (제한 ${count(tier.time)}초).`
    : `${bossLabel} — ${mode === 'mine' ? '이 덱으로는' : '추천 덱을 부활시켜 재투입해도'} 약 ${count(plan.time)}초 (${marginText(plan, tier)}). 다른 트레이너와 함께 도전하거나 강화·버프 조건을 확인해 보세요.`;

  return (
    <>
      <section className={`px-panel px-skin px-drop pxt-result${plan.possible ? ' is-ok' : ' is-no'}`} id={id} aria-live="polite">
        <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">SIMULATION RESULT</p>
        <h2 className="px-heading">{plan.possible ? '솔플 가능' : '시간 초과 예상'}</h2>
        <p className="px-body">{lead}</p>
        <div className="px-grid pxt-result__tiles">
          <MetricTile label="예상 소요 시간" value={`${count(plan.time)} s`} note={`제한 ${count(tier.time)}초`} tone={over ? 'orange' : undefined} />
          <MetricTile label="예상 피해량" value={percent(dealt, tier.hp)} note={`보스 체력 ${count(tier.hp)} 대비`} tone={gap < 0 ? 'orange' : undefined} />
          <MetricTile label="전투 사이클" value={count(plan.cycles)} note="덱 전원이 한 바퀴 싸우는 횟수" />
          <MetricTile label="기절 / 회복" value={`${count(plan.revives)}회`} note={plan.revives ? '부활약 · 회복약 챙기세요' : '부활 없이 한 번에'} />
        </div>
      </section>
      <Note title={plan.possible ? '계산 근거' : '다음으로 시도해 볼 조건'}>
        <p className="px-note__body">{`${bossLabel} · 기절 직전 이탈 → 부활(5~6초) → 같은 덱 재진입 · 총 ${count(plan.cycles)}사이클${plan.revives ? ` · 부활 ${count(plan.revives)}회` : ' · 부활 없이 한 번에'} · 위 출전 순서를 기준으로 계산했어요.`}</p>
        <p className="px-note__body">{damageLine}</p>
        {!plan.possible ? <p className="px-note__body">위 덱은 현재 조건에서 예상 클리어 시간이 가장 짧은 구성이에요. 풀강 50 · 메가부스트 같은 조건을 바꿔 다시 확인해 보세요.</p> : null}
        <p className="px-caption">실험 기능 · 기절 전 이탈 후 부활해 재입장하는 조건으로 계산해요.</p>
      </Note>
    </>
  );
}
