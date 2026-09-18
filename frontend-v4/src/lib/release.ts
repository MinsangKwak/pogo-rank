// ─────────────────────────────────────────────────────────────────────────────
// lib/release.ts — 새 패치노트가 있다는 빨간 점
//
// **본 판을 문자열 하나로 기억한다** (v3 components/release.js 와 같은 키·같은 규칙).
// 그 값이 지금 RELEASE_VER 과 다르면 새 소식이 있다고 본다 — 날짜나 항목 수를 비교하지 않으므로
// 문구만 손볼 때는 점이 뜨지 않는다.
//
// 저장이 막힌 환경(사생활 보호 모드)에서는 **'이미 봤다' 로 친다** — 기록을 남길 수 없는
// 브라우저에서 빨간 점이 매번 다시 뜨는 것이 더 거슬린다.
// ─────────────────────────────────────────────────────────────────────────────
const SEEN_KEY = 'pogo_release_seen';   // v3 와 같은 키

/** 이 판을 이미 읽었는가 */
export function releaseSeen(version: string): boolean {
  try { return localStorage.getItem(SEEN_KEY) === version; } catch { return true; }
}

/** 패치노트를 열었을 때 — 이 판을 읽은 것으로 적는다 */
export function markReleaseSeen(version: string) {
  try { localStorage.setItem(SEEN_KEY, version); } catch { /* 저장 불가 환경 */ }
  // 셸의 빨간 점이 이 판정을 다시 하도록 알린다 (Shell.tsx 가 듣는다)
  window.dispatchEvent(new CustomEvent('moncamp:release-seen'));
}
