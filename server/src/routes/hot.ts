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
import { hotRows, rollup, MIN_HITS, MIN_ROWS, MIN_VISITORS, PERSON_CAP } from '../lib/hot.ts';
import { purge, KEEP_MONTHS } from '../lib/retention.ts';

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

  const HOT_ROW = {
    type: 'object',
    properties: {
      term: { type: 'string', description: '고른 완성어' },
      hits: { type: 'integer', description: `사람당 하루 ${PERSON_CAP}회까지 센 합계` },
      visitors: { type: 'integer', description: '찾은 사람 수 (난수 ID 기준)' },
    },
  } as const;

  app.get<{ Querystring: HotQuery }>('/v1/hot', {
    schema: {
      tags: ['조회'],
      summary: '검색 순위',
      description: [
        '**빌드가 받아 가는 자리다, 브라우저가 아니다.** 하루 두 번 도는 배포 워크플로가 받아 정적 파일로 굽는다 —',
        '그래서 콜드 스타트가 문제되지 않고, 서버가 죽어도 어제 구운 화면이 그대로 선다.',
        '',
        '**문턱은 자르기 전에 건다.** 안 그러면 한 사람이 밀어 올린 말들이 열 자리를 다 먹고,',
        '그 뒤에 전부 걸러져 표가 통째로 빈다.',
        '',
        `- 사람당 **하루** \`${PERSON_CAP}\`회까지만 센다`,
        `- \`${MIN_HITS}\`회를 못 넘긴 말, **찾은 사람이 \`${MIN_VISITORS}\`명 미만**인 말은 안 세운다`,
        `- 남은 줄이 \`${MIN_ROWS}\` 개를 못 채우면 **빈 표**를 준다 — 화면이 구역 자체를 안 그린다`,
        '',
        '`raw=true` 는 문턱을 끈 날것이라 열쇠가 필요하다.',
      ].join('\n'),
      querystring: hotQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            window: { type: 'integer', description: '센 날 수. 화면이 "최근 N일" 이라고 말을 바꾼다' },
            country: { type: ['string', 'null'] },
            // **칸을 하나하나 적는다.** fast-json-stringify 는 적힌 칸만 내보낸다 —
            // 빈 object 스키마는 값이 들어 있어도 `{}` 가 되어 문턱이 소리 없이 사라진다
            thresholds: {
              type: ['object', 'null'],
              description: '`raw` 면 `null`',
              properties: {
                minHits: { type: 'integer', description: '이 횟수를 못 넘긴 말은 안 세운다' },
                minRows: { type: 'integer', description: '남은 줄이 이보다 적으면 빈 표를 준다' },
                minVisitors: { type: 'integer', description: '찾은 사람이 이보다 적은 말은 안 세운다' },
                personCap: { type: 'integer', description: '사람당 하루 이 횟수까지만 센다' },
              },
            },
            generated: { type: 'string', format: 'date-time' },
            rows: { type: 'array', items: HOT_ROW },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
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
      thresholds: raw ? null : { minHits: MIN_HITS, minRows: MIN_ROWS, minVisitors: MIN_VISITORS, personCap: PERSON_CAP },
      generated: new Date().toISOString(),
      rows,
    };
  });

  // **집계와 파기를 한 자리에서 한다.** 파기를 따로 두면 그 워크플로를 빠뜨린 날이 생기고,
  // 방침에 적은 12개월은 '누가 기억해서 돌리면' 이 아니라 저절로 지켜져야 한다
  app.post('/v1/admin/rollup', {
    schema: {
      tags: ['관리'],
      summary: '일별 집계와 12개월 파기',
      description: [
        '매일 01:30 KST 에 워크플로가 부른다 (`server-rollup.yml`).',
        '',
        '1. 최근 며칠을 **다시 세어** `search_daily` 에 굳힌다 — 늦게 도착한 이벤트를 반영한다',
        `2. **${KEEP_MONTHS}개월** 넘은 KST 날짜를 먼저 굳히고, 그다음 \`events\` 에서 지운다`,
        '',
        '**둘을 한 부름에서 한다.** 파기를 따로 두면 그 워크플로를 빠뜨린 날이 생기고,',
        '방침에 적은 기간은 누가 기억해서 돌리는 것이 아니라 저절로 지켜져야 한다.',
        '',
        '`deleted` 가 0 인 것이 한동안 정상이다 — 첫 12개월은 지울 것이 없다.',
      ].join('\n'),
      security: [{ adminToken: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            written: { type: 'integer', description: '다시 센 일별 줄 수' },
            purged: {
              type: 'object',
              properties: {
                rolled: { type: 'integer', description: '지우기 전에 굳힌 줄 수' },
                deleted: { type: 'integer', description: '지운 원본 줄 수' },
                throughDay: { type: 'string', description: '이 KST 날짜까지가 대상이었다' },
              },
            },
            keepMonths: { type: 'integer' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    if (!authorized(req.headers.authorization)) return reply.code(401).send({ error: '열쇠가 필요합니다' });
    const written = await rollup(sql);
    const purged = await purge(sql);
    return { ok: true, written, purged, keepMonths: KEEP_MONTHS };
  });
}
