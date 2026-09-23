// ─────────────────────────────────────────────────────────────────────────────
// migrate.test.ts — 마이그레이션이 빈 DB 에서 끝까지 돌고, 제약이 실제로 막는지 본다.
//
// **왜 가짜(fakeSql)가 아니라 진짜 Postgres 인가.** 여기서 확인하려는 것이 전부 Postgres 의
// 일이기 때문이다 — check 제약이 대문자 이메일을 거부하는가, on delete cascade 가 딸린 줄을
// 같이 지우는가, 같은 파일을 두 번 적용해도 아무 일이 없는가. 가짜는 제가 흉내 낸 것만 답한다.
//
// **DB 가 없으면 건너뛴다.** 로컬에서 Postgres 없이 나머지 검사를 돌리는 길을 막지 않는다.
// CI 는 서비스 컨테이너로 띄워 반드시 돌린다 — 건너뛴 검사는 없는 검사다.
//
//   TEST_DATABASE_URL=postgresql://postgres@localhost:5433/moncamp_test npm test
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate, migrationFiles } from '../db/migrate.ts';
import { testDatabaseUrl } from './dbUrl.ts';

const url = testDatabaseUrl();
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, '../../migrations');

let sql: Sql;

/** 그 문장이 막히는가. 막히면 true — 어느 제약이 걸렸는지까지는 안 본다(메시지는 판마다 다르다) */
async function rejected(run: () => Promise<unknown>): Promise<boolean> {
  try { await run(); return false; } catch { return true; }
}

describe.skipIf(!url)('마이그레이션과 스키마', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    // 빈 자리에서 시작한다 — 앞선 실행이 남긴 것이 결과를 바꾸지 않게
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
  });
  afterAll(async () => { if (sql) await sql.end(); });

  it('migrations/ 의 파일이 전부 적용된다', async () => {
    const done = await sql<{ name: string }[]>`select name from schema_migrations order by name`;
    expect(done.map((row) => row.name)).toEqual(migrationFiles(migrationsDir));
  });

  it('두 번 돌려도 아무 일이 없다', async () => {
    // 마이그레이션은 배포마다 돈다 — 두 번째가 무언가를 한다면 그건 배포마다 하는 일이다
    expect(await migrate(sql, migrationsDir)).toEqual([]);
  });

  it('신원·세션·개인 데이터 표가 선다', async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'`;
    const names = new Set(rows.map((row) => row.table_name));
    for (const table of ['users', 'sessions', 'favorites', 'trainers']) {
      expect(names.has(table), `${table} 가 없다`).toBe(true);
    }
  });

  describe('users 의 제약이 실제로 막는다', () => {
    beforeAll(async () => {
      await sql`delete from users`;
      await sql`insert into users (google_sub, email, display_name) values ('sub-1', 'a@x.com', '가')`;
    });

    it('이메일은 소문자만 들어간다', async () => {
      // Firestore 규칙이 myEmail() 에서 .lower() 를 부르던 것과 같은 약속이다.
      // 대문자가 섞여 들어가면 같은 사람이 두 줄이 된다
      expect(await rejected(() => sql`insert into users (google_sub, email) values ('s2', 'B@X.com')`)).toBe(true);
    });

    it('권한은 넷 중 하나여야 한다', async () => {
      expect(await rejected(() => sql`insert into users (google_sub, email, role) values ('s3', 'c@x.com', 'superuser')`)).toBe(true);
    });

    it('같은 이메일이 두 번 들어가지 않는다', async () => {
      expect(await rejected(() => sql`insert into users (google_sub, email) values ('s4', 'a@x.com')`)).toBe(true);
    });

    it('같은 google_sub 가 두 번 들어가지 않는다', async () => {
      // 이메일이 바뀌어도 같은 사람이다 — 신원의 축이 여기다
      expect(await rejected(() => sql`insert into users (google_sub, email) values ('sub-1', 'd@x.com')`)).toBe(true);
    });

    it('기본 권한은 pending 이다', async () => {
      const [row] = await sql<{ role: string; beta: boolean }[]>`select role, beta from users where email = 'a@x.com'`;
      expect(row!.role).toBe('pending');
      // 실험 기능은 권한과 다른 축이다 — 승인되어도 저절로 켜지지 않는다 (v4.0.1)
      expect(row!.beta).toBe(false);
    });
  });

  describe('담아 둔 포켓몬', () => {
    it('없는 포켓몬 번호를 막는다', async () => {
      const [user] = await sql<{ id: string }[]>`select id from users where email = 'a@x.com'`;
      expect(await rejected(() => sql`insert into favorites (user_id, dex) values (${user!.id}, 0)`)).toBe(true);
    });

    it('같은 포켓몬을 두 번 담지 않는다', async () => {
      const [user] = await sql<{ id: string }[]>`select id from users where email = 'a@x.com'`;
      await sql`insert into favorites (user_id, dex) values (${user!.id}, 25)`;
      expect(await rejected(() => sql`insert into favorites (user_id, dex) values (${user!.id}, 25)`)).toBe(true);
    });
  });

  it('사람을 지우면 세션과 즐겨찾기가 같이 지워진다', async () => {
    // 계정 삭제가 트랜잭션 하나로 끝나는 근거다 — v4.9.7 에서 Firestore 는 네 걸음이었고,
    // 그중 한 걸음(allowlist)이 v4 에서 빠져 승인 목록에 이메일이 영영 남아 있었다
    const [user] = await sql<{ id: string }[]>`select id from users where email = 'a@x.com'`;
    await sql`insert into sessions (user_id, refresh_hash, family_id, expires_at)
              values (${user!.id}, sha256('t1'), gen_random_uuid(), now() + interval '30 days')`;

    await sql`delete from users where id = ${user!.id}`;

    const [favs] = await sql<{ n: string }[]>`select count(*)::text as n from favorites`;
    const [sess] = await sql<{ n: string }[]>`select count(*)::text as n from sessions`;
    expect(favs!.n).toBe('0');
    expect(sess!.n).toBe('0');
  });

  it('세션은 같은 리프레시 해시를 두 번 담지 않는다', async () => {
    await sql`insert into users (google_sub, email) values ('sub-r', 'r@x.com')`;
    const [user] = await sql<{ id: string }[]>`select id from users where email = 'r@x.com'`;
    const put = () => sql`insert into sessions (user_id, refresh_hash, family_id, expires_at)
                          values (${user!.id}, sha256('same'), gen_random_uuid(), now() + interval '1 day')`;
    await put();
    expect(await rejected(put)).toBe(true);
  });
});
