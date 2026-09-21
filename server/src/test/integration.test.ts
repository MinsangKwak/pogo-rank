// ─────────────────────────────────────────────────────────────────────────────
// 통합 검사 — **진짜 Postgres 로** SQL 이 맞는지 본다.
//
// DATABASE_URL 이 있을 때만 깨어난다 (datasweep.test.ts 가 실데이터로 하는 것과 같은 방식).
// 가짜 DB 로는 확인할 수 없는 것이 여기 있다: 마이그레이션이 실제로 돌아가는가,
// 사람당 한도가 SQL 에서 먹는가, 롤업이 KST 로 날을 자르는가.
//
//   docker compose up -d
//   DATABASE_URL=postgres://moncamp:moncamp@localhost:5433/moncamp npm test
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { hotRows, rollup, PERSON_CAP, MIN_HITS } from '../lib/hot.ts';

const url = (process.env['DATABASE_URL'] ?? '').trim();
let sql: Sql;

async function seed(term: string, visitor: string, times: number, channel = 'prod') {
  for (let i = 0; i < times; i += 1) {
    await sql`insert into events (name, visitor, term, surface, country, channel)
              values ('search', ${visitor}, ${term}, 'dex', 'KR', ${channel})`;
  }
}

describe.skipIf(!url)('통합 — 진짜 Postgres', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await migrate(sql);
    await sql`truncate events, search_daily`;
  });

  afterAll(async () => { if (sql) await sql.end(); });

  it('마이그레이션이 두 번 돌아도 한 번만 적용된다', async () => {
    expect(await migrate(sql)).toEqual([]);
  });

  it('표의 제약이 이상한 줄을 막는다 — 채널은 둘뿐이다', async () => {
    await expect(
      sql`insert into events (name, visitor, channel) values ('search', ${'v'.repeat(32)}, 'staging')`,
    ).rejects.toThrow();
  });

  it('한 사람이 순위를 만들지 못한다 — 사람당 한도가 SQL 에서 먹는다', async () => {
    await sql`truncate events`;
    // 한 사람이 같은 말을 100번
    await seed('혼자밀기', 'solo'.padEnd(32, 'x'), 100);
    const rows = await hotRows(sql, { days: 7, limit: 10, threshold: false });
    expect(rows[0]?.hits).toBe(PERSON_CAP);
    expect(rows[0]?.visitors).toBe(1);
  });

  it('여러 사람이 찾은 말이 위로 온다', async () => {
    await sql`truncate events`;
    await seed('혼자밀기', 'solo'.padEnd(32, 'x'), 100);
    for (let i = 0; i < 4; i += 1) await seed('여럿이찾음', `many${i}`.padEnd(32, 'y'), 2);
    const rows = await hotRows(sql, { days: 7, limit: 10, threshold: false });
    expect(rows[0]?.term).toBe('여럿이찾음');   // 8회 (4명 × 2) > 5회 (한도에 잘린 100회)
    expect(rows[0]?.visitors).toBe(4);
  });

  it('dev 채널은 순위에 안 섞인다 — 미리보기가 운영 수치를 만들지 못한다', async () => {
    await sql`truncate events`;
    for (let i = 0; i < 5; i += 1) await seed('미리보기말', `dev${i}`.padEnd(32, 'z'), 3, 'dev');
    expect(await hotRows(sql, { days: 7, limit: 10, threshold: false })).toEqual([]);
  });

  it('문턱을 못 넘으면 빈 표 — 두 줄짜리는 순위가 아니다', async () => {
    await sql`truncate events`;
    for (let i = 0; i < 2; i += 1) await seed(`말${i}`, `p${i}`.padEnd(32, 'a'), MIN_HITS + 1);
    expect(await hotRows(sql, { days: 7, limit: 10 })).toEqual([]);          // 줄이 둘뿐
    expect(await hotRows(sql, { days: 7, limit: 10, threshold: false })).toHaveLength(2);
  });

  it('창 밖의 이벤트는 안 센다', async () => {
    await sql`truncate events`;
    await sql`insert into events (name, visitor, term, country, channel, created_at)
              values ('search', ${'old'.padEnd(32, 'o')}, '옛날말', 'KR', 'prod', now() - interval '30 days')`;
    expect(await hotRows(sql, { days: 7, limit: 10, threshold: false })).toEqual([]);
    expect(await hotRows(sql, { days: 60, limit: 10, threshold: false })).toHaveLength(1);
  });

  it('나라를 좁히면 그 나라 것만', async () => {
    await sql`truncate events`;
    await seed('한국말', 'kr'.padEnd(32, 'k'), 3);
    await sql`insert into events (name, visitor, term, country, channel)
              values ('search', ${'jp'.padEnd(32, 'j')}, '일본말', 'JP', 'prod')`;
    const kr = await hotRows(sql, { days: 7, limit: 10, country: 'KR', threshold: false });
    expect(kr.map((row) => row.term)).toEqual(['한국말']);
  });

  it('롤업이 일별 표를 채우고, 다시 돌려도 수가 안 부푼다', async () => {
    await sql`truncate events, search_daily`;
    for (let i = 0; i < 3; i += 1) await seed('굳은말', `r${i}`.padEnd(32, 'r'), 2);
    await rollup(sql);
    const first = await sql<{ hits: number; visitors: number }[]>`
      select hits, visitors from search_daily where term = '굳은말'`;
    expect(first[0]).toMatchObject({ hits: 6, visitors: 3 });
    await rollup(sql);
    const again = await sql<{ n: string }[]>`select count(*)::text as n from search_daily`;
    expect(again[0]?.n).toBe('1');
  });
});
