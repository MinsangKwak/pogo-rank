'use strict';
// 화면별 페이지뷰 — **방침 시행일과 실제가 어긋나지 않는다** (2026-09-24, CLAUDE.md §3)
//
// 날짜가 적힌 자리가 넷이다: 서버(버리는 쪽) · 브라우저(안 보내는 쪽) · 방침 본문 · 패치노트(7일 전 고지).
// 한 곳만 옮기면 "10월 2일부터" 라고 적어 놓고 그 전부터 쌓거나, 고지 없이 쌓는 일이 난다
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { VIEW_COLLECT_FROM, collectView, configureCollect, resetCollect } from '../lib/collect';
import { PRIVACY_VER } from '../lib/legalMeta';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const serverFrom = /VIEW_COLLECT_FROM = '([^']+)'/.exec(read('../../../server/src/lib/contract.ts'))?.[1];
const day = VIEW_COLLECT_FROM.slice(0, 10);
const [, m, d] = day.split('-').map(Number);

describe('시행일 한 벌', () => {
  it('서버와 브라우저가 같은 때를 본다', () => {
    expect(serverFrom).toBe(VIEW_COLLECT_FROM);
  });

  it('방침의 개정일이 그날이고 본문에 그날부터라고 적혀 있다', () => {
    expect(PRIVACY_VER).toBe(day);
    const legal = read('../screens/Legal.tsx');
    expect(legal).toContain(`${day}부터 서비스에서 연 화면의 이름`);
  });

  it('맨 위 패치노트가 그날을 알리고, 그날보다 7일 이상 먼저 나간다', async () => {
    const { RELEASE_NOTES } = await import('../../../content/release-notes.mjs') as { RELEASE_NOTES: { date: string; items: string[] }[] };
    const top = RELEASE_NOTES[0]!;
    expect(top.items.join(' ')).toContain(`${m}월 ${d}일부터`);
    const noticed = Date.parse(`${top.date.slice(0, 10)}T00:00:00+09:00`);
    expect(Date.parse(VIEW_COLLECT_FROM) - noticed).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });
});

describe('브라우저는 그 전에 안 보낸다', () => {
  const sent: unknown[] = [];
  beforeEach(() => {
    resetCollect();
    sent.length = 0;
    configureCollect('https://api.example.test', 'v5.2.0');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: (_url: string, body: Blob) => { sent.push(body); return true; } } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => undefined } });
  });

  it('시행일 전에는 큐에 안 넣는다', async () => {
    const { flushCollect } = await import('../lib/collect');
    collectView('dex', Date.parse(VIEW_COLLECT_FROM) - 1);
    flushCollect();
    expect(sent).toHaveLength(0);
  });

  it('그 뒤에는 화면 id 하나만 — 같은 화면을 연달아 열면 한 번', async () => {
    const { flushCollect } = await import('../lib/collect');
    const after = Date.parse(VIEW_COLLECT_FROM) + 1;
    collectView('dex', after);
    collectView('dex', after);
    collectView('/mon/25', after);
    flushCollect();
    expect(sent).toHaveLength(1);
    const body = JSON.parse(await (sent[0] as Blob).text()) as { events: { name: string; surface: string; term?: string }[] };
    expect(body.events).toEqual([{ name: 'view', surface: 'dex', ts: expect.any(String) }]);
  });
});
