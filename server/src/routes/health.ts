// ─────────────────────────────────────────────────────────────────────────────
// routes/health.ts — 살아 있는가, DB 에 닿는가.
//
// 둘을 가른다. 프로세스는 떠 있는데 DB 가 잠들어 있는 상태가 이 구성에서 실제로 생긴다
// (Neon 은 유휴 컴퓨트를 재운다). '200 인데 아무것도 저장되지 않는' 시간을 눈으로 보려고 둔다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance } from 'fastify';
import type { Sql } from '../db/client.ts';

export function healthRoutes(app: FastifyInstance, sql: Sql): void {
  app.get('/healthz', async (_req, reply) => {
    let db: 'up' | 'down' = 'down';
    try {
      await sql`select 1`;
      db = 'up';
    } catch (error) {
      app.log.warn({ error }, 'healthz: DB 에 못 닿았다');
    }
    // DB 가 죽었으면 200 을 주지 않는다 — Cloud Run 이 이 인스턴스를 빼게 한다
    return reply.code(db === 'up' ? 200 : 503).send({ ok: db === 'up', db });
  });
}
