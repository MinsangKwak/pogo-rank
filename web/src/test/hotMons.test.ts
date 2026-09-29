'use strict';
// 이번 주 많이 본 포켓몬 — 번호를 이름표에 대고, 없는 번호는 버리고, 서버 순서를 지킨다 (lib/hotMons.ts)
import { describe, it, expect } from 'vitest';
import { rankMons, hotChannel, loadHotMons, passesToFill, HOT_MON_MAX, HOT_MON_WEEK, HOT_MON_ALL } from '../lib/hotMons';
import { fillBosses } from '../lib/weekBosses';
import type { MaxSlide } from '../lib/maxSlides';

const names = { '25': '피카츄', '150': '뮤츠', '6': '리자몽' };
const forms = { '25': { types: ['electric'] }, '150': { types: ['psychic'] } };

describe('rankMons', () => {
  it('이름표가 없으면 빈 줄 — 번호만으로는 안 그린다', () => {
    expect(rankMons([{ dex: 25, hits: 3, visitors: 2 }], undefined, undefined)).toEqual([]);
  });

  it('서버 순서 그대로 이름 · 타입을 붙이고, 이름표에 없는 번호 · 0 이하는 버린다', () => {
    const rows = rankMons([
      { dex: 150, hits: 4, visitors: 3 },
      { dex: 99999, hits: 9, visitors: 9 },
      { dex: 0, hits: 9, visitors: 9 },
      { dex: 25, hits: 2, visitors: 1 },
      { dex: 6, hits: 1, visitors: 1 },
    ], names, forms);
    expect(rows.map((row) => row.name)).toEqual(['뮤츠', '피카츄', '리자몽']);
    expect(rows[0]).toMatchObject({ dex: 150, visitors: 3, types: ['psychic'] });
    expect(rows[2]!.types).toEqual([]);
  });

  it('최대 줄 수에서 끊는다', () => {
    const many = Array.from({ length: 20 }, () => ({ dex: 25, hits: 1, visitors: 1 }));
    expect(rankMons(many, names, forms)).toHaveLength(HOT_MON_MAX);
    expect(rankMons(many, names, forms, 2)).toHaveLength(2);
  });
});

describe('hotChannel', () => {
  it('-dev 판은 dev 채널, 그 밖은 운영 — 수집기와 같은 규칙', () => {
    expect(hotChannel('v5.5.0-dev')).toBe('dev');
    expect(hotChannel('v5.5.0')).toBe('prod');
    expect(hotChannel(undefined)).toBe('prod');
  });
});

describe('loadHotMons — 이번 주가 비면 누적', () => {
  const body = (window: number, rows: { dex: number; hits: number; visitors: number }[]) => ({ window, generated: '', rows });
  it('이번 주에 줄이 있으면 그것으로 끝 — 한 번만 묻는다', async () => {
    const asked: number[] = [];
    const got = await loadHotMons('prod', async (days) => { asked.push(days); return body(days, [{ dex: 25, hits: 1, visitors: 1 }]); });
    expect(asked).toEqual([HOT_MON_WEEK]);
    expect(got.window).toBe(HOT_MON_WEEK);
  });
  it('이번 주가 비면 누적(400일)을 다시 묻고, 열 줄까지', async () => {
    const asked: number[] = [];
    const got = await loadHotMons('dev', async (days) => { asked.push(days); return body(days, days === HOT_MON_WEEK ? [] : [{ dex: 150, hits: 3, visitors: 2 }]); });
    expect(asked).toEqual([HOT_MON_WEEK, HOT_MON_ALL]);
    expect(got.rows[0]!.dex).toBe(150);
    expect(HOT_MON_MAX).toBe(10);
  });
});

describe('fillBosses — 남은 자리를 맥스 보스로', () => {
  const slide = (id: string, gmax: boolean, bosses: [number, string][]): MaxSlide => ({
    id, kind: 'monday', gmax, label: '', when: '', short: '', hours: '', live: false,
    bosses: bosses.map(([dex, name]) => ({ dex, sprite: dex, name, types: [] })),
  } as unknown as MaxSlide);
  const slides = [slide('a', false, [[816, '울머기'], [150, '뮤츠']]), slide('b', true, [[6, '리자몽'], [816, '울머기']])];

  it('가까운 장부터, 같은 종은 한 번, 순위에 선 번호는 빼고, 접두어로 상세를 연다', () => {
    const out = fillBosses(slides, 3, new Set([150]));
    expect(out.map((one) => one.detailName)).toEqual(['다이맥스 울머기', '거다이맥스 리자몽']);
    expect(out[1]!.gmax).toBe(true);
  });

  it('자리가 없으면 빈 줄, 자리만큼만', () => {
    expect(fillBosses(slides, 0)).toEqual([]);
    expect(fillBosses(slides, 1).map((one) => one.name)).toEqual(['울머기']);
  });
});

describe('passesToFill — 넓은 화면에서 폭을 채우는 바퀴 수', () => {
  it('한 바퀴가 칸보다 좁으면 올림으로, 넓거나 같으면 한 바퀴, 잴 수 없으면 한 바퀴', () => {
    expect(passesToFill(1400, 900)).toBe(2);
    expect(passesToFill(1400, 300)).toBe(5);
    expect(passesToFill(1400, 1400)).toBe(1);
    expect(passesToFill(1400, 2000)).toBe(1);
    expect(passesToFill(0, 300)).toBe(1);
    expect(passesToFill(1400, 0)).toBe(1);
    expect(passesToFill(9000, 100)).toBe(6);
  });
});
