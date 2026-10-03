'use strict';
// 조각(chunk)을 못 받으면 한 번 새로 고친다 — 문서 머리 조각을 가짜 창에서 그대로 돌린다 (lib/chunkReload.ts)
import { describe, it, expect, beforeEach } from 'vitest';
import { CHUNK_RELOAD_GAP, CHUNK_RELOAD_KEY, CHUNK_SCRIPT } from '../lib/chunkReload';

type Handler = (event: Record<string, unknown>) => void;

function fakeWindow(now: { t: number }, blocked = false) {
  const handlers: Record<string, Handler[]> = {};
  const store = new Map<string, string>();
  const win = {
    reloads: 0,
    addEventListener: (type: string, fn: Handler) => { (handlers[type] ??= []).push(fn); },
    sessionStorage: {
      getItem: (k: string) => { if (blocked) throw new Error('blocked'); return store.get(k) ?? null; },
      setItem: (k: string, v: string) => { if (blocked) throw new Error('blocked'); store.set(k, v); },
    },
    location: { reload: () => { win.reloads += 1; } },
    Date: { now: () => now.t },
    fire: (type: string, event: Record<string, unknown>) => handlers[type]?.forEach((fn) => fn(event)),
    store,
  };
  // 문서 머리와 같은 전역 이름으로 돌린다
  new Function('addEventListener', 'sessionStorage', 'location', 'Date', CHUNK_SCRIPT)(
    win.addEventListener, win.sessionStorage, win.location, win.Date,
  );
  return win;
}

describe('조각을 못 받으면 새로 고친다', () => {
  let now: { t: number };
  beforeEach(() => { now = { t: 1_000_000 }; });

  it('_next/static 스크립트 태그가 못 받히면 새로 고치고 시각을 적는다', () => {
    const win = fakeWindow(now);
    win.fire('error', { target: { tagName: 'SCRIPT', src: 'https://moncamp.kr/_next/static/chunks/app/layout-08adc36e.js' } });
    expect(win.reloads).toBe(1);
    expect(win.store.get(CHUNK_RELOAD_KEY)).toBe(String(now.t));
  });

  it('던져진 ChunkLoadError · CSS 조각 · 동적 import 실패 · 처리 안 된 약속', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['error', { message: 'Uncaught Error: Loading chunk 177 failed.\n(error: https://moncamp.kr/_next/static/chunks/177.js)' }],
      ['error', { message: 'Script error.', error: { name: 'ChunkLoadError', message: 'Loading chunk 5 failed.' } }],
      ['unhandledrejection', { reason: { name: 'Error', message: 'Loading CSS chunk 8211 failed.' } }],
      ['unhandledrejection', { reason: { name: 'TypeError', message: 'Failed to fetch dynamically imported module: https://moncamp.kr/x.js' } }],
      ['unhandledrejection', { reason: { name: 'TypeError', message: 'Importing a module script failed.' } }],
    ];
    for (const [type, event] of cases) {
      now.t += CHUNK_RELOAD_GAP + 1;
      const win = fakeWindow(now);
      win.fire(type, event);
      expect(win.reloads, JSON.stringify(event)).toBe(1);
    }
  });

  it('조각과 상관없는 오류 · 다른 곳의 스크립트 · 스타일시트는 그대로 둔다', () => {
    const win = fakeWindow(now);
    win.fire('error', { message: "TypeError: Cannot read properties of undefined (reading 'x')" });
    win.fire('error', { target: { tagName: 'SCRIPT', src: 'https://www.googletagmanager.com/gtag/js?id=G-1' } });
    win.fire('error', { target: { tagName: 'LINK', href: 'https://moncamp.kr/_next/static/css/a.css' } });
    win.fire('unhandledrejection', { reason: { name: 'Error', message: 'Network request failed' } });
    win.fire('unhandledrejection', { reason: undefined });
    expect(win.reloads).toBe(0);
  });

  it('1분 안에는 다시 고치지 않는다 — 조각이 정말 없으면 한 번만 돈다', () => {
    const first = fakeWindow(now);
    first.fire('unhandledrejection', { reason: { name: 'ChunkLoadError', message: 'Loading chunk 1 failed.' } });
    expect(first.reloads).toBe(1);
    // 새로 고친 뒤의 문서 — 같은 탭 저장소가 이어진다
    now.t += 5_000;
    const second = fakeWindow(now);
    for (const [k, v] of first.store) second.store.set(k, v);
    second.fire('unhandledrejection', { reason: { name: 'ChunkLoadError', message: 'Loading chunk 1 failed.' } });
    expect(second.reloads).toBe(0);
    now.t += CHUNK_RELOAD_GAP;
    second.fire('unhandledrejection', { reason: { name: 'ChunkLoadError', message: 'Loading chunk 1 failed.' } });
    expect(second.reloads).toBe(1);
  });

  it('저장소를 막은 브라우저에서는 고치지 않는다 — 횟수를 적을 수 없어 끝없이 돌 수 있다', () => {
    const win = fakeWindow(now, true);
    win.fire('unhandledrejection', { reason: { name: 'ChunkLoadError', message: 'Loading chunk 1 failed.' } });
    expect(win.reloads).toBe(0);
  });
});
