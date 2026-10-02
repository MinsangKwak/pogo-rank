// 월 일정표 병합 — 손으로 적은 줄이 이기고 자동분은 빈 자리만 채운다 (v4.7.2 WBS-224).
// 실제 꾸러미(public/data/schedule.json)가 있으면 그 줄 전량도 훑는다 — 화면이 먹는 모양 그대로
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { KOREA_PLACES, mergeSchedule, stripRegionTitles, titlesForRegion } from '../../scripts/merge-schedule.mjs';
import { weekBoss } from '../lib/schedule';
import type { ScheduleMonth, ScheduleItem } from '../types/data';

const month = (y: number, m: number, items: ScheduleItem[], note = '손'): ScheduleMonth => ({ ym: { y, m }, note, items });

describe('mergeSchedule', () => {
  it('같은 분류·같은 날짜면 손 줄이 남고 자동 줄은 버린다', () => {
    const hand = { '2026-10': month(2026, 10, [{ s: 3, e: 3, cat: 'event', label: '거다이맥스 에이스번 맥스배틀 데이 (14–17시)', source: 'https://x' }]) };
    const auto = { '2026-10': month(2026, 10, [
      { s: 3, e: 3, cat: 'event', label: '거다이맥스 에이스번 맥스 배틀 데이', auto: true },
      { s: 13, e: 19, cat: 'event', label: 'Fall Marathon: Buddy Trek', auto: true },
    ], '자동') };
    const out = mergeSchedule(hand, auto)['2026-10']!;
    expect(out.items.map((one) => one.label)).toEqual(['거다이맥스 에이스번 맥스배틀 데이 (14–17시)', 'Fall Marathon: Buddy Trek']);
    expect(out.items[0]?.source).toBe('https://x');
    expect(out.note).toContain('LeekDuck');
  });

  it('보스 분류는 날짜가 겹치기만 해도 손 줄이 이긴다', () => {
    const hand = { '2026-09': month(2026, 9, [{ s: 30, e: 30, cat: 'raid5', label: '제르네아스 (9/30~10/6)' }]) };
    const auto = { '2026-09': month(2026, 9, [
      { s: 30, e: 30, cat: 'raid5', label: '제르네아스', auto: true },
      { s: 23, e: 29, cat: 'raid5', label: '매시붕 · 페로코체 · 전수목', auto: true },
      { s: 16, e: 22, cat: 'mega', label: '메가 이상해꽃', auto: true },
    ]) };
    const out = mergeSchedule(hand, auto)['2026-09']!;
    // 분류 순서(raid5 → mega) 뒤 시작일 순
    expect(out.items.map((one) => `${one.cat} ${one.s}`)).toEqual(['raid5 23', 'raid5 30', 'mega 16']);
    expect(out.items.find((one) => one.s === 30)?.label).toBe('제르네아스 (9/30~10/6)');
  });

  it('한쪽에만 있는 달은 통째로 들어오고 안내문은 그대로다 — 손 표 이전 달은 세우지 않는다', () => {
    const hand = { '2026-09': month(2026, 9, [{ s: 1, e: 1, cat: 'event', label: '손' }]) };
    const auto = {
      '2026-08': month(2026, 8, [{ s: 3, e: 31, cat: 'event', label: 'LEGO Stores and Pokémon GO', auto: true }], '자동'),
      '2026-11': month(2026, 11, [{ s: 1, e: 5, cat: 'event', label: 'Halloween 2026 Part II', auto: true }], '자동'),
    };
    const out = mergeSchedule(hand, auto);
    expect(Object.keys(out)).toEqual(['2026-09', '2026-11']);
    expect(out['2026-09']!.note).toBe('손');
    expect(out['2026-11']!.note).toBe('자동');
  });

  it('자동분이 없으면 손 표 그대로', () => {
    const hand = { '2026-09': month(2026, 9, []) };
    expect(mergeSchedule(hand, undefined)).toEqual(hand);
    expect(mergeSchedule(hand, {})).toEqual(hand);
  });

  it('자동 dmax 줄만 있어도 이번 주 보스가 선다', () => {
    const auto = { '2026-10': month(2026, 10, [{ s: 5, e: 11, cat: 'dmax', label: 'D-MAX 태우지네 (맥스 먼데이 10/5)', t: 'fire', auto: true }]) };
    const out = mergeSchedule({}, auto);
    expect(weekBoss(out, new Date(2026, 9, 7))).toEqual({ type: 'fire', label: '태우지네', now: true });
  });
});

// 실데이터 전량을 본다 — 빌드가 표 모양을 바꾸면 여기서 빨개진다.
// 꾸러미(public/data, npm run data 뒤)를 먼저 보고, 없으면 v3 빌드 원본(data/schedule.json)을 본다 —
// CI 는 npm test 를 npm run data 보다 먼저 돌려 그 시점엔 원본만 있다 (datasweep 과 같은 판단).
// 읽기는 검사 안에서 한다 — describe 의 몸통은 skipIf 여도 실행된다
const bundle = resolve(__dirname, '../../public/data/schedule.json');
const raw = resolve(__dirname, '../../../data/schedule.json');
const CATS = ['event', 'raid5', 'mega', 'dmax', 'hour', 'shadow'];
// 한국 표와 유럽 표(2026-10-01 지역 토글)를 같은 잣대로 본다 — 화면은 둘 중 하나를 그대로 그린다
type Tables = Record<string, Record<string, ScheduleMonth>>;
function source(): { where: string; tables: Tables; cats: string[] } | null {
  if (existsSync(bundle)) {
    const data = JSON.parse(readFileSync(bundle, 'utf-8'));
    return { where: 'public/data', tables: { kr: data.SCHEDULE_MONTHS, eu: data.SCHEDULE_MONTHS_EU ?? {} }, cats: Object.keys(data.SCHEDULE_CATS) };
  }
  if (existsSync(raw)) {
    const data = JSON.parse(readFileSync(raw, 'utf-8'));
    return { where: 'data', tables: { kr: data.months, eu: data.months_eu ?? {} }, cats: CATS };
  }
  return null;
}

describe.skipIf(!existsSync(bundle) && !existsSync(raw))('실데이터 — 일정표 전량', () => {
  it('모든 줄이 날짜·분류·제목을 갖춘다', () => {
    const src = source()!;
    const bad: string[] = [];
    for (const [key, one] of Object.entries(src.tables).flatMap(([region, months]) => Object.entries(months).map(([ym, month]) => [`${region} ${ym}`, month] as const))) {
      const ym = key.split(' ')[1]!;
      const [y, m] = ym.split('-').map(Number);
      if (one.ym.y !== y || one.ym.m !== m) bad.push(`${key} ym 불일치`);
      const last = new Date(y!, m!, 0).getDate();
      for (const item of one.items) {
        if (!Number.isInteger(item.s) || !Number.isInteger(item.e) || item.s < 1 || item.e > last || item.s > item.e) bad.push(`${key} ${item.label} 날짜 ${item.s}–${item.e}`);
        if (!src.cats.includes(item.cat)) bad.push(`${key} ${item.label} 분류 ${item.cat}`);
        if (!item.label || /undefined|NaN|null|\[object/.test(item.label)) bad.push(`${key} 제목 '${item.label}'`);
        if (item.source && !/^https?:\/\//.test(item.source)) bad.push(`${key} ${item.label} source '${item.source}'`);
      }
    }
    expect(Object.keys(src.tables['kr'] ?? {}).length, src.where).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

// 2026-10-01 지역 토글 — 유럽 달력도 공식 한국어 제목을 쓴다 (주인 제보: 'EU 를 누르면 영어로 바뀐다').
// 제목 · 출처만 옮기고 날짜는 유럽 것을 지킨다, 한국 한정 손 줄은 옮기지 않는다 (Codex, PR #290)
describe('유럽 달력의 한국어 제목', () => {
  const ym = { y: 2026, m: 10 };
  const hand = { '2026-10': { ym, note: '', items: [
    { s: 1, e: 5, cat: 'event', label: '수확 축제: 과사삭벌레 모으기 (9/29 10시 ~ 10/5 20시)', source: 'https://pokemongo.com/ko/news/harvest-festival-2026' },
    { s: 1, e: 11, cat: 'event', label: '피카츄의 가을 소풍 (9/18~10/11 · 서울 종로·중구, 인천공항 한정)' },
    { s: 23, e: 29, cat: 'raid5', label: '울트라비스트 — 한국(아시아·태평양): 전수목' },
    { s: 12, e: 12, cat: 'event', label: '대구 사파리 존' },
  ] } };
  const autoKr = { '2026-10': { ym, note: '', items: [
    { s: 1, e: 5, cat: 'event', label: 'Harvest Festival 2026: Applin Picking', auto: true },
    { s: 23, e: 29, cat: 'raid5', label: '매시붕 · 페로코체 · 전수목', auto: true },
    { s: 12, e: 12, cat: 'event', label: 'Safari Zone: Daegu', auto: true },
  ] } };
  // UTC 행사라 유럽은 하루 앞선다고 치자 — 날짜는 유럽 것이 그대로 남아야 한다
  const autoEu = { '2026-10': { ym, note: 'CET', items: [
    { s: 1, e: 4, cat: 'event', label: 'Harvest Festival 2026: Applin Picking', auto: true },
    { s: 23, e: 29, cat: 'raid5', label: '매시붕 · 페로코체 · 전수목', auto: true },
  ] } };
  const eu = titlesForRegion(hand, autoKr, autoEu)['2026-10']!.items;
  it('제목 · 출처만 옮기고 날짜는 유럽 것', () => {
    expect(eu[0]).toEqual({ s: 1, e: 4, cat: 'event', auto: true, label: '수확 축제: 과사삭벌레 모으기 (9/29 10시 ~ 10/5 20시)', source: 'https://pokemongo.com/ko/news/harvest-festival-2026' });
  });
  it('한국 한정 손 줄(서울 · 아시아 · 대구 …)은 옮기지 않는다', () => {
    expect(eu[1]!.label).toBe('매시붕 · 페로코체 · 전수목');
    expect(eu.map((item) => item.label).join(' ')).not.toMatch(/대구|서울|아시아/);
  });
  it('짝은 행사 한 번 단위 — 다른 달의 같은 원제에는 붙지 않는다 (Codex, PR #290)', () => {
    const one = (m: number, s: number) => ({ ym: { y: 2026, m }, note: '', items: [{ s, e: s, cat: 'event', label: '슈퍼 메가 레이드 데이', auto: true }] });
    const handOct = { '2026-10': { ym, note: '', items: [{ s: 31, e: 31, cat: 'event', label: '슈퍼 메가 레이드 데이 (날짜 확정 · 세부 내용 미발표)', source: 'https://pokemongo.com/ko/news/save-the-date-s24' }] } };
    const autoBoth = { '2026-10': one(10, 31), '2026-11': one(11, 28) };
    const out = titlesForRegion(handOct, autoBoth, autoBoth);
    expect(out['2026-10']!.items[0]!.label).toBe('슈퍼 메가 레이드 데이 (날짜 확정 · 세부 내용 미발표)');
    expect(out['2026-11']!.items[0]).toEqual({ s: 28, e: 28, cat: 'event', label: '슈퍼 메가 레이드 데이', auto: true });
  });
  it('달이 갈린 같은 행사도 짝짓는다 — 한국 3/1 · 유럽 2/28 (Codex, PR #291)', () => {
    const at = (m: number, s: number, label: string, extra = {}) => ({ ym: { y: 2027, m }, note: '', items: [{ s, e: s, cat: 'event', label, ...extra }] });
    const handMar = { '2027-03': at(3, 1, '커뮤니티 데이 (14–17시)', { source: 'https://pokemongo.com/ko/news/x' }) };
    const autoKrMar = { '2027-03': at(3, 1, 'Community Day', { auto: true }) };
    const autoEuFeb = { '2027-02': at(2, 28, 'Community Day', { auto: true }) };
    expect(titlesForRegion(handMar, autoKrMar, autoEuFeb)['2027-02']!.items[0]).toEqual({ s: 28, e: 28, cat: 'event', auto: true, label: '커뮤니티 데이 (14–17시)', source: 'https://pokemongo.com/ko/news/x' });
  });
  it('지역 제목(eu)이 있으면 한국 한정 손 줄이어도 유럽 달력에 그 제목을 단다 · 한국 표에서는 뗀다', () => {
    const at = (label: string, extra = {}) => ({ '2026-10': { ym, note: '', items: [{ s: 24, e: 24, cat: 'event', label, ...extra }] } });
    const handDay = at('다이맥스 유크시 맥스배틀 데이 (한국은 유크시)', { eu: '다이맥스 엠라이트 맥스배틀 데이' });
    const auto = at('Dynamax Max Battle Day', { auto: true });
    expect(titlesForRegion(handDay, auto, auto)['2026-10']!.items[0]!.label).toBe('다이맥스 엠라이트 맥스배틀 데이');
    expect(stripRegionTitles(handDay)['2026-10']!.items[0]).not.toHaveProperty('eu');
  });
  it('같은 행사가 두 원제로 남아도 한국어 제목을 단 뒤 한 줄만 둔다', () => {
    const handHatch = { '2026-10': { ym, note: '', items: [{ s: 17, e: 17, cat: 'event', label: '깜눈크 부화데이 (11–17시)' }] } };
    const auto = { '2026-10': { ym, note: '', items: [
      { s: 17, e: 17, cat: 'event', label: 'Hatch Day', auto: true },
      { s: 17, e: 17, cat: 'event', label: 'Sandile Hatch Day', auto: true },
    ] } };
    expect(titlesForRegion(handHatch, auto, auto)['2026-10']!.items.map((item) => item.label)).toEqual(['깜눈크 부화데이 (11–17시)']);
  });
  it('한국 한정 장소 목록이 백엔드(PLACE_REGION kr)와 같다', () => {
    const py = readFileSync(resolve(__dirname, '../../../backend/schedule_build.py'), 'utf-8');
    const kr = py.match(/'kr':\s*\[([^\]]*)\]/)?.[1] ?? '';
    const cities = [...kr.matchAll(/'([^']+)'/g)].map((one) => one[1]);
    expect(cities.length).toBeGreaterThan(5);
    expect(cities.filter((city) => !(city! in KOREA_PLACES))).toEqual([]);
  });
  it.skipIf(!existsSync(bundle))('실데이터 — 유럽 달력의 영문 제목은 한국 달력에도 영문이거나 유럽에만 있는 것뿐, 한국 한정 손 줄은 없다', () => {
    const data = JSON.parse(readFileSync(bundle, 'utf-8'));
    const items = (months: Record<string, ScheduleMonth>) => Object.values(months).flatMap((month) => month.items);
    const krLabels = new Set(items(data.SCHEDULE_MONTHS).map((item) => item.label));
    const krEnglish = new Set([...krLabels].filter((label) => !/[가-힣]/.test(label)));
    const euEnglish = items(data.SCHEDULE_MONTHS_EU).filter((item) => !/[가-힣]/.test(item.label) && krLabels.has(item.label));
    expect(euEnglish.filter((item) => !krEnglish.has(item.label)).map((item) => item.label)).toEqual([]);
    expect(items(data.SCHEDULE_MONTHS_EU).filter((item) => /서울|인천|아시아/.test(item.label)).map((item) => item.label)).toEqual([]);
  });
});
