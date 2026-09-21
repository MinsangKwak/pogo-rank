// ─────────────────────────────────────────────────────────────────────────────
// app.ts — Fastify 한 대를 조립한다. **듣기(listen)는 안 한다.**
//
// 갈라 둔 이유 — 검사가 포트를 열지 않고 app.inject() 로 같은 길을 탄다.
// 포트를 여는 검사는 느리고, 병렬로 돌리면 서로 포트를 뺏는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { OPENAPI_INFO, OPENAPI_TAGS, BEARER_SCHEME } from './lib/openapi.ts';
import type { Sql } from './db/client.ts';
import type { Env } from './env.ts';
import { healthRoutes } from './routes/health.ts';
import { eventRoutes } from './routes/events.ts';
import { hotRoutes } from './routes/hot.ts';
import { backupRoutes } from './routes/backup.ts';

export async function buildApp(env: Env, sql: Sql): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.nodeEnv === 'test' ? false : { level: env.nodeEnv === 'production' ? 'info' : 'debug' },
    // Cloud Run 이 앞에 있다. 프로토콜·호스트를 헤더에서 읽어야 생성되는 주소가 맞는다
    trustProxy: true,
    // 수집 몸통은 작다. 큰 몸통을 받아 줄 이유가 없다 (배치 20건이면 4KB 남짓)
    bodyLimit: 64 * 1024,
    // **모르는 칸은 조용히 버리지 않고 400 으로 돌려준다.**
    // Fastify 기본값(removeAdditional: true)은 스키마에 없는 칸을 말없이 지운다 — 저장은 안 되니
    // 안전하지만, 프런트가 오타 난 칸을 보내도 아무 일 없이 204 라 **틀린 줄 알 길이 없다**.
    // 프런트와 서버가 같은 커밋에서 나가는 구조라(server/ 를 같은 저장소에 둔 이유) 엄격해도 안전하다
    ajv: { customOptions: { removeAdditional: false } },
  });

  // **CORS 는 방어가 아니다.** 브라우저가 *응답을 읽는 것*을 막을 뿐이고,
  // sendBeacon 같은 단순 요청(text/plain)은 프리플라이트 없이 그냥 도착한다 — 응답을 안 읽으니 상관없이.
  // 그래서 여기는 '정상 사용을 위한 설정' 이고, 남의 사이트가 우리 수집기에 쏘는 것은
  // 아래 originGuard 가 Origin 헤더를 직접 봐서 막는다.
  // 쿠키를 안 받으므로 credentials 도 켜지 않는다
  await app.register(cors, {
    origin: env.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: false,
    maxAge: 86400,
  });

  // 인스턴스 안의 계수다 — Cloud Run 이 인스턴스를 늘리거나 재우면 초기화된다.
  // 정교한 방어가 아니라 **사고로 쏟아지는 것**(재시도 루프·잘못 짠 스크립트)을 막는 그물이다.
  // 진짜 방어는 앞단(Cloudflare)의 몫이고, 마지막 판정은 집계의 사람당 한도가 한다
  await app.register(rateLimit, {
    max: env.rateLimitPerMinute,
    timeWindow: '1 minute',
    // 앞단이 넘겨준 IP 를 본다. 여기서 쓰고 **저장하지는 않는다** (lib/country.ts)
    keyGenerator: (req) => req.ip,
  });

  // **sendBeacon 은 text/plain 으로 온다.** application/json 으로 보내면 프리플라이트가 붙는데,
  // 탭이 닫히는 순간의 프리플라이트는 자주 실패한다 — 떠나면서 보낸 마지막 검색이 그때 사라진다.
  // 그래서 몸통은 text/plain 으로 받고 여기서 JSON 으로 읽는다. 스키마 검사는 그다음에 그대로 돈다
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    try { done(null, JSON.parse(body as string)); }
    catch { done(Object.assign(new Error('JSON 이 아닙니다'), { statusCode: 400 }), undefined); }
  });

  // Origin 을 **서버가 직접 본다.** 브라우저에서 온 교차 출처 POST 에는 Origin 이 반드시 붙으므로,
  // 이것으로 '남의 사이트가 우리 수집기에 beacon 을 쏘는' 경우가 통째로 막힌다.
  //
  // **curl 은 못 막는다** — Origin 은 얼마든지 지어낼 수 있다. 그쪽은 분당 한도와
  // 집계의 사람당 한도(lib/hot.ts PERSON_CAP)가 맡는다. 겹을 나눠 두는 이유가 이것이다
  app.addHook('preHandler', async (req, reply) => {
    if (req.method !== 'POST' || !req.url.startsWith('/v1/events')) return;
    const origin = req.headers.origin;
    if (!origin || !env.allowedOrigins.includes(origin)) {
      app.log.warn({ origin: origin ?? '(없음)' }, '허용하지 않은 출처의 수집 요청');
      return reply.code(403).send({ error: '허용하지 않은 출처입니다' });
    }
  });

  // **설명서는 라우트보다 먼저 붙인다.** 뒤에 붙이면 이미 등록된 주소의 스키마를 못 읽는다.
  // 본문을 손으로 안 쓰므로 코드와 어긋날 자리가 없다 (lib/openapi.ts)
  await app.register(swagger, {
    openapi: {
      info: OPENAPI_INFO,
      tags: [...OPENAPI_TAGS],
      components: { securitySchemes: { adminToken: BEARER_SCHEME } },
      servers: [
        { url: 'https://api.moncamp.kr', description: '운영' },
        { url: 'http://localhost:8080', description: '로컬' },
      ],
    },
  });
  // 읽는 자리는 열어 둔다 — 코드가 통째로 공개돼 있어 숨겨서 얻는 것이 없고,
  // 관리 주소는 열쇠가 막는다
  await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'list' } });

  healthRoutes(app, sql);
  eventRoutes(app, sql);
  hotRoutes(app, sql, env.adminToken);
  backupRoutes(app, sql, env.adminToken);

  // 수집이 실패해도 화면은 멀쩡해야 한다 — 500 을 내되 몸통에 내부 사정을 싣지 않는다
  app.setErrorHandler((error: FastifyError, req, reply) => {
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (status >= 500) app.log.error({ error, url: req.url }, '요청 처리 실패');
    return reply.code(status).send({ error: status >= 500 ? '서버 오류' : error.message });
  });

  return app;
}
