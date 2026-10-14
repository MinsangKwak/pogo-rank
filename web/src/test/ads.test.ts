'use strict';
// 광고 자리 — 누구에게 · 어느 모드로 보이는가 (lib/ads.ts). 주인 결정: 로그인한 사람에게는 광고가 없다
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AD_FREE_PATHS, AD_SLOT_SIZE, adFreeRoute, adsMode, adsTxtLine, adsVisible } from '../lib/ads';
import { ROUTES } from '../routes';

describe('adsMode', () => {
  it('placeholder 만 켜진 모드, 나머지(빈 값 · 오타 · live)는 off', () => {
    expect(adsMode('placeholder')).toBe('placeholder');
    // undefined 는 넘기지 않는다 — 기본 인자가 process.env 를 읽어 dev 파이프라인(NEXT_PUBLIC_ADS=placeholder)에서 깨진다 (Codex, PR #364)
    expect(adsMode('')).toBe('off');
    expect(adsMode('on')).toBe('off');
    expect(adsMode('live')).toBe('off');
  });
});

const auth = (status: 'anon' | 'loading' | 'pending' | 'ok', ready = true, recheckError = '', trace = false, consentDenied = false, adFree = false) =>
  ({ status, ready, recheckError, trace, consentDenied, adFree });

describe('adsVisible', () => {
  it('켜진 모드에서 첫 확인이 끝난 뒤 로그인 전(anon)에게만 보인다', () => {
    expect(adsVisible('placeholder', auth('anon'))).toBe(true);
    expect(adsVisible('placeholder', auth('loading'))).toBe(false);
    expect(adsVisible('placeholder', auth('pending'))).toBe(false);
    expect(adsVisible('placeholder', auth('ok'))).toBe(false);
  });
  it('첫 확인이 끝나기 전에는 anon 이어도 안 보인다 — 로그인 직후 첫 화면은 자취 없이 anon 으로 시작한다 (Codex, PR #364)', () => {
    expect(adsVisible('placeholder', auth('anon', false))).toBe(false);
  });
  it('확인이 회선 문제로 실패했으면 anon 이어도 안 보인다 — 쿠키만 살아 있는 로그인 사용자일 수 있다 (Codex, PR #364)', () => {
    expect(adsVisible('placeholder', auth('anon', true, 'network'))).toBe(false);
    expect(adsVisible('placeholder', auth('ok', true, 'network'))).toBe(false);
  });
  it('다른 탭에서 로그인해 자취가 생기면 이 탭이 anon 이어도 안 보인다 (Codex, PR #364)', () => {
    expect(adsVisible('placeholder', auth('anon', true, '', true))).toBe(false);
  });
  it('통계를 끈 사람에게는 안 보인다 — 광고 스크립트가 붙으면 Google 로 요청이 나간다 (2026-10-14 점검)', () => {
    expect(adsVisible('placeholder', auth('anon', true, '', false, true))).toBe(false);
  });
  it('광고 없는 화면(약관 · 방침 · 설정 · 잠금 카드)에서는 안 보인다 — AdSense \'게시자 콘텐츠가 없는 화면\' (2026-10-14 점검)', () => {
    expect(adsVisible('placeholder', auth('anon', true, '', false, false, true))).toBe(false);
  });
  it('꺼진 모드에서는 아무에게도 안 보인다', () => {
    for (const status of ['anon', 'loading', 'pending', 'ok'] as const) {
      expect(adsVisible('off', auth(status))).toBe(false);
      expect(adsVisible('off', auth(status, false))).toBe(false);
    }
  });
});

describe('자리 크기와 빌드 설정', () => {
  it('Google 표준 단위 — 세로 띠 160×600, 바닥 띠 320×50', () => {
    expect(AD_SLOT_SIZE.left).toEqual({ w: 160, h: 600 });
    expect(AD_SLOT_SIZE.right).toEqual({ w: 160, h: 600 });
    expect(AD_SLOT_SIZE.bottom).toEqual({ w: 320, h: 50 });
  });
  it('운영 빌드(.env.production)는 off, dev 파이프라인은 placeholder — 약관이 아직 광고 없음이라 운영에 자리가 서면 안 된다', () => {
    expect(readFileSync('.env.production', 'utf8')).toMatch(/^NEXT_PUBLIC_ADS=off$/m);
    expect(readFileSync('../.github/workflows/dev-pipeline.yml', 'utf8')).toMatch(/NEXT_PUBLIC_ADS: placeholder/);
  });
});

describe('광고 없는 화면 (2026-10-14 수익화 전 점검)', () => {
  it('약관 · 방침 · 설정과 로그인해야 열리는 화면 — 그 밖의 화면에는 선다', () => {
    const free = ROUTES.filter((route) => adFreeRoute(route)).map((route) => route.id).sort();
    expect(free).toEqual(['admin-stats', 'planner', 'privacy', 'settings', 'terms']);
    for (const id of ['home', 'dex', 'dmax', 'pve', 'pvp', 'schedule', 'mon', 'release']) {
      expect(adFreeRoute(ROUTES.find((route) => route.id === id)!), id).toBe(false);
    }
  });
  it('첫 그림 전 스크립트가 같은 목록 · 같은 저장 키를 본다 — 둘이 다르면 본문이 한 번 움직인다', () => {
    expect(AD_FREE_PATHS).toEqual(expect.arrayContaining(['/privacy', '/terms', '/settings', '/planner', '/admin/stats']));
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain('JSON.stringify(AD_FREE_PATHS)');
    // 켤지는 adsMode 한 곳으로 — 모드를 더해도 첫 그림 전 문이 같이 열린다 (Codex, PR #365)
    expect(layout).toContain("adsMode(process.env['NEXT_PUBLIC_ADS']) !== 'off'");
    expect(layout).not.toContain("process.env['NEXT_PUBLIC_ADS'] === 'placeholder'");
    expect(layout).toContain("localStorage.getItem('pogo_signed_in')==='1'");
    expect(layout).toContain("localStorage.getItem('pogo_consent')==='denied'");
    expect(readFileSync('src/stores/auth.ts', 'utf8')).toContain("TRACE_KEY = 'pogo_signed_in'");
    expect(readFileSync('src/lib/consent.ts', 'utf8')).toContain("CONSENT_KEY = 'pogo_consent'");
  });
});

describe('ads.txt (2026-10-14 수익화 전 점검)', () => {
  it('게시자 ID(ca-pub-16자리)가 있을 때만 한 줄, 없거나 꼴이 틀리면 null(→ 404)', () => {
    expect(adsTxtLine('ca-pub-1234567890123456')).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0');
    expect(adsTxtLine(undefined)).toBeNull();
    expect(adsTxtLine('')).toBeNull();
    expect(adsTxtLine('pub-1234567890123456')).toBeNull();
    expect(adsTxtLine('ca-pub-123')).toBeNull();
    expect(adsTxtLine('ca-pub-1234567890123456\nevil')).toBeNull();
  });
  it('주소는 빌드 값에서 만든다 — 손으로 둔 public/ads.txt 가 없다 (있으면 경로가 겹친다)', () => {
    expect(() => readFileSync('public/ads.txt', 'utf8')).toThrow();
    expect(readFileSync('app/ads.txt/route.ts', 'utf8')).toContain("adsTxtLine(process.env['NEXT_PUBLIC_ADSENSE_CLIENT'])");
  });
});
