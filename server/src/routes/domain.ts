// ─────────────────────────────────────────────────────────────────────────────
// routes/domain.ts — 담아 두기 · 트레이너 코드 · 가입 승인의 HTTP 자리 (v5 Phase 5)
//
// **Firestore 의 문서 모양을 그대로 안 옮겼다.** 화면은 `setDoc('allowlist/{email}')` 처럼
// 문서를 직접 썼는데, 그건 규칙이 이메일로만 문서를 찾을 수 있어서 생긴 모양이지 뜻이 아니다.
// Phase 6 이 프런트를 새로 쓰므로 모양을 바로잡을 자리가 지금뿐이다.
//
// **가입 요청이 사라졌다.** 전에는 로그인한 사람이 `requests/{email}` 을 손수 써야 승인
// 대기가 됐다. 여기서는 로그인이 곧 `pending` 줄이라 따로 요청할 것이 없다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { FastifyInstance, FastifyReply, preHandlerHookHandler } from 'fastify';
import { DomainError, type Domain } from '../services/domain.ts';
import { ROLES, favoriteCap, type Role } from '../lib/rbac.ts';

export interface DomainRouteDeps {
  domain: Domain;
  requireRole: (min: Role) => preHandlerHookHandler;
}

/** 거부의 이유를 상태 코드로. 한 곳에서 옮겨야 주소마다 답이 달라지지 않는다 */
const STATUS: Record<DomainError['reason'], number> = {
  invalid: 400,
  forbidden: 403,
  missing: 404,
  // 409 다. 400 이 아니다 — 요청은 멀쩡하고 **지금 상태**가 안 받아 준다
  limit: 409,
};

function refuse(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof DomainError) {
    return reply.code(STATUS[error.reason]).send({ error: error.message, reason: error.reason });
  }
  throw error;
}

const ERROR_REPLY = {
  type: 'object',
  properties: { error: { type: 'string' }, reason: { type: 'string' } },
  required: ['error'],
} as const;

/** 칸 없는 object 는 값이 있어도 `{}` 로 나간다 (CLAUDE.md §3) */
const TRAINER = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    code: { type: 'string' },
    sortOrder: { type: 'integer' },
  },
  required: ['name', 'code', 'sortOrder'],
} as const;

const USER_ROW = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    picture: { type: 'string' },
    role: { type: 'string', enum: [...ROLES] },
    beta: { type: 'boolean' },
    createdAt: { type: 'string' },
    lastSeenAt: { type: 'string', nullable: true },
  },
  required: ['id', 'email', 'name', 'picture', 'role', 'beta', 'createdAt', 'lastSeenAt'],
} as const;

export function domainRoutes(app: FastifyInstance, deps: DomainRouteDeps): void {
  const { domain, requireRole } = deps;

  // ── 담아 두기 ────────────────────────────────────────────────────────────
  // **승인 대기도 담는다** (v3.60.0) — 담아 둔 것이 있어야 승인을 기다릴 이유도 생긴다
  app.get('/v1/me/favorites', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['내 것'],
      summary: '담아 둔 포켓몬',
      security: [{ accessToken: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            favorites: { type: 'array', items: { type: 'integer' } },
            cap: { type: 'integer', description: '담을 수 있는 최대 — 승인 대기 200, 승인부터 1000' },
          },
          required: ['favorites', 'cap'],
        },
        401: ERROR_REPLY,
      },
    },
  }, async (request, reply) => {
    const claims = request.claims!;
    const favorites = await domain.favorites(claims.sub);
    // 상한을 같이 내려 준다 — 프런트가 그 숫자를 또 적으면 두 벌이 되고 한쪽만 고쳐진다
    return reply.send({ favorites, cap: favoriteCap(claims.role) });
  });

  app.put('/v1/me/favorites/:dex', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['내 것'],
      summary: '한 마리 담는다',
      security: [{ accessToken: [] }],
      params: { type: 'object', properties: { dex: { type: 'integer' } }, required: ['dex'] },
      response: { 204: { description: '담았다', type: 'null' }, 400: ERROR_REPLY, 409: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const claims = request.claims!;
    const { dex } = request.params as { dex: number };
    try {
      await domain.addFavorite(claims.sub, claims.role, dex);
      return reply.code(204).send();
    } catch (error) { return refuse(reply, error); }
  });

  app.delete('/v1/me/favorites/:dex', {
    preHandler: requireRole('pending'),
    schema: {
      tags: ['내 것'],
      summary: '한 마리 뺀다',
      security: [{ accessToken: [] }],
      params: { type: 'object', properties: { dex: { type: 'integer' } }, required: ['dex'] },
      response: { 204: { description: '뺐다', type: 'null' }, 401: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const { dex } = request.params as { dex: number };
    await domain.removeFavorite(request.claims!.sub, dex);
    return reply.code(204).send();
  });

  // ── 트레이너 코드 ────────────────────────────────────────────────────────
  // **코드는 저장소에 안 박는다** (CLAUDE.md §3) — 전에는 Firestore 에만 뒀고 이제 DB 에만 둔다
  app.get('/v1/trainers', {
    preHandler: requireRole('approved'),
    schema: {
      tags: ['트레이너'],
      summary: '트레이너 코드 목록 — 승인된 사람만',
      security: [{ accessToken: [] }],
      response: {
        200: {
          type: 'object',
          properties: { trainers: { type: 'array', items: TRAINER } },
          required: ['trainers'],
        },
        403: ERROR_REPLY,
      },
    },
  }, async (_request, reply) => reply.send({ trainers: await domain.trainers() }));

  app.put('/v1/trainers/:name', {
    preHandler: requireRole('admin'),
    schema: {
      tags: ['트레이너'],
      summary: '넣거나 고친다 — 관리자 둘 다',
      security: [{ accessToken: [] }],
      params: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      body: {
        type: 'object',
        properties: { code: { type: 'string' }, sortOrder: { type: 'integer' } },
        required: ['code'],
      },
      response: { 204: { description: '넣었다', type: 'null' }, 400: ERROR_REPLY, 403: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const { name } = request.params as { name: string };
    const { code, sortOrder } = request.body as { code: string; sortOrder?: number };
    try {
      await domain.putTrainer(request.claims!.role, { name, code, sortOrder: sortOrder ?? 0 });
      return reply.code(204).send();
    } catch (error) { return refuse(reply, error); }
  });

  app.delete('/v1/trainers/:name', {
    preHandler: requireRole('admin'),
    schema: {
      tags: ['트레이너'],
      summary: '지운다 — 관리자 둘 다',
      security: [{ accessToken: [] }],
      params: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      response: { 204: { description: '지웠다', type: 'null' }, 403: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const { name } = request.params as { name: string };
    try {
      await domain.removeTrainer(request.claims!.role, name);
      return reply.code(204).send();
    } catch (error) { return refuse(reply, error); }
  });

  // ── 사람을 들이고 내보내기 ───────────────────────────────────────────────
  // **루트만** (v3.41.0). 위임 관리자가 할 수 있는 일은 트레이너 코드 쓰기뿐이다
  app.get('/v1/admin/users', {
    preHandler: requireRole('admin'),
    schema: {
      tags: ['관리'],
      summary: '사람 목록 — 관리자 둘 다. **승인 대기는 루트에게만 실려 나간다**',
      security: [{ accessToken: [] }],
      response: {
        200: {
          type: 'object',
          properties: { users: { type: 'array', items: USER_ROW } },
          required: ['users'],
        },
        403: ERROR_REPLY,
      },
    },
  }, async (request, reply) => {
    try {
      const users = await domain.listUsers(request.claims!.role);
      return reply.send({
        users: users.map((one) => ({
          ...one,
          createdAt: one.createdAt.toISOString(),
          lastSeenAt: one.lastSeenAt ? one.lastSeenAt.toISOString() : null,
        })),
      });
    } catch (error) { return refuse(reply, error); }
  });

  app.patch('/v1/admin/users/:id', {
    preHandler: requireRole('root'),
    schema: {
      tags: ['관리'],
      summary: '승인·관리자 지정·실험 기능 — 루트 관리자만',
      security: [{ accessToken: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          // 'root' 를 목록에서 뺀다 — 루트는 ROOT_EMAIL 로만 정해진다
          role: { type: 'string', enum: ['pending', 'approved', 'admin'] },
          beta: { type: 'boolean' },
        },
      },
      response: { 204: { description: '바꿨다', type: 'null' }, 400: ERROR_REPLY, 403: ERROR_REPLY, 404: ERROR_REPLY },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const change = request.body as { role?: Role; beta?: boolean };
    try {
      await domain.setRole(request.claims!.role, id, change);
      return reply.code(204).send();
    } catch (error) { return refuse(reply, error); }
  });
}
