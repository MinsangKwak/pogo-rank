'use strict';
// 광고 자리 — 누구에게 · 어느 모드로 보이는가 (lib/ads.ts). 주인 결정: 로그인한 사람에게는 광고가 없다
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AD_FREE_PATHS, AD_SLOT_SIZE, ADS_RAIL_QUERY, adFreeRoute, adsClient, adsMode, adsModeNow, adsScriptSrc, adsSlotUnit, adsStarted, adsTxtLine, adsVisible } from '../lib/ads';
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

describe('live 모드 (2026-10-15 — 승인 당일 켤 준비)', () => {
  const units = { left: '1234567890', right: '2234567890', bottom: '3234567890' };
  it('게시자 ID 와 단위 셋이 모두 꼴에 맞을 때만 live — 하나라도 없으면 off (빈 띠 · 본문만 비켜서는 일을 막는다)', () => {
    expect(adsMode('live', 'ca-pub-6881629275458768')).toBe('off');
    expect(adsMode('live', 'ca-pub-123')).toBe('off');
    expect(adsClient('ca-pub-6881629275458768')).toBe('ca-pub-6881629275458768');
    expect(adsClient('pub-6881629275458768')).toBeNull();
  });
  it('단위 ID 는 숫자만 — 꼴이 틀리면 그 자리는 안 선다', () => {
    expect(adsSlotUnit('left', units)).toBe('1234567890');
    expect(adsSlotUnit('bottom', { ...units, bottom: 'abc' })).toBeNull();
    expect(adsSlotUnit('right', { left: units.left })).toBeNull();
  });
  it('스크립트 주소는 게시자 ID 를 붙인 AdSense 주소 하나', () => {
    expect(adsScriptSrc('ca-pub-6881629275458768')).toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6881629275458768');
  });
});

describe('실제 광고는 고정(sticky) 자리를 쓰지 않는다 (Codex, PR #379 · AdSense 고정 광고 요건)', () => {
  const css = readFileSync('src/styles/cinema/ads.css', 'utf8');
  const slots = readFileSync('src/components/AdSlots.tsx', 'utf8');
  it('live 양옆 띠는 페이지와 함께 흐르고(absolute), 휴대폰 바닥 자리는 문서 흐름 안(relative)에 선다', () => {
    expect(css).toContain('.ad-slot--live:is(.ad-slot--left, .ad-slot--right) { position: absolute; }');
    expect(css).toMatch(/\.ad-slot--live\.ad-slot--bottom \{[^}]*position: relative;[^}]*padding: 1\.6rem 0;/);
  });
  it('휴대폰 바닥 여백 · 맨 위로 올림은 live 가 아닐 때만 — 고정 띠가 없으면 비워 둘 이유가 없다', () => {
    expect(css).not.toMatch(/html\[data-ads="on"\] body \{ padding-bottom/);
    expect(css.match(/html\[data-ads="on"\]:not\(\[data-ads-live\]\) body \{ padding-bottom/g)?.length).toBe(2);
  });
  it('띠 단위는 띠가 보이는 화면에서만 붙인다 — 화면 조건 글자가 CSS 와 같다', () => {
    expect(css).toContain(`@media ${ADS_RAIL_QUERY}`);
    expect(slots).toContain('useMedia(ADS_RAIL_QUERY)');
  });
});

describe('시행일 문 — 약관이 말한 날 전에는 어느 모드든 off', () => {
  const start = Date.parse('2026-10-20T00:00:00+09:00');
  it('시행일이 없으면 영영 off, 있으면 한국 시간 0시부터 연다', () => {
    expect(adsStarted(Date.now(), null)).toBe(false);
    expect(adsStarted(start - 1, start)).toBe(false);
    expect(adsStarted(start, start)).toBe(true);
    expect(adsModeNow('placeholder', start - 1, start)).toBe('off');
    expect(adsModeNow('placeholder', start, start)).toBe('placeholder');
    expect(adsModeNow('live', start - 1, start)).toBe('off');
  });
  it('live 는 moncamp.kr 에서만 — pages.dev · 미리보기 · Vercel 주소에서는 off, 빈 자리(placeholder)는 주소를 안 본다', () => {
    expect(adsModeNow('live', start, start, 'moncamp.kr')).toBe('live');
    expect(adsModeNow('live', start, start, 'moncamp.pages.dev')).toBe('off');
    expect(adsModeNow('live', start, start, 'www.moncamp.kr')).toBe('off');
    expect(adsModeNow('placeholder', start, start, 'dev.moncamp.kr')).toBe('placeholder');
  });
  it('첫 그림 전 스크립트도 같은 시각을 본다 — 시각 전이면 off 를 적고 끝낸다', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).toContain("ADS_START_MS !== null");
    expect(layout).toContain("if(Date.now()<${ADS_START_MS}${ADS_LIVE ? `||location.hostname!==${JSON.stringify(ADS_HOST)}` : ''}){d.dataset.ads='off';return;}");
  });
  it('AdSlots 는 시각을 얹은 모드(adsModeNow)로 판정하고, 비개인 광고만 요청한 뒤 스크립트를 한 번만 심는다', () => {
    const slots = readFileSync('src/components/AdSlots.tsx', 'utf8');
    expect(slots).toContain("preview ? 'placeholder' : adsModeNow()");
    // 시작 시각 전에 연 탭도 그 시각에 다시 그린다 (Codex, PR #381)
    expect(slots).toContain('ADS_START_MS - Date.now()');
    expect(slots).toContain('window.setTimeout(() => wake((n) => n + 1), wait + 50)');
    expect(slots).toContain('queue.requestNonPersonalizedAds = 1');
    expect(slots).toContain("document.querySelector('script[data-moncamp-ads]')");
  });
});

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
  it('운영 빌드 값의 게시자 ID 가 AdSense 가 준 한 줄과 같다 (2026-10-15 주인 계정)', () => {
    const client = /^NEXT_PUBLIC_ADSENSE_CLIENT=(.*)$/m.exec(readFileSync('.env.production', 'utf8'))?.[1];
    expect(adsTxtLine(client)).toBe('google.com, pub-6881629275458768, DIRECT, f08c47fec0942fa0');
  });
  it('주소는 빌드 값에서 만든다 — 손으로 둔 public/ads.txt 가 없다 (있으면 경로가 겹친다)', () => {
    expect(() => readFileSync('public/ads.txt', 'utf8')).toThrow();
    expect(readFileSync('app/ads.txt/route.ts', 'utf8')).toContain("adsTxtLine(process.env['NEXT_PUBLIC_ADSENSE_CLIENT'])");
  });
});
