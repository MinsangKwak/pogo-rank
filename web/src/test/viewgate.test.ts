'use strict';
// 화면별 페이지뷰 — **적힌 날짜와 실제가 어긋나지 않는다** (2026-09-24 v5.2.1, CLAUDE.md §3)
//
// v5.2.0 은 10/2 시행이라 서버 · 브라우저에 날짜 문을 두었고, 같은 날 주인이 바로 켜기로 해 문을 지웠다.
// 문이 다시 생기면 방침은 '9/24부터' 라 적어 놓고 안 세는 일이, 방침 날짜만 남으면 고지 없이 세는 일이 난다
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectView, configureCollect, resetCollect, flushCollect } from '../lib/collect';
import { PRIVACY_VER } from '../lib/legalMeta';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const [, m, d] = PRIVACY_VER.split('-').map(Number);

describe('시행일 한 벌', () => {
  it('서버와 브라우저에 날짜 문이 없다', () => {
    expect(read('../../../server/src/lib/contract.ts')).not.toContain('VIEW_COLLECT_FROM');
    expect(read('../../../server/src/lib/normalize.ts')).not.toContain('VIEW_COLLECT_FROM');
    expect(read('../lib/collect.ts')).not.toContain('VIEW_COLLECT_FROM');
  });

  it('방침 본문이 개정일부터 센다고 적는다', () => {
    const legal = read('../screens/Legal.tsx');
    expect(legal).toContain(`${PRIVACY_VER}부터 서비스에서 연 화면의 이름`);
    expect(legal).not.toContain('2026-10-02');
  });

  // 개정일 묶음을 찾는다 — 처음엔 맨 위였지만 v5.3.0 부터 그 위에 새 판이 선다. 정정이 지워지지 않았는지가 보는 것이다
  it('개정일에 나간 패치노트가 정정이고 그날부터라고 알린다', async () => {
    const { RELEASE_NOTES } = await import('../../../content/release-notes.mjs') as { RELEASE_NOTES: { date: string; items: string[] }[] };
    const onDay = RELEASE_NOTES.find((note) => note.date.startsWith(PRIVACY_VER));
    expect(onDay, `${PRIVACY_VER} 묶음이 패치노트에 없습니다`).toBeDefined();
    expect(onDay!.items.join(' ')).toContain('[정정]');
    expect(onDay!.items.join(' ')).toContain(`${m}월 ${d}일`);
  });
});

describe('브라우저는 화면 id 하나만 보낸다', () => {
  const sent: unknown[] = [];
  beforeEach(() => {
    resetCollect();
    sent.length = 0;
    configureCollect('https://api.example.test', 'v5.2.1');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: (_url: string, body: Blob) => { sent.push(body); return true; } } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => undefined } });
  });

  it('같은 화면을 연달아 열면 한 번 — 주소 꼴은 버린다', async () => {
    collectView('dex');
    collectView('dex');
    collectView('/mon/25');
    flushCollect();
    expect(sent).toHaveLength(1);
    const body = JSON.parse(await (sent[0] as Blob).text()) as { events: { name: string; surface: string; term?: string }[] };
    expect(body.events).toEqual([{ name: 'view', surface: 'dex', ts: expect.any(String) }]);
  });
});
