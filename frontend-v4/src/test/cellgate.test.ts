// ─────────────────────────────────────────────────────────────────────────────
// test/cellgate.test.ts — 관문 자체를 검사한다
//
// rankcells 는 **관문을 쓰는 쪽**(순위표 칸)을 본다. 관문 자체는 아무도 안 보고 있었다.
// 2026-09-21 스토리북에 빈 값을 늘어놓는 판(`parts-value--leaky`)을 세우자 세 군데가 드러났다 —
//   word(NaN)       → 'NaN'              LEAK 이 잡으라고 적어 둔 바로 그 글자
//   word({})        → '[object Object]'  같다
//   num('   ')      → '0'                없는 값이 "0 이다" 라는 거짓말로 나갔다
// 화면은 관문을 지나므로 관문이 새면 그물 셋이 다 소용없다. 여기서 못 박는다.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { DASH, LEAK, lines, num, word } from '../lib/cell';

// 화면에 절대 못 나가는 값들. lib/cell.ts 의 LEAK 과 같은 목록이다
const BROKEN: [string, unknown][] = [
  ['undefined', undefined],
  ['null', null],
  ['NaN', Number.NaN],
  ['Infinity', Number.POSITIVE_INFINITY],
  ['-Infinity', Number.NEGATIVE_INFINITY],
  ['빈 문자열', ''],
  ['공백만', '   '],
  ['객체', {}],
  ['배열', []],
  ['불리언', true],
  ['숫자 아닌 글자', '약 300'],
];

describe('num — 숫자 칸', () => {
  it.each(BROKEN)('%s 는 대시로 접힌다', (_name, value) => {
    expect(num(value)).toBe(DASH);
  });

  it('성한 값은 그대로 편다', () => {
    expect(num(248180)).toBe('248180');
    expect(num('93.4')).toBe('93.4');
    expect(num(0)).toBe('0');       // 0 은 없는 값이 아니다 — 대시로 접으면 안 된다
    expect(num(-1)).toBe('-1');
  });

  it('digits 를 주면 자릿수를 맞춘다', () => {
    expect(num(93.42, 1)).toBe('93.4');
    expect(num(Number.NaN, 1)).toBe(DASH);
  });
});

describe('word — 글자 칸', () => {
  it.each(BROKEN)('%s 는 대시로 접힌다', (_name, value) => {
    // '약 300' 은 글자로는 성하다 — 숫자 칸에서만 대시다
    if (value === '약 300') { expect(word(value)).toBe('약 300'); return; }
    expect(word(value)).toBe(DASH);
  });

  it('성한 글자는 앞뒤 공백만 떼고 그대로 둔다', () => {
    expect(word(' 맥스 너클 ')).toBe('맥스 너클');
  });

  it('유한한 숫자는 글자로 편다', () => {
    expect(word(248180)).toBe('248180');
    expect(word(0)).toBe('0');
  });
});

describe('lines — 보조줄', () => {
  it('빈 줄은 대시로 때우지 않고 걷어낸다', () => {
    expect(lines(undefined, '내구 2,140', '', '   ', null)).toEqual(['내구 2,140']);
  });

  it('남는 줄이 없으면 빈 묶음이다', () => {
    expect(lines(undefined, null, '  ')).toEqual([]);
  });
});

describe('LEAK — 잣대', () => {
  it('관문을 지난 글자는 하나도 안 걸린다', () => {
    const all = [...BROKEN.map(([, value]) => num(value)), ...BROKEN.map(([, value]) => word(value))];
    expect(all.filter((one) => LEAK.test(one))).toEqual([]);
  });
});
