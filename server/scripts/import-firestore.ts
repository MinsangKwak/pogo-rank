#!/usr/bin/env -S npx tsx
// ─────────────────────────────────────────────────────────────────────────────
// scripts/import-firestore.ts — 백업 JSON 을 Neon 에 옮긴다 (v5 Phase 7)
//
//   DRY_RUN=1 tsx scripts/import-firestore.ts firestore-backup.json   예행 — 다 해 보고 되돌린다
//             tsx scripts/import-firestore.ts firestore-backup.json   실제
//
// **통째로 한 트랜잭션이다.** 반쯤 옮겨진 상태가 제일 나쁘다 — 누구는 승인이 넘어왔는데
// 담아 둔 ★ 는 없는 식이 된다. 중간에 실패하면 아무것도 안 바뀐다.
// 예행도 같은 길을 끝까지 걷고 마지막에 되돌린다. 그래야 예행이 통과한 것이 실제도 통과한다 —
// 예행만 따로 짜면 그 둘이 다른 코드가 된다.
//
// **로그에 사람을 안 남긴다.** 이메일은 앞 두 글자만 남기고 가린다 (CLAUDE.md §3).
// Actions 로그는 저장소 권한이 있는 사람 모두가 본다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { readFileSync } from 'node:fs';
import { makeDb, type Sql } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { importBackup, type Backup, type ImportReport } from '../src/db/importFirestore.ts';
import { directOf } from '../src/env.ts';

/** 예행을 되돌리려고 던지는 것 — 실패와 구별해야 보고를 살릴 수 있다 */
class Rollback extends Error {
  constructor(readonly report: ImportReport) { super('예행 — 되돌린다'); }
}

/** `mi***@gmail.com` — 누군지 알아볼 만큼은 안 남긴다 */
function mask(text: string): string {
  return text.replace(/([^\s@'"`(]{1,2})[^\s@'"`(]*@([^\s'"`),]+)/g, '$1***@$2');
}

/**
 * 사람별로 **Firestore 에 적힌 권한**과 **지금 Neon 에 있는 권한**을 나란히 찍는다.
 * 2026-09-23 dev 에서 로그인은 되는데 '내 포켓몬' 이 잠긴 계정이 나왔다 — 짐작으로 고치지 않고
 * 원본과 사본을 견준다. 이관 전의 모습이라 예행으로 돌려도 같은 표가 나온다
 */
async function compare(sql: Sql, backup: Backup): Promise<void> {
  const mail = (raw: string) => raw.trim().toLowerCase();
  const yes = (doc: { fields?: Record<string, unknown> }, key: string) => {
    const field = doc.fields?.[key] as { booleanValue?: boolean } | undefined;
    return field?.booleanValue === true;
  };
  const source = new Map<string, string>();
  for (const doc of backup.collections.requests ?? []) source.set(mail(doc.id), '대기');
  for (const doc of backup.collections.allowlist ?? []) {
    source.set(mail(doc.id), `승인${yes(doc, 'admin') ? '·관리자' : ''}${yes(doc, 'beta') ? '·beta' : ''}`);
  }
  const rows = await sql<{ email: string; role: string; beta: boolean; claimed: boolean; favs: number }[]>`
    select u.email, u.role, u.beta, u.google_sub not like 'firebase:%' as claimed,
           (select count(*)::int from favorites f where f.user_id = u.id) as favs
      from users u order by u.email`;
  const seen = new Set<string>();
  console.log('── 사람별 대조 (Firestore → Neon 지금) ──');
  for (const row of rows) {
    seen.add(row.email);
    const from = source.get(row.email) ?? '(Firestore 에 없음)';
    const now = `${row.role}${row.beta ? '·beta' : ''} · ${row.claimed ? '로그인함' : '아직 로그인 안 함'} · ★ ${row.favs}`;
    console.log(`  ${mask(row.email)}  ${from}  →  ${now}`);
  }
  for (const [email, from] of source) {
    if (!seen.has(email)) console.log(`  ${mask(email)}  ${from}  →  (Neon 에 없음)`);
  }
}

async function main(): Promise<void> {
  const file = process.argv[2] ?? 'firestore-backup.json';
  const dry = process.env['DRY_RUN'] === '1';
  const given = process.env['DATABASE_URL'] ?? '';
  if (!given) throw new Error('DATABASE_URL 이 없습니다');

  const backup = JSON.parse(readFileSync(file, 'utf-8')) as Backup;
  const counts = Object.entries(backup.collections ?? {}).map(([name, docs]) => `${name} ${docs?.length ?? 0}`);
  console.log(`백업: ${counts.join(' · ')}`);

  // 풀링 주소로는 마이그레이션 잠금이 안 선다 — 직접 주소로 연다 (server/src/env.ts 의 directOf)
  const sql: Sql = makeDb(directOf(given));
  try {
    const applied = await migrate(sql);
    console.log(applied.length ? `스키마: ${applied.join(', ')} 적용` : '스키마: 최신');
    await compare(sql, backup);

    let report: ImportReport;
    try {
      report = await sql.begin(async (tx) => {
        const done = await importBackup(tx as unknown as Sql, backup, process.env['ROOT_EMAIL'] ?? '');
        if (dry) throw new Rollback(done);
        return done;
      }) as ImportReport;
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
      report = error.report;
    }

    console.log(`${dry ? '예행 (되돌림)' : '옮김'}: 사람 ${report.users} · ★ ${report.favorites} · 트레이너 ${report.trainers}`);
    if (report.skipped.length) {
      console.log(`건너뜀 ${report.skipped.length}건`);
      for (const why of report.skipped) console.log(`  · ${mask(why)}`);
    }
    // 합계를 표에서 다시 센다 — 보고서가 말하는 것과 실제로 남은 것이 같아야 한다
    const [row] = await sql<{ users: number; favorites: number; trainers: number }[]>`
      select (select count(*)::int from users) as users,
             (select count(*)::int from favorites) as favorites,
             (select count(*)::int from trainers) as trainers`;
    console.log(`표에 지금: 사람 ${row?.users} · ★ ${row?.favorites} · 트레이너 ${row?.trainers}`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(mask(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
