// ─────────────────────────────────────────────────────────────────────────────
// screens/DmaxDeck.tsx — 🧩 D-MAX 덱 짜기 (v3 views/maxdeck.js renderMaxDeck · v6 피그마 09)
//
// 맥스 배틀에 데려갈 셋을 보스별로 고른다. D-MAX 화면 맨 위의 추천 파티 카드는
// **이번 주 보스 하나**에만 붙어 있고 세 칸이 고정이라, 친구들이 실제로 묻는 셋에 답하지 못했다 —
// "다음 주 ○○ 나오는데 뭐 키워둬야 해" · "1위가 없는데 그럼 누구 넣어" · "내 덱 이거 괜찮아".
//
// 주소가 덱을 싣는다(/dmax/deck?b=…&p=…) — 그대로 보내면 상대도 같은 덱을 연다.
// v5 Phase 6 에 해시를 떼면서 **진짜 쿼리스트링**이 됐다 — 서버도 크롤러도 읽는 자리다.
// 주소에 실려 온 덱은 **이 화면에 처음 들어올 때 한 번만** 읽는다: 남이 보낸 링크를 자동 추천이
// 덮어쓰면 안 되지만, 그 뒤 보스 칩을 바꿀 때마다 옛 덱을 되읽으면 새 보스의 표에 없는 칸이
// 조용히 비어 버린다 (2026-09-15 첫 구현에서 잡은 버그).
//
// v6 — 슬롯 아래 펼치던 후보 칩은 공용 교체 팝업(components/SwapDialog.tsx)으로 옮겼다. 셈 · 주소 · 저장은 그대로다.
// ─────────────────────────────────────────────────────────────────────────────
import { go } from '../lib/nav';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDex, useMax, usePve, usePvp, useSchedule } from '../lib/data';
import { Slot } from '../components/Slots';
import { PxChips, PxSwitch, ToolBtn, type ChipDef } from '../components/Bits';
import { CandList, CandRow, Note, SearchBox, SecHead, SlotCard } from '../components/ToolBits';
import SwapDialog from '../components/SwapDialog';
import { weekBoss } from '../lib/schedule';
import { buildBossIndex, monSearch } from '../lib/search';
import { MAX_DECK_SIZE, MAX_DECK_SLOTS, maxDeckAutoFill, maxDeckCandidates, maxDeckRowOf, maxDeckWhy, type MaxDeck } from '../lib/maxdeck';
import { count, num, word } from '../lib/cell';
import { track } from '../lib/track';
import { useSearch } from '../lib/useSearch';
import { useRankStore } from '../stores/rank';
import type { OpenMon } from '../lib/mon';
import type { DmaxRow } from '../types/data';

/**
 * 주소에 실린 덱(?p=) — 숫자로 못 읽는 조각은 버린다.
 * **서버에는 주소가 없다** — 빌드가 이 화면을 그릴 때는 빈 덱으로 시작하고,
 * 브라우저에서 첫 효과가 돌 때 주소를 읽는다 (v5 Phase 6)
 */
function readHashIds(): (number | null)[] | null {
  if (typeof location === 'undefined') return null;
  const query = location.search.slice(1);
  const raw = query ? new URLSearchParams(query).get('p') : null;
  if (!raw) return null;
  // 빈 조각은 빈 칸 — 앞 칸이 걸러져 비어도 뒤 칸이 앞으로 밀리지 않게 자리를 지킨다 (Codex, PR #343)
  const ids = raw.split(',').map((piece) => { const value = Number(piece.trim()); return piece.trim() && Number.isFinite(value) ? value : null; });
  return ids.length ? ids : null;
}

function readHashBoss(typeKo: Record<string, string>, search: string = typeof location === 'undefined' ? '' : location.search): string | null {
  const raw = search.startsWith('?') ? new URLSearchParams(search.slice(1)).get('b') : null;
  return raw && (raw === 'overall' || typeKo[raw]) ? raw : null;
}

export default function DmaxDeck({ onOpen }: { onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: pve } = usePve();
  const { data: pvp } = usePvp();
  const { data: schedule } = useSchedule();

  const week = useMemo(() => weekBoss(schedule.SCHEDULE_MONTHS), [schedule]);
  // 주소(?b=)가 가장 세고, 없으면 이번 주 보스, 끝으로 '전체' (v3 maxDeckBossType)
  const [chosen, setChosen] = useState<string | null>(() => readHashBoss(dex.TYPE_KO));
  // 이 화면 위에서 팝업의 'D-MAX 덱 짜기에서 자세히' 를 누르면 경로는 그대로이고 질의만 바뀐다 — 이동 때마다 다시 읽는다
  // (lib/useSearch.ts, Codex PR #361). 이 화면이 제자리에서 바꾼 주소(replaceState)는 이동이 아니라 다시 읽지 않는다
  const search = useSearch();
  useEffect(() => {
    const next = readHashBoss(dex.TYPE_KO, search);
    if (next) setChosen((now) => (now === next ? now : next));
  }, [search, dex]);
  const [dynaOnly, setDynaOnly] = useState(false);
  // D-MAX 화면의 [맥스 참가 가능 다른 유닛] 체크와 같은 값 — 덱 후보도 같은 규칙으로 (2026-10-06)
  const showJoin = useRankStore((s) => s.maxShowJoin);
  // 교체 팝업이 열린 칸 — null 이면 닫힘
  const [swap, setSwap] = useState<number | null>(null);
  // 아래 '교체 후보' 목록이 보여 주는 칸 — 팝업을 열지 않고도 윗줄 후보를 바로 넣는다
  const [focus, setFocus] = useState(0);
  const [picked, setPicked] = useState<{ key: string; deck: MaxDeck } | null>(null);
  const [hashIds] = useState(readHashIds);
  const [term, setTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const typeToggle = useRef<HTMLButtonElement>(null);

  const bossType = chosen ?? week?.type ?? 'overall';
  const key = `${bossType}|${dynaOnly}|${showJoin}`;
  const firstKey = useRef<string | null>(null);
  if (firstKey.current === null) firstKey.current = key;

  const auto = useMemo(() => maxDeckAutoFill(max, bossType, dynaOnly, showJoin), [max, bossType, dynaOnly, showJoin]);
  // 칸 수가 안 맞거나 그 표에 없는 id 면 그 칸만 비운다. 미구현 · 출시 예정 줄도 받지 않는다(usable) — 지금 데려갈 수 있는 것만 (Codex, PR #343)
  const fromHash = useMemo(() => {
    if (!hashIds || key !== firstKey.current) return null;
    const deck: MaxDeck = [null, null, null];
    hashIds.slice(0, MAX_DECK_SIZE).forEach((id, index) => {
      if (maxDeckRowOf(max, index, bossType, id, true)) deck[index] = id;
    });
    // 전부 걸러진 링크는 빈 덱이 아니라 자동 추천 덱으로 — 빈 덱은 보여 줄 까닭이 없고, 주소(p 없음)와도 맞는다 (Codex, PR #343)
    return deck.some((id) => id != null) ? deck : null;
  }, [hashIds, key, max, bossType]);
  const deck = picked?.key === key ? picked.deck : (fromHash ?? auto);

  const typeLabel = bossType === 'overall' ? '전체' : (dex.TYPE_KO[bossType] ?? bossType);

  // 주소를 지금 덱에 맞춘다 — 화면을 다시 그리지 않으려고 replaceState 만 쓴다 (도감 검색과 같은 방식)
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('b', bossType);
    // 빈 칸은 빈 조각으로 자리를 남긴다(뒤쪽 빈 칸만 잘라 낸다) — 걸러진 앞 칸 때문에 뒤 포켓몬이 다른 칸으로 옮겨 가지 않게 (Codex, PR #343)
    const ids = deck.map((sprite) => (sprite == null ? '' : String(sprite)));
    while (ids.length && ids[ids.length - 1] === '') ids.pop();
    if (ids.length) next.set('p', ids.join(','));
    try { history.replaceState(history.state, '', `/dmax/deck?${next.toString()}`); } catch { /* 주소 못 바꾸는 환경 */ }
  }, [bossType, deck]);

  // 보스 고르기 — 타입 칩 하나가 답이다. 검색창은 그 칩을 좁히고, 보스 이름을 치면 그 보스의 첫 타입으로 안내한다
  const pickType = (id: string) => {
    setChosen(id); setPicked(null); setSwap(null); setTerm(''); setTypesOpen(false);
    if (typesOpen) typeToggle.current?.focus();
  };
  const query = term.trim();
  const typeKeys = Object.keys(dex.TYPE_KO);
  const shownTypes = query ? typeKeys.filter((type) => (dex.TYPE_KO[type] ?? type).includes(query)) : typeKeys;
  const bossHits = useMemo(() => (query ? monSearch(buildBossIndex(dex, max, pve, pvp), query, 5) : []), [query, dex, max, pve, pvp]);
  // 보스 이름 → 첫 타입 칩. '전체' 는 검색어가 없거나 그 글자를 담을 때만
  const bossChips: ChipDef[] = bossHits.flatMap((hit) => (hit.types[0] ? [{ id: hit.types[0], label: `${hit.name} · ${dex.TYPE_KO[hit.types[0]] ?? hit.types[0]}`, type: hit.types[0] }] : []));
  const typeChips: ChipDef[] = [
    ...(!query || '전체'.includes(query) ? [{ id: 'overall', label: '전체' }] : []),
    ...shownTypes.map((type) => ({ id: type, label: dex.TYPE_KO[type] ?? type, type })),
  ];

  const rows = MAX_DECK_SLOTS.map((_, index) => maxDeckRowOf(max, index, bossType, deck[index] ?? null));
  const dealerRows = rows.slice(0, 2).filter((row): row is DmaxRow => !!row);
  const tankRow = rows[2] ?? null;
  const dmgSum = dealerRows.reduce((sum, row) => sum + (row.dmg ?? 0), 0);
  const summary = !dealerRows.length && !tankRow
    ? '세 칸이 모두 비었어요.'
    : `딜러 ${count(dealerRows.length)}마리 맥스 피해 합 ${count(dmgSum)}${tankRow ? ` · 탱커 EHP ${num(tankRow.ehp)}` : ''}`;

  // 한 칸을 갈아 끼운다 — picked 는 지금 조건(key)에만 묶인다. 보스를 바꾸면 자동 추천으로 돌아간다
  const put = (index: number, sprite: number) => {
    setPicked({ key, deck: deck.map((value, at) => (at === index ? sprite : value)) });
  };
  const candidatesOf = (index: number) => maxDeckCandidates(max, index, bossType, deck, dynaOnly, showJoin);
  const roleOf = (index: number) => (MAX_DECK_SLOTS[index]?.role === 'tank' ? '탱커' : '딜러');
  const slotLabel = (index: number) => `슬롯 0${index + 1} · ${roleOf(index)} 후보`;
  // 딜러 칸은 '맥스어택 · 바위 맥스' 처럼 적는다 — charged 는 기술 이름이 아니라 맥스 기술의 타입 키다 (D-MAX 표의 약속)
  const moveSet = (index: number, row: DmaxRow) => {
    if (MAX_DECK_SLOTS[index]?.role === 'tank') return '';
    const charged = row.charged ? `${dex.TYPE_KO[row.charged] ?? row.charged} 맥스` : '';
    return [row.fast, charged].filter(Boolean).join(' · ');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      track('maxdeck_copy', { boss: bossType });
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* 클립보드가 없는 환경 — 주소창에서 복사하면 된다 */ }
  };

  const focusRow = rows[focus] ?? null;
  const quick = candidatesOf(focus).slice(0, 6);

  return (
    <>
      <Slot name="headActions">
        {/* D-MAX 화면과 덱 짜기가 같은 버튼을 쓴다 — 버튼이 움직이면 같은 버튼으로 안 읽힌다 */}
        <ToolBtn label="🧩 덱 짜기" on onClick={() => { track('tool_dmaxdeck', { on: 0 }); go('/dmax'); }} />
      </Slot>

      <div className="pxt pxt-dmax" id="page-dmax-deck" data-route="dmax-deck">
        {/* 01 · 보스 고르기 — 검색 · 이번 주 칩 · 다이맥스만 · 타입 칩 */}
        <section className="px-panel px-skin px-drop pxt-target" aria-label="상대 보스">
          <div className="pxt-target__row">
            <SearchBox className="pxt-target__search" value={term} placeholder="상대 보스 검색" onChange={(next) => { setTerm(next); setTypesOpen(Boolean(next.trim())); }} />
            {week ? (
              <button type="button" className="px-chip px-skin" aria-pressed={bossType === week.type} title={`${week.now ? '이번 주' : '다음'} 보스의 타입으로 고르기`}
                onClick={() => pickType(week.type)}>{`${week.now ? '이번 주' : '다음 보스'} · ${week.label}`}</button>
            ) : null}
            {/* 거다이맥스는 위력 450, 다이맥스는 350 이라 섞어 두면 상위가 거의 거다이맥스로 찬다.
                틀린 것은 아니지만 가진 사람과 안 가진 사람의 답이 달라야 한다 */}
            <PxSwitch text="다이맥스만" checked={dynaOnly} title="거다이맥스를 제외하고 다이맥스 포켓몬만 추천해요"
              onChange={(next) => { setDynaOnly(next); setPicked(null); setSwap(null); }} />
          </div>
          {bossHits.length ? <PxChips label="보스 이름으로 타입 고르기" items={bossChips} onPick={pickType} /> : null}
          <div className="pxt-type-picker">
            <button ref={typeToggle} type="button" className="pxt-type-picker__toggle px-caption" aria-label={`보스 타입 ${typeLabel} ${typesOpen ? '접기' : '변경'}`} aria-expanded={typesOpen} aria-controls="dmax-boss-types"
              onClick={() => setTypesOpen((open) => !open)}>
              <span>보스 타입</span><b>{typeLabel}</b><span>{typesOpen ? '접기 −' : '변경 +'}</span>
            </button>
            <div id="dmax-boss-types" hidden={!typesOpen}>
              <PxChips label="보스 타입" items={typeChips} value={bossType} onPick={pickType} />
            </div>
          </div>
        </section>

        {/* 02 · 내 배틀 팀 — 슬롯 셋 */}
        <section className="pxt-sec" aria-labelledby="dmax-team-title">
          <SecHead id="dmax-team-title" title="내 배틀 팀" note={`딜러 2 · 탱커 1 · ${typeLabel} 보스 상대`} />
          <div className="px-grid px-grid--3 pxt-slots">
            {MAX_DECK_SLOTS.map((slot, index) => {
              const row = rows[index];
              const tank = slot.role === 'tank';
              return (
                <SlotCard key={index} compact index={index} role={slot.label} roleTone={tank ? 'blue' : 'orange'}
                  sprite={row?.sprite ?? null} name={row ? word(row.name) : '비어 있어요'}
                  types={row ? row.types.map((type) => dex.TYPE_KO[type] ?? type).join(' · ') : ''}
                  moves={row ? (moveSet(index, row) || (tank ? '방어 · 교체 지원' : '')) : ''}
                  emptyText={`${typeLabel} 보스 상대 ${tank ? 'EHP' : '맥스 피해'} 후보에서 골라 주세요.`}
                  metric={tank ? 'EHP' : 'MAX SCORE'} value={tank ? num(row?.ehp) : num(row?.dmg)} note={row ? maxDeckWhy(index, row, bossType) : '—'}
                  onOpen={row ? () => onOpen(row) : undefined} onSwap={() => setSwap(index)} />
              );
            })}
          </div>
          <div className="pxt-actions">
            <button type="button" className="px-btn px-skin" onClick={() => { setPicked({ key, deck: auto }); setSwap(null); }}>추천 팀으로 초기화</button>
            <button type="button" className="px-btn px-btn--primary px-skin" onClick={() => void copyLink()}>{copied ? '복사됨 ✓' : '팀 링크 복사'}</button>
          </div>
        </section>

        {/* 지어낸 등급이 아니라 표에 있는 숫자를 그대로 더한 값이다 */}
        <Note title="팀 구성 요약" live>
          <ul className="pxt-summary__roles">
            <li><span className="px-badge px-skin px-badge--ko px-badge--orange">딜러</span><span className="px-body">공격 턴에 집중</span></li>
            <li><span className="px-badge px-skin px-badge--ko px-badge--blue">탱커</span><span className="px-body">교체와 생존 지원</span></li>
          </ul>
          <p className="px-note__body">{summary}</p>
          <p className="px-caption">현재 팀은 주소에 자동으로 저장돼요. 링크를 보내면 같은 팀을 볼 수 있어요.</p>
        </Note>

        {/* 교체 후보 윗줄 — 칸을 골라 바로 넣는다. 더 많은 후보 · 검색 · 즐겨찾기는 팝업에서 */}
        <section className="pxt-sec" aria-labelledby="dmax-cand-title">
          <SecHead id="dmax-cand-title" title="교체 후보" note={`${roleOf(focus)} ${focus === 1 ? '2' : '1'} · ${MAX_DECK_SLOTS[focus]?.role === 'tank' ? 'EHP' : '맥스 피해'} 기준`} />
          <PxChips label="후보를 넣을 칸" items={MAX_DECK_SLOTS.map((slot, index) => ({ id: String(index), label: `SLOT 0${index + 1} · ${slot.label}` }))}
            value={String(focus)} onPick={(id) => setFocus(Number(id))} />
          {quick.length ? (
            <CandList>
              {quick.map((candidate) => {
                const now = Number(candidate.sprite) === Number(deck[focus]);
                return (
                  <CandRow key={candidate.sprite} sprite={candidate.sprite} name={word(candidate.name)} lines={[maxDeckWhy(focus, candidate, bossType)]}
                    onOpen={() => onOpen(candidate)}
                    ops={<button type="button" className="px-btn px-btn--sm px-skin" disabled={now} onClick={() => put(focus, candidate.sprite)}>{now ? '현재' : '선택'}</button>} />
                );
              })}
            </CandList>
          ) : <p className="px-body px-muted">이 조건에 맞는 후보가 없어요. '다이맥스만' 을 끄거나 다른 타입을 골라 보세요.</p>}
          {focusRow ? null : <p className="px-caption">{`SLOT 0${focus + 1} 이 비어 있어요 — 위에서 고르면 바로 채워져요.`}</p>}
        </section>

        <p className="px-caption pxt-foot">딜러는 맥스 피해 × √내구 순위, 탱커는 체력 × 방어 ÷ 받는 배율(EHP) 순위에서 골라요. 맥스가드·맥스스피릿 같은 방어·회복 역할은 아직 데이터가 없어 다루지 않아요. 주소를 그대로 보내면 상대도 같은 덱을 봅니다.</p>
      </div>

      {swap != null ? (
        <SwapDialog subtitle={slotLabel(swap)} current={deck[swap] ?? null}
          candidates={candidatesOf(swap).map((row) => ({ sprite: row.sprite, name: row.name, en: row.en, types: row.types, note: maxDeckWhy(swap, row, bossType) }))}
          onPick={(candidate) => { put(swap, candidate.sprite); setSwap(null); }}
          onClose={() => setSwap(null)} />
      ) : null}
    </>
  );
}
