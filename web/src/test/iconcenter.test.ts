'use strict';
// 아이콘 단추 세로 중앙 — 도트 아이콘의 잉크를 12칸 가운데로, 즐겨찾기 별은 글자가 아닌 SVG (2026-09-30 주인 요청)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pxInkShift } from '../components/PxIcon';

describe('도트 아이콘 잉크 가운데', () => {
  const rows = (from: number, to: number) => Array.from({ length: 12 }, (_, y) => (y >= from && y <= to ? '..######....' : '............'));
  it('위아래 빈 줄이 같으면 옮기지 않는다', () => {
    expect(pxInkShift(rows(5, 6))).toBe(0);
    expect(pxInkShift(rows(2, 9))).toBe(0);
  });
  it('아래가 비면 보기 창을 올려(음수) 그림을 내린다 · 위가 비면 반대', () => {
    // 0~7 줄을 칠함 → 잉크 가운데 4 · 칸 가운데 6 → 창을 -2 옮겨 그림이 2칸 내려온다
    expect(pxInkShift(rows(0, 7))).toBe(-2);
    // 3~11 줄 → 잉크 가운데 7.5 → +1.5
    expect(pxInkShift(rows(3, 11))).toBe(1.5);
    expect(pxInkShift(rows(0, 11))).toBe(0);
  });
  it('빈 그림 · 짧은 표도 NaN 없이 선다', () => {
    expect(pxInkShift([])).toBe(0);
    // 1번 줄 하나 → 잉크 가운데 1.5 · 칸 가운데 6
    expect(pxInkShift(['....', '.##.'])).toBe(-4.5);
  });
});

describe('즐겨찾기 별은 SVG', () => {
  it('글자 ★ · ☆ 로 그리지 않는다 — 운영체제 글꼴마다 높이가 달라 Windows 에서 떴다', () => {
    const src = readFileSync(new URL('../screens/MonDetail.tsx', import.meta.url), 'utf8');
    const star = /className="detail__fav-star"[^>]*>([\s\S]*?)<\/(svg|span)>/.exec(src);
    expect(star?.[2]).toBe('svg');
    expect(src).not.toMatch(/isFav \? '★' : '☆'/);
  });
});
