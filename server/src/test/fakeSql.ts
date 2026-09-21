// ─────────────────────────────────────────────────────────────────────────────
// test/fakeSql.ts — postgres.js 자리에 끼우는 가짜. **무엇이 저장되려 했는지**를 붙잡는다.
//
// 진짜 DB 없이 확인하고 싶은 것이 있다: IP 가 줄에 섞여 들어가지 않는가, 채널이 갈리는가,
// 뜻 없는 줄이 걸러지는가. 셋 다 SQL 이 아니라 **넘겨진 값**의 문제라 가짜로 충분하다.
// SQL 자체가 맞는지는 통합 검사(integration.test.ts)가 진짜 Postgres 로 본다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';

export interface Captured { rows: Record<string, unknown>[] }

export function makeFakeSql(): { sql: Sql; captured: Captured } {
  const captured: Captured = { rows: [] };

  // postgres.js 는 한 함수가 두 얼굴이다 — 태그드 템플릿(질의)이자, sql(rows, ...cols)(값 묶음)이다
  const fake = ((first: unknown, ...rest: unknown[]) => {
    if (Array.isArray(first) && Object.prototype.hasOwnProperty.call(first, 'raw')) {
      // 태그드 템플릿으로 불렸다 — 질의다. 결과가 필요한 자리는 빈 배열이면 된다
      const result: unknown[] = [];
      (result as { count?: number }).count = captured.rows.length;
      return Promise.resolve(result);
    }
    // sql(rows, ...columns) — 저장하려는 줄이 여기로 온다
    if (Array.isArray(first)) {
      for (const row of first as Record<string, unknown>[]) captured.rows.push(row);
      return { columns: rest };
    }
    return {};
  }) as unknown as Sql;

  return { sql: fake, captured };
}
