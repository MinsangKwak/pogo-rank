// ─────────────────────────────────────────────────────────────────────────────
// lib/useLocked.ts — 잠긴 화면인가, 그리고 **왜** 잠겼는가 (v3 router.js routeLocked)
//
// **판정을 한 곳에 둔다.** 이 답을 쓰는 자리가 셋이다 —
//   화면 본문(App 의 Screen) · ☰ 메뉴와 PC 사이드바 줄 · 서비스 홈 타일.
// v3 도 routeLocked 하나를 셋이 나눠 썼다. 나뉘어 있으면 한쪽만 고쳐지는 날이 온다.
//
// **잠긴 까닭이 둘이라 답도 둘이다.**
//   login  로그인·승인이 없다 — 로그인 버튼을 내밀면 풀린다
//   beta   실험 기능이다 — 로그인해도 관리자가 깃발을 달아 줘야 열린다
// 둘을 한 글자로 묶으면 승인된 사람에게 "로그인하면 열려요" 를 내밀게 된다. 이미 했는데.
//
// 규칙
//   - **판정 중에는 잠그지 않는다** — 이 기기에 로그인 자취가 있을 때만 'loading' 이라 곧 열릴 화면이고,
//     잠갔다 여는 깜빡임은 "로그아웃됐다" 로 읽힌다
//   - 로그인을 쓸 수 없는 빌드에서는 잠그지 않는다 — 열 길이 없는 자물쇠는 고장과 같다
//   - **판정 중에 잠긴 화면의 본문을 그리지도 않는다** (useLockChecking) — 메뉴 줄은 링크라
//     누를 때마다 문서를 새로 열고, 그러면 늘 'loading' 에서 시작한다. 그때 본문을 그렸더니
//     실험 기능이 없는 사람에게 '내 포켓몬' 이 떴다가 잠금 카드로 지워졌다 (2026-09-23 dev 제보)
//   - **실험 기능 잠금은 누를 수 없다** (inert) — 로그인한 사람이 눌러 봐야 할 수 있는 일이 없다.
//     로그인 잠금은 눌리게 둔다 — 누르면 로그인 버튼이 있는 카드로 간다
//
// 잠금 표시는 **막는 것이 아니라 보여 주는 것**이다. 실제 차단은 화면 본문이 하고,
// 그보다 앞서 보안 규칙(firestore.rules)이 한다 (v3 syncLockedNav 머리말과 같은 전제).
// ─────────────────────────────────────────────────────────────────────────────
import { routeById } from '../routes';
import { useAuthStore } from '../stores/auth';

export type LockReason = '' | 'login' | 'beta';

const LOCK_TITLE: Record<Exclude<LockReason, ''>, string> = {
  login: '로그인하면 열려요',
  beta: '실험 기능이에요',
};

export function useLockReason(routeId: string): LockReason {
  const enabled = useAuthStore((s) => s.enabled);
  const status = useAuthStore((s) => s.status);
  const beta = useAuthStore((s) => s.beta);
  const route = routeById(routeId);
  if (!route || !enabled) return '';
  if (status === 'loading') return '';
  if (route.locked && status !== 'ok') return 'login';
  if (route.beta && !beta) return 'beta';
  return '';
}

/** 로그인이 걸린 화면인데 아직 확인 중인가 — 이때는 본문 대신 '확인 중' 을 세운다 */
export function useLockChecking(routeId: string): boolean {
  const enabled = useAuthStore((s) => s.enabled);
  const status = useAuthStore((s) => s.status);
  return enabled && status === 'loading' && !!routeById(routeId)?.locked;
}

/** 잠긴 줄에 붙는 것들 — 클래스·aria·설명글을 한 벌로 (v3 syncLockedNav 와 같은 값) */
export function lockedAttrs(reason: LockReason) {
  return {
    className: reason ? ' is-locked' : '',
    'aria-disabled': reason ? ('true' as const) : undefined,
    title: reason ? LOCK_TITLE[reason] : '',
    // 주소를 떼면 링크가 아니다 — 눌러도, 길게 눌러 새 탭으로 열어도 아무 데도 안 간다
    inert: reason === 'beta',
  };
}
