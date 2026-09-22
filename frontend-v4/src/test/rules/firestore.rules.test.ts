// ─────────────────────────────────────────────────────────────────────────────
// test/rules/firestore.rules.test.ts — 보안 규칙을 에뮬레이터로 실제 돌려 본다 (v4.9.7)
//
// **왜 생겼나** — users/{uid} 삭제가 쓰기 한도가 규칙에 들어온 뒤로 한 번도 허용된 적이 없었다.
// write 하나로 셋(create·update·delete)을 묶고 본문 크기를 검사했는데, 삭제 요청에는
// request.resource 가 없다(null). 규칙은 오류로 죽고 오류는 거부다. 콘솔도 코드도 조용했다 —
// 화면은 "삭제 실패 permission-denied" 라고만 말했다. 규칙을 기계로 읽는 자리가 없었다.
//
// 자리표시자 __ADMIN_UID__ 는 **메모리에서만** 채운다. 파일로 쓰지 않는다 — render_rules.sh 가
// mock uid 로 만든 판이 콘솔에 게시되는 사고를 막는 그 자리다 (CLAUDE.md §4).
//
//   cd frontend-v4 && npm run test:rules
//   RULES_PATH=/tmp/old.rules npm run test:rules   # 고치기 전 판으로 돌려 빨개지는지 볼 때
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';

const ROOT = 'root-admin-uid';
const RULES_PATH = process.env['RULES_PATH'] ?? resolve(__dirname, '../../../../firestore.rules');
const rules = readFileSync(RULES_PATH, 'utf8').replace("'__ADMIN_UID__'", `'${ROOT}'`);

// 실데이터가 아니다 — 검사용 자리. 예약 도메인(.test)이라 누구의 주소도 아니다
const APPROVED = { uid: 'uid-approved', email: 'approved@example.test' };
const PENDING = { uid: 'uid-pending', email: 'pending@example.test' };
const OTHER = { uid: 'uid-other', email: 'other@example.test' };

let env: RulesTestEnvironment;
const as = (who: { uid: string; email: string }) =>
  env.authenticatedContext(who.uid, { email: who.email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
// 규칙을 우회해 자리를 심는다 — 재는 것은 규칙이고 씨앗은 그 대상이 아니다
const seed = (fn: (db: Firestore) => Promise<void>) =>
  env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore() as unknown as Firestore));
const keys = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, i]));

beforeAll(async () => {
  const [host, port] = (process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8085').split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-moncamp', firestore: { rules, host, port: Number(port) } });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, `allowlist/${APPROVED.email}`), { approvedAt: 1 });
    await setDoc(doc(db, `users/${APPROVED.uid}`), { email: APPROVED.email, favs: [1, 2] });
    await setDoc(doc(db, `users/${PENDING.uid}`), { email: PENDING.email, favs: [3] });
    await setDoc(doc(db, `requests/${PENDING.email}`), { email: PENDING.email });
  });
});

describe('users/{uid} — 삭제는 본인이면 된다 (v4.9.7 이 고친 자리)', () => {
  it('승인된 본인이 지운다', async () => {
    await assertSucceeds(deleteDoc(doc(as(APPROVED), `users/${APPROVED.uid}`)));
  });
  it('승인 대기 중인 본인도 지운다 — 자기 계정을 지우는 길은 승인과 무관하게 열려 있다', async () => {
    await assertSucceeds(deleteDoc(doc(as(PENDING), `users/${PENDING.uid}`)));
  });
  it('남의 문서는 못 지운다', async () => {
    await assertFails(deleteDoc(doc(as(OTHER), `users/${APPROVED.uid}`)));
  });
  it('로그인 전에는 못 지운다', async () => {
    await assertFails(deleteDoc(doc(anon(), `users/${APPROVED.uid}`)));
  });
});

describe('users/{uid} — 쓰기 한도는 그대로다 (삭제를 가르며 흔들리지 않았는지)', () => {
  it('승인: 필드 12개까지', async () => {
    const db = as(APPROVED);
    await assertSucceeds(setDoc(doc(db, `users/${APPROVED.uid}`), keys(12)));
    await assertFails(setDoc(doc(db, `users/${APPROVED.uid}`), keys(13)));
  });
  it('승인: 개체 300마리까지 — 클라이언트 PLAN_MAX_MONS 와 같은 값', async () => {
    const db = as(APPROVED);
    await assertSucceeds(setDoc(doc(db, `users/${APPROVED.uid}`), { mons: Array(300).fill(0) }));
    await assertFails(setDoc(doc(db, `users/${APPROVED.uid}`), { mons: Array(301).fill(0) }));
  });
  it('대기: 즐겨찾기 200까지, 개체는 못 쓴다', async () => {
    const db = as(PENDING);
    await assertSucceeds(setDoc(doc(db, `users/${PENDING.uid}`), { favs: Array(200).fill(1) }));
    await assertFails(setDoc(doc(db, `users/${PENDING.uid}`), { favs: Array(201).fill(1) }));
    await assertFails(setDoc(doc(db, `users/${PENDING.uid}`), { mons: [0] }));
  });
  it('남의 문서는 읽지도 쓰지도 못한다 · 본인은 읽는다', async () => {
    await assertFails(setDoc(doc(as(OTHER), `users/${APPROVED.uid}`), { favs: [] }));
    await assertFails(getDoc(doc(as(OTHER), `users/${APPROVED.uid}`)));
    const mine = await assertSucceeds(getDoc(doc(as(APPROVED), `users/${APPROVED.uid}`)));
    expect(mine.exists()).toBe(true);
  });
});

describe('allowlist · requests — 본인 문서 삭제 (v2.18.0 부터 열려 있던 자리)', () => {
  it('allowlist: 본인은 지우고, 남의 것은 못 지우고, 만드는 것은 루트만', async () => {
    await assertFails(deleteDoc(doc(as(OTHER), `allowlist/${APPROVED.email}`)));
    await assertFails(setDoc(doc(as(APPROVED), `allowlist/${APPROVED.email}`), { admin: true }));
    await assertSucceeds(deleteDoc(doc(as(APPROVED), `allowlist/${APPROVED.email}`)));
  });
  it('requests: 본인은 지운다', async () => {
    await assertSucceeds(deleteDoc(doc(as(PENDING), `requests/${PENDING.email}`)));
  });
});

describe('계정 삭제 네 걸음 — Account.tsx 가 지우는 순서 그대로', () => {
  it('users → allowlist → requests 가 차례로 지워진다', async () => {
    await seed(async (db) => { await setDoc(doc(db, `requests/${APPROVED.email}`), { email: APPROVED.email }); });
    const db = as(APPROVED);
    await assertSucceeds(deleteDoc(doc(db, `users/${APPROVED.uid}`)));
    await assertSucceeds(deleteDoc(doc(db, `allowlist/${APPROVED.email}`)));
    await assertSucceeds(deleteDoc(doc(db, `requests/${APPROVED.email}`)));
    await seed(async (raw) => {
      for (const path of [`users/${APPROVED.uid}`, `allowlist/${APPROVED.email}`, `requests/${APPROVED.email}`]) {
        expect((await getDoc(doc(raw, path))).exists(), path).toBe(false);
      }
    });
  });
});
