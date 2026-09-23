// ─────────────────────────────────────────────────────────────────────────────
// lib/pwa.ts — 서비스 워커 등록
//
// **배포 환경에서만 등록한다** (v3 app.js 와 같은 조건). 로컬 개발에서 켜 두면
// 캐시가 꼬여 고친 것이 안 보이는 시간을 계속 잡아먹는다.
// 조건에 moncamp.kr 이 들어 있는 이유 — github.io 만 보던 시절 커스텀 도메인으로 옮기자
// PWA 캐시가 조용히 꺼져 있었다 (v3.27.0 에 잡았다).
// ─────────────────────────────────────────────────────────────────────────────
import { BASE } from './base';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const host = location.hostname;
  if (!(host.endsWith('github.io') || host.endsWith('moncamp.kr'))) return;
  navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => { /* 등록 실패는 조용히 — 앱은 그대로 돈다 */ });
}
