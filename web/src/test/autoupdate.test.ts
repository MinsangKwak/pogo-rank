'use strict';
// 새 판 자동 새로고침 — 언제 고치고 언제 참는지 (lib/autoUpdate.ts)
import { describe, expect, it } from 'vitest';
import { needsReload } from '../lib/autoUpdate';

describe('needsReload', () => {
  it('빌드 시각이 바뀌면 고친다', () => {
    expect(needsReload('2026-09-30T08:00', '2026-09-30T09:00', null)).toBe(true);
  });
  it('같거나 모르면 고치지 않는다', () => {
    expect(needsReload('a', 'a', null)).toBe(false);
    expect(needsReload('', 'b', null)).toBe(false);
    expect(needsReload('a', '', null)).toBe(false);
  });
  it('같은 빌드로는 한 번만 — 캐시가 어긋나도 무한히 돌지 않는다', () => {
    expect(needsReload('a', 'b', 'b')).toBe(false);
    expect(needsReload('a', 'c', 'b')).toBe(true);
  });
});
