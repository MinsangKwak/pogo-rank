// ─────────────────────────────────────────────────────────────────────────────
// lib/spec.ts — 지금 코드가 만드는 OpenAPI 문서를 꺼낸다.
//
// **한 자리에서 꺼낸다.** 굽는 스크립트와 어긋남 검사가 같은 함수를 쓴다 —
// 둘이 따로 만들면 "검사는 통과하는데 파일은 옛것" 이 된다.
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
};

export async function openapiSpec(): Promise<Record<string, unknown>> {
  const app = await buildApp(ENV, NO_DB);
  await app.ready();
  const spec = app.swagger() as Record<string, unknown>;
  await app.close();
  return spec;
}

/** 저장소에 넣는 모양 — 줄바꿈까지 고정해야 검사가 흔들리지 않는다 */
export function specText(spec: Record<string, unknown>): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}
