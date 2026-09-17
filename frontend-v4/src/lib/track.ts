// ─────────────────────────────────────────────────────────────────────────────
// lib/track.ts — GA4 이벤트 (v3 scripts/track.js 와 **같은 이벤트명·같은 가상 경로**)
//
// 이름을 바꾸면 v3.57.0 에 겨우 맞춰 놓은 지표가 끊긴다.
// 미리보기 빌드에는 GA 를 넣지 않는다 — 여기서는 호출 자리만 갖춰 둔다.
// ─────────────────────────────────────────────────────────────────────────────
declare global {
  interface Window { gtag?: (...args: unknown[]) => void; __trackLog?: unknown[][] }
}

const ON = typeof window !== 'undefined' && typeof window.gtag === 'function';

export function track(name: string, params: Record<string, unknown> = {}): void {
  if (ON) window.gtag?.('event', name, params);
  // 미리보기에서는 무엇이 찍히는지 볼 수 있게 남겨 둔다 (콘솔에서 window.__trackLog)
  (window.__trackLog ??= []).push([name, params]);
}

/** 해시는 pathname 이 아니다 — GA4 '페이지 경로' 가 되려면 가상 경로로 바꿔야 한다 (v3.57.0) */
export function gaVirtualUrl(): string {
  const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0]?.replace(/\/+$/, '') ?? '';
  return `${location.origin}/${raw}`;
}

export function trackPageView(title: string): void {
  if (!ON) return;
  window.gtag?.('event', 'page_view', {
    page_location: gaVirtualUrl(),
    page_title: title,
  });
}
