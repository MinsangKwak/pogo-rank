'use strict';
// 이번 주 보스판 — 맥스 일정과 레이드를 한 줄로, 진행 중이 먼저, 모르는 이름은 안 세우고, 새는 글자 없이 (lib/bossBoard.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bossBoard, cardDday, cardFor, cardWhen, raidKindOf, reasonFor, BOARD_MAX } from '../lib/bossBoard';
import { maxSlides, weeksFromSchedule } from '../lib/maxSlides';
import { LEAK } from '../lib/cell';
import type { GamedayEvent } from '../types/data';

const names = { '6': '리자몽', '150': '뮤츠', '483': '디아루가', '570': '조로아', '571': '조로아크', '645': '랜드로스', '812': '인텔리레온', '816': '울머기', '821': '파라꼬', '822': '파크로우' };
const en = { '812': 'Inteleon' };
const forms = { '6': { types: ['fire', 'flying'] }, '10034': { types: ['fire', 'dragon'] }, '10035': { types: ['fire', 'flying'] }, '150': { types: ['psychic'] }, '483': { types: ['steel', 'dragon'] }, '645': { types: ['ground', 'flying'] }, '812': { types: ['water'] }, '816': { types: ['water'] }, '821': { types: ['flying'] } };
const megas = { '6': [{ sprite: 10034, label: '메가X' }, { sprite: 10035, label: '메가Y' }], '150': [{ sprite: 10043, label: '메가X' }, { sprite: 10044, label: '메가Y' }] };

const ev = (id: string, type: string, title: string, start: string, end: string, dex?: number[]): GamedayEvent =>
  ({ id, type, title, start, end, ...(dex ? { dex } : {}) });

const events: GamedayEvent[] = [
  ev('mm-1012', 'max-mondays', 'Dynamax Rookidee during Max Monday', '2026-10-12T06:00:00.000', '2026-10-12T21:00:00.000', [821]),
  ev('gmax-1017', 'max-battles', 'Gigantamax Inteleon Max Battle Day', '2026-10-17T14:00:00.000', '2026-10-17T17:00:00.000', [812]),
  ev('mm-1026', 'max-mondays', 'Dynamax Sobble during Max Monday', '2026-10-26T06:00:00.000', '2026-10-26T21:00:00.000', [816]),
  ev('r5-1007', 'raid-battles', 'Mewtwo in 5-star Raid Battles', '2026-10-07T10:00:00.000', '2026-10-13T10:00:00.000', [150]),
  ev('sh-1007', 'raid-battles', 'Shadow Landorus (Incarnate Forme) in Shadow Raids', '2026-10-07T10:00:00.000', '2026-11-03T10:00:00.000', [645]),
  ev('r5-1014', 'raid-battles', 'Dialga in 5-star Raid Battles', '2026-10-14T10:00:00.000', '2026-10-20T10:00:00.000', [483]),
  ev('mega-1021', 'raid-battles', 'Mega Charizard X and Mega Charizard Y in Mega Raid', '2026-10-21T10:00:00.000', '2026-10-27T10:00:00.000', [6]),
  ev('mega-1028', 'raid-battles', 'Mega Charizard Y in Mega Raids', '2026-10-28T10:00:00.000', '2026-11-03T10:00:00.000', [6]),
  ev('r5-9999', 'raid-battles', 'Unknown in 5-star Raid Battles', '2026-10-14T10:00:00.000', '2026-10-20T10:00:00.000', [9999]),
  ev('cd-1010', 'community-day', 'Zorua Community Day', '2026-10-10T14:00:00.000', '2026-10-10T17:00:00.000', [570, 571]),
  ev('cd-1018', 'community-day', 'Sobble Community Day', '2026-10-18T14:00:00.000', '2026-10-18T17:00:00.000', [816]),
];
// 2026-10-13 12:00 한국 — 파라꼬 주(10.12~10.18) 진행 중, 뮤츠 5성은 10시에 끝났다, 디아루가는 내일
const now = Date.parse('2026-10-13T12:00:00+09:00');
const src = () => ({ slides: maxSlides({ events, names, en, forms, weeks: weeksFromSchedule(undefined) }, now), events, names, forms, megas });

describe('raidKindOf', () => {
  it('제목으로 섀도우 · 메가 · 5성을 가른다', () => {
    expect(raidKindOf('Shadow Landorus (Incarnate Forme) in Shadow Raids')).toBe('shadow');
    expect(raidKindOf('Mega Blastoise in Mega Raids')).toBe('mega');
    expect(raidKindOf('Yveltal in 5-star Raid Battles')).toBe('raid5');
    expect(raidKindOf('Something in 3-star Raids')).toBe('raid');
  });
});

describe('bossBoard', () => {
  const board = bossBoard(src(), now);

  it('진행 중이 먼저(맥스 → 레이드), 그다음 가까운 것. 끝난 레이드 · 7일 밖 · 모르는 이름은 없다', () => {
    expect(board.map((card) => card.detailName)).toEqual(['다이맥스 파라꼬', '랜드로스', '디아루가', '거다이맥스 인텔리레온']);
    expect(board.map((card) => card.kind)).toEqual(['dmax', 'shadow', 'raid5', 'gmax']);
    expect(board.map((card) => card.live)).toEqual([true, true, false, false]);
    // 10.26 울머기(13일 뒤) · 10.21 메가 리자몽(8일 뒤) · 끝난 뮤츠 · 9999 는 안 선다
    expect(board.some((card) => /울머기|리자몽|뮤츠/.test(card.detailName))).toBe(false);
  });

  it('카드 글 — 기간 · 남은 날 · 종류, 새는 글자 없이', () => {
    const [rookidee, landorus, dialga, inteleon] = board;
    expect(cardDday(rookidee!)).toBe('진행 중');
    expect(cardWhen(rookidee!)).toBe('다이맥스 보스 · 10.12 (월) — 10.18 (일) · 월 06:00–21:00');
    expect(cardWhen(landorus!)).toBe('섀도우 레이드 보스 · 10.7 (수) — 11.3 (화)');
    expect(cardDday(dialga!)).toBe('D-1');
    expect(dialga!.short).toBe('10.14–10.20');
    expect(cardDday(inteleon!)).toBe('D-4');
    expect(cardWhen(inteleon!)).toBe('거다이맥스 보스 · 10.17 (토) · 14:00–17:00');
    for (const card of board) {
      for (const text of [card.name, card.detailName, card.when, card.short, card.hours, cardWhen(card), cardDday(card)]) expect(text).not.toMatch(LEAK);
    }
  });

  it('메가 레이드는 제목의 X · Y 폼만, 없으면 첫 폼 — 그림은 메가 폼 번호', () => {
    const later = Date.parse('2026-10-21T12:00:00+09:00');
    const board2 = bossBoard(src(), later, { horizonDays: 7 });
    const megas2 = board2.filter((card) => card.kind === 'mega');
    expect(megas2.map((card) => card.detailName)).toEqual(['메가X 리자몽', '메가Y 리자몽']);
    expect(megas2.map((card) => card.sprite)).toEqual([10034, 10035]);
    expect(megas2[0]!.types).toEqual(['fire', 'dragon']);
    // 10.28 메가Y 만 — 같은 폼(10035)은 한 번만 선다
    expect(board2.filter((card) => card.sprite === 10035)).toHaveLength(1);
  });

  it('카드 수 상한 — 기본 여섯', () => {
    const many = Array.from({ length: 10 }, (_, index) => ev(`r-${index}`, 'raid-battles', 'X in 5-star Raid Battles', '2026-10-13T10:00:00.000', '2026-10-20T10:00:00.000', [150]));
    const names2: Record<string, string> = { '150': '뮤츠' };
    // 같은 폼은 한 번만이라 하나뿐이다 — 상한은 서로 다른 폼에서만 센다
    expect(bossBoard({ slides: [], events: many, names: names2, forms }, now)).toHaveLength(1);
    const distinct = Array.from({ length: 10 }, (_, index) => ev(`r-${index}`, 'raid-battles', 'X in 5-star Raid Battles', '2026-10-13T10:00:00.000', '2026-10-20T10:00:00.000', [100 + index]));
    const names3 = Object.fromEntries(distinct.map((one) => [String(one.dex![0]), `보스${one.dex![0]}`]));
    expect(bossBoard({ slides: [], events: distinct, names: names3, forms: {} }, now)).toHaveLength(BOARD_MAX);
  });

  it('cardFor — 진화 계열로 찾는다 (파크로우를 열어도 파라꼬 카드)', () => {
    expect(cardFor(board, new Set([822, 821]))?.detailName).toBe('다이맥스 파라꼬');
    expect(cardFor(board, new Set([25]))).toBeNull();
  });
});

describe('reasonFor', () => {
  const board = bossBoard(src(), now);
  it('보스판에 있으면 종류, 아니면 7일 안의 커뮤니티 데이 · 스포트라이트, 아무것도 아니면 빈 글자', () => {
    expect(reasonFor(board, events, 821, now)).toBe('다이맥스 보스');
    expect(reasonFor(board, events, 812, now)).toBe('거다이맥스 보스 · D-4');
    expect(reasonFor(board, events, 816, now)).toBe('커뮤니티 데이 · D-5');
    // 지난 커뮤니티 데이(조로아)는 이유가 아니다
    expect(reasonFor(board, events, 571, now)).toBe('');
    expect(reasonFor(board, events, 25, now)).toBe('');
  });
});

describe('실제 데이터', () => {
  it('지금 판의 모든 카드 글에 새는 글자가 없고, 이름 없는 번호는 없다', () => {
    const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
    const dex = read('dex');
    const gameday = read('gameday');
    const schedule = read('schedule');
    const realNow = Date.now();
    const slides = maxSlides({ events: gameday.GAMEDAY.events, names: dex.DEX_DATA.names, en: dex.DEX_DATA.en, forms: dex.DEX_DATA.forms, weeks: weeksFromSchedule(schedule.SCHEDULE_MONTHS) }, realNow);
    const board = bossBoard({ slides, events: gameday.GAMEDAY.events, names: dex.DEX_DATA.names, forms: dex.DEX_DATA.forms, megas: dex.DEX_DATA.megas }, realNow);
    for (const card of board) {
      expect(card.name).toBeTruthy();
      expect(card.types.length).toBeGreaterThan(0);
      for (const text of [card.detailName, cardWhen(card), cardDday(card), card.short]) expect(text).not.toMatch(LEAK);
    }
  });
});
