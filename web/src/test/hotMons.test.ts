'use strict';
// 이번 주 많이 본 포켓몬 — 번호를 이름표에 대고, 없는 번호는 버리고, 서버 순서를 지킨다 (lib/hotMons.ts)
import { describe, it, expect } from 'vitest';
import { rankMons, hotChannel, loadHotMons, hotMonsCaption, HOT_MON_MAX, HOT_MON_WEEK, HOT_MON_ALL, HOT_MON_HOURS } from '../lib/hotMons';
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

describe('loadHotMons — 최근 1시간 → 이번 주 → 누적', () => {
  const body = (days: number, hours: number | undefined, rows: { dex: number; hits: number; visitors: number }[]) => ({ window: hours ? 0 : days, ...(hours ? { hours } : {}), generated: '', rows });
  it('최근 1시간에 줄이 있으면 그것으로 끝 — 한 번만 묻는다', async () => {
    const asked: string[] = [];
    const got = await loadHotMons('prod', async (days, _limit, _ch, hours) => { asked.push(hours ? `h${hours}` : `d${days}`); return body(days, hours, [{ dex: 25, hits: 1, visitors: 1 }]); });
    expect(asked).toEqual([`h${HOT_MON_HOURS}`]);
    expect(got.hours).toBe(HOT_MON_HOURS);
  });
  it('한 시간이 비면 이번 주, 그마저 비면 누적(400일)을 묻고, 열 줄까지', async () => {
    const asked: string[] = [];
    const got = await loadHotMons('dev', async (days, _limit, _ch, hours) => { asked.push(hours ? `h${hours}` : `d${days}`); return body(days, hours, !hours && days === HOT_MON_ALL ? [{ dex: 150, hits: 3, visitors: 2 }] : []); });
    expect(asked).toEqual([`h${HOT_MON_HOURS}`, `d${HOT_MON_WEEK}`, `d${HOT_MON_ALL}`]);
    expect(got.rows[0]!.dex).toBe(150);
    expect(HOT_MON_MAX).toBe(10);
  });
});

describe('hotMonsCaption — 어느 창을 보여 주는지', () => {
  it('시간 창 · 날 창 · 누적 · 보스만', () => {
    expect(hotMonsCaption({ window: 0, hours: 1 }, true)).toBe('총 수집기간 7일 · 화면 표시 최근 1시간');
    expect(hotMonsCaption({ window: 7 }, true)).toBe('총 수집기간 7일 · 화면 표시 최근 7일');
    expect(hotMonsCaption({ window: 400 }, true)).toBe('총 수집기간 7일 · 화면 표시 누적');
    expect(hotMonsCaption({ window: 0, hours: 1 }, false)).toBe('이번 시즌 맥스 배틀 보스');
    expect(hotMonsCaption(null, false)).toBe('이번 시즌 맥스 배틀 보스');
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

  it('씨앗이 있으면 임의의 순서 — 같은 씨앗이면 같은 순서, 종은 그대로 셋', () => {
    const a = fillBosses(slides, 3, new Set(), 42).map((one) => one.dex);
    const b = fillBosses(slides, 3, new Set(), 42).map((one) => one.dex);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([150, 6, 816].sort());
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => fillBosses(slides, 3, new Set(), seed).map((one) => one.dex).join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });
});
