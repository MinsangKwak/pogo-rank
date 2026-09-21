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
import { hotRows, rollup, PERSON_CAP, MIN_HITS, MIN_VISITORS } from '../lib/hot.ts';
import { purge } from '../lib/retention.ts';

const url = (process.env['DATABASE_URL'] ?? '').trim();
let sql: Sql;

async function seed(term: string, visitor: string, times: number, channel = 'prod') {
  for (let i = 0; i < times; i += 1) {
    await sql`insert into events (name, visitor, term, surface, country, channel)
              values ('search', ${visitor}, ${term}, 'dex', 'KR', ${channel})`;
  }
}

/** 며칠 전으로 날짜를 밀어 넣는다 — 하루 단위 규칙은 날을 넘겨 봐야 확인된다 */
async function seedDaysAgo(term: string, visitor: string, times: number, daysAgo: number) {
  for (let i = 0; i < times; i += 1) {
    await sql`insert into events (name, visitor, term, country, channel, created_at)
              values ('search', ${visitor}, ${term}, 'KR', 'prod', now() - (${daysAgo} * interval '1 day'))`;
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

  // v4.7.2 코드 리뷰가 잡은 것 — 한도가 창 전체에 한 번 걸려 rollup 과 수가 어긋났다
  it('사람당 한도는 **날마다** 다시 열린다 — rollup 과 같은 셈이어야 한다', async () => {
    await sql`truncate events, search_daily`;
    const who = 'daily'.padEnd(32, 'd');
    // 사흘 동안 매일 열 번. 한도가 하루 5 이므로 15 가 맞다 (창 전체에 한 번이면 5 가 나온다)
    for (const ago of [0, 1, 2]) await seedDaysAgo('사흘말', who, 10, ago);

    const [row] = await hotRows(sql, { days: 7, limit: 10, threshold: false });
    expect(row?.hits).toBe(PERSON_CAP * 3);

    // 굳힌 표와 살아 있는 순위가 같은 수를 말해야 한다
    await rollup(sql, 7);
    const [sum] = await sql<{ hits: number }[]>`
      select sum(hits)::int as hits from search_daily where term = '사흘말'`;
    expect(sum?.hits).toBe(row?.hits);
  });

  it('한 사람이 찾은 말은 창이 길어도 순위에 안 선다', async () => {
    await sql`truncate events`;
    // 이레 동안 매일 다섯 번 — 하루 한도는 다 지키지만 찾은 사람은 하나다
    for (let ago = 0; ago < 7; ago += 1) await seedDaysAgo('혼자이레', 'solo7'.padEnd(32, 's'), 5, ago);
    const raw = await hotRows(sql, { days: 7, limit: 10, threshold: false });
    expect(raw[0]?.hits).toBe(35);          // 하루 한도는 다 지켰다
    expect(raw[0]?.visitors).toBe(1);
    expect(await hotRows(sql, { days: 7, limit: 10 })).toEqual([]);   // 그래도 안 세운다
    expect(MIN_VISITORS).toBe(2);
  });

  // v4.7.2 코드 리뷰가 잡은 것 — 방침에 12개월을 적어 두고 지우는 코드가 없었다
  it('12개월 지난 원본을 지우고, 그 전에 합계를 굳힌다', async () => {
    await sql`truncate events, search_daily`;
    await seedDaysAgo('옛날말', 'old'.padEnd(32, 'o'), 3, 400);      // 13개월 전
    await seedDaysAgo('요즘말', 'new'.padEnd(32, 'n'), 3, 1);        // 어제

    const { rolled, deleted, throughDay } = await purge(sql);
    expect(deleted).toBe(3);
    expect(rolled).toBe(1);
    expect(throughDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 원본은 갔고
    const left = await sql<{ term: string }[]>`select distinct term from events`;
    expect(left.map((one) => one.term)).toEqual(['요즘말']);
    // 역사는 남았다 — 방문자 난수 ID 는 원본과 함께 사라졌다
    const [kept] = await sql<{ hits: number; visitors: number }[]>`
      select hits, visitors from search_daily where term = '옛날말'`;
    expect(kept).toMatchObject({ hits: 3, visitors: 1 });
  });

  it('이미 굳힌 날은 파기가 덮어쓰지 않는다', async () => {
    await sql`truncate events, search_daily`;
    await seedDaysAgo('겹치는말', 'dup'.padEnd(32, 'p'), 2, 400);
    await sql`insert into search_daily (day, term, country, hits, visitors)
              values ((now() - interval '400 days')::date, '겹치는말', 'KR', 99, 9)`;
    await purge(sql);
    const [row] = await sql<{ hits: number }[]>`select hits from search_daily where term = '겹치는말'`;
    expect(row?.hits).toBe(99);   // rollup 이 쓴 값이 이긴다
  });

  // v4.7.3 코드 리뷰 — 자바스크립트로 거르면 한 사람이 표를 통째로 비울 수 있었다
  it('한 사람이 자리를 다 채워도 표가 비지 않는다', async () => {
    await sql`truncate events`;
    // 한 사람이 열두 말을 이레 동안 매일 다섯 번씩 — 하나하나가 35회라 상위 열 자리를 다 먹는다
    const bully = 'bully'.padEnd(32, 'b');
    for (let n = 0; n < 12; n += 1) {
      for (let ago = 0; ago < 7; ago += 1) await seedDaysAgo(`혼자밀기${n}`, bully, 5, ago);
    }
    // 그 아래에 자격 있는 말 셋 (두 사람씩 두 번)
    for (let n = 0; n < 3; n += 1) {
      for (const who of ['aa', 'bb']) await seed(`여럿말${n}`, `${who}${n}`.padEnd(32, 'c'), 2);
    }

    const rows = await hotRows(sql, { days: 7, limit: 10 });
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.term.startsWith('여럿말'))).toBe(true);
    // 혼자 민 말은 한 줄도 없다
    expect(rows.filter((row) => row.term.startsWith('혼자밀기'))).toEqual([]);
  });

  // v4.7.3 코드 리뷰 — 정확한 시각으로 자르면 하루 한 번 도는 일이 반나절을 넘긴다
  it('파기는 KST 날짜로 자른다 — 경계 날은 통째로 가고 그 다음 날은 통째로 남는다', async () => {
    await sql`truncate events, search_daily`;
    const [edge] = await sql<{ through: string }[]>`
      select to_char(((now() at time zone 'Asia/Seoul')::date - interval '12 months')::date, 'YYYY-MM-DD') as through`;
    const through = edge!.through;

    // 경계 날 늦은 시각 — 시각으로 자르면 살아남던 줄이다
    await sql`insert into events (name, visitor, term, country, channel, created_at)
              values ('search', ${'edge'.padEnd(32, 'e')}, '경계말', 'KR', 'prod',
                      (${through}::date + time '23:59') at time zone 'Asia/Seoul')`;
    // 그 다음 날 새벽 — 남아야 한다
    await sql`insert into events (name, visitor, term, country, channel, created_at)
              values ('search', ${'safe'.padEnd(32, 'f')}, '안전말', 'KR', 'prod',
                      (${through}::date + 1 + time '00:01') at time zone 'Asia/Seoul')`;

    const out = await purge(sql);
    expect(out.throughDay).toBe(through);
    expect(out.deleted).toBe(1);
    const left = await sql<{ term: string }[]>`select term from events`;
    expect(left.map((one) => one.term)).toEqual(['안전말']);
  });

  it('반쪽 하루를 완전한 집계로 굳히지 않는다', async () => {
    await sql`truncate events, search_daily`;
    const [edge] = await sql<{ through: string }[]>`
      select to_char(((now() at time zone 'Asia/Seoul')::date - interval '12 months')::date, 'YYYY-MM-DD') as through`;
    const through = edge!.through;
    // 같은 날 이른 시각과 늦은 시각 — 한 날은 통째로 세어져야 한다
    for (const at of ['01:00', '13:00', '23:00']) {
      await sql`insert into events (name, visitor, term, country, channel, created_at)
                values ('search', ${'day'.padEnd(32, 'g')}, '하루말', 'KR', 'prod',
                        (${through}::date + ${at}::time) at time zone 'Asia/Seoul')`;
    }
    await purge(sql);
    const [row] = await sql<{ hits: number }[]>`select hits from search_daily where term = '하루말'`;
    expect(row?.hits).toBe(3);   // 셋 다 한 줄로 굳었다 — 앞부분만 굳고 뒷부분이 사라지지 않았다
    expect(await sql`select 1 from events`).toHaveLength(0);
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
