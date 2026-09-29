'use strict';
// 이번 주 많이 본 포켓몬 — 번호를 이름표에 대고, 없는 번호는 버리고, 서버 순서를 지킨다 (lib/hotMons.ts)
import { describe, it, expect } from 'vitest';
import { rankMons, hotChannel, HOT_MON_MAX } from '../lib/hotMons';

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
