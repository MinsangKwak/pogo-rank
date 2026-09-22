// ─────────────────────────────────────────────────────────────────────────────
// services/domain.ts — 담아 두기 · 트레이너 코드 · 가입 승인 (v5 Phase 5)
//
// **Firestore 보안 규칙이 막던 것을 여기서 막는다.** Phase 4 는 판정(lib/rbac.ts)만 옮겨 왔고
// 강제할 자리가 없었다 — 담아 두기 API 가 없었기 때문이다.
//
// **권한은 인자로 받는다. 여기서 다시 안 읽는다.** 토큰을 연 자리(plugins/requireRole.ts)가
// 이미 읽은 값이고, 요청마다 users 를 또 읽으면 Cloud Run 이 깰 때마다 DB 왕복이 는다.
//
// **상한은 사람 줄을 잠그고 센다.** 세고 나서 넣는 사이에 다른 기기가 끼어들면 상한을 넘는다 —
// Firestore 에서는 규칙이 문서 하나를 통째로 보므로 그 틈이 없었는데, 줄로 쪼개면서 생긴 틈이다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';
import { canApproveUsers, canWriteTrainers, favoriteCap, type Role } from '../lib/rbac.ts';

/** 거부의 이유. HTTP 로 옮길 때 400 · 403 · 404 · 409 를 가르는 값이다 */
export class DomainError extends Error {
  constructor(readonly reason: 'invalid' | 'forbidden' | 'missing' | 'limit', message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export interface Trainer {
  name: string;
  code: string;
  sortOrder: number;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
  beta: boolean;
  createdAt: Date;
  lastSeenAt: Date | null;
}

export interface RoleChange {
  role?: Role;
  beta?: boolean;
}

export interface Domain {
  favorites(userId: string): Promise<number[]>;
  addFavorite(userId: string, role: Role, dex: number): Promise<void>;
  removeFavorite(userId: string, dex: number): Promise<void>;

  trainers(): Promise<Trainer[]>;
  putTrainer(role: Role, trainer: Trainer): Promise<void>;
  removeTrainer(role: Role, name: string): Promise<void>;

  listUsers(role: Role): Promise<UserRow[]>;
  setRole(role: Role, targetId: string, change: RoleChange): Promise<void>;
}

/** 권한이 내려가는가 — 내려가면 그 사람의 세션을 끊는다 */
const RANK: Record<Role, number> = { pending: 0, approved: 1, admin: 2, root: 3 };

export function makeDomain(sql: Sql): Domain {
  return {
    // ── 담아 두기 ──────────────────────────────────────────────────────────
    async favorites(userId) {
      const rows = await sql<{ dex: number }[]>`
        select dex from favorites where user_id = ${userId} order by added_at`;
      return rows.map((row) => row.dex);
    },

    async addFavorite(userId, role, dex) {
      // 스프라이트 id 다. 표의 check (dex > 0) 와 같은 선을 앱에서도 본다 —
      // DB 오류를 500 으로 흘려보내면 프런트가 무엇이 틀렸는지 모른다
      if (!Number.isInteger(dex) || dex <= 0) {
        throw new DomainError('invalid', '포켓몬 번호가 아닙니다');
      }
      const cap = favoriteCap(role);
      const outcome = await sql.begin(async (tx) => {
        // **사람 줄을 잠근다.** 세고 나서 넣는 사이를 다른 기기가 비집고 들어올 수 없게
        const [owner] = await tx<{ id: string }[]>`select id from users where id = ${userId} for update`;
        if (!owner) return 'missing' as const;

        // 이미 담은 것이면 상한을 안 본다 — 넘칠 수 없는 요청까지 막으면
        // 같은 버튼을 두 번 누른 사람이 오류를 본다
        const [already] = await tx<{ dex: number }[]>`
          select dex from favorites where user_id = ${userId} and dex = ${dex}`;
        if (already) return null;

        const [count] = await tx<{ n: string }[]>`
          select count(*)::text as n from favorites where user_id = ${userId}`;
        if (Number(count!.n) >= cap) return 'limit' as const;

        await tx`insert into favorites (user_id, dex) values (${userId}, ${dex})`;
        return null;
      });
      if (outcome === 'missing') throw new DomainError('missing', '없는 사람입니다');
      if (outcome === 'limit') throw new DomainError('limit', `${cap}마리까지 담을 수 있습니다`);
    },

    async removeFavorite(userId, dex) {
      // 없는 것을 빼도 조용히 끝낸다 — 두 기기에서 같이 뺀 경우가 흔하다
      await sql`delete from favorites where user_id = ${userId} and dex = ${dex}`;
    },

    // ── 트레이너 코드 ──────────────────────────────────────────────────────
    async trainers() {
      const rows = await sql<{ name: string; code: string; sort_order: number }[]>`
        select name, code, sort_order from trainers order by sort_order, name`;
      return rows.map((row) => ({ name: row.name, code: row.code, sortOrder: row.sort_order }));
    },

    async putTrainer(role, trainer) {
      if (!canWriteTrainers(role)) throw new DomainError('forbidden', '관리자만 쓸 수 있습니다');
      const name = trainer.name.trim();
      const code = trainer.code.trim();
      if (!name || !code) throw new DomainError('invalid', '이름과 코드가 필요합니다');
      if (name.length > 200 || code.length > 50) throw new DomainError('invalid', '너무 깁니다');

      await sql`
        insert into trainers (name, code, sort_order)
        values (${name}, ${code}, ${trainer.sortOrder})
        on conflict (name) do update
           set code = excluded.code, sort_order = excluded.sort_order, updated_at = now()`;
    },

    async removeTrainer(role, name) {
      if (!canWriteTrainers(role)) throw new DomainError('forbidden', '관리자만 지울 수 있습니다');
      await sql`delete from trainers where name = ${name.trim()}`;
    },

    // ── 사람을 들이고 내보내기 ─────────────────────────────────────────────
    async listUsers(role) {
      // **루트만 본다** (v3.41.0). 위임 관리자는 운영을 돕는 자리지 서비스의 주인이 아니다
      if (!canApproveUsers(role)) throw new DomainError('forbidden', '루트 관리자만 볼 수 있습니다');
      const rows = await sql<{
        id: string; email: string; display_name: string; photo_url: string;
        role: Role; beta: boolean; created_at: Date; last_seen_at: Date | null;
      }[]>`
        select id, email, display_name, photo_url, role, beta, created_at, last_seen_at
          from users order by role, created_at`;
      return rows.map((row) => ({
        id: row.id, email: row.email, name: row.display_name, picture: row.photo_url,
        role: row.role, beta: row.beta, createdAt: row.created_at, lastSeenAt: row.last_seen_at,
      }));
    },

    async setRole(role, targetId, change) {
      if (!canApproveUsers(role)) throw new DomainError('forbidden', '루트 관리자만 바꿀 수 있습니다');
      // **루트는 API 로 만들 수 없다.** 루트는 ROOT_EMAIL 하나뿐이고 그 판정은 로그인에서만 난다 —
      // 관리자가 스스로를 루트로 올릴 수 있으면 '위임' 이라는 말이 뜻을 잃는다
      if (change.role === 'root') {
        throw new DomainError('invalid', '루트 관리자는 ROOT_EMAIL 로만 정해집니다');
      }

      const outcome = await sql.begin(async (tx) => {
        const [target] = await tx<{ role: Role }[]>`
          select role from users where id = ${targetId} for update`;
        if (!target) return 'missing' as const;

        if (change.role !== undefined) {
          await tx`update users set role = ${change.role}, updated_at = now() where id = ${targetId}`;
        }
        if (change.beta !== undefined) {
          await tx`update users set beta = ${change.beta}, updated_at = now() where id = ${targetId}`;
        }

        // **내리면 세션을 끊는다.** 액세스 토큰은 15분 사는 물건이라 권한을 내리는 것만으로는
        // 그 15분이 안 막힌다. 올릴 때는 안 끊는다 — 승인되자마자 쫓겨나면 이상하고,
        // 회전 한 번이면 새 권한이 따라온다
        if (change.role !== undefined && RANK[change.role] < RANK[target.role]) {
          await tx`update sessions set revoked_at = now()
                    where user_id = ${targetId} and revoked_at is null`;
        }
        return null;
      });
      if (outcome === 'missing') throw new DomainError('missing', '없는 사람입니다');
    },
  };
}
