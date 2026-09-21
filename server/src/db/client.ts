// ─────────────────────────────────────────────────────────────────────────────
// db/client.ts — Postgres 연결 하나.
//
// **ORM 을 얹지 않는다.** 표가 둘이고 집계는 어차피 SQL 로 쓴다 — 그 사이에 층을 하나 더 두면
// 읽을 것만 늘고 막히는 것은 없다 (CLAUDE.md '의존성을 늘리지 않는다').
// 주입은 태그드 템플릿이 막는다: sql`… ${value}` 의 값은 언제나 바인딩 파라미터로 나간다.
//
// 연결 수를 작게 잡는 이유 — Cloud Run 은 요청이 없으면 인스턴스를 0 으로 내린다.
// 인스턴스마다 풀을 크게 잡으면 Neon 의 접속 한도를 인스턴스 몇 대로 다 먹는다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import postgres from 'postgres';

export type Sql = postgres.Sql;

export function makeDb(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    max: 4,
    idle_timeout: 20,        // 초. 놀면 놓아 준다 — 인스턴스가 곧 잠들 것이라서
    connect_timeout: 10,
    // Neon 은 유휴 컴퓨트를 잠재운다. 깨우는 데 드는 수백 ms 를 실패로 세지 않게 넉넉히 둔다
    prepare: false,          // 풀러(pooler) 뒤에서는 prepared statement 가 세션을 넘어가지 않는다
    // `create ... if not exists` 가 매번 NOTICE 를 뱉는다 — 기대한 일이라 로그를 어지럽힐 뿐이다.
    // 경고 이상은 예외로 올라오므로 여기서 삼켜도 진짜 문제를 놓치지 않는다
    onnotice: () => {},
  });
}
