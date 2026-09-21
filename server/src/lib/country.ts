// ─────────────────────────────────────────────────────────────────────────────
// lib/country.ts — 요청에서 **국가만** 뽑는다.
//
// **IP 는 어디에도 저장하지 않는다** (CLAUDE.md §3 — 개인을 가리키는 값은 코드·DB 에 두지 않는다).
// 앞단(Cloudflare · Google 프런트엔드)이 이미 판정해 둔 국가 코드를 읽을 뿐이라,
// 이 서버는 IP 를 볼 일조차 없다. 그래서 '지우는 것을 깜빡할' 자리가 아예 없다.
//
// 앞단이 없으면(로컬 · 직접 호출) 'ZZ' 다. 모른다고 적는 쪽이 지어내는 것보다 정직하다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { UNKNOWN_COUNTRY } from './contract.ts';

/** 앞에 있는 것부터 본다 — Cloudflare 를 앞에 두면 그쪽이 더 정확하다 (docs/INFRA.md 로드맵) */
const HEADERS = ['cf-ipcountry', 'x-appengine-country', 'x-country-code'] as const;

/** Cloudflare 가 모를 때 쓰는 값들. 나라가 아니므로 'ZZ' 로 모은다 */
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'ZZ']);

type Headers = Record<string, string | string[] | undefined>;

export function countryOf(headers: Headers): string {
  for (const key of HEADERS) {
    const raw = headers[key];
    const value = ((Array.isArray(raw) ? raw[0] : raw) ?? '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(value) && !NOT_A_COUNTRY.has(value)) return value;
  }
  return UNKNOWN_COUNTRY;
}
