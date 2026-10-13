// ─────────────────────────────────────────────────────────────────────────────
// lib/bossBoard.ts — "이번 주 보스" 판 (2026-10-13)
//
// 통계(10월 1~13일)에서 사람들이 가장 많이 연 상세는 보스 자신이었다 — 인텔리레온 · 메타그로스 · 고릴타 · 에이스번.
// 키우려는 것이 아니라 **지금 상대해야 하는** 거다이맥스 · 레이드 보스다. 그런데 그 보스가 '지금 보스' 라는 것과
// 무엇으로 잡는지는 솔플 계산기 · 덱 짜기 안쪽에만 있었다. 이 판이 그것을 홈과 팝업 맨 위로 꺼낸다.
//
// 두 원본을 한 줄로 합친다:
//   맥스 — 홈 배너가 굴리는 맥스 일정(lib/maxSlides.ts). 맥스 먼데이 · 맥스배틀 데이 한 장의 보스 하나가 카드 하나
//   레이드 — gameday(LeekDuck) 의 raid-battles 행사. 5성 · 메가 · 섀도우를 제목으로 가른다
// 진행 중인 것이 먼저, 그다음 가까운 것. 시작이 `horizonDays` 보다 먼 것은 안 세운다 — '이번 주' 판이다.
//
// 화면에 나갈 글자는 여기서 다 만든다 — 값이 비면 줄을 안 세운다 (CLAUDE.md §1). 이름을 모르는 번호는 지어내지 않는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { dayLabel, daysUntil, hhmm, kst, shortDay, type MaxSlide } from './maxSlides';
import type { BossKind } from './bossCounters';
import type { GamedayEvent } from '../types/data';

export type BoardKind = 'gmax' | 'dmax' | 'raid5' | 'mega' | 'shadow' | 'raid';

/** 카드의 종류 글 — 머리의 작은 표 */
export const BOARD_KIND_KO: Readonly<Record<BoardKind, string>> = {
  gmax: '거다이맥스', dmax: '다이맥스', raid5: '5성 레이드', mega: '메가 레이드', shadow: '섀도우 레이드', raid: '레이드',
};

export interface BossCard {
  id: string;
  kind: BoardKind;
  /** 'max' · 'raid' — 추천 풀을 가르는 축 (lib/bossCounters.ts) */
  battle: BossKind;
  dex: number;
  /** 그릴 그림 — 거다이맥스 · 메가는 그 폼의 번호, 아니면 도감 번호 */
  sprite: number;
  /** 종 이름 — '인텔리레온' */
  name: string;
  /** 상세를 열 이름 — '거다이맥스 인텔리레온' · '메가 리자몽'. 섀도우는 종 이름 그대로(섀도우 폼은 상세 계약이 없다) */
  detailName: string;
  types: string[];
  /** '10.3 (토)' · '10.7 (수) — 10.13 (화)' */
  when: string;
  /** '10.3' · '10.7–10.13' */
  short: string;
  /** '14:00–17:00' · '월 06:00–21:00' — 모르면 빈 글자 */
  hours: string;
  live: boolean;
  /** 시작까지 남은 날 (진행 중이면 0) */
  days: number;
  /** 시작 시각(ms) — 정렬용 */
  at: number;
}

export interface BossBoardSource {
  /** 남은 맥스 일정 (lib/maxSlides.ts) */
  slides: readonly MaxSlide[] | undefined;
  /** gameday 행사 — raid-battles 만 읽는다 */
  events: readonly GamedayEvent[] | undefined;
  names: Readonly<Record<string, string>> | undefined;
  forms: Readonly<Record<string, { types?: readonly string[] }>> | undefined;
  /** 메가 폼 표 (DEX_DATA.megas) — 메가 레이드 카드의 그림 · 이름 */
  megas?: Readonly<Record<string, readonly { sprite: number; label: string }[]>> | undefined;
}

export interface BossBoardOptions {
  /** 시작이 이보다 먼 행사는 안 세운다 — 기본 7일 */
  horizonDays?: number;
  /** 카드 수 상한 — 기본 6 */
  max?: number;
}

export const BOARD_HORIZON_DAYS = 7;
export const BOARD_MAX = 6;

/** 레이드 행사 제목 → 종류. 'Shadow Landorus in Shadow Raids' · 'Mega Blastoise in Mega Raids' · 'Yveltal in 5-star Raid Battles' */
export function raidKindOf(title: string): BoardKind {
  if (/\bshadow\b/i.test(title)) return 'shadow';
  if (/\bmega\b/i.test(title)) return 'mega';
  if (/5-star|five-star|\b5★/i.test(title)) return 'raid5';
  return 'raid';
}

function maxCards(slides: readonly MaxSlide[]): BossCard[] {
  const out: BossCard[] = [];
  for (const slide of slides) {
    const prefix = slide.gmax ? '거다이맥스' : '다이맥스';
    for (const boss of slide.bosses) {
      if (!boss.name) continue;
      out.push({
        id: `${slide.id}-${boss.dex}`,
        kind: slide.gmax ? 'gmax' : 'dmax',
        battle: 'max',
        dex: boss.dex, sprite: boss.sprite, name: boss.name, detailName: `${prefix} ${boss.name}`,
        types: [...boss.types],
        when: slide.when, short: slide.short, hours: slide.hours,
        live: slide.live, days: slide.days,
        // 슬라이드는 시작 시각을 들고 있지 않다 — 남은 날로 되돌려 정렬 축을 맞춘다
        at: slide.days,
      });
    }
  }
  return out;
}

/** 메가 레이드 한 행사의 폼들 — 제목에 X · Y 가 있으면 그 폼만, 없으면 첫 폼. 메가 폼이 없는 종은 일반 그림 · 이름으로 */
function megaFormsOf(title: string, forms: readonly { sprite: number; label: string }[] | undefined) {
  if (!forms?.length) return [];
  const wanted = forms.filter((one) => {
    const suffix = /^메가([XY])$/.exec(one.label)?.[1];
    return suffix ? new RegExp(`\\b${suffix}\\b`).test(title) : false;
  });
  return wanted.length ? wanted : [forms[0]!];
}

function raidCards(src: BossBoardSource, nowMs: number, horizonMs: number): BossCard[] {
  const out: BossCard[] = [];
  for (const event of src.events ?? []) {
    if (event.type !== 'raid-battles' || !event.dex?.length) continue;
    const start = kst(event.start);
    const end = kst(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end < nowMs || start > nowMs + horizonMs) continue;
    const kind = raidKindOf(event.title);
    const live = start <= nowMs;
    const from = hhmm(event.start);
    const to = hhmm(event.end);
    const sameDay = shortDay(start) === shortDay(end);
    const base = {
      kind, battle: 'raid' as const,
      when: sameDay ? dayLabel(start) : `${dayLabel(start)} — ${dayLabel(end)}`,
      short: sameDay ? shortDay(start) : `${shortDay(start)}–${shortDay(end)}`,
      // 레이드 로테이션은 일주일 내내라 시간을 안 적는다 — 하루 행사(레이드 데이)만 시간이 뜻이 있다
      hours: sameDay && from && to ? `${from}–${to}` : '',
      live, days: Math.max(0, daysUntil(start, nowMs)), at: start,
    };
    for (const dex of event.dex) {
      const name = src.names?.[String(dex)];
      // 이름이 없으면 그 보스를 안 세운다 — 지어내지 않는다
      if (!name) continue;
      const typesOf = (sprite: number) => [...(src.forms?.[String(sprite)]?.types ?? src.forms?.[String(dex)]?.types ?? [])];
      if (kind === 'mega') {
        const forms = megaFormsOf(event.title, src.megas?.[String(dex)]);
        if (forms.length) {
          for (const form of forms) {
            out.push({ ...base, id: `${event.id}-${form.sprite}`, dex, sprite: form.sprite, name, detailName: `${form.label} ${name}`, types: typesOf(form.sprite) });
          }
          continue;
        }
      }
      out.push({ ...base, id: `${event.id}-${dex}`, dex, sprite: dex, name, detailName: name, types: typesOf(dex) });
    }
  }
  return out;
}

/**
 * 이번 주 보스판 — 진행 중인 것이 먼저(이른 것부터), 그다음 가까운 것. 같은 폼(그림 번호)은 한 번만.
 * 맥스 일정은 홈 배너와 같은 `slides` 를 받는다 — 배너 · 보스판 · 팝업이 같은 장을 봐야 한다
 */
export function bossBoard(src: BossBoardSource, nowMs: number, options: BossBoardOptions = {}): BossCard[] {
  const horizonDays = options.horizonDays ?? BOARD_HORIZON_DAYS;
  const cards = [
    ...maxCards((src.slides ?? []).filter((slide) => slide.live || slide.days <= horizonDays)),
    ...raidCards(src, nowMs, horizonDays * 24 * 60 * 60 * 1000),
  ];
  // 진행 중 → 남은 날 → 종류(맥스 먼저 — 서비스의 축) 순
  const order: Record<BoardKind, number> = { gmax: 0, dmax: 1, raid5: 2, mega: 3, shadow: 4, raid: 5 };
  cards.sort((left, right) => Number(right.live) - Number(left.live) || left.days - right.days || order[left.kind] - order[right.kind]);
  const seen = new Set<number>();
  const out: BossCard[] = [];
  for (const card of cards) {
    if (seen.has(card.sprite)) continue;
    seen.add(card.sprite);
    out.push(card);
    if (out.length >= (options.max ?? BOARD_MAX)) break;
  }
  return out;
}

/** 이 종(또는 그 진화 계열)이 서는 카드 — 진행 중이 먼저, 없으면 가장 가까운 것. 판은 이미 그 순서다 */
export function cardFor(board: readonly BossCard[], dexNos: ReadonlySet<number>): BossCard | null {
  return board.find((card) => dexNos.has(card.dex)) ?? null;
}

/** 카드 머리의 남은 날 — '진행 중' · '오늘' · 'D-5' (배너의 dday 와 같은 말) */
export function cardDday(card: Pick<BossCard, 'live' | 'days'>): string {
  if (card.live) return '진행 중';
  if (card.days <= 0) return '오늘';
  return `D-${card.days}`;
}

/** 카드 머리 한 줄 — '거다이맥스 보스 · 10.3 (토) · 14:00–17:00' */
export function cardWhen(card: Pick<BossCard, 'kind' | 'when' | 'hours'>): string {
  return [`${BOARD_KIND_KO[card.kind]} 보스`, card.when, card.hours].filter(Boolean).join(' · ');
}

/**
 * '지금 많이 보는 포켓몬' 줄에 붙는 이유 한 마디 — 왜 이 목록인지 (2026-10-13 통계 개편).
 * 보스판에 있으면 그 종류('거다이맥스 보스'), 아니면 커뮤니티 데이 · 스포트라이트 아워처럼 지금 진행 중이거나
 * 7일 안에 오는 행사. 아무것도 아니면 빈 글자 — 지어내지 않는다
 */
export function reasonFor(board: readonly BossCard[], events: readonly GamedayEvent[] | undefined, dex: number, nowMs: number, horizonDays = BOARD_HORIZON_DAYS): string {
  const card = cardFor(board, new Set([dex]));
  if (card) return `${BOARD_KIND_KO[card.kind]} 보스${card.live ? '' : ` · ${cardDday(card)}`}`;
  const horizonMs = horizonDays * 24 * 60 * 60 * 1000;
  const labels: Record<string, string> = { 'community-day': '커뮤니티 데이', 'pokemon-spotlight-hour': '스포트라이트 아워', 'raid-day': '레이드 데이' };
  for (const event of events ?? []) {
    const label = labels[event.type];
    if (!label || !event.dex?.includes(dex)) continue;
    const start = kst(event.start);
    const end = kst(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < nowMs || start > nowMs + horizonMs) continue;
    const days = daysUntil(start, nowMs);
    return start <= nowMs ? label : `${label} · ${days <= 0 ? '오늘' : `D-${days}`}`;
  }
  return '';
}
