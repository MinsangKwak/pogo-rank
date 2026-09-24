// 정규화 — 모양은 맞지만 뜻이 없는 줄을 표에 남기지 않는다
'use strict';
import { describe, it, expect } from 'vitest';
import { toRows } from '../lib/normalize.ts';

const now = new Date('2026-09-21T12:00:00Z');

describe('줄 만들기', () => {
  it('검색어가 없는 search 는 버린다 — 무엇을 찾았는지 모르는 검색은 셀 것이 없다', () => {
    const rows = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search' }] }, 'KR', now);
    expect(rows).toHaveLength(0);
  });

  it('공백만 있는 검색어도 버린다', () => {
    const rows = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search', term: '   ' }] }, 'KR', now);
    expect(rows).toHaveLength(0);
  });

  it("'뮤츠' 와 '뮤츠 ' 가 같은 말로 세어진다 — 안 그러면 순위가 갈라진다", () => {
    const [a] = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search', term: ' 뮤츠 ' }] }, 'KR', now);
    const [b] = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search', term: '뮤츠' }] }, 'KR', now);
    expect(a?.term).toBe(b?.term);
    expect(a?.term).toBe('뮤츠');
  });

  it('줄바꿈과 연속 공백은 한 칸으로 모은다', () => {
    const [row] = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search', term: '거다이맥스\n\n 잠만보' }] }, 'KR', now);
    expect(row?.term).toBe('거다이맥스 잠만보');
  });

  it('긴 검색어는 100자에서 자른다 — 붙여넣기 사고를 표까지 들이지 않는다', () => {
    const [row] = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search', term: '가'.repeat(500) }] }, 'KR', now);
    expect(row?.term).toHaveLength(100);
  });

  it('채널을 안 적으면 prod 다. dev 는 적어야 dev 다', () => {
    const term = { name: 'search', term: '뮤츠' } as const;
    expect(toRows({ visitor: 'v'.repeat(32), events: [term] }, 'KR', now)[0]?.channel).toBe('prod');
    expect(toRows({ visitor: 'v'.repeat(32), channel: 'dev', events: [term] }, 'KR', now)[0]?.channel).toBe('dev');
  });

  it('브라우저 시계가 크게 틀어졌으면 시각만 버리고 줄은 살린다', () => {
    const far = { name: 'search', term: '뮤츠', ts: '2019-01-01T00:00:00Z' } as const;
    const [row] = toRows({ visitor: 'v'.repeat(32), events: [far] }, 'KR', now);
    expect(row).toBeDefined();
    expect(row?.occurred_at).toBeNull();
  });

  it('쓸 만한 시각은 그대로 남긴다', () => {
    const near = { name: 'search', term: '뮤츠', ts: '2026-09-21T11:59:00Z' } as const;
    const [row] = toRows({ visitor: 'v'.repeat(32), events: [near] }, 'KR', now);
    expect(row?.occurred_at?.toISOString()).toBe('2026-09-21T11:59:00.000Z');
  });

  it('만든 줄에 IP 를 담을 칸 자체가 없다', () => {
    const [row] = toRows({ visitor: 'v'.repeat(32), events: [{ name: 'search', term: '뮤츠' }] }, 'KR', now);
    expect(Object.keys(row ?? {})).toEqual(
      ['name', 'visitor', 'term', 'surface', 'country', 'channel', 'occurred_at'],
    );
  });
});

describe('페이지뷰 (2026-09-24) — 화면 id 하나만 남긴다', () => {
  const visitor = 'v'.repeat(32);

  it('화면 id 하나만 남긴다 — 글은 안 남긴다', () => {
    const [row] = toRows({ visitor, events: [{ name: 'view', surface: 'dmax', term: '몰래 실은 글' }] }, 'KR', now);
    expect(row).toMatchObject({ name: 'view', surface: 'dmax', term: null, country: 'KR' });
  });

  it('화면 id 꼴이 아니면 버린다 — 주소 · 질의가 섞여 들어오지 못한다', () => {
    for (const surface of ['/mon/25', 'dex?b=1', 'Dex', 'a b']) {
      expect(toRows({ visitor, events: [{ name: 'view', surface }] }, 'KR', now)).toEqual([]);
    }
    expect(toRows({ visitor, events: [{ name: 'view' }] }, 'KR', now)).toEqual([]);
  });
});
