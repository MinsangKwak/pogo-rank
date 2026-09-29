'use strict';
// 화면별 페이지뷰 — **적힌 날짜와 실제가 어긋나지 않는다** (2026-09-24 v5.2.1, CLAUDE.md §3)
//
// v5.2.0 은 10/2 시행이라 서버 · 브라우저에 날짜 문을 두었고, 같은 날 주인이 바로 켜기로 해 문을 지웠다.
// 문이 다시 생기면 방침은 '9/24부터' 라 적어 놓고 안 세는 일이, 방침 날짜만 남으면 고지 없이 세는 일이 난다
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectView, collectMonView, configureCollect, resetCollect, flushCollect } from '../lib/collect';
import { PRIVACY_VER, VIEW_FROM, MON_VIEW_FROM } from '../lib/legalMeta';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const [, m, d] = VIEW_FROM.split('-').map(Number);
const [, mm, md] = MON_VIEW_FROM.split('-').map(Number);
type Notes = { RELEASE_NOTES: { date: string; items: string[] }[] };

describe('시행일 한 벌', () => {
  it('서버와 브라우저에 날짜 문이 없다', () => {
    expect(read('../../../server/src/lib/contract.ts')).not.toContain('VIEW_COLLECT_FROM');
    expect(read('../../../server/src/lib/normalize.ts')).not.toContain('VIEW_COLLECT_FROM');
    expect(read('../lib/collect.ts')).not.toContain('VIEW_COLLECT_FROM');
  });

  it('방침 본문이 개정일부터 센다고 적는다 — 화면 이름(9/24) · 상세의 포켓몬 번호(9/29)', () => {
    const legal = read('../screens/Legal.tsx');
    expect(legal).toContain(`${VIEW_FROM}부터 서비스에서 연 화면의 이름`);
    expect(legal).toContain(`${MON_VIEW_FROM}부터는 상세 팝업에서 본 포켓몬의 도감 번호`);
    expect(legal).not.toContain('2026-10-02');
    // 방침 판은 마지막 개정(상세 번호)의 날이다 — lib/terms.ts 가 이 값으로 다시 묻는다
    expect(PRIVACY_VER).toBe(MON_VIEW_FROM);
  });

  // 개정일 묶음을 찾는다 — 처음엔 맨 위였지만 v5.3.0 부터 그 위에 새 판이 선다. 정정이 지워지지 않았는지가 보는 것이다
  it('화면 기록 개정일에 나간 패치노트가 정정이고 그날부터라고 알린다', async () => {
    const { RELEASE_NOTES } = await import('../../../content/release-notes.mjs') as Notes;
    const onDay = RELEASE_NOTES.find((note) => note.date.startsWith(VIEW_FROM));
    expect(onDay, `${VIEW_FROM} 묶음이 패치노트에 없습니다`).toBeDefined();
    expect(onDay!.items.join(' ')).toContain('[정정]');
    expect(onDay!.items.join(' ')).toContain(`${m}월 ${d}일`);
  });

  it('상세 번호 기록 시행일에 나간 패치노트가 그날부터 번호를 센다고 알린다', async () => {
    const { RELEASE_NOTES } = await import('../../../content/release-notes.mjs') as Notes;
    // 같은 날 판이 둘 이상일 수 있다(v5.5.0 · v5.5.1) — 그날 묶음을 다 모아 본다
    const onDay = RELEASE_NOTES.filter((note) => note.date.startsWith(MON_VIEW_FROM));
    expect(onDay.length, `${MON_VIEW_FROM} 묶음이 패치노트에 없습니다`).toBeGreaterThan(0);
    const text = onDay.flatMap((note) => note.items).join(' ');
    expect(text).toContain(`${mm}월 ${md}일`);
    expect(text).toContain('도감 번호');
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

  it('상세 팝업은 mon-<도감 번호> 로 — 같은 포켓몬을 연달아 열면 한 번, 번호가 아니면 버린다', async () => {
    collectMonView(25);
    collectMonView(25);
    collectMonView(0);
    collectMonView(2.5);
    collectMonView(150);
    flushCollect();
    expect(sent).toHaveLength(1);
    const body = JSON.parse(await (sent[0] as Blob).text()) as { events: { name: string; surface: string }[] };
    expect(body.events.map((one) => one.surface)).toEqual(['mon-25', 'mon-150']);
    expect(body.events.every((one) => one.name === 'view')).toBe(true);
  });
});
