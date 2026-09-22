// ─────────────────────────────────────────────────────────────────────────────
// auth.test.ts — 로그인·회전·폐기가 실제 DB 위에서 도는지 본다 (v5 Phase 4)
//
// **여기가 이 판에서 제일 조심할 자리다.** Firebase Auth 가 하던 일을 통째로 가져왔고,
// 틀려도 증상이 없는 종류의 코드다 — 로그인은 되는데 훔친 토큰도 같이 되는 식이다.
//
// 재는 것 넷
//   ① 사람이 하나로 모이는가 — google_sub 가 축이고 이메일이 바뀌어도 같은 사람이다
//   ② 잠기지 않는가 — ROOT_EMAIL 은 스스로를 루트로 되돌린다 (규칙에 uid 를 박던 자리)
//   ③ **재사용이 잡히면 사슬 전체가 끊기는가** — 이 파일에서 가장 중요한 검사다
//   ④ 계정 삭제가 한 걸음인가 — Firestore 는 넷이었고 그중 하나가 조용히 빠져 있었다
//
//   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/moncamp_test npm test
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { makeAccessTokens } from '../lib/jwt.ts';
import { makeAuth, AuthError, type Auth, type GoogleProfile } from '../services/auth.ts';
import { testDatabaseUrl } from './dbUrl.ts';

const url = testDatabaseUrl();
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

const SECRET = 'a'.repeat(48);
const ROOT_EMAIL = 'owner@example.test';
const tokens = makeAccessTokens(SECRET);

// 실데이터가 아니다 — 예약 도메인(.test)이라 누구의 주소도 아니다
const friend: GoogleProfile = { sub: 'g-friend', email: 'friend@example.test', name: '친구', picture: 'https://x.test/a.png' };
const owner: GoogleProfile = { sub: 'g-owner', email: ROOT_EMAIL, name: '주인', picture: '' };

let sql: Sql;
let auth: Auth;

/** 그 일이 AuthError 로 막히는가 — 막혔다면 이유를 돌려준다 */
async function refused(run: () => Promise<unknown>): Promise<string> {
  try { await run(); return '(안 막혔다)'; }
  catch (error) { return error instanceof AuthError ? error.reason : `(다른 오류: ${String(error)})`; }
}

const liveSessions = async (userId: string) => {
  const [row] = await sql<{ n: string }[]>`
    select count(*)::text as n from sessions
     where user_id = ${userId} and revoked_at is null and used_at is null`;
  return Number(row!.n);
};

describe.skipIf(!url)('인증 서버', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
  });
  afterAll(async () => { if (sql) await sql.end(); });
  beforeEach(async () => {
    await sql`delete from users`;
    auth = makeAuth(sql, tokens, { rootEmail: ROOT_EMAIL });
  });

  // ── ① 사람이 하나로 모인다 ────────────────────────────────────────────────
  describe('처음 로그인', () => {
    it('승인 대기로 사람이 생긴다', async () => {
      const session = await auth.signIn(friend);
      expect(session.role).toBe('pending');
      expect(session.beta).toBe(false);
      const [row] = await sql<{ email: string; role: string; display_name: string }[]>`
        select email, role, display_name from users`;
      expect(row!.email).toBe(friend.email);
      expect(row!.role).toBe('pending');
      expect(row!.display_name).toBe('친구');
    });

    it('구글이 대문자 이메일을 줘도 소문자로 담는다', async () => {
      // 스키마의 check (email = lower(email)) 가 막는 자리다 — 앱이 먼저 낮춰야 통과한다.
      // 안 낮추면 같은 사람이 두 줄이 된다
      await auth.signIn({ ...friend, email: 'Friend@Example.TEST' });
      const [row] = await sql<{ email: string }[]>`select email from users`;
      expect(row!.email).toBe('friend@example.test');
    });

    it('액세스 토큰에 권한이 담긴다', async () => {
      const session = await auth.signIn(friend);
      const claims = await tokens.verify(session.access);
      expect(claims.role).toBe('pending');
      expect(claims.sub).toBe(session.userId);
    });
  });

  describe('다시 로그인', () => {
    it('사람이 안 늘고 이름·사진이 갱신된다', async () => {
      await auth.signIn(friend);
      await auth.signIn({ ...friend, name: '친구2', picture: 'https://x.test/b.png' });
      const rows = await sql<{ display_name: string; photo_url: string }[]>`select display_name, photo_url from users`;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.display_name).toBe('친구2');
      expect(rows[0]!.photo_url).toBe('https://x.test/b.png');
    });

    it('이메일이 바뀌어도 같은 사람이다 — 축은 google_sub 다', async () => {
      const first = await auth.signIn(friend);
      const again = await auth.signIn({ ...friend, email: 'moved@example.test' });
      expect(again.userId).toBe(first.userId);
      const [row] = await sql<{ email: string }[]>`select email from users`;
      expect(row!.email).toBe('moved@example.test');
    });

    it('권한을 올려 두면 다음 로그인에 그 권한이 담긴다', async () => {
      const first = await auth.signIn(friend);
      await sql`update users set role = 'approved' where id = ${first.userId}`;
      const again = await auth.signIn(friend);
      expect(again.role).toBe('approved');
    });

    it('로그인한다고 권한이 초기화되지 않는다', async () => {
      // upsert 가 role 까지 덮어쓰면 관리자가 로그인할 때마다 대기로 떨어진다
      const first = await auth.signIn(friend);
      await sql`update users set role = 'admin', beta = true where id = ${first.userId}`;
      const again = await auth.signIn(friend);
      expect(again.role).toBe('admin');
      expect(again.beta).toBe(true);
    });
  });

  // ── ② 잠기지 않는다 ──────────────────────────────────────────────────────
  describe('루트 관리자 (규칙에 uid 를 박던 자리)', () => {
    it('ROOT_EMAIL 로 처음 로그인하면 루트다', async () => {
      expect((await auth.signIn(owner)).role).toBe('root');
    });

    it('루트가 끌어내려져 있어도 로그인에서 되돌아온다', async () => {
      // 잠금 방지용 열쇠다. Firestore 는 이것을 규칙 본문의 uid 로 했다 —
      // 누구도 못 뺏지만 콘솔에 게시해야 바뀌는 값이라, 고치려면 배포가 아니라 사람이 움직여야 했다.
      // 여기서는 환경변수 하나다
      const first = await auth.signIn(owner);
      await sql`update users set role = 'pending' where id = ${first.userId}`;
      expect((await auth.signIn(owner)).role).toBe('root');
    });

    it('루트가 아닌 사람은 로그인으로 루트가 안 된다', async () => {
      expect((await auth.signIn(friend)).role).toBe('pending');
      const [row] = await sql<{ n: string }[]>`select count(*)::text as n from users where role = 'root'`;
      expect(row!.n).toBe('0');
    });

    it('루트 이메일을 든 다른 구글 계정은 거부된다', async () => {
      // 이메일만 보고 루트를 내주면, 같은 주소로 계정을 새로 판 사람이 루트가 된다.
      // 축은 google_sub 라 그 줄은 남이고, 남에게 루트를 줄 이유가 없다
      await auth.signIn(owner);
      expect(await refused(() => auth.signIn({ ...owner, sub: 'g-impostor' }))).toBe('conflict');
      const rows = await sql<{ google_sub: string; role: string }[]>`select google_sub, role from users`;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.google_sub).toBe('g-owner');
    });
  });

  describe('이메일이 부딪힐 때', () => {
    it('남이 쓰는 이메일로 새 구글 계정이 오면 거부된다', async () => {
      // 구글 이메일은 재사용될 수 있다 — 계정을 지웠다 다시 만들면 주소는 같고 sub 는 다르다.
      // 넘겨주면 옛 계정이 담아 둔 것이 새 사람에게 간다. 거부는 막다른 길이지만
      // **사람이 풀 수 있는 막다른 길**이다 (옛 계정을 지우면 된다)
      await auth.signIn(friend);
      expect(await refused(() => auth.signIn({ ...friend, sub: 'g-new' }))).toBe('conflict');
    });

    it('이미 있는 사람의 주소를 남이 가져가도 그 사람의 줄은 그대로다', async () => {
      const mine = await auth.signIn(friend);
      await auth.signIn({ sub: 'g-other', email: 'other@example.test', name: '남', picture: '' });
      await refused(() => auth.signIn({ sub: 'g-other', email: friend.email, name: '남', picture: '' }));
      const [row] = await sql<{ google_sub: string }[]>`select google_sub from users where id = ${mine.userId}`;
      expect(row!.google_sub).toBe(friend.sub);
    });

    it('거부돼도 세션이 안 생긴다', async () => {
      await auth.signIn(friend);
      await refused(() => auth.signIn({ ...friend, sub: 'g-new' }));
      const [row] = await sql<{ n: string }[]>`select count(*)::text as n from sessions`;
      expect(row!.n).toBe('1');
    });
  });

  // ── ③ 회전과 사슬 ────────────────────────────────────────────────────────
  describe('리프레시 토큰', () => {
    it('DB 에는 원문이 없다 — 해시만 둔다', async () => {
      const session = await auth.signIn(friend);
      const [row] = await sql<{ refresh_hash: Uint8Array }[]>`select refresh_hash from sessions`;
      expect(Buffer.from(row!.refresh_hash).length).toBe(32);
      expect(Buffer.from(row!.refresh_hash).toString()).not.toContain(session.refresh);
    });

    it('회전하면 새 토큰이 나오고 옛 것은 죽는다', async () => {
      const first = await auth.signIn(friend);
      const second = await auth.rotate(first.refresh);
      expect(second.refresh).not.toBe(first.refresh);
      expect(await liveSessions(first.userId)).toBe(1);
    });

    it('회전해도 사슬은 같다', async () => {
      const first = await auth.signIn(friend);
      await auth.rotate(first.refresh);
      const rows = await sql<{ family_id: string }[]>`select distinct family_id from sessions`;
      expect(rows).toHaveLength(1);
    });

    it('★ 이미 쓴 토큰이 또 오면 사슬 전체가 끊긴다', async () => {
      // 네트워크가 답을 잃어 같은 것을 두 번 보냈거나, 누가 훔쳐 갔거나 — 구분할 방법이 없다.
      // 둘 다 끊는 쪽을 고른다. 훔친 쪽만 조용히 살아 있는 것보다 낫다
      const first = await auth.signIn(friend);
      const second = await auth.rotate(first.refresh);
      const third = await auth.rotate(second.refresh);

      expect(await refused(() => auth.rotate(first.refresh))).toBe('reuse');

      // 가장 최근 것까지 같이 죽는다 — 훔친 쪽이 최신 토큰을 들고 있을 수 있다
      expect(await refused(() => auth.rotate(third.refresh))).toBe('revoked');
      expect(await liveSessions(first.userId)).toBe(0);
    });

    it('다른 기기의 사슬은 안 끊긴다', async () => {
      // 폰에서 토큰이 새도 PC 는 계속 쓸 수 있어야 한다 — 사슬은 로그인마다 따로 선다
      const phone = await auth.signIn(friend, 'phone');
      const desktop = await auth.signIn(friend, 'desktop');
      await auth.rotate(phone.refresh);
      await refused(() => auth.rotate(phone.refresh));
      expect(await refused(() => auth.rotate(desktop.refresh))).toBe('(안 막혔다)');
    });

    it('만료된 토큰은 거부된다', async () => {
      const short = makeAuth(sql, tokens, { rootEmail: ROOT_EMAIL, refreshTtlDays: -1 });
      const session = await short.signIn(friend);
      expect(await refused(() => short.rotate(session.refresh))).toBe('expired');
    });

    it('없는 토큰은 거부된다', async () => {
      await auth.signIn(friend);
      expect(await refused(() => auth.rotate('made-up-token'))).toBe('unknown');
      expect(await refused(() => auth.rotate(''))).toBe('unknown');
    });

    it('회전하면 그때의 권한이 새 액세스 토큰에 담긴다', async () => {
      // 승인되자마자 다시 로그인하지 않아도 15분 안에 반영된다
      const first = await auth.signIn(friend);
      await sql`update users set role = 'approved' where id = ${first.userId}`;
      const claims = await tokens.verify((await auth.rotate(first.refresh)).access);
      expect(claims.role).toBe('approved');
    });

    it('권한을 뺏으면 다음 회전에서 따라 내려온다', async () => {
      const first = await auth.signIn(friend);
      await sql`update users set role = 'approved' where id = ${first.userId}`;
      const second = await auth.rotate(first.refresh);
      await sql`update users set role = 'pending' where id = ${first.userId}`;
      expect((await auth.rotate(second.refresh)).role).toBe('pending');
    });

    it('사람이 사라진 토큰은 거부된다', async () => {
      const session = await auth.signIn(friend);
      await sql`delete from users where id = ${session.userId}`;
      expect(await refused(() => auth.rotate(session.refresh))).toBe('unknown');
    });
  });

  // ── 로그아웃 ────────────────────────────────────────────────────────────
  describe('로그아웃', () => {
    it('그 기기만 끊는다', async () => {
      const phone = await auth.signIn(friend, 'phone');
      const desktop = await auth.signIn(friend, 'desktop');
      await auth.signOut(phone.refresh);
      expect(await refused(() => auth.rotate(phone.refresh))).toBe('revoked');
      expect(await refused(() => auth.rotate(desktop.refresh))).toBe('(안 막혔다)');
    });

    it('없는 토큰으로 로그아웃해도 조용히 끝난다', async () => {
      // 이미 지워진 쿠키로 다시 누르는 일은 흔하다. 오류를 낼 이유가 없다
      await expect(auth.signOut('made-up-token')).resolves.toBeUndefined();
    });

    it('전체 로그아웃은 모든 기기를 끊는다', async () => {
      const phone = await auth.signIn(friend, 'phone');
      const desktop = await auth.signIn(friend, 'desktop');
      await auth.signOutEverywhere(phone.userId);
      expect(await refused(() => auth.rotate(phone.refresh))).toBe('revoked');
      expect(await refused(() => auth.rotate(desktop.refresh))).toBe('revoked');
    });

    it('기기 목록을 보여 준다 — 사람을 가리키는 값은 안 담는다', async () => {
      await auth.signIn(friend, 'phone');
      const me = await auth.signIn(friend, 'desktop');
      const list = await auth.sessionsOf(me.userId);
      expect(list.map((one) => one.userAgent).sort()).toEqual(['desktop', 'phone']);
      // IP 가 표에 없다 (CLAUDE.md §3) — 담을 자리 자체를 안 만들었다
      expect(Object.keys(list[0]!)).not.toContain('ip');
    });
  });

  // ── ④ 계정 삭제 ─────────────────────────────────────────────────────────
  describe('계정 삭제', () => {
    it('한 걸음이다 — 사람·세션·담아 둔 것이 같이 사라진다', async () => {
      // Firestore 는 넷이었고(users · allowlist · requests · Auth 계정) 그중 allowlist 가
      // v4 에서 빠져 승인 목록에 이메일이 영영 남아 있었다 (v4.9.7). 여기서는 줄 하나다
      const session = await auth.signIn(friend);
      await sql`insert into favorites (user_id, dex) values (${session.userId}, 25)`;
      await auth.rotate(session.refresh);

      await auth.deleteAccount(session.userId);

      for (const table of ['users', 'sessions', 'favorites']) {
        const [row] = await sql.unsafe<{ n: string }[]>(`select count(*)::text as n from ${table}`);
        expect(row!.n, table).toBe('0');
      }
    });

    it('지운 사람의 토큰은 더 못 쓴다', async () => {
      const session = await auth.signIn(friend);
      await auth.deleteAccount(session.userId);
      expect(await refused(() => auth.rotate(session.refresh))).toBe('unknown');
    });

    it('남의 계정은 안 지워진다', async () => {
      const mine = await auth.signIn(friend);
      const other = await auth.signIn({ sub: 'g-other', email: 'other@example.test', name: '남', picture: '' });
      await auth.deleteAccount(other.userId);
      const [row] = await sql<{ id: string }[]>`select id from users`;
      expect(row!.id).toBe(mine.userId);
    });
  });
});
