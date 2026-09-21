// 국가 판정 — **IP 를 저장하지 않는다**는 약속이 지켜지는 자리 (CLAUDE.md §3)
'use strict';
import { describe, it, expect } from 'vitest';
import { countryOf } from '../lib/country.ts';

describe('국가 판정', () => {
  it('Cloudflare 헤더를 읽는다', () => {
    expect(countryOf({ 'cf-ipcountry': 'kr' })).toBe('KR');
  });

  it('Cloudflare 가 없으면 Google 프런트엔드 헤더를 본다', () => {
    expect(countryOf({ 'x-appengine-country': 'JP' })).toBe('JP');
  });

  it('앞에 있는 것이 이긴다', () => {
    expect(countryOf({ 'cf-ipcountry': 'KR', 'x-appengine-country': 'US' })).toBe('KR');
  });

  it("앞단이 없으면 'ZZ' — 모른다고 적지, 지어내지 않는다", () => {
    expect(countryOf({})).toBe('ZZ');
  });

  it("나라가 아닌 값(XX·T1)은 'ZZ' 로 모은다", () => {
    expect(countryOf({ 'cf-ipcountry': 'XX' })).toBe('ZZ');
    expect(countryOf({ 'cf-ipcountry': 'T1' })).toBe('ZZ');
  });

  it('IP 가 담긴 헤더는 아예 보지 않는다', () => {
    expect(countryOf({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' })).toBe('ZZ');
  });

  it('모양이 아닌 값은 통과하지 못한다', () => {
    expect(countryOf({ 'cf-ipcountry': 'KOR' })).toBe('ZZ');
    expect(countryOf({ 'cf-ipcountry': '<script>' })).toBe('ZZ');
  });
});
