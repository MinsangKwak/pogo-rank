'use strict';
// 맥스 표에서 보일 줄 — 미구현 · 맥스 참가는 체크가 켜져야 보인다 (lib/maxVisible.ts)
import { describe, expect, it } from 'vitest';
import { maxVisible } from '../lib/maxVisible';

const rows = [
  { name: '거다이맥스 리자몽' },
  { name: '맥스 참가 검왕 자시안', join: true },
  { name: '거다이맥스 두랄루돈', unrel: true },
  { name: '다이맥스 두랄루돈', soon: '2026-11-14' },
];

describe('maxVisible', () => {
  it('기본은 다이맥스 · 거다이맥스 출시분만', () => {
    expect(maxVisible(rows).map((row) => row.name)).toEqual(['거다이맥스 리자몽', '다이맥스 두랄루돈']);
    expect(maxVisible(undefined)).toEqual([]);
  });
  it('체크마다 따로 켠다', () => {
    expect(maxVisible(rows, { join: true }).map((row) => row.name)).toEqual(['거다이맥스 리자몽', '맥스 참가 검왕 자시안', '다이맥스 두랄루돈']);
    expect(maxVisible(rows, { unrel: true }).map((row) => row.name)).toEqual(['거다이맥스 리자몽', '거다이맥스 두랄루돈', '다이맥스 두랄루돈']);
    expect(maxVisible(rows, { unrel: true, join: true })).toHaveLength(4);
  });
  it('now 면 출시 예정 줄도 뺀다 — 덱 짜기는 지금 데려갈 수 있는 것만', () => {
    expect(maxVisible(rows, { now: true }).map((row) => row.name)).toEqual(['거다이맥스 리자몽']);
    expect(maxVisible(rows, { join: true, now: true }).map((row) => row.name)).toEqual(['거다이맥스 리자몽', '맥스 참가 검왕 자시안']);
  });
});
