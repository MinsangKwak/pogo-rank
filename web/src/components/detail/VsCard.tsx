// ─────────────────────────────────────────────────────────────────────────────
// components/detail/VsCard.tsx — 팝업 맨 위 '상대할 때' 카드 (2026-10-13 · v6 픽셀 판)
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
import { PixelIcon } from '../PixelIcon';
import Recs from './Recs';
import { Actions, Foot, Sec } from './Pieces';
import type { MonRef } from '../../lib/mon';

/** 카드가 보여 주는 추천 수 — 목록이 아니라 '세 마리' 다 */
export const VS_RECS = 3;

export default function VsCard({ mon, dexNo, kind, onSwitch, onLeave }: {
  /** 지금 열린 포켓몬 — 폼째 이름 · 그림 번호로 그 폼의 카드를 먼저 찾는다 (메가X · 메가Y 가 같이 선 주) */
  mon: Pick<MonRef, 'name' | 'sprite'>;
  dexNo: number | null;
  /** 홈 보스 카드에서 열었으면 그 카드의 종류 — 같은 폼이 5성 레이드와 주말 섀도우에 같이 설 때 누른 쪽 (MonPick.boss) */
  kind?: string | undefined;
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
  const card = useMemo(() => cardFor(board, family, { name: mon.name, sprite: mon.sprite, dex: dexNo, ...(kind ? { kind } : {}) }), [board, family, mon.name, mon.sprite, dexNo, kind]);
  const counters = useMemo(() => (card ? countersOf(src, card.battle, card.types, VS_RECS) : null), [card, src]);
  if (!card) return null;
  const isMax = card.battle === 'max';
  // 섀도우 레이드는 격노 · 정화 결정이 있어 솔플 계산기의 셈(일반 레이드 체력 · 피해)이 맞지 않는다 — 계산기 대신 레이드 순위로 보낸다 (Codex, PR #361)
  const isShadow = card.kind === 'shadow';
  const goLabel = isMax ? 'D-MAX 덱 짜기' : isShadow ? '레이드 순위' : '솔플 계산기';
  // 레이드 난이도 — 카드가 제목에서 읽은 것(1 · 3 · 4 · 5성 · 메가)을 계산기에 넘긴다. 계산기의 자동 판정은 전설을 4성(체력 9,000),
  // 미진화 종을 1성으로 보는데 5성은 15,000 · 3성 피카츄는 3,600 이라 이름만 넘기면 솔플 판정이 틀린다 (Codex, PR #361)
  const tier = card.tier;
  // 맥스는 덱 짜기가 보스 타입(?b=)을, 레이드는 솔플 계산기가 보스 이름(?boss=)과 난이도(?tier=)를 주소로 받는다 — 도착하면 그 보스가 골라져 있다
  const href = isMax
    ? `${routeHref('dmax-deck')}?b=${encodeURIComponent(card.types[0] ?? 'overall')}`
    : isShadow ? routeHref('pve')
      : `${routeHref('pve-solo')}?boss=${encodeURIComponent(card.detailName)}${tier ? `&tier=${tier}` : ''}`;
  return (
    <Sec className={`pxd-vs${card.live ? ' is-live' : ''}`} data-boss={card.detailName} title={<>
      <span className="pxd-vs__when">
        <span className={`px-badge px-skin px-badge--ko${card.live ? ' px-badge--fill' : ' px-badge--yellow'}`}>{cardDday(card)}</span>
        <span className="px-caption">{`${cardWhen(card)}${card.dex !== dexNo ? ` · ${card.name} (같은 진화 계열)` : ''}`}</span>
      </span>
      상대할 때</>}>
      {counters ? (
        <>
          <p className="px-body px-muted">{counters.sub}</p>
          <Recs rows={counters.rows} onSwitch={onSwitch} />
          <Foot>{counters.foot}</Foot>
          {isShadow ? <Foot>섀도우 레이드는 격노 · 정화 결정이 있어 솔플 계산기의 셈과 달라요. 추천은 타입 상성 기준이에요.</Foot> : null}
          {/* 덱 짜기는 보스 타입 하나 기준으로 짜인 화면이다(타입 칩 · ?b= · 탱커 표) — 두 타입 보스는 첫 타입으로 가니 그 사실을 적는다 (Codex, PR #361) */}
          {isMax && card.types.length > 1 ? <Foot>{`덱 짜기는 ${dex.TYPE_KO[card.types[0]!] ?? card.types[0]} 타입 보스 기준이에요. 여기 추천은 두 타입을 함께 봤어요.`}</Foot> : null}
        </>
      ) : (
        // 타입을 모르는 보스(발표 전) — 추천 대신 무엇을 언제 알 수 있는지 적는다
        <p className="px-body px-muted">보스의 타입이 확인되면 추천 포켓몬을 보여 드려요.</p>
      )}
      <Actions routeOnly>
        <button type="button" className="px-btn px-btn--sm px-skin" onClick={() => {
          track('vs_go', { to: isMax ? 'dmax-deck' : isShadow ? 'pve' : 'pve-solo', boss: card.detailName });
          onLeave?.();
          go(href);
        }}>
          <PixelIcon name={isMax ? 'team' : 'chart'} />{`${goLabel}에서 자세히`}
        </button>
      </Actions>
    </Sec>
  );
}
