// ─────────────────────────────────────────────────────────────────────────────
// routes/stats.ts — GET /v1/admin/stats · 루트 관리자 통계 화면 (2026-09-24)
//
// **루트만.** 가입 수 · 검색어 같은 운영 숫자는 위임 관리자와 나누지 않는다 — 가입 승인이 루트만인 것과 같은 선.
// 나가는 것은 모아 센 값뿐이다 (lib/stats.ts 머리말). GA4 가 안 돼도 우리 숫자는 선다 (lib/ga4.ts).
//
// 스키마의 object 는 칸까지 다 적는다 — 칸 없는 object 는 값이 있어도 {} 로 나간다 (CLAUDE.md §3).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { Sql } from '../db/client.ts';
import type { Role } from '../lib/rbac.ts';
import { adminStats, STATS_LIMITS } from '../lib/stats.ts';
import { ga4Stats } from '../lib/ga4.ts';

interface Deps {
  sql: Sql;
  requireRole: (min: Role) => preHandlerHookHandler;
  ga4PropertyId: string;
  ga4Fetch?: typeof fetch | undefined;
}

const int = { type: 'integer' } as const;
const str = { type: 'string' } as const;

const DAY_COUNT = { type: 'object', properties: { day: str, count: int }, required: ['day', 'count'] } as const;
const DAY_HITS = { type: 'object', properties: { day: str, hits: int, visitors: int }, required: ['day', 'hits', 'visitors'] } as const;
const RANKED = { type: 'object', properties: { key: str, hits: int, visitors: int }, required: ['key', 'hits', 'visitors'] } as const;

const EVENT_STATS = {
  type: 'object',
  properties: {
    hits: int,
    visitors: int,
    perDay: { type: 'array', items: DAY_HITS },
    top: { type: 'array', items: RANKED },
    surfaces: { type: 'array', items: RANKED },
    countries: { type: 'array', items: RANKED },
  },
  required: ['hits', 'visitors', 'perDay', 'top', 'surfaces', 'countries'],
} as const;

const GA4_ROW = { type: 'object', properties: { key: str, views: int, users: int }, required: ['key', 'views', 'users'] } as const;

const GA4 = {
  type: 'object',
  description: "status 가 'ok' 가 아니면 reason 만 온다 — 화면이 그 말을 그대로 적는다",
  properties: {
    status: { type: 'string', enum: ['ok', 'off', 'error'] },
    reason: str,
    users: int,
    newUsers: int,
    views: int,
    sessions: int,
    perDay: {
      type: 'array',
      items: { type: 'object', properties: { day: str, users: int, views: int, sessions: int }, required: ['day', 'users', 'views', 'sessions'] },
    },
    pages: { type: 'array', items: GA4_ROW },
    countries: { type: 'array', items: GA4_ROW },
  },
  required: ['status'],
} as const;

const STATS_REPLY = {
  type: 'object',
  properties: {
    generatedAt: str,
    days: int,
    users: {
      type: 'object',
      properties: {
        total: int, pending: int, approved: int, admin: int, root: int, beta: int,
        active1d: int, active7d: int, active30d: int,
        newPerDay: { type: 'array', items: DAY_COUNT },
      },
      required: ['total', 'pending', 'approved', 'admin', 'root', 'beta', 'active1d', 'active7d', 'active30d', 'newPerDay'],
    },
    sessions: { type: 'object', properties: { active: int }, required: ['active'] },
    favorites: {
      type: 'object',
      properties: {
        total: int,
        people: int,
        top: { type: 'array', items: { type: 'object', properties: { dex: int, users: int }, required: ['dex', 'users'] } },
      },
      required: ['total', 'people', 'top'],
    },
    search: EVENT_STATS,
    views: EVENT_STATS,
    ga4: GA4,
  },
  required: ['generatedAt', 'days', 'users', 'sessions', 'favorites', 'search', 'views', 'ga4'],
} as const;

const ERROR_REPLY = {
  type: 'object',
  properties: { error: str, reason: str },
  required: ['error'],
} as const;

export function statsRoutes(app: FastifyInstance, deps: Deps): void {
  app.get<{ Querystring: { days?: number } }>('/v1/admin/stats', {
    preHandler: deps.requireRole('root'),
    schema: {
      tags: ['관리'],
      summary: '운영 통계 — 루트 관리자만',
      description: [
        '가입 · 로그인 · ★ · 검색 · 페이지뷰(우리 수집)와 GA4 방문자 · 페이지뷰를 한 번에 준다.',
        '',
        '- **모아 센 값만** 나간다. 이메일 · 이름 · 방문자 난수 ID 는 한 칸도 없다',
        '- 날짜는 한국 날짜, 빈 날은 0 으로 채운다',
        `- 기간은 ${STATS_LIMITS.minDays}~${STATS_LIMITS.maxDays}일 (기본 30)`,
        "- GA4 가 안 되면 `ga4.status` 가 'off' · 'error' 이고 나머지는 그대로 선다",
      ].join('\n'),
      security: [{ accessToken: [] }],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: { days: { type: 'integer', minimum: STATS_LIMITS.minDays, maximum: STATS_LIMITS.maxDays, default: 30 } },
      },
      response: { 200: STATS_REPLY, 401: ERROR_REPLY, 403: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const days = request.query.days ?? 30;
    const [ours, ga4] = await Promise.all([
      adminStats(deps.sql, days),
      ga4Stats(deps.ga4PropertyId, days, deps.ga4Fetch ?? fetch),
    ]);
    // 숫자는 바뀌어도 곧 다시 볼 것이라 저장하지 않는다 — 운영 숫자가 브라우저 캐시에 남지 않게
    return reply.header('cache-control', 'no-store').send({ ...ours, ga4 });
  });
}
