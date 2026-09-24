'use strict';
// GA4 칸 — 설정이 없거나 권한이 빠져도 화면이 서고, 무엇이 빠졌는지 사람 말로 적힌다 (lib/ga4.ts)
import { describe, it, expect, beforeEach } from 'vitest';
import { clearGa4Cache, fillDays, ga4Stats } from '../lib/ga4.ts';

type Reply = { status?: number; body: unknown };

function fakeFetch(route: (url: string, init?: RequestInit) => Reply): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const { status = 200, body } = route(url, init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetch: impl, calls };
}

const TOKEN = { body: { access_token: 'tok' } };

describe('GA4 칸', () => {
  beforeEach(() => clearGa4Cache());

  it('속성 ID 가 없으면 꺼짐 — 부르지 않는다', async () => {
    const fake = fakeFetch(() => TOKEN);
    expect(await ga4Stats('', 30, fake.fetch)).toEqual({ status: 'off', reason: expect.stringContaining('GA4_PROPERTY_ID') });
    expect(fake.calls).toEqual([]);
  });

  it('측정 ID(G-…)를 넣으면 무엇이 틀렸는지 말한다', async () => {
    const res = await ga4Stats('G-1L6ENS8PVK', 30, fakeFetch(() => TOKEN).fetch);
    expect(res).toEqual({ status: 'error', reason: expect.stringContaining('속성 ID') });
  });

  it('권한이 없으면 뷰어 권한이 빠졌다고 적는다', async () => {
    const fake = fakeFetch((url) => url.includes('metadata') ? TOKEN : { status: 403, body: { error: { status: 'PERMISSION_DENIED', message: 'User does not have sufficient permissions' } } });
    expect(await ga4Stats('123456789', 30, fake.fetch)).toEqual({ status: 'error', reason: expect.stringContaining('뷰어') });
  });

  it('API 가 꺼져 있으면 그렇다고 적는다', async () => {
    const fake = fakeFetch((url) => url.includes('metadata') ? TOKEN : { status: 403, body: { error: { message: 'Google Analytics Data API has not been used in project 1 before or it is disabled' } } });
    expect(await ga4Stats('123456789', 30, fake.fetch)).toEqual({ status: 'error', reason: expect.stringContaining('Data API') });
  });

  it('토큰은 analytics.readonly 로 받고 보고서 셋을 합친다 · 10분 동안 다시 안 부른다', async () => {
    const fake = fakeFetch((url, init) => {
      if (url.includes('metadata')) {
        expect(url).toContain(encodeURIComponent('https://www.googleapis.com/auth/analytics.readonly'));
        expect((init?.headers as Record<string, string>)['Metadata-Flavor']).toBe('Google');
        return TOKEN;
      }
      const body = JSON.parse(String(init?.body)) as { dimensions: { name: string }[] };
      const dim = body.dimensions[0]!.name;
      if (dim === 'date') {
        return { body: { rows: [{ dimensionValues: [{ value: '20260923' }], metricValues: [{ value: '12' }, { value: '40' }, { value: '15' }, { value: '3' }] }], totals: [{ metricValues: [{ value: '12' }, { value: '40' }, { value: '15' }, { value: '3' }] }] } };
      }
      if (dim === 'pagePath') return { body: { rows: [{ dimensionValues: [{ value: '/dmax' }], metricValues: [{ value: '20' }, { value: '9' }] }] } };
      return { body: { rows: [{ dimensionValues: [{ value: 'KR' }], metricValues: [{ value: '38' }, { value: '11' }] }] } };
    });
    const res = await ga4Stats('123456789', 7, fake.fetch);
    expect(res).toMatchObject({ status: 'ok', users: 12, views: 40, sessions: 15, newUsers: 3, pages: [{ key: '/dmax', views: 20, users: 9 }], countries: [{ key: 'KR', views: 38, users: 11 }] });
    if (res.status === 'ok') expect(res.perDay).toHaveLength(7);
    const before = fake.calls.length;
    await ga4Stats('123456789', 7, fake.fetch);
    expect(fake.calls.length).toBe(before);
  });

  it('빈 날을 0 으로 채운다 — 한국 날짜 기준', () => {
    const now = new Date('2026-09-23T16:00:00Z'); // 한국 9/24 01:00
    const days = fillDays(3, [{ day: '2026-09-23', users: 5, views: 9, sessions: 6 }], now);
    expect(days.map((one) => one.day)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
    expect(days[1]).toMatchObject({ users: 5 });
    expect(days[0]).toMatchObject({ users: 0, views: 0, sessions: 0 });
  });
});
