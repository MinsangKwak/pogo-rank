#!/usr/bin/env -S npx tsx
// ─────────────────────────────────────────────────────────────────────────────
// scripts/import-firestore.ts — 백업 파일을 DB 로 옮긴다 (v5 Phase 7)
//
//   npx tsx scripts/import-firestore.ts firestore-backup.json
//   DRY_RUN=1 npx tsx scripts/import-firestore.ts firestore-backup.json   # 되돌린다
//
// 백업 파일은 scripts/firestore_backup.py 가 만든다. **원본을 직접 안 읽는 이유**는
// 옮기는 코드를 Firebase 없이 검사할 수 있게 하기 위해서다 (src/test/importFirestore.test.ts).
//
// **DRY_RUN 을 먼저 돌린다.** 진짜로 넣어 보고 통째로 되돌리므로, 몇 명이 오고 무엇이
// 버려지는지를 손해 없이 볼 수 있다 — 이관은 되돌릴 수 없는 일이다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { readFileSync } from 'node:fs';
import { makeDb } from '../src/db/client.ts';
import { importBackup, type Backup } from '../src/db/importFirestore.ts';
import { readEnv } from '../src/env.ts';

const file = process.argv[2];
if (!file) {
  console.error('쓰는 법: npx tsx scripts/import-firestore.ts <백업.json>');
  process.exit(1);
}

const env = readEnv();
const backup = JSON.parse(readFileSync(file, 'utf8')) as Backup;
const sql = makeDb(env.databaseUrl);
const dry = process.env['DRY_RUN'] === '1';

try {
  // 한 트랜잭션 안에서 한다 — 중간에 터지면 절반만 옮겨진 DB 가 남는 것이 제일 나쁘다
  const report = await sql.begin(async (tx) => {
    const out = await importBackup(tx as never, backup, env.auth.rootEmail);
    if (dry) throw Object.assign(new Error('DRY_RUN'), { report: out });
    return out;
  });
  console.log(`사람 ${report.users}명 · 담아 둔 것 ${report.favorites}개 · 트레이너 ${report.trainers}개`);
  for (const line of report.skipped) console.log(`  버림: ${line}`);
} catch (error) {
  const report = (error as { report?: { users: number; favorites: number; trainers: number; skipped: string[] } }).report;
  if (!report) throw error;
  console.log('[DRY_RUN] 되돌렸습니다. 진짜로 돌리면 이렇게 됩니다:');
  console.log(`사람 ${report.users}명 · 담아 둔 것 ${report.favorites}개 · 트레이너 ${report.trainers}개`);
  for (const line of report.skipped) console.log(`  버림: ${line}`);
} finally {
  await sql.end();
}
