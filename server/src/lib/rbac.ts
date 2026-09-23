// ─────────────────────────────────────────────────────────────────────────────
// rbac.ts — 누가 무엇을 할 수 있는가. **판정은 이 파일에서만 한다.**
//
// 왜 한 곳인가 — Firestore 에서는 이 판정이 보안 규칙의 다섯 함수(isRootAdmin ·
// isDelegatedAdmin · isApproved · smallDoc · favsOnly)와 화면 코드에 나뉘어 있었다.
// 두 벌이면 한쪽만 고쳐진다: v3.39.0 에 위임 관리자가 가입 승인을 할 수 있던 것을
// v3.41.0 이 규칙에서 좁혔는데 화면은 그대로여서, 눌리는 버튼이 실패로 끝났다.
//
// **권한은 한 칸(users.role)이다.** Firestore 는 allowlist 와 requests 두 컬렉션으로
// 갈라 뒀는데, 그건 규칙이 이메일로만 문서를 찾을 수 있어서였지 뜻이 둘이어서가 아니다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

/** 0004_identity.sql 의 `check (role in (...))` 와 같은 넷. 차례가 곧 크기다 */
export const ROLES = ['pending', 'approved', 'admin', 'root'] as const;
export type Role = (typeof ROLES)[number];

/** 바깥에서 온 문자열을 권한으로 받아도 되는가 — DB 가 거부할 값을 코드가 만들지 않게 */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

const RANK: Record<Role, number> = { pending: 0, approved: 1, admin: 2, root: 3 };

/** 위가 아래를 포함한다 */
export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * 가입 승인 · 관리자 지정 · 실험 기능 지정 — **루트만.**
 * 위임 관리자는 운영을 돕는 자리다. 사람을 들이고 내보내는 일은 서비스의 주인이 한다
 */
export function canApproveUsers(role: Role): boolean {
  return role === 'root';
}

/**
 * 실험 기능을 쓸 수 있는가 — **루트는 늘 켜져 있다** (v4 stores/auth.ts 의 `let beta = adminRoot`).
 * 루트는 서비스를 만든 사람이라 자기에게 깃발을 달아 줄 자리가 없다. 칸만 그대로 내보냈더니
 * v5 dev 에서 주인 계정의 '내 포켓몬' 이 잠겼다 (2026-09-23)
 */
export function hasBeta(role: Role, beta: boolean | null | undefined): boolean {
  return role === 'root' || beta === true;
}

/** 트레이너 코드 쓰기 — 관리자 둘 다 */
export function canWriteTrainers(role: Role): boolean {
  return atLeast(role, 'admin');
}

/** 트레이너 코드 읽기 — 승인된 사람부터 */
export function canReadTrainers(role: Role): boolean {
  return atLeast(role, 'approved');
}

/**
 * 담아 둘 수 있는 마리 수.
 * **승인 대기도 담는다** (v3.60.0) — 승인을 기다리는 동안 담아 둔 것이 있어야
 * 기다릴 이유도 생긴다. 다만 열어 주는 것은 담아 두기 하나뿐이다
 */
export function favoriteCap(role: Role): number {
  return role === 'pending' ? 200 : 1000;
}
