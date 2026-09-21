// ─────────────────────────────────────────────────────────────────────────────
// test/favnews.test.ts — 담아 둔 포켓몬에 일정이 실제로 걸리는가 (2026-09-21 v4.9.1)
//
// **꾸러미를 그대로 읽는다.** 맥스 먼데이가 소식에 한 건도 안 뜬 사고(제보)는 화면이 아니라
// 데이터에서 났다 — 이벤트 줄에 dex 가 비어 있었다. 함수만 검사하면 그 구멍을 못 본다.
// 플래너 화면은 로그인 뒤에만 열려 화면 훑기(check_screens.mjs)가 못 가는 자리이기도 하다.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { favNewsList, favNewsWhen, FAV_NEWS_LABEL } from '../lib/favnews';
import type { FavEvent } from '../types/data';

// 빌드를 안 돌린 환경에서는 꾸러미가 없다 — datasweep 과 같은 판단
const PATH = resolve(__dirname, '../../public/data/fav-events.json');
const BUNDLE: { FAV_EVENTS?: FavEvent[] } = existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf-8')) : {};
const EVENTS = BUNDLE.FAV_EVENTS ?? [];

describe('즐겨찾기 소식 — 실데이터', () => {
  it.skipIf(!EVENTS.length)('맥스 먼데이·맥스 배틀 데이에 걸린 종이 있다', () => {
    const max = EVENTS.filter((one) => String(one.type ?? '').startsWith('max-'));
    expect(max.length).toBeGreaterThan(0);
    // 종이 안 적힌 제목('Dynamax Max Battle Day')도 있어 전부는 아니지만, 하나도 없으면 그때가 사고다
    expect(max.filter((one) => (one.dex ?? []).length).length).toBeGreaterThan(0);
  });

  it.skipIf(!EVENTS.length)('그 종을 담으면 소식에 걸린다', () => {
    const withDex = EVENTS.filter((one) => String(one.type ?? '').startsWith('max-') && (one.dex ?? []).length);
    for (const event of withDex) {
      const rows = favNewsList(EVENTS, [event.dex![0]!]);
      expect(rows.some((row) => row.event.id === event.id)).toBe(true);
    }
  });

  // 라벨이 없으면 화면이 '일정' 으로 뭉뚱그린다 — 종류를 늘리면 이 표도 같이 늘려야 한다
  it.skipIf(!EVENTS.length)('실데이터에 나오는 모든 종류에 라벨이 있다', () => {
    const kinds = [...new Set(EVENTS.map((one) => String(one.type ?? '')))];
    expect(kinds.filter((kind) => !FAV_NEWS_LABEL[kind])).toEqual([]);
  });
});

describe('즐겨찾기 소식 — 읽는 말', () => {
  const at = (start: string, end: string): FavEvent =>
    ({ id: 'x', title: 't', type: 'max-mondays', start, end } as FavEvent);

  it('시작했고 아직 안 끝났으면 진행 중', () => {
    const now = Date.now();
    const rows = favNewsList([at(new Date(now - 3600e3).toISOString(), new Date(now + 3600e3).toISOString())], []);
    expect(rows).toEqual([]);   // 담은 것이 없으면 한 줄도 없다
  });

  it('오늘 시작해 지났으면 진행 중, 아직이면 오늘', () => {
    const now = Date.now();
    expect(favNewsWhen({ event: at('', ''), dex: [1], start: now - 1000, days: 0 })).toBe('진행 중');
    expect(favNewsWhen({ event: at('', ''), dex: [1], start: now + 3600e3, days: 0 })).toBe('오늘');
  });
});
