// ─────────────────────────────────────────────────────────────────────────────
// importFirestore.test.ts — 이관이 사람을 잃지 않는지 본다 (v5 Phase 7)
//
// **이관은 한 번뿐이고 되돌릴 수 없다.** Firestore 를 지운 뒤에 "승인 목록이 절반만 왔다" 를
// 알게 되면 고칠 원본이 없다. 그래서 진짜 DB 위에서 미리 재 본다.
//
// 재는 것 다섯
//   ① 네 컬렉션이 표 셋으로 제대로 접히는가 (allowlist 가 requests 를 이긴다)
//   ② 담아 둔 것이 사람에게 제대로 붙는가 — uid 로 이어야 한다
//   ③ 두 번 돌려도 안전한가 — 중간에 멈추면 다시 돌린다
//   ④ 버린 것을 말하는가 — 조용히 버리면 "왜 한 명이 없지" 를 영영 못 찾는다
//   ⑤ 루트가 루트로 오는가
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDb, type Sql } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { importBackup, type Backup } from '../db/importFirestore.ts';
import { testDatabaseUrl } from './dbUrl.ts';

const url = testDatabaseUrl();
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');
const ROOT = 'owner@example.test';

// Firestore REST 가 주는 모양 그대로 (scripts/firestore_backup.py 가 저장하는 것)
const S = (value: string) => ({ stringValue: value });
const B = (value: boolean) => ({ booleanValue: value });
const N = (value: number) => ({ integerValue: String(value) });
const A = (values: number[]) => ({ arrayValue: { values: values.map(N) } });

const backup: Backup = {
  collections: {
    allowlist: [
      { id: 'friend@example.test', fields: { uid: S('uid-friend'), name: S('친구'), beta: B(true) } },
      { id: 'helper@example.test', fields: { uid: S('uid-helper'), name: S('도우미'), admin: B(true) } },
      { id: ROOT, fields: { uid: S('uid-owner'), name: S('주인'), admin: B(true) } },
    ],
    requests: [
      { id: 'waiting@example.test', fields: { uid: S('uid-waiting'), name: S('대기'), photo: S('https://x.test/w.png') } },
      // 이미 승인된 사람의 가입 요청도 남아 있다 — 승인이 이겨야 한다
      { id: 'friend@example.test', fields: { uid: S('uid-friend'), name: S('친구(옛)') } },
    ],
    users: [
      { id: 'uid-friend', fields: { email: S('friend@example.test'), favs: A([25, 6, 25]) } },
      { id: 'uid-waiting', fields: { email: S('waiting@example.test'), favs: A([1]) } },
      // 승인 목록에도 가입 요청에도 없는 uid — 옮길 자리가 없다
      { id: 'uid-ghost', fields: { email: S('ghost@example.test'), favs: A([7]) } },
    ],
    trainers: [
      { id: '민상', fields: { name: S('민상'), code: S('111122223333'), order: N(1) } },
      { id: '빈줄', fields: { name: S('빈줄') } },
    ],
  },
};

let sql: Sql;

describe.skipIf(!url)('Firestore 이관', () => {
  beforeAll(async () => {
    sql = makeDb(url);
    await sql.unsafe('drop schema public cascade; create schema public;');
    await migrate(sql, migrationsDir);
  });
  afterAll(async () => { if (sql) await sql.end(); });
  beforeEach(async () => { await sql`delete from users`; await sql`delete from trainers`; });

  it('네 컬렉션이 표 셋으로 접힌다', async () => {
    const report = await importBackup(sql, backup, ROOT);
    expect(report.users).toBe(4);
    const rows = await sql<{ email: string; role: string; beta: boolean }[]>`
      select email, role, beta from users order by email`;
    expect(rows.map((one) => [one.email, one.role])).toEqual([
      ['friend@example.test', 'approved'],
      ['helper@example.test', 'admin'],
      [ROOT, 'root'],
      ['waiting@example.test', 'pending'],
    ]);
    // 실험 깃발은 권한과 다른 축이다 — 따로 따라와야 한다
    expect(rows.find((one) => one.email === 'friend@example.test')!.beta).toBe(true);
  });

  it('★ 승인이 가입 요청을 이긴다', async () => {
    // 승인된 뒤에도 requests 문서는 남아 있다. 순서를 잘못 보면 승인된 사람이 대기로 내려간다
    await importBackup(sql, backup, ROOT);
    const [row] = await sql<{ role: string; display_name: string }[]>`
      select role, display_name from users where email = 'friend@example.test'`;
    expect(row!.role).toBe('approved');
    expect(row!.display_name).toBe('친구');
  });

  it('담아 둔 것이 사람에게 붙는다 — 겹친 것은 한 번이다', async () => {
    const report = await importBackup(sql, backup, ROOT);
    const [row] = await sql<{ id: string }[]>`select id from users where email = 'friend@example.test'`;
    const favs = await sql<{ dex: number }[]>`
      select dex from favorites where user_id = ${row!.id} order by dex`;
    expect(favs.map((one) => one.dex)).toEqual([6, 25]);
    expect(report.favorites).toBeGreaterThan(0);
  });

  it('승인 대기인 사람의 것도 옮긴다 (v3.60.0 부터 담을 수 있었다)', async () => {
    await importBackup(sql, backup, ROOT);
    const [row] = await sql<{ id: string }[]>`select id from users where email = 'waiting@example.test'`;
    const [count] = await sql<{ n: string }[]>`
      select count(*)::text as n from favorites where user_id = ${row!.id}`;
    expect(count!.n).toBe('1');
  });

  it('★ 옮길 자리가 없는 것을 말한다', async () => {
    // 조용히 버리면 "왜 한 명이 없지" 를 영영 못 찾는다
    const report = await importBackup(sql, backup, ROOT);
    expect(report.skipped.some((one) => one.includes('uid-ghost'))).toBe(true);
    expect(report.skipped.some((one) => one.includes('빈줄'))).toBe(true);
  });

  it('트레이너 코드가 차례까지 온다', async () => {
    const report = await importBackup(sql, backup, ROOT);
    expect(report.trainers).toBe(1);
    const [row] = await sql<{ name: string; code: string; sort_order: number }[]>`
      select name, code, sort_order from trainers`;
    expect(row).toMatchObject({ name: '민상', code: '111122223333', sort_order: 1 });
  });

  it('★ 두 번 돌려도 같은 상태다', async () => {
    // 이관은 한 번에 안 끝나는 일이다 — 중간에 멈추면 다시 돌린다
    await importBackup(sql, backup, ROOT);
    await importBackup(sql, backup, ROOT);
    const [users] = await sql<{ n: string }[]>`select count(*)::text as n from users`;
    const [favs] = await sql<{ n: string }[]>`select count(*)::text as n from favorites`;
    const [trainers] = await sql<{ n: string }[]>`select count(*)::text as n from trainers`;
    expect([users!.n, favs!.n, trainers!.n]).toEqual(['4', '3', '1']);
  });

  // v5 Phase 7 — 전환 직전에 한 번 더 돌린다. 그 사이 새 서버에서 일어난 일을 옛 백업이 덮으면 안 된다.
  // 전에는 이메일로 부딪히면 role 을 백업 값으로 덮어써서, 새 화면에서 승인된 사람이 대기로 강등됐다
  it('★ 다시 돌려도 새 서버에서 올린 권한을 내리지 않는다', async () => {
    await importBackup(sql, backup, ROOT);
    // 새 서버의 관리자가 대기자를 승인하고 실험 기능을 열어 줬다 — 옛 Firestore 는 여전히 대기다
    await sql`update users set role = 'approved', beta = true where email = 'waiting@example.test'`;
    await importBackup(sql, backup, ROOT);
    const [row] = await sql<{ role: string; beta: boolean }[]>`
      select role, beta from users where email = 'waiting@example.test'`;
    expect(row).toEqual({ role: 'approved', beta: true });
  });

  it('★ 다시 돌려도 백업 쪽이 더 높으면 올린다 — 옛 화면에서 그 사이 승인된 사람', async () => {
    const before: Backup = { collections: { ...backup.collections,
      allowlist: (backup.collections.allowlist ?? []).filter((doc) => doc.id !== 'friend@example.test') } };
    await importBackup(sql, before, ROOT);
    await importBackup(sql, backup, ROOT);
    const [row] = await sql<{ role: string }[]>`select role from users where email = 'friend@example.test'`;
    expect(row!.role).not.toBe('pending');
  });

  it('★ 새 서버로 들어온 사람의 이름·사진은 옛 백업이 덮지 않는다', async () => {
    await importBackup(sql, backup, ROOT);
    // 로그인하면 구글이 준 값으로 갈린다 (services/auth.ts) — 그게 옛 백업보다 새 값이다
    await sql`update users set google_sub = 'real-sub', display_name = '구글 이름', photo_url = 'https://g.test/p.png'
              where email = 'waiting@example.test'`;
    await importBackup(sql, backup, ROOT);
    const [row] = await sql<{ google_sub: string; display_name: string; photo_url: string }[]>`
      select google_sub, display_name, photo_url from users where email = 'waiting@example.test'`;
    expect(row).toEqual({ google_sub: 'real-sub', display_name: '구글 이름', photo_url: 'https://g.test/p.png' });
  });

  it('승인 목록에 없는 루트도 루트로 선다', async () => {
    // 아직 한 번도 로그인 안 한 주인이 있을 수 있다 — 그래도 목록에는 있어야 한다
    const bare: Backup = { collections: { allowlist: [], requests: [], users: [], trainers: [] } };
    await importBackup(sql, bare, ROOT);
    const [row] = await sql<{ role: string }[]>`select role from users where email = ${ROOT}`;
    expect(row!.role).toBe('root');
  });

  it('★ 옮겨 온 줄은 자리표시자를 달고 있다', async () => {
    // 이것이 있어야 처음 로그인할 때 서버가 이어받는다 (services/auth.ts)
    await importBackup(sql, backup, ROOT);
    const rows = await sql<{ google_sub: string }[]>`select google_sub from users`;
    expect(rows.every((one) => one.google_sub.startsWith('firebase:'))).toBe(true);
  });
});
