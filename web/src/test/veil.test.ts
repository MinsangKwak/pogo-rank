'use strict';
// 덮개(lib/veil.ts) — 최소 300ms 는 보이고, 8초면 무조건 걷히고, 걷힌 뒤에는 settle 이 아무 일도 안 한다
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showVeil, settleVeil, settleVeilAfterFonts, resetVeil } from '../lib/veil';

function fakeVeil() {
  const classes = new Set<string>(['veil', 'veil--boot']);
  const attrs = new Map<string, string>();
  return {
    hidden: false,
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
    setAttribute: (k: string, v: string) => attrs.set(k, v),
    has: (c: string) => classes.has(c),
    busy: () => attrs.get('aria-busy'),
  };
}

describe('덮개', () => {
  let veil: ReturnType<typeof fakeVeil>;
  beforeEach(() => {
    vi.useFakeTimers();
    resetVeil();
    veil = fakeVeil();
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: (id: string) => (id === 'veil' ? veil : null) } });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('세우고 바로 걷으면 300ms 는 채운 뒤 사라진다', () => {
    showVeil();
    settleVeil();
    vi.advanceTimersByTime(299);
    expect(veil.has('is-out')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(veil.has('is-out')).toBe(true);
    expect(veil.has('veil--boot')).toBe(false);
    expect(veil.busy()).toBe('false');
    vi.advanceTimersByTime(200);
    expect(veil.hidden).toBe(true);
  });

  it('아무도 안 걷어도 8초면 걷힌다', () => {
    showVeil();
    vi.advanceTimersByTime(7999);
    expect(veil.has('is-out')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(veil.has('is-out')).toBe(true);
  });

  it('걷힌 덮개에 settle 은 아무 일도 안 한다 · 다시 세우면 다시 덮는다', () => {
    showVeil(); settleVeil(); vi.advanceTimersByTime(600);
    expect(veil.hidden).toBe(true);
    settleVeil();
    expect(veil.hidden).toBe(true);
    showVeil();
    expect(veil.hidden).toBe(false);
    expect(veil.has('is-out')).toBe(false);
    expect(veil.busy()).toBe('true');
  });

  it('첫 화면은 글꼴을 기다리되 1.5초를 넘기지 않는다', async () => {
    // fonts.ready 가 영영 안 끝나는 브라우저 — 그래도 1.5초 + 300ms 안에 걷힌다
    (globalThis as unknown as { document: { fonts?: { ready: Promise<void> } } }).document.fonts = { ready: new Promise(() => undefined) };
    showVeil();
    settleVeilAfterFonts();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.advanceTimersByTimeAsync(300);
    expect(veil.has('is-out')).toBe(true);
  });
});
