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
] as const;

/** 열쇠를 쓰는 자리에 붙인다 */
export const BEARER_SCHEME = {
  type: 'http',
  scheme: 'bearer',
  description: '`Authorization: Bearer <ADMIN_TOKEN>`. 운영에서는 32자 이상이어야 서버가 뜬다',
} as const;
