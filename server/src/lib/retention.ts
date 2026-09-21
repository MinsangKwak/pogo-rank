// ─────────────────────────────────────────────────────────────────────────────
// lib/retention.ts — 오래된 원본을 지운다 (v4.7.2).
//
// **방침에 적은 약속을 코드가 지킨다.** 개인정보처리방침 5번에 "원본 한 줄은 최대 12개월 뒤
// 지우고, 날짜·이름별로 센 합계만 남깁니다. 방문자 난수 ID 는 원본과 함께 지워집니다" 라고
// 적어 두고 지우는 코드가 없었다 (v4.7.1 코드 리뷰). 적어 둔 것을 안 하면 그게 위반이다.
//
// **지우기 전에 굳힌다.** 순서가 반대면 그 기간의 순위 역사가 통째로 사라진다 —
// events 는 원본이고 search_daily 가 남길 것이다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';
import { PERSON_CAP } from './hot.ts';

/** 방침 5번에 적은 값. 여기를 고치면 방침도 같이 고친다 */
export const KEEP_MONTHS = 12;

export interface PurgeResult {
  /** 지우기 전에 search_daily 로 굳힌 줄 수 */
  rolled: number;
  /** 지운 원본 줄 수 */
  deleted: number;
}

export async function purge(sql: Sql, months = KEEP_MONTHS): Promise<PurgeResult> {
  return sql.begin(async (tx) => {
    // **경계를 한 번만 잰다.** 문장마다 now() 를 다시 부르면 그 사이에 걸친 줄이
    // 굳히기에는 안 들어가고 지우기에는 들어간다 — 한 줄이 소리 없이 사라지는 길이다
    const [edge] = await tx<{ at: Date }[]>`select (now() - (${months} * interval '1 month')) as at`;
    if (!edge) throw new Error('보존 경계를 못 구했습니다');
    const horizon = edge.at;

    // 이미 rollup 이 쓴 날은 그대로 둔다 — 같은 셈이라 덮어쓸 이유가 없고,
    // 덮어쓰려다 실패하면 지우기까지 같이 무른다
    const rolled = await tx`
      insert into search_daily (day, term, country, hits, visitors)
      with capped as (
        select (created_at at time zone 'Asia/Seoul')::date as day,
               term, country, visitor,
               least(count(*), ${PERSON_CAP}) as hits
        from events
        where name = 'search'
          and channel = 'prod'
          and term is not null
          and created_at < ${horizon}
        group by 1, 2, 3, 4
      )
      select day, term, country, sum(hits)::int, count(distinct visitor)::int
      from capped
      group by day, term, country
      on conflict (day, term, country) do nothing
    `;

    // **이름을 가리지 않고 전부 지운다.** search 가 아닌 이벤트도, dev 채널 것도 같은 나이면 간다 —
    // 방침은 '검색어 기록' 을 말했지만 남길 이유가 있는 줄이 따로 있지 않다
    const deleted = await tx`delete from events where created_at < ${horizon}`;

    return { rolled: rolled.count, deleted: deleted.count };
  });
}
