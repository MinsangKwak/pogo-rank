// ─────────────────────────────────────────────────────────────────────────────
// lib/authMock.ts — 로컬 확인용 가짜 로그인 (v3 static/dev-mock.js 와 같은 자리)
//
// 왜 있나 — localhost 에서는 Google 팝업이 자주 막힌다. 로그인 뒤에만 보이는 화면
// (계정 카드 · 승인 대기 · ★ 계정 저장)을 짐작이 아니라 눈으로 확인하려고 둔다.
// **배포에서는 절대 안 탄다** — mockWanted() 가 localhost 와 ?mock 둘 다를 요구한다.
//
//   ?mock=1        승인된 관리자
//   ?mock=friend   승인된 일반 사용자
//   ?mock=pending  승인 대기
//   ?mock=anon     로그인 전
//   ?mock=reset    저장해 둔 가짜 문서를 지우고 시작
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthApi, AuthUser, DocData } from './authApi';

const DB_KEY = 'pogo_mock_db';

export function makeMockApi(adminUid: string): AuthApi {
  const mode = new URLSearchParams(location.search).get('mock') || '1';
  const users: Record<string, AuthUser> = {
    '1': { uid: adminUid || 'mock-admin', email: 'admin@mock.local', displayName: '로컬 테스트 (관리자)', photoURL: '' },
    friend: { uid: 'mock-friend', email: 'friend@mock.local', displayName: '로컬 테스트 (친구)', photoURL: '' },
    pending: { uid: 'mock-pending', email: 'pending@mock.local', displayName: '로컬 테스트 (대기)', photoURL: '' },
  };
  let user: AuthUser | null = mode === 'anon' ? null : (users[mode] ?? users['1']!);

  let db: Record<string, DocData> = {};
  try { db = mode === 'reset' ? {} : JSON.parse(localStorage.getItem(DB_KEY) || '{}'); } catch { db = {}; }
  // 승인된 친구는 허용 목록에 있어야 'ok' 가 된다 (규칙과 같은 뜻)
  db['allowlist/friend@mock.local'] ??= { approved: true };
  // ★ 를 v3 dev-mock.js 와 **같은 값으로** 심는다 — 다르면 나란히 놓고 비교할 때
  // 화면이 틀린 것인지 씨앗이 다른 것인지 구분이 안 된다. 실제 도감번호만 쓴다
  db[`users/${users['1']!.uid}`] ??= { email: 'admin@mock.local', name: '로컬 테스트 (관리자)', favs: [150, 384, 383, 149, 68, 143, 302, 227, 25] };
  db['users/mock-friend'] ??= { email: 'friend@mock.local', name: '로컬 테스트 (친구)', favs: [150, 6, 302] };
  const save = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* 저장 불가 환경 */ } };
  save();

  let notify: ((next: AuthUser | null) => void) | null = null;
  const tell = () => notify?.(user);

  return {
    onUser(fn) { notify = fn; setTimeout(tell, 60); },
    async signIn() { user = users[mode === 'anon' ? '1' : mode] ?? users['1']!; tell(); },
    async signOut() { user = null; tell(); },
    async deleteUser() { user = null; tell(); },
    async getDoc(path) { return db[path] ?? null; },
    async setDoc(path, data) { db[path] = { ...(db[path] ?? {}), ...data }; save(); },
    async deleteDoc(path) { delete db[path]; save(); },
    async arrayEdit(path, field, value, add) {
      const now = Array.isArray(db[path]?.[field]) ? (db[path]![field] as number[]) : [];
      db[path] = { ...(db[path] ?? {}), [field]: add ? [...new Set([...now, value])] : now.filter((one) => one !== value) };
      save();
    },
  };
}
