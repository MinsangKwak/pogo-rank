// ─────────────────────────────────────────────────────────────────────────────
// lib/contract.ts — 프런트와 서버가 주고받는 모양. **여기가 정본이다.**
//
// 프런트(frontend-v4/src/lib/collect.ts)에도 같은 이름이 적혀 있지만, 판정은 서버가 한다 —
// 번들은 공개라 누구나 고쳐 보낼 수 있고, 화이트리스트를 클라이언트에 맡기면 없는 것과 같다.
//
// **이름을 늘릴 때는 EVENT_NAMES 한 줄만 는다.** 새 이벤트가 표에 들어가려면 여기를 지나야 하고,
// 여기를 안 지난 이름은 저장되지 않는다 (CLAUDE.md §1 의 '관문' 과 같은 생각).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

/**
 * 검색어(1판) · 페이지뷰(2026-09-24).
 * view 는 **화면 id 하나**만 받는다(surface) — 주소 · 질의 · 상세의 포켓몬 번호는 안 받는다.
 */
export const EVENT_NAMES = ['search', 'view'] as const;

/**
 * 페이지뷰를 저장하기 시작하는 때 — **방침 개정 시행일**이다.
 * 수집 항목이 늘면 시행 7일 전에 패치노트로 알린다(방침 10번 · CLAUDE.md §3). 고지는 2026-09-24 에
 * 운영 패치노트로 나가고, 그 전에 온 view 는 **서버가 버린다** — 번들은 누구나 고쳐 보낼 수 있어서
 * 날짜 판정을 브라우저에만 맡기면 없는 것과 같다. 날짜를 옮기면 프런트(web/src/lib/collect.ts) ·
 * 방침(web/src/screens/Legal.tsx) · 패치노트도 같이 — web 의 viewgate 검사가 셋을 견준다
 */
export const VIEW_COLLECT_FROM = '2026-10-02T00:00:00+09:00';

/** 화면 id 모양 — web/src/routes.ts 의 id 와 같은 꼴 */
export const ROUTE_ID = /^[a-z0-9-]{1,40}$/;
export type EventName = (typeof EVENT_NAMES)[number];

export const LIMITS = {
  /** 한 요청에 담을 수 있는 이벤트 수. 오프라인에서 모아 보내도 이 안에서 끊는다 */
  batch: 20,
  /** 검색어 길이. 붙여넣기 사고를 막는다 (v4.5.4 와 같은 값) */
  term: 100,
  surface: 40,
  /** 익명 ID 길이 — 아래 makeVisitorId 가 만드는 32자가 들어간다 */
  visitorMin: 8,
  visitorMax: 64,
} as const;

/** 모름. ISO 3166 의 사용자 지정 구역이라 실제 나라와 부딪히지 않는다 */
export const UNKNOWN_COUNTRY = 'ZZ';

export interface CollectEvent {
  name: EventName;
  term?: string;
  surface?: string;
  /** 브라우저가 말한 시각(ISO). 없어도 된다 — 집계는 서버가 받은 시각을 쓴다 */
  ts?: string;
}

export interface CollectBody {
  visitor: string;
  channel?: 'prod' | 'dev';
  events: CollectEvent[];
}

/** Fastify(ajv)가 요청을 받기 전에 거르는 그물. 통과 못 하면 400 이고 저장은 없다 */
export const collectBodySchema = {
  type: 'object',
  required: ['visitor', 'events'],
  additionalProperties: false,
  properties: {
    visitor: { type: 'string', minLength: LIMITS.visitorMin, maxLength: LIMITS.visitorMax, pattern: '^[A-Za-z0-9_-]+$' },
    channel: { type: 'string', enum: ['prod', 'dev'] },
    events: {
      type: 'array',
      minItems: 1,
      maxItems: LIMITS.batch,
      items: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', enum: [...EVENT_NAMES] },
          term: { type: 'string', minLength: 1, maxLength: LIMITS.term },
          surface: { type: 'string', minLength: 1, maxLength: LIMITS.surface },
          ts: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;
