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
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.ts';
import { readEnv } from '../env.ts';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { hotRows, rollup, PERSON_CAP, MIN_HITS, MIN_VISITORS } from '../lib/hot.ts';
import { purge, retentionEdge, KEEP_MONTHS } from '../lib/retention.ts';
import { backupHealth, STALE_DAYS, DROP_RATIO } from '../lib/backup.ts';

const url = (process.env['DATABASE_URL'] ?? '').trim();
const TOKEN = 'k'.repeat(40);
let sql: Sql;
let app: FastifyInstance;

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
    await sql`truncate events, search_daily, backup_runs, backup_ack`;
    // 라우트가 **실제로 내보내는 글자**를 보려면 진짜 줄이 있어야 한다
    app = await buildApp(readEnv({
      DATABASE_URL: url, ALLOWED_ORIGINS: 'https://moncamp.kr', NODE_ENV: 'test', ADMIN_TOKEN: TOKEN,
    }), sql);
    await app.ready();
  });

  afterAll(async () => { if (app) await app.close(); if (sql) await sql.end(); });

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
    const who = 'daily'.padEnd(32, '3');
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
    const bully = 'bully'.padEnd(32, '1');
    for (let n = 0; n < 12; n += 1) {
      for (let ago = 0; ago < 7; ago += 1) await seedDaysAgo(`혼자밀기${n}`, bully, 5, ago);
    }
    // 그 아래에 자격 있는 말 셋 (두 사람씩 두 번)
    for (let n = 0; n < 3; n += 1) {
      for (const who of ['aa', 'bb']) await seed(`여럿말${n}`, `${who}${n}`.padEnd(32, '2'), 2);
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
    const through = (await retentionEdge(sql)).through;

    // 경계 날 늦은 시각 — 시각으로 자르면 살아남던 줄이다
    await sql`insert into events (name, visitor, term, country, channel, created_at)
              values ('search', ${'edge'.padEnd(32, '4')}, '경계말', 'KR', 'prod',
                      (${through}::date + time '23:59') at time zone 'Asia/Seoul')`;
    // 그 다음 날 새벽 — 남아야 한다
    await sql`insert into events (name, visitor, term, country, channel, created_at)
              values ('search', ${'safe'.padEnd(32, '5')}, '안전말', 'KR', 'prod',
                      (${through}::date + 1 + time '00:01') at time zone 'Asia/Seoul')`;

    const out = await purge(sql);
    expect(out.throughDay).toBe(through);
    expect(out.deleted).toBe(1);
    const left = await sql<{ term: string }[]>`select term from events`;
    expect(left.map((one) => one.term)).toEqual(['안전말']);
  });

  it('반쪽 하루를 완전한 집계로 굳히지 않는다', async () => {
    await sql`truncate events, search_daily`;
    const through = (await retentionEdge(sql)).through;
    // 같은 날 이른 시각과 늦은 시각 — 한 날은 통째로 세어져야 한다
    for (const at of ['01:00', '13:00', '23:00']) {
      await sql`insert into events (name, visitor, term, country, channel, created_at)
                values ('search', ${'day'.padEnd(32, '6')}, '하루말', 'KR', 'prod',
                        (${through}::date + ${at}::time) at time zone 'Asia/Seoul')`;
    }
    await purge(sql);
    const [row] = await sql<{ hits: number }[]>`select hits from search_daily where term = '하루말'`;
    expect(row?.hits).toBe(3);   // 셋 다 한 줄로 굳었다 — 앞부분만 굳고 뒷부분이 사라지지 않았다
    expect(await sql`select 1 from events`).toHaveLength(0);
  });


  // ── 파기 경계 (v4.8.1 코드 리뷰) ─────────────────────────────────────────
  // **달을 빼면 월말이 당겨 붙는다.** 약속은 'D 에 만든 줄은 D+12개월 안에 지운다' 하나이고,
  // 경계는 그 부등식이 참인 날 중 가장 늦은 날이어야 한다 — 어느 쪽으로도 안 새게
  it('경계가 윤년 하루를 남기지 않는다', async () => {
    // 2025-02-28 에서 열두 달을 빼면 2024-02-28 이라 2024-02-29 가 하루 더 산다
    expect((await retentionEdge(sql, KEEP_MONTHS, '2025-02-28')).through).toBe('2024-02-29');
    expect((await retentionEdge(sql, KEEP_MONTHS, '2029-02-28')).through).toBe('2028-02-29');
  });

  it('보정한다고 반대로 하루를 더 살려 두지도 않는다', async () => {
    // `+1일 -12개월 -1일` 로 보정하면 여기서 2023-02-27 이 되어 하루가 더 산다.
    // 2023-02-28 은 열두 달이 이미 찼다 (2023-02-28 + 12개월 = 2024-02-28)
    expect((await retentionEdge(sql, KEEP_MONTHS, '2024-02-28')).through).toBe('2023-02-28');
    expect((await retentionEdge(sql, KEEP_MONTHS, '2024-02-29')).through).toBe('2023-02-28');
  });

  it('평범한 날에는 그냥 열두 달 전이다', async () => {
    for (const [today, want] of [
      ['2026-06-15', '2025-06-15'],
      ['2025-03-01', '2024-03-01'],
      ['2025-12-31', '2024-12-31'],
      ['2026-01-31', '2025-01-31'],
      ['2026-05-31', '2025-05-31'],
    ]) {
      expect((await retentionEdge(sql, KEEP_MONTHS, today)).through).toBe(want);
    }
  });

  it('경계가 고른 날은 언제나 약속을 지킨다 — 윤년을 낀 430일을 하루씩 대어 본다', async () => {
    // 손으로 고른 날짜 몇으로는 다음 월말 규칙을 못 잡는다. 1년을 통째로 훑는다
    const days = await sql<{ d: string }[]>`
      select to_char(g, 'YYYY-MM-DD') as d
      from generate_series('2024-01-01'::date, '2025-03-05'::date, interval '1 day') g`;
    for (const { d } of days) {
      const { through } = await retentionEdge(sql, KEEP_MONTHS, d);
      const [check] = await sql<{ due: boolean; nextDue: boolean }[]>`
        select (${through}::date + interval '12 month')::date <= ${d}::date as due,
               (${through}::date + 1 + interval '12 month')::date <= ${d}::date as "nextDue"`;
      // 고른 날은 열두 달이 찼고 (안 새고), 그 다음 날은 아직 안 찼다 (더 안 지우고)
      expect([d, check?.due, check?.nextDue]).toEqual([d, true, false]);
    }
  });

  // ── 3판 백업 기록 ───────────────────────────────────────────────────────
  // 백업의 진짜 실패는 조용하다 — 워크플로는 초록인데 안이 비었거나 몇 주째 안 돈 쪽이다
  const logRun = (agoDays: number, counts: Record<string, number>, tag = '0') =>
    sql`insert into backup_runs (ran_at, location, bytes, sha256, counts)
        values (now() - (${agoDays} * interval '1 day'),
                ${`gs://moncamp-backup/${tag}.enc`}, 1234, ${tag.repeat(64).slice(0, 64)},
                ${sql.json(counts)})`;

  it('기록이 하나도 없으면 문제로 잡는다', async () => {
    await sql`truncate backup_runs`;
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    expect(out.latest).toBeNull();
    expect(out.problems[0]).toContain('하나도 없습니다');
  });

  it('제때 돌고 수가 그대로면 괜찮다고 한다', async () => {
    await sql`truncate backup_runs`;
    await logRun(8, { allowlist: 7, users: 7 }, '1');
    await logRun(1, { allowlist: 7, users: 7 }, '2');
    const out = await backupHealth(sql);
    expect(out.ok).toBe(true);
    expect(out.problems).toEqual([]);
    expect(out.latest?.location).toContain('2.enc');   // 최근 것이 위로 온다
  });

  it('너무 오래되면 잡는다 — 주 1회인데 여드레가 넘었다', async () => {
    await sql`truncate backup_runs`;
    await logRun(STALE_DAYS + 3, { users: 7 }, '3');
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('마지막 백업이');
  });

  it('문서 수가 급감하면 잡는다 — 안이 빈 백업을 초록으로 넘기지 않는다', async () => {
    await sql`truncate backup_runs, backup_ack`;
    await logRun(8, { allowlist: 7, users: 7, trainers: 6 }, '4');   // 20건
    await logRun(1, { allowlist: 1, users: 1 }, '5');                // 2건 — 90% 줄었다
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    // 총합으로 뭉뚱그리지 않고 **어느 표**가 어떻게 됐는지 짚는다
    const said = out.problems.join(' ');
    expect(said).toContain('trainers');   // 통째로 사라졌다
    expect(said).toContain('users');      // 7 → 1
  });

  it('조금 줄어든 것은 안 잡는다 — 계정 하나 지운 것까지 시끄러우면 아무도 안 본다', async () => {
    await sql`truncate backup_runs`;
    await logRun(8, { users: 10 }, '6');
    await logRun(1, { users: 9 }, '7');   // 10% — 문턱(30%) 아래
    expect((await backupHealth(sql)).ok).toBe(true);
    expect(DROP_RATIO).toBe(0.3);
  });

  // 어느 하나도 문턱을 안 넘었는데 여럿이 조금씩 줄어든 경우 — 여기서만 총합이 말한다
  it('여럿이 조금씩 줄어 총합이 무너지면 총합이 말한다', async () => {
    await sql`truncate backup_runs, backup_ack`;
    await logRun(7, { a: 100, b: 100, c: 100 }, 'a');
    await logRun(0, { a: 72, b: 72, c: 72 }, 'b');   // 각 28% — 문턱(30%) 아래, 합은 28%
    const out = await backupHealth(sql);
    // 합이 216 이라 216 < 300*0.7 = 210 이 아니다 → 아직 조용하다
    expect(out.ok).toBe(true);

    await logRun(0, { a: 69, b: 69, c: 69 }, 'c');   // 각 31% — 이제 컬렉션이 먼저 말한다
    expect((await backupHealth(sql)).problems.join(' ')).toContain('컬렉션');
  });

  it('표가 이상한 줄을 막는다 — 해시 모양과 크기', async () => {
    await expect(sql`insert into backup_runs (location, bytes, sha256)
                     values ('gs://x', 1, 'not-a-hash')`).rejects.toThrow();
    await expect(sql`insert into backup_runs (location, bytes, sha256)
                     values ('gs://x', 0, ${'a'.repeat(64)})`).rejects.toThrow();
  });

  it('/v1/admin/backups 가 기록을 온전히 내보낸다 — 스키마가 칸을 지우지 않는다', async () => {
    await sql`truncate backup_runs`;
    await logRun(1, { users: 7, trainers: 3 }, 'a');
    const res = await app.inject({
      method: 'GET', url: '/v1/admin/backups', headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { runs: Record<string, unknown>[]; latest: Record<string, unknown>; staleDays: number; dropRatio: number };
    // 되돌릴 일이 생겼을 때 "어느 것을 받아야 하나" 를 답하는 칸들이다 — 하나라도 비면 못 쓴다
    expect(Object.keys(body.runs[0] ?? {}).sort()).toEqual(['bytes', 'counts', 'location', 'note', 'ran_at', 'sha256']);
    expect(body.runs[0]?.['counts']).toEqual({ users: 7, trainers: 3 });
    expect(body.runs[0]?.['location']).toBe('gs://moncamp-backup/a.enc');
    expect(body.latest?.['sha256']).toBe('a'.repeat(64));
    expect([body.staleDays, body.dropRatio]).toEqual([STALE_DAYS, DROP_RATIO]);
  });

  // ── 백업 판정 (v4.8.1 코드 리뷰) ─────────────────────────────────────────
  it('걸른 주를 잡는다 — 방금 넣은 기록이 그 사실을 지우지 못한다', async () => {
    await sql`truncate backup_runs`;
    // 워크플로가 하는 그대로다: 한 주를 거른 뒤 오늘 넣고, 그러고 나서 묻는다
    await logRun(20, { users: 10 }, 'b');
    await logRun(0, { users: 10 }, 'c');
    const out = await backupHealth(sql);
    // '마지막 백업의 나이' 로는 0일이라 절대 안 걸린다. 간격에만 남아 있다
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('벌어졌습니다');
  });

  it('제때 돌았으면 간격으로 잡지 않는다', async () => {
    await sql`truncate backup_runs`;
    await logRun(7, { users: 10 }, 'd');
    await logRun(0, { users: 10 }, 'e');
    expect((await backupHealth(sql)).ok).toBe(true);
  });

  it('컬렉션 하나가 통째로 사라진 것을 총합이 가리지 못한다', async () => {
    await sql`truncate backup_runs`;
    // 총합은 200 → 200 으로 그대로다. 그래도 users 는 되돌릴 수 없는 상태다
    await logRun(7, { users: 100, allowlist: 100 }, 'a');
    await logRun(0, { users: 0, allowlist: 200 }, 'b');
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('users');
  });

  it('키가 아예 빠진 것도 잡는다 — 0 으로 적히지 않고 사라질 수 있다', async () => {
    await sql`truncate backup_runs`;
    await logRun(7, { users: 100, trainers: 50 }, 'c');
    await logRun(0, { users: 100 }, 'd');
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('trainers');
  });

  it('한 컬렉션이 조금 준 것은 안 잡는다 — 시끄러우면 아무도 안 본다', async () => {
    await sql`truncate backup_runs`;
    await logRun(7, { users: 100, allowlist: 100 }, 'e');
    await logRun(0, { users: 90, allowlist: 105 }, 'f');
    expect((await backupHealth(sql)).ok).toBe(true);
  });

  it('안 고쳐진 손실이 일주일 지났다고 사라지지 않는다', async () => {
    await sql`truncate backup_runs, backup_ack`;
    // users 가 비었고, 그 다음 판에도 여전히 비어 있다. 총합은 더 안 줄어든다
    await logRun(14, { users: 100, allowlist: 100 }, 'a');
    await logRun(7, { users: 0, allowlist: 200 }, 'b');
    await logRun(0, { users: 0, allowlist: 200 }, 'c');
    const out = await backupHealth(sql);
    // 바로 앞 판만 보면 견줄 것이 0 이라 통과한다 — 여태 가장 컸던 수와 견뎌야 잡힌다
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('users');
  });

  // **창으로 잡으면 미루기만 한다** (v4.8.5 코드 리뷰). 망가진 판이 창만큼 쌓이면
  // 성한 판이 밀려나 사고가 저절로 지워진다 — 잣대에 창이 없어야 한다
  it('망가진 판이 아무리 쌓여도 사고가 지워지지 않는다', async () => {
    await sql`truncate backup_runs, backup_ack`;
    await logRun(70, { users: 100, allowlist: 100 }, 'a');
    // 성한 판 하나에 망가진 판 여덟 — 어떤 창을 잡아도 성한 판이 밖으로 밀려난다
    for (let i = 8; i >= 1; i -= 1) await logRun(i * 7, { users: 0, allowlist: 100 }, String(i));
    await logRun(0, { users: 0, allowlist: 100 }, 'f');
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('users');
  });

  it('되살아나면 더 안 묻는다', async () => {
    await sql`truncate backup_runs, backup_ack`;
    await logRun(14, { users: 100 }, 'a');
    await logRun(7, { users: 0 }, 'b');
    await logRun(0, { users: 100 }, 'c');
    expect((await backupHealth(sql)).ok).toBe(true);
  });

  // 진짜로 줄어든 경우를 끊는 자리. **기계가 스스로 잊지는 못하고 사람이 끊는다**
  it('사람이 못 박으면 조용해진다 — 그때만', async () => {
    await sql`truncate backup_runs, backup_ack`;
    // 판 사이는 여드레 안이다 — 여기서 보려는 것은 간격이 아니라 줄어듦이다
    await logRun(7, { users: 100 }, 'a');
    await logRun(0, { users: 40 }, 'b');
    expect((await backupHealth(sql)).ok).toBe(false);

    await sql`insert into backup_ack (collection, baseline, reason)
              values ('users', 40, '계정 정리 — 확인함')`;
    expect((await backupHealth(sql)).ok).toBe(true);

    // 못 박은 수보다 더 줄면 다시 묻는다 — 한 번 끊었다고 영영 안 보는 것이 아니다
    await logRun(0, { users: 10 }, 'c');
    expect((await backupHealth(sql)).ok).toBe(false);
  });

  // **못 박은 뒤에 되살아났으면 그쪽을 따른다** (v4.8.5 코드 리뷰).
  // 안 그러면 잣대가 낮은 채로 굳어, 옛 못이 새 사고를 덮는다
  it('못 박은 뒤 되살아나면 잣대도 따라 올라간다', async () => {
    await sql`truncate backup_runs, backup_ack`;
    await sql`insert into backup_ack (collection, baseline, acked_at)
              values ('users', 40, now() - (10 * interval '1 day'))`;
    // 판 사이는 여드레 안이다 — 여기서 보려는 것은 간격이 아니다
    await logRun(12, { users: 100 }, 'a');   // 못 박기(10일 전) 전
    await logRun(5, { users: 100 }, 'b');    // 못 박은 뒤 되살아났다
    expect((await backupHealth(sql)).ok).toBe(true);

    // 다시 40 이 됐다. 옛 못은 40 이지만 그 뒤 100 을 봤으므로 이건 새 사고다
    await logRun(0, { users: 40 }, 'c');
    const out = await backupHealth(sql);
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toContain('users');
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
