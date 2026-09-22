// ─────────────────────────────────────────────────────────────────────────────
// lib/spec.ts — 지금 코드가 만드는 OpenAPI 문서를 꺼낸다.
//
// **한 자리에서 꺼낸다.** 굽는 스크립트와 어긋남 검사가 같은 함수를 쓴다 —
// 둘이 따로 만들면 "검사는 통과하는데 파일은 옛것" 이 된다.
//
// **서버가 실제로 내보내는 주소에서 받는다** (v4.8.3 코드 리뷰). app.swagger() 를 직접 읽고
// 거기서만 손질하면, 저장소의 파일은 멀쩡한데 돌아가는 서버의 `/docs/json` 은 딴것이 된다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { buildApp } from '../app.ts';
import type { Env } from '../env.ts';
import type { Sql } from '../db/client.ts';

/** 문서를 뽑는 데 DB 는 필요 없다 — 주소와 스키마만 읽는다 */
const NO_DB = (() => Promise.resolve([])) as unknown as Sql;

const ENV: Env = {
  databaseUrl: 'postgres://doc',
  port: 8080,
  allowedOrigins: ['https://moncamp.kr'],
  adminToken: '',
  rateLimitPerMinute: 60,
  nodeEnv: 'test',
  // 문서를 뽑는 데 진짜 자격증명은 필요 없다 — 주소와 스키마만 읽는다.
  // 예약 도메인(.test)이라 누구의 값도 아니고, 이 판은 부팅하지 않는다
  auth: {
    jwtSecret: 'd'.repeat(48),
    rootEmail: 'owner@example.test',
    clientId: 'doc.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-doc',
    redirectUri: 'https://api.moncamp.kr/v1/auth/google/callback',
    appOrigin: 'https://moncamp.kr',
  },
};

export async function openapiSpec(): Promise<Record<string, unknown>> {
  const app = await buildApp(ENV, NO_DB);
  await app.ready();
  // **서버가 내보내는 바로 그 문서를 받는다.** app.swagger() 를 직접 읽으면
  // 돌아가는 서버의 /docs/json 과 달라질 수 있다 — 실제로 그렇게 어긋났었다 (v4.8.3)
  const res = await app.inject({ method: 'GET', url: '/docs/json' });
  await app.close();
  return JSON.parse(res.body) as Record<string, unknown>;
}

/** 저장소에 넣는 모양 — 줄바꿈까지 고정해야 검사가 흔들리지 않는다 */
export function specText(spec: Record<string, unknown>): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}
