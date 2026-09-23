'use strict';
// 홈 배너 슬라이드 — 남은 맥스 일정만, 이른 것부터, 새는 글자 없이 (lib/maxSlides.ts)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dday, maxSlides, type MaxSlideSource } from '../lib/maxSlides';
import { LEAK } from '../lib/cell';
import type { GamedayEvent } from '../types/data';

const names = { '144': '프리져', '145': '썬더', '146': '파이어', '815': '에이스번', '816': '울머기' };
const en = { '144': 'Articuno', '145': 'Zapdos', '146': 'Moltres', '815': 'Cinderace', '816': 'Sobble' };
const forms = { '144': { types: ['ice', 'flying'] }, '815': { types: ['fire'] }, '816': { types: ['water'] } };

const ev = (id: string, type: string, title: string, start: string, end: string, dex?: number[]): GamedayEvent =>
  ({ id, type, title, start, end, ...(dex ? { dex } : {}) });

const events: GamedayEvent[] = [
  ev('mm-0921', 'max-mondays', 'Dynamax Articuno, Zapdos, and Moltres during Max Monday', '2026-09-21T06:00:00.000', '2026-09-21T21:00:00.000', [144, 145, 146]),
  ev('mm-0928', 'max-mondays', 'Dynamax Sobble during Max Monday', '2026-09-28T06:00:00.000', '2026-09-28T21:00:00.000', [816]),
  ev('gmax-1003', 'max-battles', 'Gigantamax Cinderace Max Battle Day', '2026-10-03T14:00:00.000', '2026-10-03T17:00:00.000', [815]),
  ev('mbd-1024', 'max-battles', 'Dynamax Max Battle Day', '2026-10-24T14:00:00.000', '2026-10-24T17:00:00.000'),
  ev('raid', 'raid-battles', 'Mewtwo in 5-star Raids', '2026-09-20T10:00:00.000', '2026-10-20T10:00:00.000', [150]),
];
const src: MaxSlideSource = {
  events, names, en, forms,
  maxRows: [{ sprite: 10210, name: '거다이맥스 에이스번', en: 'Cinderace', types: ['fire'], fast: '', charged: '', gmax: true } as never],
};
// 2026-09-23 12:00 한국
const now = Date.parse('2026-09-23T12:00:00+09:00');

describe('maxSlides', () => {
  it('맥스 일정만 — 레이드는 빠진다', () => {
    expect(maxSlides(src, now).map((one) => one.id)).toEqual(['mm-0921', 'mm-0928', 'gmax-1003', 'mbd-1024']);
  });

  it('맥스 먼데이는 그 주 일요일까지 남는다 — 월요일 21시에 지우지 않는다', () => {
    const [week] = maxSlides(src, now);
    expect(week?.live).toBe(true);
    expect(dday(week!)).toBe('진행 중');
    expect(week?.when).toBe('9.21 (월) — 9.27 (일)');
    expect(week?.hours).toBe('월 06:00–21:00');
    // 일요일 밤이 지나면 빠진다
    const monday = Date.parse('2026-09-28T00:00:01+09:00');
    expect(maxSlides(src, monday).map((one) => one.id)[0]).toBe('mm-0928');
  });

  it('하루 행사는 행사가 끝나면 빠진다', () => {
    const after = Date.parse('2026-10-03T17:00:01+09:00');
    expect(maxSlides(src, after).map((one) => one.id)).not.toContain('gmax-1003');
  });

  it('거다이맥스는 폼 그림을 찾고, 남은 날을 한국 날짜로 센다', () => {
    const gmax = maxSlides(src, now).find((one) => one.id === 'gmax-1003')!;
    expect(gmax.gmax).toBe(true);
    expect(gmax.bosses).toEqual([{ dex: 815, sprite: 10210, name: '에이스번', types: ['fire'] }]);
    expect(gmax.when).toBe('10.3 (토)');
    expect(gmax.hours).toBe('14:00–17:00');
    expect(dday(gmax)).toBe('D-10');
  });

  it('폼 그림 표가 없으면 도감 번호로 그린다', () => {
    const gmax = maxSlides({ ...src, maxRows: undefined }, now).find((one) => one.id === 'gmax-1003')!;
    expect(gmax.bosses[0]?.sprite).toBe(815);
  });

  it('이름을 모르는 보스는 세우지 않는다 — 지어내지 않는다', () => {
    const week = maxSlides({ ...src, names: { '144': '프리져' } }, now)[0]!;
    expect(week.bosses.map((one) => one.name)).toEqual(['프리져']);
    const blank = maxSlides(src, now).find((one) => one.id === 'mbd-1024')!;
    expect(blank.bosses).toEqual([]);
  });

  it('시각이 깨진 줄은 버린다', () => {
    const broken = [ev('x', 'max-battles', 'Dynamax', 'soon', 'later', [144])];
    expect(maxSlides({ ...src, events: broken }, now)).toEqual([]);
    expect(maxSlides({ ...src, events: undefined }, now)).toEqual([]);
  });

  it('해외 시간대에서 열어도 날짜가 밀리지 않는다', () => {
    // 한국 9/23 01:00 = 뉴욕 9/22 — 한국 기준으로 센다
    const early = Date.parse('2026-09-23T01:00:00+09:00');
    expect(dday(maxSlides(src, early).find((one) => one.id === 'mm-0928')!)).toBe('D-5');
  });

  it('실데이터 전량 — 어느 날에 열어도 새는 글자가 없다', () => {
    const read = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/${name}.json`, import.meta.url), 'utf8'));
    const gameday = read('gameday');
    const dex = read('dex');
    const max = read('max');
    const real: MaxSlideSource = {
      events: gameday.GAMEDAY.events, names: dex.DEX_DATA.names, en: dex.DEX_DATA.en,
      forms: dex.DEX_DATA.forms, maxRows: max.DMAX_DATA.overall,
    };
    for (let day = 0; day < 60; day++) {
      const at = Date.parse('2026-09-01T09:00:00+09:00') + day * 24 * 60 * 60 * 1000;
      for (const slide of maxSlides(real, at)) {
        const text = [slide.label, slide.when, slide.hours, dday(slide), ...slide.bosses.map((one) => one.name)].join(' ');
        expect(text).not.toMatch(LEAK);
        for (const boss of slide.bosses) expect(Number.isFinite(boss.sprite)).toBe(true);
      }
    }
  });
});
