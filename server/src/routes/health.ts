// ─────────────────────────────────────────────────────────────────────────────
// routes/health.ts — 살아 있는가, DB 에 닿는가.
//
// 둘을 가른다. 프로세스는 떠 있는데 DB 가 잠들어 있는 상태가 이 구성에서 실제로 생긴다
// (Neon 은 유휴 컴퓨트를 재운다). '200 인데 아무것도 저장되지 않는' 시간을 눈으로 보려고 둔다.
//
// **`/healthz` 가 아니다** (v5 Phase 7). Cloud Run 은 `z` 로 끝나는 경로 일부를 앞단에서 가로챈다 —
// 공식 문서가 '끝이 z 인 경로는 다 피하라' 고 적는다. 그대로 두면 서버는 멀쩡한데 앞단이 404 를
// 줘서 배포 검사가 '죽었다' 고 판정한다. 한 번도 배포된 적이 없어 물린 곳이 없을 때 바꿨다
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance } from 'fastify';
import type { Sql } from '../db/client.ts';

export function healthRoutes(app: FastifyInstance, sql: Sql): void {
  app.get('/health', {
    schema: {
      tags: ['상태'],
      summary: '살아 있는가, DB 에 닿는가',
      description: 'DB 에 못 닿으면 **503** 이다 — 200 을 주면 Cloud Run 이 죽은 인스턴스에 계속 보낸다.',
      response: {
        200: { type: 'object', properties: { ok: { type: 'boolean' }, db: { type: 'string', enum: ['up'] } } },
        503: { type: 'object', properties: { ok: { type: 'boolean' }, db: { type: 'string', enum: ['down'] } } },
      },
    },
  }, async (_req, reply) => {
    let db: 'up' | 'down' = 'down';
    try {
      await sql`select 1`;
      db = 'up';
    } catch (error) {
      app.log.warn({ error }, 'health: DB 에 못 닿았다');
    }
    // DB 가 죽었으면 200 을 주지 않는다 — Cloud Run 이 이 인스턴스를 빼게 한다
    return reply.code(db === 'up' ? 200 : 503).send({ ok: db === 'up', db });
  });
}
