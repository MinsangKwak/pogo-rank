// ─────────────────────────────────────────────────────────────────────────────
// screens/DmaxDeck.tsx — 🧩 D-MAX 덱 짜기 (v3 views/maxdeck.js renderMaxDeck)
//
// 맥스 배틀에 데려갈 셋을 보스별로 고른다. D-MAX 화면 맨 위의 추천 파티 카드는
// **이번 주 보스 하나**에만 붙어 있고 세 칸이 고정이라, 친구들이 실제로 묻는 셋에 답하지 못했다 —
// "다음 주 ○○ 나오는데 뭐 키워둬야 해" · "1위가 없는데 그럼 누구 넣어" · "내 덱 이거 괜찮아".
//
// 주소가 덱을 싣는다(#/dmax/deck?b=…&p=…) — 그대로 보내면 상대도 같은 덱을 연다.
// 주소에 실려 온 덱은 **이 화면에 처음 들어올 때 한 번만** 읽는다: 남이 보낸 링크를 자동 추천이
// 덮어쓰면 안 되지만, 그 뒤 보스 칩을 바꿀 때마다 옛 덱을 되읽으면 새 보스의 표에 없는 칸이
// 조용히 비어 버린다 (2026-09-15 첫 구현에서 잡은 버그).
// ─────────────────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useDex, useMax, useSchedule } from '../lib/data';
import { Slot } from '../components/Slots';
import { Chips, Sprite, ToolBtn, type ChipDef } from '../components/Bits';
import { NameNode } from '../components/Row';
import { weekBoss } from '../lib/schedule';
import { MAX_DECK_SIZE, MAX_DECK_SLOTS, maxDeckAutoFill, maxDeckCandidates, maxDeckRowOf, maxDeckWhy, type MaxDeck } from '../lib/maxdeck';
import { track } from '../lib/track';
import type { OpenMon } from '../lib/mon';

/** 주소에 실린 덱(?p=) — 숫자로 못 읽는 조각은 버린다 */
function readHashIds(): number[] | null {
  const query = location.hash.split('?')[1];
  const raw = query ? new URLSearchParams(query).get('p') : null;
  if (!raw) return null;
  const ids = raw.split(',').map((piece) => Number(piece.trim())).filter((value) => Number.isFinite(value));
  return ids.length ? ids : null;
}

function readHashBoss(typeKo: Record<string, string>): string | null {
  const query = location.hash.split('?')[1];
  const raw = query ? new URLSearchParams(query).get('b') : null;
  return raw && (raw === 'overall' || typeKo[raw]) ? raw : null;
}

export default function DmaxDeck({ onOpen }: { onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const { data: max } = useMax();
  const { data: schedule } = useSchedule();

  const week = useMemo(() => weekBoss(schedule.SCHEDULE_MONTHS), [schedule]);
  // 주소(?b=)가 가장 세고, 없으면 이번 주 보스, 끝으로 '전체' (v3 maxDeckBossType)
  const [chosen, setChosen] = useState<string | null>(() => readHashBoss(dex.TYPE_KO));
  const [dynaOnly, setDynaOnly] = useState(false);
  const [swap, setSwap] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ key: string; deck: MaxDeck } | null>(null);
  const [hashIds] = useState(readHashIds);

  const bossType = chosen ?? week?.type ?? 'overall';
  const key = `${bossType}|${dynaOnly}`;
  const firstKey = useRef<string | null>(null);
  if (firstKey.current === null) firstKey.current = key;

  const auto = useMemo(() => maxDeckAutoFill(max, bossType, dynaOnly), [max, bossType, dynaOnly]);
  // 칸 수가 안 맞거나 그 표에 없는 id 면 그 칸만 비운다
  const fromHash = useMemo(() => {
    if (!hashIds || key !== firstKey.current) return null;
    const deck: MaxDeck = [null, null, null];
    hashIds.slice(0, MAX_DECK_SIZE).forEach((id, index) => {
      if (maxDeckRowOf(max, index, bossType, id)) deck[index] = id;
    });
    return deck;
  }, [hashIds, key, max, bossType]);
  const deck = picked?.key === key ? picked.deck : (fromHash ?? auto);

  const typeLabel = bossType === 'overall' ? '전체' : (dex.TYPE_KO[bossType] ?? bossType);

  // 주소를 지금 덱에 맞춘다 — 화면을 다시 그리지 않으려고 replaceState 만 쓴다 (도감 검색과 같은 방식)
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('b', bossType);
    const ids = deck.filter((sprite) => sprite != null);
    if (ids.length) next.set('p', ids.join(','));
    try { history.replaceState(history.state, '', `#/dmax/deck?${next.toString()}`); } catch { /* 주소 못 바꾸는 환경 */ }
  }, [bossType, deck]);

  const bossItems: ChipDef[] = [{ id: 'overall', label: '전체' },
    ...Object.keys(dex.TYPE_KO).map((type) => ({ id: type, label: dex.TYPE_KO[type] ?? type, type }))];

  const dealerRows = [0, 1].map((index) => maxDeckRowOf(max, index, bossType, deck[index] ?? null)).filter(Boolean);
  const tankRow = maxDeckRowOf(max, 2, bossType, deck[2] ?? null);
  const dmgSum = dealerRows.reduce((sum, row) => sum + (row?.dmg ?? 0), 0);
  const summary = !dealerRows.length && !tankRow
    ? '세 칸이 모두 비었어요.'
    : `딜러 ${dealerRows.length}마리 맥스 피해 합 ${dmgSum.toLocaleString()}${tankRow ? ` · 탱커 EHP ${tankRow.ehp}` : ''}`;

  return (
    <>
      <Slot name="headActions">
        {/* D-MAX 화면과 덱 짜기가 같은 버튼을 쓴다 — 버튼이 움직이면 같은 버튼으로 안 읽힌다 */}
        <ToolBtn label="🧩 덱 짜기" on onClick={() => { track('tool_dmaxdeck', { on: 0 }); location.hash = '#/dmax'; }} />
      </Slot>

      <div className="row-head">
        <div className="row-head__title"><h2>{`${typeLabel} 보스 상대 추천 3마리`}</h2></div>
        <span className="meta">{week && week.type === bossType ? (week.now ? `이번 주 ${week.label}` : `다음 보스 ${week.label}`) : ''}</span>
      </div>

      <div className="submenu">
        <span className="submenu__label">보스 속성</span>
        <Chips items={bossItems} value={bossType} onPick={(id) => { setChosen(id); setPicked(null); setSwap(null); }} />
      </div>

      {/* 거다이맥스는 위력 450, 다이맥스는 350 이라 섞어 두면 상위가 거의 거다이맥스로 찬다.
          틀린 것은 아니지만 가진 사람과 안 가진 사람의 답이 달라야 한다 */}
      <div className="controls__row controls__row--tools">
        <button className={`uchip${dynaOnly ? ' is-on' : ''}`} aria-pressed={dynaOnly}
          title="거다이맥스를 제외하고 다이맥스 포켓몬만 추천해요"
          onClick={() => { setDynaOnly(!dynaOnly); setPicked(null); setSwap(null); }}>다이맥스만</button>
      </div>

      <ul className="row-list deck-slots">
        {MAX_DECK_SLOTS.map((slot, index) => {
          const row = maxDeckRowOf(max, index, bossType, deck[index] ?? null);
          const open = swap === index;
          const candidates = open ? maxDeckCandidates(max, index, bossType, deck, dynaOnly).slice(0, 12) : [];
          return (
            <Fragment key={index}>
              <li className={`row deck-slot${row ? '' : ' is-empty'}`}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('.deck-slot__swap')) return;
                  if (row) onOpen(row);
                }}>
                <span className="row__rank">{index + 1}</span>
                {row ? <Sprite id={row.sprite} /> : <span className="deck-slot__blank">—</span>}
                <span className="row__name">
                  {/* nameNode 가 폼 뱃지 + <b>종 이름</b> 을 돌려준다 — 여기서 <b> 를 한 겹 더 씌우지 않는다 */}
                  {row ? <NameNode name={row.name} labels={dex.FORM_LABELS} /> : <b>비어 있어요</b>}
                  <span className="row__sub">{`${slot.label} · ${maxDeckWhy(index, row, bossType)}`}</span>
                </span>
                <button className="boss__more deck-slot__swap" aria-expanded={open}
                  onClick={() => setSwap(open ? null : index)}>{open ? '닫기' : '바꾸기'}</button>
              </li>
              {open ? (
                <li className="row__why is-open deck-slot__picker">
                  <div className="row__why-col">
                    <b className="row__why-title">{`${slot.label} 후보 — ${typeLabel} 보스 상대 ${slot.role === 'tank' ? 'EHP' : '맥스 피해'}순`}</b>
                    <div className="row__why-chips">
                      {candidates.map((candidate) => (
                        <button key={candidate.sprite}
                          className={`row__why-chip${Number(candidate.sprite) === Number(deck[index]) ? ' is-on' : ''}`}
                          onClick={() => {
                            setPicked({ key, deck: deck.map((value, at) => (at === index ? candidate.sprite : value)) });
                            setSwap(null);
                          }}>
                          <NameNode name={candidate.name} labels={dex.FORM_LABELS} />
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ul>

      {/* 지어낸 등급이 아니라 표에 있는 숫자를 그대로 더한 값이다 */}
      <p className="deck__reason">{`💬 ${summary}`}</p>

      <p className="detail__foot">딜러는 맥스 피해 × √내구 순위, 탱커는 체력 × 방어 ÷ 받는 배율(EHP) 순위에서 골라요. 맥스가드·맥스스피릿 같은 방어·회복 역할은 아직 데이터가 없어 다루지 않아요. 주소를 그대로 보내면 상대도 같은 덱을 봅니다.</p>
    </>
  );
}
