// ─────────────────────────────────────────────────────────────────────────────
// lib/track.ts — GA4 이벤트 (v3 scripts/track.js 와 **같은 이벤트명·같은 가상 경로**)
//
// 이름을 바꾸면 v3.57.0 에 겨우 맞춰 놓은 지표가 끊긴다.
// **지금 이 빌드에는 GA 조각이 없다** (index.html 에 안 넣었다) — 호출 자리만 갖춰 둔 상태다.
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window { gtag?: (...args: unknown[]) => void; __trackLog?: unknown[][]; GA_SENT_FIRST?: boolean }
}

import { analyticsWanted } from './consent';

// **볼 때마다 본다.** 처음에 모듈을 읽는 순간 한 번만 보고 상수에 담아 뒀는데,
// GA 조각은 async 로 붙어 그때는 아직 window.gtag 가 없다 — 켜도 영영 한 건도 안 나갔다
const on = () => typeof window !== 'undefined' && typeof window.gtag === 'function';

export function track(name: string, params: Record<string, unknown> = {}): void {
  // '통계 끄기' 를 고른 사람에게는 한 건도 보내지 않는다 (lib/consent.ts)
  if (on() && analyticsWanted()) window.gtag?.('event', name, params);
  // 무엇이 찍히는지 눈으로 볼 수 있게 남겨 둔다 (콘솔에서 window.__trackLog)
  const log = (window.__trackLog ??= []);
  log.push([name, params]);
  if (log.length > 200) log.splice(0, log.length - 200);   // 오래 켜 두면 끝없이 쌓인다
}

/** 해시는 pathname 이 아니다 — GA4 '페이지 경로' 가 되려면 가상 경로로 바꿔야 한다 (v3.57.0) */
export function gaVirtualUrl(): string {
  const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0]?.replace(/\/+$/, '') ?? '';
  return `${location.origin}/${raw}`;
}

export function trackPageView(title: string): void {
  if (!on() || !analyticsWanted()) return;
  // 홈으로 들어왔으면 <head> 의 조각이 첫 조회를 이미 보냈다 — 여기서 또 보내면 두 번 센다 (v3 GA_SENT_FIRST)
  if (window.GA_SENT_FIRST) { window.GA_SENT_FIRST = false; return; }
  window.gtag?.('event', 'page_view', {
    page_location: gaVirtualUrl(),
    page_title: title,
  });
}

// ── 검색어 기록 (v4.5.5) ─────────────────────────────────────────────────────
// **완성어만 센다.** '뮤' 를 치다 뮤츠를 고르면 기록되는 말은 '뮤츠' 다 —
// 친 글자를 그대로 보내면 뮤·뮤ㅊ 같은 토막이 순위를 덮는다.
// 그래서 타이핑이 아니라 **고른 순간**(추천 선택 · 검색 결과에서 연 상세)에 한 번 보낸다.
//
// GA4 표준 'search' 이벤트를 쓰는 이유 — search_term 이 GA4 **기본 측정기준**이라
// 콘솔에서 맞춤 측정기준을 따로 등록하지 않아도 Data API 로 바로 읽힌다 (backend/hotsearch_build.py).
// 동의 게이트는 track() 안에 있다 — '통계 끄기' 면 한 건도 안 나간다.

// 같은 이름을 연달아 보내지 않는다 — 고쳐 고르느라 오간 것까지 세면 한 사람이 순위를 만든다
let lastPick = '';

export function trackSearchPick(name: string, surface: string, sprite?: number): void {
  const term = name.trim();
  if (!term || term === lastPick) return;
  lastPick = term;
  track('search', { search_term: term, surface });
  tallyLocal(term, sprite);
}

// ── 이 브라우저에 센 것 (v4.5.7) ──────────────────────────────────────────────
// **미리보기에서만 화면에 선다.** dev 에는 GA 조각이 없어 무엇을 검색해도 GA 에 안 쌓이고,
// 운영에 올리기 전에는 고르는 자리가 제대로 잡히는지 확인할 길이 없다.
// 그래서 고른 이름을 이 브라우저에 세어 둔다 — 밖으로 나가지 않고, 운영 화면은 읽지 않는다.
// 운영에서도 쓰기는 일어난다: 한 줄 쓰기라 값이 싸고, 채널을 아는 것보다 코드가 단순하다.
export const LOCAL_PICK_KEY = 'pogo_hotsearch_local';   // 새 키라 접두사를 단다 (CLAUDE.md §2)
const LOCAL_MAX = 30;   // 한 브라우저가 서른 종을 넘겨 세면 오래된 쪽부터 버린다

export interface LocalPick { name: string; sprite?: number; count: number }

export function readLocalPicks(): LocalPick[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_PICK_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((one): one is LocalPick => !!one && typeof one.name === 'string' && Number.isFinite(one.count))
      .sort((left, right) => right.count - left.count);
  } catch { return []; }   // 저장소를 막아 둔 브라우저
}

function tallyLocal(name: string, sprite?: number): void {
  try {
    const picks = readLocalPicks();
    const found = picks.find((one) => one.name === name);
    if (found) { found.count += 1; if (sprite) found.sprite = sprite; }
    else picks.push({ name, sprite, count: 1 });
    localStorage.setItem(LOCAL_PICK_KEY, JSON.stringify(picks.slice(0, LOCAL_MAX)));
  } catch { /* 저장 불가 환경 — 세지 않을 뿐 화면은 멀쩡하다 */ }
}
