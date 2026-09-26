import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { MAX_ART, maxArtFor } from '../lib/heroArt';
import { maxSlides } from '../lib/maxSlides';
import type { GamedayEvent } from '../types/data';

const unknown = 'max-battle-day-october-24-2026';

describe('맥스 배너 일정과 일러스트', () => {
  it('9월 현재 주간부터 10월 마지막 주까지 8개를 날짜순으로 보여 준다', () => {
    const weeks = [
      ['09-21', 144], ['09-28', 816], ['10-05', 850], ['10-12', 821],
      ['10-19', 215], ['10-26', 302],
    ] as const;
    const names = { '144': '프리져', '816': '울머기', '815': '에이스번', '850': '태우지네', '821': '파라꼬', '215': '포푸니', '302': '깜까미' };
    const events: GamedayEvent[] = weeks.map(([date, dex]) => ({
      id: `max-mondays-2026-${date}`, type: 'max-mondays', title: 'Max Monday',
      start: `2026-${date}T06:00:00`, end: `2026-${date}T21:00:00`, dex: [dex],
    }));
    events.push(
      { id: 'cinderace-day', type: 'max-battles', title: 'Gigantamax Cinderace Max Battle Day', start: '2026-10-03T14:00:00', end: '2026-10-03T17:00:00', dex: [815] },
      { id: unknown, type: 'max-battles', title: 'Dynamax Max Battle Day', start: '2026-10-24T14:00:00', end: '2026-10-24T17:00:00' },
    );
    const slides = maxSlides({ events, names, en: undefined, forms: undefined }, Date.parse('2026-09-25T12:00:00+09:00'));
    expect(slides.map((slide) => slide.bosses.map((boss) => boss.dex))).toEqual([[144], [816], [815], [850], [821], [215], [], [302]]);
    const art = slides.map((slide) => maxArtFor(slide.bosses.map((boss) => boss.dex), slide.id));
    expect(art.every(Boolean)).toBe(true);
    expect(new Set(art.map((one) => one?.src)).size).toBe(8);
    expect(slides.at(-1)?.short).toBe('10.26–11.1');
  });

  it('미공개 보스 이미지는 해당 행사에만 붙고 발표된 보스를 가리지 않는다', () => {
    expect(maxArtFor([], unknown)?.dex).toEqual([]);
    expect(maxArtFor([])).toBeUndefined();
    expect(maxArtFor([], 'other-event')).toBeUndefined();
    expect(maxArtFor([25], unknown)).toBeUndefined();
    expect(maxArtFor([302], unknown)?.dex).toEqual([302]);
  });

  it('모든 반응형 이미지 파일이 실제 존재한다', () => {
    for (const art of [...MAX_ART, maxArtFor([], unknown)!]) {
      for (const candidate of art.srcSet.split(',')) {
        const path = candidate.trim().split(' ')[0]!;
        expect(existsSync(new URL(`../../public/${path.replace(/^\//, '')}`, import.meta.url)), path).toBe(true);
      }
    }
  });
});
