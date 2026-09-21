// ─────────────────────────────────────────────────────────────────────────────
// db/migrate.ts — migrations/*.sql 을 이름순으로 한 번씩 적용한다.
//
// **마이그레이션 도구를 안 쓴다.** 표가 둘인데 도구를 붙이면 그 도구의 상태 파일과 실제 DB 가
// 어긋나는 새 사고가 생긴다. 여기서 필요한 것은 '어디까지 적용했나' 한 줄이고, 그건 표 하나면 된다.
// SQL 파일이 그대로 남으므로 리뷰에서 무엇이 바뀌는지 눈으로 읽힌다.
//
// 쓰는 법: npm run db:migrate   (DATABASE_URL 필요)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDb, type Sql } from './client.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, '../../migrations');

export function migrationFiles(from: string = dir): string[] {
  return readdirSync(from).filter((one) => one.endsWith('.sql')).sort();
}

export async function migrate(sql: Sql, from: string = dir): Promise<string[]> {
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((row) => row.name));
  const applied: string[] = [];
  for (const name of migrationFiles(from)) {
    if (done.has(name)) continue;
    const body = readFileSync(resolve(from, name), 'utf8');
    // 한 판을 통째로 — 중간에 실패하면 그 판은 통째로 없던 일이 된다.
    // sql.unsafe 는 파일 내용을 그대로 보낸다. 입력이 **저장소의 파일뿐**이라 주입 경로가 없다
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${name})`;
    });
    applied.push(name);
  }
  return applied;
}

// 직접 실행했을 때만 돈다 — 검사에서 import 할 때는 안 돈다
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const url = (process.env['DATABASE_URL'] ?? '').trim();
  if (!url) { console.error('DATABASE_URL 이 없습니다'); process.exit(1); }
  const sql = makeDb(url);
  const applied = await migrate(sql);
  console.log(applied.length ? `적용: ${applied.join(', ')}` : '적용할 것이 없습니다');
  await sql.end();
}
