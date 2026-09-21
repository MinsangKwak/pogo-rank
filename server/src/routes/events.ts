// ─────────────────────────────────────────────────────────────────────────────
// routes/events.ts — POST /v1/events. 이 서버의 존재 이유.
//
// **204 를 빨리 돌려주는 것이 일이다.** 프런트는 답을 안 기다린다(fire-and-forget) —
// 여기서 느려지거나 500 을 내도 사용자 화면은 아무 일도 없어야 한다.
//
// 막는 것 넷
//   ① CORS   우리 주소에서 온 것만 (app.ts)
//   ② 스키마 모양이 틀리면 400, 저장 없음 (lib/contract.ts)
//   ③ 한도   같은 앞단에서 분당 N 건 (app.ts)
//   ④ 뜻     term 없는 search 처럼 셀 것이 없는 줄은 버린다 (lib/normalize.ts)
// 넷 다 뚫려도 집계의 사람당 한도가 마지막으로 잡는다 (lib/hot.ts PERSON_CAP).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance } from 'fastify';
import type { Sql } from '../db/client.ts';
import { collectBodySchema, type CollectBody } from '../lib/contract.ts';
import { countryOf } from '../lib/country.ts';
import { toRows } from '../lib/normalize.ts';

export function eventRoutes(app: FastifyInstance, sql: Sql): void {
  app.post<{ Body: CollectBody }>('/v1/events', {
    schema: {
      tags: ['수집'],
      summary: '검색 기록을 보낸다',
      description: [
        '**답을 기다리지 않는 자리다.** 몸통 없이 `204` 만 돌려준다.',
        '',
        '- `sendBeacon` 이 보내는 `text/plain` 도 받는다 (프리플라이트가 없어야 탭을 떠나며 보낸 것이 닿는다).',
        '- `Origin` 을 **서버가 직접 본다** — 허용 목록에 없으면 `403`. CORS 는 단순 요청을 막지 못한다.',
        '- 모르는 칸이 하나라도 있으면 `400`. 조용히 지우지 않는다.',
        '- `term` 없는 `search` 처럼 셀 것이 없는 줄은 버리지만, 그래도 `204` 다 — 보낸 쪽이 틀린 게 아니다.',
      ].join('\n'),
      // **둘 다 적는다.** 설명에만 적으면 스펙에는 application/json 하나만 실려,
      // 이 스펙으로 만든 클라이언트는 프리플라이트가 붙는 쪽으로 보낸다 —
      // 탭을 떠나며 보낸 것이 그때 사라진다 (v4.8.1)
      consumes: ['application/json', 'text/plain'],
      body: collectBodySchema,
      response: {
        204: { type: 'null', description: '받았다 (걸러져 남은 줄이 없어도 같다)' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        429: { type: 'object', properties: { error: { type: 'string' } }, description: '분당 한도' },
      },
    },
  }, async (req, reply) => {
    const rows = toRows(req.body, countryOf(req.headers));
    // 다 걸러져 남은 것이 없어도 400 이 아니다 — 보낸 쪽이 틀린 게 아니라 셀 것이 없을 뿐이다
    if (rows.length) {
      // postgres.js 의 다중 insert. 값은 전부 바인딩 파라미터로 나간다
      await sql`insert into events ${sql(rows, 'name', 'visitor', 'term', 'surface', 'country', 'channel', 'occurred_at')}`;
    }
    return reply.code(204).send();
  });
}
