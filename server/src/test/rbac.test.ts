// ─────────────────────────────────────────────────────────────────────────────
// rbac.test.ts — 권한 판정이 Firestore 규칙과 같은 답을 내는지 본다 (v5 Phase 4)
//
// **무엇을 옮겨 왔나.** firestore.rules 의 isRootAdmin() · isDelegatedAdmin() · isApproved()
// · smallDoc() · favsOnly() 다. 규칙에서는 다섯 함수였고 화면에도 같은 뜻의 검사가 또 있었다.
// 두 벌이면 한쪽만 고쳐진다 — v3.39.0 에 위임 관리자가 가입 승인을 할 수 있던 것을
// v3.41.0 이 규칙에서 좁혔는데, 화면은 그대로라 눌리는 버튼이 실패로 끝났다.
//
// **개체(mons)는 안 본다.** 0004_identity.sql 이 적은 대로 표를 안 만들었다 — v4 화면이
// 한 번도 안 쓴다. 규칙의 '대기는 개체를 못 쓴다' 는 서버에 그 자리가 없어 저절로 지켜진다.
// 표가 생기는 날 이 파일에 함께 들어온다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect } from 'vitest';
import { ROLES, isRole, atLeast, canApproveUsers, canWriteTrainers, canReadTrainers, favoriteCap } from '../lib/rbac.ts';

describe('권한은 넷이고 차례가 있다', () => {
  it('스키마의 check 제약과 같은 넷이다', () => {
    // 0004_identity.sql 의 check (role in (...)) 와 어긋나면 DB 가 못 넣는 값을 코드가 만든다
    expect([...ROLES]).toEqual(['pending', 'approved', 'admin', 'root']);
  });

  it('모르는 값은 권한이 아니다', () => {
    expect(isRole('root')).toBe(true);
    expect(isRole('superuser')).toBe(false);
    expect(isRole('')).toBe(false);
    expect(isRole('ROOT')).toBe(false);
  });

  it('위가 아래를 포함한다', () => {
    expect(atLeast('root', 'admin')).toBe(true);
    expect(atLeast('admin', 'approved')).toBe(true);
    expect(atLeast('approved', 'approved')).toBe(true);
    expect(atLeast('approved', 'admin')).toBe(false);
    expect(atLeast('pending', 'approved')).toBe(false);
  });
});

describe('사람을 들이고 내보내는 일은 루트만 (v3.41.0 이 좁힌 자리)', () => {
  it('위임 관리자는 가입 승인을 못 한다', () => {
    // 규칙의 allow create, update: if isRootAdmin() 과 같은 답이어야 한다.
    // 위임 관리자가 할 수 있는 일은 운영을 돕는 것이지 서비스의 주인이 되는 것이 아니다
    expect(canApproveUsers('root')).toBe(true);
    expect(canApproveUsers('admin')).toBe(false);
    expect(canApproveUsers('approved')).toBe(false);
    expect(canApproveUsers('pending')).toBe(false);
  });
});

describe('트레이너 코드 — 승인된 사람이 읽고 관리자 둘 다 쓴다', () => {
  it('읽기는 승인부터', () => {
    expect(canReadTrainers('pending')).toBe(false);
    expect(canReadTrainers('approved')).toBe(true);
    expect(canReadTrainers('admin')).toBe(true);
    expect(canReadTrainers('root')).toBe(true);
  });

  it('쓰기는 관리자부터 — 위임 관리자도 쓴다', () => {
    expect(canWriteTrainers('approved')).toBe(false);
    expect(canWriteTrainers('admin')).toBe(true);
    expect(canWriteTrainers('root')).toBe(true);
  });
});

describe('담아 두기 한도 — 승인 대기도 담는다 (v3.60.0)', () => {
  it('대기는 200, 승인부터는 1000', () => {
    // 승인을 기다리는 동안에도 담아 둘 수 있어야 한다.
    // 승인된 뒤에 "이제 다시 담으세요" 는 말이 안 된다
    expect(favoriteCap('pending')).toBe(200);
    expect(favoriteCap('approved')).toBe(1000);
    expect(favoriteCap('admin')).toBe(1000);
    expect(favoriteCap('root')).toBe(1000);
  });
});
