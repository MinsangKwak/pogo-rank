// ─────────────────────────────────────────────────────────────────────────────
// domain.test.ts — 담아 두기 · 트레이너 코드 · 가입 승인 (v5 Phase 5)
//
// **여기가 Firestore 규칙이 막던 것을 서버가 막는 자리다.** Phase 4 는 판정(lib/rbac.ts)만
// 옮겨 왔고 강제할 자리가 없었다 — 담아 두기 API 가 없었기 때문이다. 이제 생긴다.
//
// 규칙에서 옮겨 온 약속 넷
//   ① 담아 두기 상한 — 승인 대기 200, 승인부터 1000 (favsOnly / smallDoc)
//   ② 트레이너 코드는 승인된 사람이 읽고 관리자 둘 다 쓴다
//   ③ **사람을 들이고 내보내는 일은 루트만** (v3.41.0 이 좁힌 자리)
//   ④ 남의 것은 못 읽고 못 쓴다
//
// 규칙에 없던 약속 하나
//   ⑤ **루트는 API 로 만들 수 없다.** Firestore 에는 admin: true 만 있었고 루트는 규칙에
//      박힌 uid 였다. 여기서도 루트는 ROOT_EMAIL 하나뿐이어야 한다 — 관리자가 스스로를
//      루트로 올릴 수 있으면 '위임' 이라는 말이 뜻을 잃는다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { makeDomain, DomainError, type Domain } from '../services/domain.ts';
import { testDatabaseUrl } from './dbUrl.ts';

const url = testDatabaseUrl();
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

let sql: Sql;
let domain: Domain;
let pending: string;
let approved: string;

/** 막히는가. 막혔다면 이유를 돌려준다 */
async function refused(run: () => Promise<unknown>): Promise<string> {
  try { await run(); return '(안 막혔다)'; }
  catch (error) { return error instanceof DomainError ? error.reason : `(다른 오류: ${String(error)})`; }
}

const makeUser = async (email: string, role: string): Promise<string> => {
  const [row] = await sql<{ id: string }[]>`
    insert into users (google_sub, email, role) values (${`g-${email}`}, ${email}, ${role}) returning id`;
  return row!.id;
};

describe.skipIf(!url)('도메인 API', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
  });
  afterAll(async () => { if (sql) await sql.end(); });
  beforeEach(async () => {
    await sql`delete from users`;
    await sql`delete from trainers`;
    domain = makeDomain(sql);
    pending = await makeUser('pending@example.test', 'pending');
    approved = await makeUser('approved@example.test', 'approved');
  });

  // ── ① 담아 두기 ─────────────────────────────────────────────────────────
  describe('담아 두기', () => {
    it('담고 빼고 읽는다', async () => {
      await domain.addFavorite(approved, 'approved', 25);
      await domain.addFavorite(approved, 'approved', 6);
      expect((await domain.favorites(approved)).sort((a, b) => a - b)).toEqual([6, 25]);

      await domain.removeFavorite(approved, 25);
      expect(await domain.favorites(approved)).toEqual([6]);
    });

    it('같은 것을 두 번 담아도 한 번이다', async () => {
      // Firestore 는 배열이라 통째로 덮어써야 했고 기기끼리 부딪혔다. 줄이면 그 문제가 없다
      await domain.addFavorite(approved, 'approved', 25);
      await domain.addFavorite(approved, 'approved', 25);
      expect(await domain.favorites(approved)).toEqual([25]);
    });

    it('없는 것을 빼도 조용히 끝난다', async () => {
      await expect(domain.removeFavorite(approved, 999)).resolves.toBeUndefined();
    });

    it('없는 포켓몬 번호는 막는다', async () => {
      expect(await refused(() => domain.addFavorite(approved, 'approved', 0))).toBe('invalid');
      expect(await refused(() => domain.addFavorite(approved, 'approved', -1))).toBe('invalid');
      expect(await refused(() => domain.addFavorite(approved, 'approved', 1.5))).toBe('invalid');
    });

    it('★ 승인 대기는 200 까지다', async () => {
      // 규칙의 favsOnly 가 막던 값이다. 클라이언트 검사는 우회되므로 서버가 막아야 뜻이 있다
      const rows = Array.from({ length: 200 }, (_, i) => i + 1);
      await sql`insert into favorites ${sql(rows.map((dex) => ({ user_id: pending, dex })))}`;
      expect(await refused(() => domain.addFavorite(pending, 'pending', 201))).toBe('limit');
    });

    it('★ 승인되면 1000 까지다', async () => {
      const rows = Array.from({ length: 200 }, (_, i) => i + 1);
      await sql`insert into favorites ${sql(rows.map((dex) => ({ user_id: approved, dex })))}`;
      // 대기였다면 여기서 막혔을 값이다
      await expect(domain.addFavorite(approved, 'approved', 201)).resolves.toBeUndefined();
    });

    it('상한에 닿아도 이미 담은 것은 다시 담긴다', async () => {
      // 넘칠 수 없는 요청까지 막으면, 같은 버튼을 두 번 누른 사람이 오류를 본다
      const rows = Array.from({ length: 200 }, (_, i) => i + 1);
      await sql`insert into favorites ${sql(rows.map((dex) => ({ user_id: pending, dex })))}`;
      await expect(domain.addFavorite(pending, 'pending', 7)).resolves.toBeUndefined();
    });

    it('남의 것은 안 보인다', async () => {
      await domain.addFavorite(approved, 'approved', 25);
      expect(await domain.favorites(pending)).toEqual([]);
    });
  });

  // ── ② 트레이너 코드 ─────────────────────────────────────────────────────
  describe('트레이너 코드', () => {
    it('관리자가 넣고 승인된 사람이 읽는다', async () => {
      await domain.putTrainer('admin', { name: '민상', code: '1234 5678 9012', sortOrder: 1 });
      const list = await domain.trainers();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ name: '민상', code: '1234 5678 9012' });
    });

    it('같은 이름을 다시 넣으면 코드가 갈린다', async () => {
      await domain.putTrainer('admin', { name: '민상', code: '1111 1111 1111', sortOrder: 0 });
      await domain.putTrainer('root', { name: '민상', code: '2222 2222 2222', sortOrder: 0 });
      const list = await domain.trainers();
      expect(list).toHaveLength(1);
      expect(list[0]!.code).toBe('2222 2222 2222');
    });

    it('차례대로 나온다', async () => {
      await domain.putTrainer('admin', { name: 'ㄴ', code: 'b', sortOrder: 2 });
      await domain.putTrainer('admin', { name: 'ㄱ', code: 'a', sortOrder: 1 });
      expect((await domain.trainers()).map((one) => one.name)).toEqual(['ㄱ', 'ㄴ']);
    });

    it('승인 안 된 사람은 못 쓴다', async () => {
      expect(await refused(() => domain.putTrainer('approved', { name: 'x', code: 'y', sortOrder: 0 }))).toBe('forbidden');
      expect(await refused(() => domain.putTrainer('pending', { name: 'x', code: 'y', sortOrder: 0 }))).toBe('forbidden');
    });

    it('빈 이름이나 빈 코드는 안 들어간다', async () => {
      expect(await refused(() => domain.putTrainer('admin', { name: '  ', code: 'y', sortOrder: 0 }))).toBe('invalid');
      expect(await refused(() => domain.putTrainer('admin', { name: 'x', code: '', sortOrder: 0 }))).toBe('invalid');
    });

    it('지우는 것도 관리자만', async () => {
      await domain.putTrainer('admin', { name: '민상', code: 'c', sortOrder: 0 });
      expect(await refused(() => domain.removeTrainer('approved', '민상'))).toBe('forbidden');
      await domain.removeTrainer('admin', '민상');
      expect(await domain.trainers()).toEqual([]);
    });
  });

  // ── ③ 사람을 들이고 내보내기 ────────────────────────────────────────────
  describe('가입 승인', () => {
    it('루트가 목록을 본다 — 대기와 승인이 갈려 나온다', async () => {
      const list = await domain.listUsers('root');
      expect(list.map((one) => one.email).sort()).toEqual(['approved@example.test', 'pending@example.test']);
      expect(list.find((one) => one.email === 'pending@example.test')!.role).toBe('pending');
    });

    it('★ 위임 관리자는 목록은 보되 승인 대기는 못 본다', async () => {
      // Firestore 는 컬렉션이 둘이라 저절로 갈렸다 —
      //   allowlist read: if isAdmin()      목록
      //   requests  read: if isRootAdmin()  승인 대기
      // 한 표가 됐으므로 서버가 가른다
      const seen = await domain.listUsers('admin');
      expect(seen.map((one) => one.email)).toEqual(['approved@example.test']);
      expect(seen.some((one) => one.role === 'pending')).toBe(false);
    });

    it('승인된 사람은 목록을 아예 못 본다', async () => {
      expect(await refused(() => domain.listUsers('approved'))).toBe('forbidden');
      expect(await refused(() => domain.listUsers('pending'))).toBe('forbidden');
    });

    it('루트가 승인한다', async () => {
      await domain.setRole('root', pending, { role: 'approved' });
      const [row] = await sql<{ role: string }[]>`select role from users where id = ${pending}`;
      expect(row!.role).toBe('approved');
    });

    it('루트가 위임 관리자를 지정한다', async () => {
      await domain.setRole('root', approved, { role: 'admin' });
      const [row] = await sql<{ role: string }[]>`select role from users where id = ${approved}`;
      expect(row!.role).toBe('admin');
    });

    it('루트가 내보낸다 — 대기로 내린다', async () => {
      await domain.setRole('root', approved, { role: 'pending' });
      const [row] = await sql<{ role: string }[]>`select role from users where id = ${approved}`;
      expect(row!.role).toBe('pending');
    });

    it('★ 위임 관리자는 사람을 못 들인다', async () => {
      expect(await refused(() => domain.setRole('admin', pending, { role: 'approved' }))).toBe('forbidden');
    });

    it('★ 루트는 API 로 만들 수 없다', async () => {
      // 관리자가 스스로를 루트로 올릴 수 있으면 '위임' 이라는 말이 뜻을 잃는다.
      // 루트는 ROOT_EMAIL 하나뿐이고, 그 판정은 로그인에서만 난다
      expect(await refused(() => domain.setRole('root', approved, { role: 'root' }))).toBe('invalid');
    });

    it('실험 기능은 권한과 다른 축이다', async () => {
      // v4.0.1 에서 깃발 둘을 가른 이유다 — 실험 기능을 열어 주려다 유저 목록까지 넘기지 않는다
      await domain.setRole('root', pending, { beta: true });
      const [row] = await sql<{ role: string; beta: boolean }[]>`select role, beta from users where id = ${pending}`;
      expect(row!.beta).toBe(true);
      expect(row!.role).toBe('pending');
    });

    it('없는 사람은 못 고친다', async () => {
      expect(await refused(() => domain.setRole('root', '999999', { role: 'approved' }))).toBe('missing');
    });

    it('아무것도 안 주면 아무것도 안 바뀐다', async () => {
      await domain.setRole('root', approved, {});
      const [row] = await sql<{ role: string; beta: boolean }[]>`select role, beta from users where id = ${approved}`;
      expect(row!.role).toBe('approved');
      expect(row!.beta).toBe(false);
    });

    it('★ 권한을 내리면 그 사람의 로그인이 끊긴다', async () => {
      // 규칙에서는 다음 읽기부터 막혔다. 토큰은 15분 사는 물건이라 그것만으로는 모자라다 —
      // 내보낸 사람이 15분 더 도는 것을 막으려면 세션을 같이 끊어야 한다
      await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at)
                values (${approved}, sha256('t'), gen_random_uuid(), now() + interval '30 days')`;
      await domain.setRole('root', approved, { role: 'pending' });
      const [row] = await sql<{ n: string }[]>`
        select count(*)::text as n from sessions where user_id = ${approved} and revoked_at is null`;
      expect(row!.n).toBe('0');
    });

    it('권한을 올릴 때는 안 끊는다', async () => {
      // 승인되자마자 쫓겨나면 이상하다. 회전 한 번이면 새 권한이 따라온다
      await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at)
                values (${pending}, sha256('t2'), gen_random_uuid(), now() + interval '30 days')`;
      await domain.setRole('root', pending, { role: 'approved' });
      const [row] = await sql<{ n: string }[]>`
        select count(*)::text as n from sessions where user_id = ${pending} and revoked_at is null`;
      expect(row!.n).toBe('1');
    });
  });
});
