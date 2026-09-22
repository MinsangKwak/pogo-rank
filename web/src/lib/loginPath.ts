// ─────────────────────────────────────────────────────────────────────────────
// lib/loginPath.ts — 로그인을 마치고 돌아갈 자리 (v5 Phase 6)
//
// **열린 리다이렉트를 막는 한 함수.** 서버에도 같은 판정이 있다
// (`server/src/lib/loginState.ts` 의 safePath) — 양쪽에 두는 이유는 서로를 믿지 않기
// 위해서다. 화면 쪽이 뚫려도 서버가 잡고, 서버 판이 낡아도 화면이 이상한 값을 안 보낸다.
// ─────────────────────────────────────────────────────────────────────────────

export function safePath(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  // 역슬래시를 슬래시로 읽는 브라우저가 있다 — `/\evil.test` 가 그 틈이다
  if (raw.includes('\\')) return '/';
  return raw.slice(0, 500);
}
