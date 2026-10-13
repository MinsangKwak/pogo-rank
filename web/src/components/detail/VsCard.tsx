// ─────────────────────────────────────────────────────────────────────────────
// components/detail/VsCard.tsx — 팝업 맨 위 '상대할 때' 카드 (2026-10-13)
//
// **왜 맨 위인가.** 10월 통계에서 가장 많이 열린 상세는 거다이맥스 · 레이드 보스 자신이었다 — 사람들은 이 포켓몬을
// 키우려고가 아니라 잡으려고 연다. 그런데 팝업은 '키울 때'(육성 추천) 한 면뿐이었고, '어떻게 잡나' 는
// 배틀 정보 탭 맨 아래 '보스로 만났을 때' 에만 있었다. 보스로 서는 기간이면 그 답을 첫 줄에 둔다.
//
// 요약 팝업에도 선다 — 홈 · 전체 검색에서 보스를 연 사람이 가장 먼저 찾는 것이라서. 순위 목록은 펼치지 않는다 (CLAUDE.md 3-1):
// 추천 세 마리와, 자세한 셈으로 가는 단추 하나(맥스 → D-MAX 덱 짜기 · 레이드 → 솔플 계산기)뿐이다.
// 보스로 서지 않는 포켓몬에는 카드 자체를 안 만든다 — 빈 카드는 '데이터가 없다' 로 읽힌다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useMemo } from 'react';
import { useDex } from '../../lib/data';
import { cardDday, cardFor, cardWhen } from '../../lib/bossBoard';
import { countersOf, useBossBoard, useCounterSource } from '../../lib/useBossBoard';
import { go } from '../../lib/nav';
import { track } from '../../lib/track';
import { routeHref } from '../../routes';
import { PxIcon } from '../PxIcon';
import Recs from './Recs';
import type { MonRef } from '../../lib/mon';

/** 카드가 보여 주는 추천 수 — 목록이 아니라 '세 마리' 다 */
export const VS_RECS = 3;

export default function VsCard({ mon, dexNo, onSwitch, onLeave }: {
  /** 지금 열린 포켓몬 — 폼째 이름 · 그림 번호로 그 폼의 카드를 먼저 찾는다 (메가X · 메가Y 가 같이 선 주) */
  mon: Pick<MonRef, 'name' | 'sprite'>;
  dexNo: number | null;
  /** 추천 후보를 누르면 같은 창에서 그 포켓몬으로 */
  onSwitch: (mon: MonRef) => void;
  /** 다른 화면으로 옮겨 갈 때 팝업을 닫는다 */
  onLeave?: (() => void) | undefined;
}) {
  const { data: dex } = useDex();
  const { board } = useBossBoard();
  const src = useCounterSource();
  // 진화 계열까지 본다 — 파크로우를 열어도 이번 주 파라꼬 다이맥스가 보인다 (BossLine 이 하던 일)
  const family = useMemo(() => new Set<number>(dexNo != null ? (dex.DEX_DATA.evo[String(dexNo)]?.flat() ?? [dexNo]) : []), [dex, dexNo]);
  const card = useMemo(() => cardFor(board, family, { name: mon.name, sprite: mon.sprite, dex: dexNo }), [board, family, mon.name, mon.sprite, dexNo]);
  const counters = useMemo(() => (card ? countersOf(src, card.battle, card.types, VS_RECS) : null), [card, src]);
  if (!card) return null;
  const isMax = card.battle === 'max';
  const goLabel = isMax ? 'D-MAX 덱 짜기' : '솔플 계산기';
  // 맥스는 덱 짜기가 보스 타입(?b=)을, 레이드는 솔플 계산기가 보스 이름(?boss=)을 주소로 받는다 — 도착하면 그 보스가 골라져 있다
  const href = isMax
    ? `${routeHref('dmax-deck')}?b=${encodeURIComponent(card.types[0] ?? 'overall')}`
    : `${routeHref('pve-solo')}?boss=${encodeURIComponent(card.detailName)}`;
  return (
    <section className={`detail__card detail__vs${card.live ? ' is-live' : ''}`} data-boss={card.detailName}>
      <p className="detail__vs-when">
        <span className={`tag${card.live ? ' tag--live' : ''}`}>{cardDday(card)}</span>
        <span>{`${cardWhen(card)}${card.dex !== dexNo ? ` · ${card.name} (같은 진화 계열)` : ''}`}</span>
      </p>
      <h3>상대할 때</h3>
      {counters ? (
        <>
          <p className="detail__card-sub">{counters.sub}</p>
          <Recs rows={counters.rows} onSwitch={onSwitch} />
          <p className="detail__foot">{counters.foot}</p>
        </>
      ) : (
        // 타입을 모르는 보스(발표 전) — 추천 대신 무엇을 언제 알 수 있는지 적는다
        <p className="detail__none-text">보스의 타입이 확인되면 추천 포켓몬을 보여 드려요.</p>
      )}
      <div className="detail__vs-go">
        <button type="button" className="detail__form-go" onClick={() => {
          track('vs_go', { to: isMax ? 'dmax-deck' : 'pve-solo', boss: card.detailName });
          onLeave?.();
          go(href);
        }}>
          <PxIcon emoji={isMax ? '🧩' : '🧮'} /><span className="btn-label">{`${goLabel}에서 자세히`}</span>
        </button>
      </div>
    </section>
  );
}
