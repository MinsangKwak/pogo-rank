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
