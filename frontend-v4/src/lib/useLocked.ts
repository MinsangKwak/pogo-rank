// ─────────────────────────────────────────────────────────────────────────────
// lib/useLocked.ts — 로그인해야 열리는 화면인가 (v3 router.js routeLocked)
//
// **판정을 한 곳에 둔다.** 이 답을 쓰는 자리가 셋이다 —
//   화면 본문(App 의 Screen) · ☰ 메뉴와 PC 사이드바 줄 · 서비스 홈 타일.
// v3 도 routeLocked 하나를 셋이 나눠 썼다. 나뉘어 있으면 한쪽만 고쳐지는 날이 온다.
//
// 규칙
//   - **판정 중에는 잠그지 않는다** — 이 기기에 로그인 자취가 있을 때만 'loading' 이라 곧 열릴 화면이고,
//     잠갔다 여는 깜빡임은 "로그아웃됐다" 로 읽힌다
//   - 로그인을 쓸 수 없는 빌드에서는 잠그지 않는다 — 열 길이 없는 자물쇠는 고장과 같다
//
// 잠금 표시는 **막는 것이 아니라 보여 주는 것**이다. 실제 차단은 화면 본문이 하고,
// 그보다 앞서 보안 규칙(firestore.rules)이 한다 (v3 syncLockedNav 머리말과 같은 전제).
// ─────────────────────────────────────────────────────────────────────────────
import { routeById } from '../routes';
import { useAuthStore } from '../stores/auth';

export function useLocked(routeId: string): boolean {
  const enabled = useAuthStore((s) => s.enabled);
  const status = useAuthStore((s) => s.status);
  if (!routeById(routeId)?.locked || !enabled) return false;
  if (status === 'loading') return false;
  return status !== 'ok';
}

/** 잠긴 줄에 붙는 것들 — 클래스·aria·설명글을 한 벌로 (v3 syncLockedNav 와 같은 값) */
export function lockedAttrs(locked: boolean) {
  return {
    className: locked ? ' is-locked' : '',
    'aria-disabled': locked ? ('true' as const) : undefined,
    title: locked ? '로그인하면 열려요' : '',
  };
}
