// ─────────────────────────────────────────────────────────────────────────────
// lib/autoUpdate.ts — 새 판이 올라오면 스스로 새로 고친다 (2026-09-30 주인 제보: PWA 가 업데이트되지 않는다)
//
// 왜 필요한가
//   설치한 앱(PWA)은 닫히지 않고 백그라운드에서 되살아난다. 한 번 열린 판의 JS 가 메모리에 남아
//   며칠이고 옛 화면을 보였다. 새 빌드를 알아보는 훅(data.ts useFreshness)은 있었지만 어디에도 걸려 있지 않았다.
//
// 어떻게
//   manifest.json 의 built(빌드 시각)를 **번들에 새긴 값**(next.config.ts)과 견준다 — 켤 때 · 되살아날 때(visible) · 5분마다.
//   새긴 값이 없으면(로컬 개발) 처음 받은 값을 기준으로 삼는다.
//   달라졌으면 새로 고친다. 되살아난 때는 바로, 보고 있는 중이면 팝업이 닫히고 입력 중이 아닐 때.
//   같은 빌드로는 한 번만 새로 고친다(sessionStorage) — 캐시가 어긋나 처음 값이 옛것으로 굳어도 무한히 돌지 않게
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { BASE } from './base';

export const RELOAD_KEY = 'pogo_reload_built';
export const CHECK_EVERY = 5 * 60 * 1000;

/** 지금 돌고 있는 번들이 구워질 때의 데이터 빌드 시각 (next.config.ts env). 로컬 개발에서는 비어 있다 */
export const BUNDLE_BUILT = process.env['NEXT_PUBLIC_DATA_BUILT'] ?? '';

/** 새로 고칠지 — 처음 값을 모르거나 같으면 아니다, 이 빌드로 이미 한 번 고쳤으면 아니다 */
export function needsReload(first: string, latest: string, done: string | null): boolean {
  return !!first && !!latest && first !== latest && done !== latest;
}

/** 지금 새로 고쳐도 되는 때 — 보고 있는 중이면 열린 팝업 · 입력칸이 없을 때만 */
export function safeNow(doc: Document): boolean {
  if (doc.visibilityState !== 'visible') return false;
  // 공유 링크 본문(/mon/…)도 <dialog open class="modal--page"> 로 그려진다 — 그것은 팝업이 아니다 (Codex, PR #278)
  if (doc.querySelector('dialog[open]:not(.modal--page)')) return false;
  const active = doc.activeElement;
  return !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement);
}

/** 서버의 빌드 시각 — 캐시를 거치지 않는다. 못 받으면 '' (새로 고치지 않는다) */
export async function latestBuilt(): Promise<string> {
  try {
    const res = await fetch(`${BASE}data/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return '';
    return String(((await res.json()) as { built?: string }).built ?? '');
  } catch {
    return '';
  }
}

/** 새로 고친다 — 남아 있는 서비스워커(v4 에서 설치한 앱)에도 새 파일을 묻게 한 뒤 */
export async function reloadFor(built: string): Promise<void> {
  try { sessionStorage.setItem(RELOAD_KEY, built); } catch { /* 저장 불가 환경 */ }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
    await Promise.all(regs.map((reg) => reg.update().catch(() => undefined)));
  } catch { /* 지원 안 하는 브라우저 */ }
  location.reload();
}
