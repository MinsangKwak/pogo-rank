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
  return toOas30(spec) as Record<string, unknown>;
}

/**
 * `type: ['string', 'null']` 을 `type: 'string', nullable: true` 로 바꾼다.
 *
 * **라우트 스키마는 안 건드린다.** 그 배열 문법은 Fastify 안에서 검증과 직렬화가 읽는 것이고,
 * 바꾸면 방금 세운 검사들이 보는 동작이 같이 바뀐다. 문서로 나갈 때만 갈아 낀다.
 *
 * 배열 `type` 은 JSON Schema · OpenAPI **3.1** 문법이다. 우리가 내는 문서는 3.0.3 이라
 * 그 자리에서 `type` 은 문자열 하나여야 하고, 없는 값은 `nullable: true` 로 적는다 —
 * 엄격한 검증기와 클라이언트 생성기가 3.1 문법을 만나면 문서를 통째로 거부한다.
 */
function toOas30(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toOas30);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    out[key] = toOas30(value);
  }
  const type = out['type'];
  if (Array.isArray(type) && type.length === 2 && type.includes('null')) {
    out['type'] = type.find((one) => one !== 'null');
    out['nullable'] = true;
  }
  return out;
}

/** 저장소에 넣는 모양 — 줄바꿈까지 고정해야 검사가 흔들리지 않는다 */
export function specText(spec: Record<string, unknown>): string {
  return `${JSON.stringify(spec, null, 2)}\n`;
}
