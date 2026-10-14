'use strict';
// 광고 자리 — 누구에게 · 어느 모드로 보이는가 (lib/ads.ts). 주인 결정: 로그인한 사람에게는 광고가 없다
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AD_SLOT_SIZE, adsMode, adsVisible } from '../lib/ads';

describe('adsMode', () => {
  it('placeholder 만 켜진 모드, 나머지(빈 값 · 오타 · live)는 off', () => {
    expect(adsMode('placeholder')).toBe('placeholder');
    expect(adsMode(undefined)).toBe('off');
    expect(adsMode('')).toBe('off');
    expect(adsMode('on')).toBe('off');
    expect(adsMode('live')).toBe('off');
  });
});

const auth = (status: 'anon' | 'loading' | 'pending' | 'ok', ready = true, recheckError = '', trace = false) => ({ status, ready, recheckError, trace });

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
