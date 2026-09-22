// ─────────────────────────────────────────────────────────────────────────────
// lib/openapi.ts — API 설명서의 머리말 (v4.7.4).
//
// **본문은 여기 없다.** 주소마다의 모양은 라우트에 이미 적힌 JSON Schema 에서 그대로 나온다
// (`@fastify/swagger`). 설명서를 손으로 따로 쓰면 코드와 어긋나는 날이 오고,
// 어긋난 설명서는 없느니만 못하다 — 읽는 사람이 그걸 믿고 짜기 때문이다.
//
// 저장소의 `openapi.json` 은 `npm run openapi` 가 굽는다. 검사가 코드와 그 파일을 대어 본다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

export const OPENAPI_INFO = {
  title: 'moncamp 수집·집계 서버',
  description: [
    'GA4 가 돌려주지 않는 **원본 이벤트**를 내 DB 에 남기는 서버입니다.',
    '',
    '- 화면(moncamp.kr)은 이 서버를 **런타임에 읽지 않습니다** — 보내기만 하고, 받아 오는 것은 빌드입니다.',
    '- `POST /v1/events` 는 답을 기다리지 않는 자리라 `204` 만 돌려줍니다.',
    '- IP 는 어디에도 저장하지 않습니다. 분당 한도가 받는 순간 보고 버릴 뿐입니다.',
    '- 원본은 **12개월** 뒤 지우고 날짜·이름별 합계만 남깁니다.',
    '',
    '설계 배경: [개발 문서 §2.28](https://github.com/MinsangKwak/pogo-rank/blob/main/docs/DEVELOPMENT.md) ·',
    '[server/README.md](https://github.com/MinsangKwak/pogo-rank/blob/main/server/README.md) ·',
    '[server/SCHEMA.md](https://github.com/MinsangKwak/pogo-rank/blob/main/server/SCHEMA.md)',
  ].join('\n'),
  version: '1.0.0',
  license: { name: 'MIT', url: 'https://github.com/MinsangKwak/pogo-rank/blob/main/LICENSE' },
} as const;

export const OPENAPI_TAGS = [
  { name: '수집', description: '브라우저가 보내는 자리. 답을 기다리지 않는다' },
  { name: '조회', description: '빌드가 받아 가는 자리' },
  { name: '관리', description: '열쇠(`ADMIN_TOKEN`)가 있어야 열린다' },
  { name: '상태', description: 'Cloud Run 이 보는 자리' },
  { name: '인증', description: '구글로 로그인하고 세션을 돌리는 자리 (v5 Phase 4)' },
  { name: '내 것', description: '본인만 읽고 쓴다 (v5 Phase 5)' },
  { name: '트레이너', description: '승인된 사람이 읽고 관리자가 쓴다 (v5 Phase 5)' },
] as const;

/** 로그인한 사람이 쓰는 자리에 붙인다 (v5 Phase 4) */
export const ACCESS_SCHEME = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: '`Authorization: Bearer <액세스 토큰>`. `POST /v1/auth/refresh` 가 준다',
} as const;

/** 열쇠를 쓰는 자리에 붙인다 */
export const BEARER_SCHEME = {
  type: 'http',
  scheme: 'bearer',
  description: '`Authorization: Bearer <ADMIN_TOKEN>`. 운영에서는 32자 이상이어야 서버가 뜬다',
} as const;

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
export function toOas30(node: unknown): unknown {
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
