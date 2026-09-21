// ─────────────────────────────────────────────────────────────────────────────
// routes/backup.ts — 백업 기록을 받고 보여 준다 (v4.8.0).
//
// **백업 자체는 서버가 하지 않는다.** 주간 워크플로(`backup-firestore.yml`)가 Firestore 를 받아
// 암호화해 올린다 — 이미 잘 도는 것을 가운데로 끌어오면 고장 날 자리만 는다.
// 서버가 맡는 것은 그 일이 **정말 돌았는지 아는 일**이다. 그건 표가 있어야 답할 수 있다.
//
// 둘 다 열쇠가 필요하다. 문서 수와 해시는 개인정보가 아니지만, 우리 서비스의 규모를
// 아무에게나 알려 줄 이유도 없다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance } from 'fastify';
import type { Sql } from '../db/client.ts';
import { backupHealth, recentRuns, STALE_DAYS, DROP_RATIO } from '../lib/backup.ts';

interface RunBody {
  location: string;
  bytes: number;
  sha256: string;
  counts?: Record<string, number>;
  note?: string;
  ranAt?: string;
}

const runBodySchema = {
  type: 'object',
  required: ['location', 'bytes', 'sha256'],
  additionalProperties: false,
  properties: {
    location: { type: 'string', minLength: 1, maxLength: 500, description: "`gs://…` 또는 `actions-artifact://…`" },
    bytes: { type: 'integer', minimum: 1 },
    sha256: { type: 'string', pattern: '^[0-9a-f]{64}$', description: '암호화본의 sha256' },
    // 컬렉션별 **문서 수**. 이름도 이메일도 오지 않는다
    counts: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } },
    note: { type: 'string', maxLength: 500 },
    ranAt: { type: 'string', format: 'date-time' },
  },
} as const;

export function backupRoutes(app: FastifyInstance, sql: Sql, adminToken: string): void {
  const authorized = (header: string | undefined): boolean =>
    !!adminToken && header === `Bearer ${adminToken}`;

  app.post<{ Body: RunBody }>('/v1/admin/backups', {
    schema: {
      tags: ['관리'],
      summary: '백업 한 판을 기록한다',
      description: [
        '주간 백업 워크플로가 암호화본을 올린 **뒤에** 부른다.',
        '',
        '**내용물은 안 보낸다.** 잰 수만 온다 — 어디에, 몇 바이트, 해시, 컬렉션별 문서 **수**.',
        '이름·이메일·트레이너 코드는 오지 않으므로 이 표에는 개인정보가 없다.',
      ].join('\n'),
      security: [{ adminToken: [] }],
      body: runBodySchema,
      response: {
        201: { type: 'object', properties: { ok: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    if (!authorized(req.headers.authorization)) return reply.code(401).send({ error: '열쇠가 필요합니다' });
    const { location, bytes, sha256, counts = {}, note = null, ranAt } = req.body;
    await sql`
      insert into backup_runs (ran_at, location, bytes, sha256, counts, note)
      values (${ranAt ? new Date(ranAt) : new Date()}, ${location}, ${bytes}, ${sha256},
              ${sql.json(counts)}, ${note})`;
    return reply.code(201).send({ ok: true });
  });

  app.get('/v1/admin/backups', {
    schema: {
      tags: ['관리'],
      summary: '백업이 살아 있는가',
      description: [
        '**백업의 진짜 실패는 조용하다.** 워크플로는 초록인데 받아 온 문서가 절반이 됐거나,',
        '몇 주째 안 돌았는데 아무도 모르는 쪽이다. 파일이 있다는 것과 그 안에 다 들어 있다는 것은 다른 말이다.',
        '',
        `- 마지막 백업이 **${STALE_DAYS}일**보다 오래되면 짚는다 (주 1회이므로 한 번은 거른 것)`,
        `- 문서 수가 지난번보다 **${DROP_RATIO * 100}%** 넘게 줄면 짚는다 — 계정 삭제일 수도 있으니 '틀렸다' 가 아니라 '보라' 다`,
        '',
        '되돌릴 일이 생겼을 때 "언제 것을 받아야 하나" 도 여기서 답한다.',
      ].join('\n'),
      security: [{ adminToken: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            problems: { type: 'array', items: { type: 'string' } },
            latest: { type: ['object', 'null'] },
            runs: { type: 'array', items: { type: 'object' } },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    if (!authorized(req.headers.authorization)) return reply.code(401).send({ error: '열쇠가 필요합니다' });
    const health = await backupHealth(sql);
    return { ...health, runs: await recentRuns(sql, 10) };
  });
}
