// ─────────────────────────────────────────────────────────────────────────────
// routes/hot.ts — GET /v1/hot · POST /v1/admin/rollup
//
// **빌드가 읽는 자리다, 브라우저가 아니다.** 순위는 하루 두 번 도는 배포 워크플로가 받아
// 정적 파일로 굽는다 (docs/DEVELOPMENT.md §1 — 화면은 서버가 죽어도 멀쩡해야 한다).
// 그래서 콜드 스타트 3초가 문제가 되지 않고, 캐시 헤더도 넉넉히 준다.
//
// 롤업은 열쇠가 있어야 돈다. 아무나 부를 수 있으면 남의 요청으로 DB 가 계속 깨어 있게 된다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance } from 'fastify';
import type { Sql } from '../db/client.ts';
import { hotRows, rollup, MIN_HITS, MIN_ROWS, PERSON_CAP } from '../lib/hot.ts';

interface HotQuery { days?: number; limit?: number; country?: string; raw?: boolean }

const hotQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    days: { type: 'integer', minimum: 1, maximum: 90, default: 7 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    country: { type: 'string', pattern: '^[A-Za-z]{2}$' },
    // 문턱을 끈 날것. 진단용이라 열쇠가 필요하다
    raw: { type: 'boolean', default: false },
  },
} as const;

export function hotRoutes(app: FastifyInstance, sql: Sql, adminToken: string): void {
  const authorized = (header: string | undefined): boolean =>
    !!adminToken && header === `Bearer ${adminToken}`;

  app.get<{ Querystring: HotQuery }>('/v1/hot', { schema: { querystring: hotQuerySchema } }, async (req, reply) => {
    const { days = 7, limit = 10, country, raw = false } = req.query;
    if (raw && !authorized(req.headers.authorization)) return reply.code(401).send({ error: 'raw 는 열쇠가 필요합니다' });
    const rows = await hotRows(sql, {
      days, limit,
      country: country ? country.toUpperCase() : undefined,
      threshold: !raw,
    });
    // 빌드가 하루 두 번 받아 간다 — 그 사이 값이 바뀔 일이 없으니 10분은 그대로 써도 된다
    reply.header('cache-control', 'public, max-age=600');
    return {
      // 화면이 "최근 N일 동안" 이라고 말을 바꿀 수 있게 창을 같이 실어 준다 (v4.6.1 gaNote 와 같은 자리)
      window: days,
      country: country ? country.toUpperCase() : null,
      thresholds: raw ? null : { minHits: MIN_HITS, minRows: MIN_ROWS, personCap: PERSON_CAP },
      generated: new Date().toISOString(),
      rows,
    };
  });

  app.post('/v1/admin/rollup', async (req, reply) => {
    if (!authorized(req.headers.authorization)) return reply.code(401).send({ error: '열쇠가 필요합니다' });
    const written = await rollup(sql);
    return { ok: true, written };
  });
}
