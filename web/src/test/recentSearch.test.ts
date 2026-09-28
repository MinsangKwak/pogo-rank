'use strict';
// 최근 검색 — 이 브라우저에만, 같은 이름은 하나, 여덟 개까지, 깨진 값은 빈 목록 (lib/recentSearch.ts)
import { describe, it, expect } from 'vitest';
import { readRecent, withRecent, pushRecent, clearRecent, RECENT_KEY, RECENT_MAX } from '../lib/recentSearch';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    map,
  };
}

describe('최근 검색', () => {
  it('맨 앞에 넣고 같은 이름은 하나만, 한도를 넘으면 꼬리를 버린다', () => {
    let list = withRecent([], { sprite: 25, name: '피카츄' });
    list = withRecent(list, { sprite: 6, name: '리자몽' });
    list = withRecent(list, { sprite: 25, name: '피카츄' });
    expect(list.map((one) => one.name)).toEqual(['피카츄', '리자몽']);
    for (let i = 0; i < RECENT_MAX + 3; i += 1) list = withRecent(list, { sprite: 100 + i, name: `#${i}` });
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0]!.name).toBe(`#${RECENT_MAX + 2}`);
  });
  it('깨진 값 · 없는 값 · 막힌 저장소는 빈 목록이다', () => {
    expect(readRecent(fakeStorage({ [RECENT_KEY]: 'not json' }))).toEqual([]);
    expect(readRecent(fakeStorage({ [RECENT_KEY]: '{"a":1}' }))).toEqual([]);
    expect(readRecent(fakeStorage({ [RECENT_KEY]: '[{"sprite":"x","name":"y"},{"sprite":1,"name":""},{"sprite":3,"name":"좋아"}]' }))).toEqual([{ sprite: 3, name: '좋아' }]);
    expect(readRecent(fakeStorage())).toEqual([]);
    expect(readRecent(null)).toEqual([]);
    expect(readRecent({ getItem: () => { throw new Error('blocked'); } })).toEqual([]);
  });
  it('넣고 읽고 지운다 — 저장소를 거쳐도 같은 목록', () => {
    const storage = fakeStorage();
    pushRecent({ sprite: 25, name: '피카츄' }, storage);
    const list = pushRecent({ sprite: 6, name: '리자몽' }, storage);
    expect(list).toEqual(readRecent(storage));
    expect(readRecent(storage).map((one) => one.name)).toEqual(['리자몽', '피카츄']);
    clearRecent(storage);
    expect(readRecent(storage)).toEqual([]);
    // setItem 이 던져도 이번 목록은 돌려준다
    const blocked = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(pushRecent({ sprite: 1, name: '이상해씨' }, blocked)).toEqual([{ sprite: 1, name: '이상해씨' }]);
  });
});
