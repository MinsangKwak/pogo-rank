'use strict';
// 광고 조항 — 약관 · 방침 · 운영 광고 모드 · 패치노트 고지가 시행일 하나(ADS_FROM)로 같이 움직인다 (2026-10-14 수익화 전 점검)
//
// 지금은 ADS_FROM 이 null 이라 약관은 '광고 없음' 그대로, 운영 광고 모드는 off 여야 한다.
// 시행일을 정하면 두 판이 그 날로 오르고, 그 날(또는 그 전)의 패치노트 고지가 있어야 한다 — 사전 고지 없이 승인 당일 시행(주인 결정 2026-10-15)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ADS_FROM, MON_VIEW_FROM, PRIVACY_VER, TERMS_VER } from '../lib/legalMeta';

const legal = readFileSync('src/screens/Legal.tsx', 'utf8');
const envProd = readFileSync('.env.production', 'utf8');
type Notes = { RELEASE_NOTES: { date: string; items: string[] }[] };

describe('국외 이전 고지 (지금부터)', () => {
  it('방문 통계(Google Analytics 4)가 미국(Google LLC)으로 간다고 적는다 — 표에만 있고 국외 이전 문단에 빠져 있었다', () => {
    expect(legal).toContain('방문 통계(Google Analytics 4)는 통계가 켜져 있는 동안 화면을 열 때마다 Google LLC(미국)로');
    expect(legal).toContain('2026-10-14 (국외 이전에 방문 통계 Google Analytics 4 · 미국을 명시');
  });
  it('개정 이력의 상세 번호 줄은 판 번호가 아니라 그 개정의 날을 적는다 — 판이 광고 날로 올라가도 9/29 그대로', () => {
    expect(legal).toContain('${MON_VIEW_FROM} v5.5.0 (상세에서 본 포켓몬 번호 기록)');
    expect(legal).not.toContain('${PRIVACY_VER} v5.5.0');
  });
});

describe('광고 조항 — 시행일 하나로', () => {
  it('조항은 Legal.tsx 에 써 두고 ADS_FROM 으로만 켠다 (약관 1항 · 방침 머리 · 2 · 3 · 4 · 7항)', () => {
    expect(legal).toContain('서비스는 무료이며, 광고나 유료 기능을 제공하지 않습니다');
    expect(legal).toContain('로그인하지 않은 화면에 광고(Google AdSense)가 표시됩니다');
    expect(legal).toContain('광고(Google AdSense) — ${ADS_FROM}부터');
    expect(legal).toContain('관심사 기반(맞춤형) 광고는 쓰지 않고');
    expect(legal).toContain('policies.google.com/technologies/partner-sites');
    expect(legal).toContain("광고 스크립트도 불러오지 않습니다");
  });

  it('시행일이 생기면 7일 전 고지 약속 대신 시행일에 알린다는 문장으로 바뀐다 — 약관 · 방침이 실제와 같아야 한다', () => {
    expect(legal).toContain('이 방침을 개정하는 경우 시행일에 메뉴의 패치노트로 알립니다');
    expect(legal).toContain('약관을 개정하면 시행일에 패치노트로 알리고');
  });

  if (ADS_FROM === null) {
    it('시행일이 없으면 두 판은 지난 개정일 그대로, 운영 광고 모드는 off', () => {
      expect(TERMS_VER).toBe('2026-09-24');
      expect(PRIVACY_VER).toBe(MON_VIEW_FROM);
      expect(envProd).toMatch(/^NEXT_PUBLIC_ADS=off$/m);
    });
  } else {
    it('시행일이 있으면 날짜 꼴이고 두 판이 그 날로 오른다 — 다음 로그인 때 다시 묻는다', () => {
      expect(ADS_FROM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(TERMS_VER).toBe(ADS_FROM);
      expect(PRIVACY_VER).toBe(ADS_FROM);
    });
    // 사전 고지 없이 승인 당일 시행 — 주인 결정(2026-10-15). 고지는 시행일 당일까지 패치노트에 있으면 된다
    it('시행일(또는 그 전) 패치노트에 광고 고지가 있다', async () => {
      const { RELEASE_NOTES } = await import('../../../content/release-notes.mjs') as Notes;
      const from = Date.parse(`${ADS_FROM}T00:00:00+09:00`);
      const notice = RELEASE_NOTES.find((note) => {
        const day = Date.parse(`${note.date.slice(0, 10)}T00:00:00+09:00`);
        // 날짜는 패치노트 꼴 셋 중 하나로 적는다 — '2026-11-01' · '11월 1일' · '11/1'
        const [, m, d] = ADS_FROM!.split('-').map(Number);
        const said = (item: string) => [ADS_FROM!, `${m}월 ${d}일`, `${m}/${d}`].some((one) => item.includes(one));
        return from - day >= 0 && note.items.some((item) => item.includes('광고') && said(item));
      });
      expect(notice, `${ADS_FROM} 광고 시행 고지가 패치노트에 없습니다`).toBeDefined();
    });
  }
});
