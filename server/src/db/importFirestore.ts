// ─────────────────────────────────────────────────────────────────────────────
// db/importFirestore.ts — Firestore 백업을 표로 옮긴다 (v5 Phase 7)
//
// **Firestore 를 직접 안 읽는다.** 이미 있는 백업 스크립트(scripts/firestore_backup.py)가
// 만든 JSON 을 읽는다. 그래야 이 코드가 **순수 함수**가 되어 Firebase 없이 검사할 수 있다 —
// 진짜 Firestore 가 있어야 도는 검사는 CI 에서 못 돌고, 못 도는 검사는 없는 검사다.
//
// 네 컬렉션이 표 셋이 된다 (0004_identity.sql 의 설계 그대로)
//   allowlist/{email}  → users.role = admin ? 'admin' : 'approved', beta
//   requests/{email}   → 아직 승인 안 된 사람 → users.role = 'pending'
//   users/{uid}.favs   → favorites 줄들
//   trainers/{name}    → trainers
//
// **google_sub 에 자리표시자를 둔다.** Firebase uid 는 구글이 준 값이 아니라 Firebase 가
// 제 안에서 쓰던 id 다. 그 사람이 처음 로그인하는 순간 서버가 진짜 sub 으로 갈아 끼운다
// (services/auth.ts 의 '옮겨 온 줄을 이어받는다').
//
// **두 번 돌려도 안전하다.** 이관은 한 번에 안 끝나는 일이다 — 중간에 멈추면 다시 돌린다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from './client.ts';
import type { Role } from '../lib/rbac.ts';

/** Firestore REST 가 주는 값 한 칸 */
type Value = Record<string, unknown>;

export interface BackupDoc { id: string; fields?: Record<string, Value> }
export interface Backup {
  collections: Partial<Record<'allowlist' | 'requests' | 'users' | 'trainers', BackupDoc[]>>;
}

export interface ImportReport {
  users: number;
  favorites: number;
  trainers: number;
  skipped: string[];
}

/** Firestore 의 형 표기를 벗긴다. 모르는 형은 undefined — 지어내지 않는다 */
function plain(value: Value | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value['stringValue'];
  if ('booleanValue' in value) return value['booleanValue'];
  if ('integerValue' in value) return Number(value['integerValue']);
  if ('doubleValue' in value) return Number(value['doubleValue']);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    const inner = (value['arrayValue'] as { values?: Value[] } | undefined)?.values ?? [];
    return inner.map(plain);
  }
  return undefined;
}

const str = (doc: BackupDoc, key: string): string => {
  const out = plain(doc.fields?.[key]);
  return typeof out === 'string' ? out : '';
};
const flag = (doc: BackupDoc, key: string): boolean => plain(doc.fields?.[key]) === true;

/** 도감번호 목록. 숫자로 못 읽는 것은 버린다 */
const numbers = (doc: BackupDoc, key: string): number[] => {
  const out = plain(doc.fields?.[key]);
  if (!Array.isArray(out)) return [];
  return out.map(Number).filter((one) => Number.isInteger(one) && one > 0);
};

/** 이메일은 소문자로만 담긴다 (users.email 의 check 제약) */
const mail = (raw: string): string => raw.trim().toLowerCase();

export async function importBackup(sql: Sql, backup: Backup, rootEmail = ''): Promise<ImportReport> {
  const report: ImportReport = { users: 0, favorites: 0, trainers: 0, skipped: [] };
  const allowlist = backup.collections.allowlist ?? [];
  const requests = backup.collections.requests ?? [];
  const users = backup.collections.users ?? [];
  const trainers = backup.collections.trainers ?? [];
  const root = mail(rootEmail);

  // uid ↔ 이메일. users/{uid} 문서에 이메일이 있고, 없으면 requests 쪽에서 찾는다
  const mailOfUid = new Map<string, string>();
  for (const doc of users) {
    const email = mail(str(doc, 'email'));
    if (email) mailOfUid.set(doc.id, email);
  }
  for (const doc of requests) {
    const uid = str(doc, 'uid');
    if (uid && !mailOfUid.has(uid)) mailOfUid.set(uid, mail(doc.id));
  }

  // 이메일 하나가 한 줄이다. allowlist 가 requests 를 이긴다 — 승인이 더 높은 사실이다
  interface Person { email: string; uid: string; name: string; photo: string; role: Role; beta: boolean }
  const people = new Map<string, Person>();

  const put = (email: string, next: Partial<Person> & { role: Role }) => {
    if (!email || !email.includes('@')) { report.skipped.push(`이메일이 아님: ${email || '(빈 값)'}`); return; }
    const now = people.get(email);
    people.set(email, {
      email,
      uid: next.uid || now?.uid || '',
      name: next.name || now?.name || '',
      photo: next.photo || now?.photo || '',
      role: next.role,
      beta: next.beta ?? now?.beta ?? false,
    });
  };

  for (const doc of requests) {
    const email = mail(doc.id);
    put(email, { role: 'pending', uid: str(doc, 'uid'), name: str(doc, 'name'), photo: str(doc, 'photo') });
  }
  for (const doc of allowlist) {
    const email = mail(doc.id);
    // 루트는 이메일로 정해진다 — 옮기는 자리에서도 같은 규칙이어야 로그인 전에도 목록이 맞는다
    const role: Role = email === root ? 'root' : flag(doc, 'admin') ? 'admin' : 'approved';
    put(email, { role, uid: str(doc, 'uid'), name: str(doc, 'name'), beta: flag(doc, 'beta') });
  }
  if (root && !people.has(root)) put(root, { role: 'root' });

  const idOfEmail = new Map<string, string>();
  for (const person of people.values()) {
    // **자리표시자.** 처음 로그인할 때 진짜 sub 으로 갈린다 (services/auth.ts)
    const sub = `firebase:${person.uid || person.email}`;
    const [row] = await sql<{ id: string }[]>`
      insert into users (google_sub, email, display_name, photo_url, role, beta)
      values (${sub}, ${person.email}, ${person.name}, ${person.photo}, ${person.role}, ${person.beta})
      on conflict (email) do update
         set display_name = excluded.display_name,
             photo_url    = excluded.photo_url,
             role         = excluded.role,
             beta         = excluded.beta,
             updated_at   = now()
      returning id`;
    idOfEmail.set(person.email, row!.id);
    report.users += 1;
  }

  for (const doc of users) {
    const email = mail(str(doc, 'email')) || mailOfUid.get(doc.id) || '';
    const userId = idOfEmail.get(email);
    if (!userId) {
      // 승인 목록에도 가입 요청에도 없는 uid — 옮길 자리가 없다. 조용히 버리지 않고 적는다
      if (numbers(doc, 'favs').length) report.skipped.push(`담아 둔 것을 옮길 사람이 없음: ${doc.id}`);
      continue;
    }
    const favs = numbers(doc, 'favs');
    if (!favs.length) continue;
    await sql`insert into favorites ${sql(favs.map((dex) => ({ user_id: userId, dex })))}
              on conflict do nothing`;
    report.favorites += favs.length;
  }

  for (const [index, doc] of trainers.entries()) {
    const name = (str(doc, 'name') || doc.id).trim();
    const code = str(doc, 'code').trim();
    if (!name || !code) { report.skipped.push(`트레이너 줄이 비었음: ${doc.id}`); continue; }
    const order = Number(plain(doc.fields?.['order']));
    await sql`insert into trainers (name, code, sort_order)
              values (${name}, ${code}, ${Number.isInteger(order) ? order : index})
              on conflict (name) do update
                 set code = excluded.code, sort_order = excluded.sort_order, updated_at = now()`;
    report.trainers += 1;
  }

  return report;
}
