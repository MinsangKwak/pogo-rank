// ─────────────────────────────────────────────────────────────────────────────
// lib/hot.ts — 검색 순위와 일별 집계.
//
// **한 사람이 순위를 만들지 못하게 한다.** v4.6.0 이 문턱(MIN_ROW_COUNT=3)을 둔 이유가
// "1회짜리가 1위로 서면 순위가 아니라 우연" 이었다. 수집기가 생기면 반대쪽 사고가 열린다 —
// 한 사람이 같은 말을 천 번 보내면 그 말이 1위다. 그래서 **사람당 하루 한도**를 건다.
// 문턱은 아래에서 막고(적은 것을 버림), 한도는 위에서 막는다(많은 것을 자름).
//
// 왜 KST 인가 — 한국어 서비스라 '어제' 는 한국의 어제다. UTC 로 자르면 한국 저녁 9시 이후의
// 검색이 다음 날로 넘어가 '어제 많이 검색된 포켓몬' 이 저녁 사용을 빠뜨린다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';

/** 한 사람이 **하루에** 한 말로 셀 수 있는 최대 횟수 */
export const PERSON_CAP = 5;
/** 이 수를 못 넘긴 말은 순위에 안 세운다 (v4.6.0 MIN_ROW_COUNT 와 같은 값) */
export const MIN_HITS = 3;
/** 줄이 이만큼 안 차면 표를 통째로 비운다 — 두 줄짜리 순위표는 순위가 아니다 */
export const MIN_ROWS = 3;
/**
 * 한 사람이 찾은 말은 순위에 안 세운다.
 *
 * **하루 한도만으로는 긴 창을 못 막는다** (v4.7.2). 한도가 하루 단위라 7일 창에서는
 * 한 사람이 35까지 쌓을 수 있고, 그건 네 사람이 두 번씩 찾은 말(8)을 가볍게 넘는다.
 * "한 사람은 순위를 만들 수 없다" 를 창 길이와 무관하게 참으로 만드는 것은 이 줄이다.
 */
export const MIN_VISITORS = 2;

export interface HotRow { term: string; hits: number; visitors: number }

export interface HotOptions {
  days: number;
  limit: number;
  /** 'KR' 처럼 나라를 좁힌다. 없으면 전 세계 */
  country?: string | undefined;
  /** 문턱을 적용할지. 운영 화면은 켜고, 관리자 진단은 끈다 */
  threshold?: boolean;
}

export async function hotRows(sql: Sql, options: HotOptions): Promise<HotRow[]> {
  const { days, limit, country, threshold = true } = options;
  const narrow = country ? sql`and country = ${country}` : sql``;
  // capped: **날 · 사람 · 말** 단위로 먼저 묶어 한도를 건 뒤에 합친다.
  //
  // **날을 빼면 rollup 과 수가 어긋난다** (v4.7.2 코드 리뷰). 한도는 '하루에 몇 번' 인데
  // 날을 안 묶으면 창 전체에 한 번만 걸려, 이레 동안 매일 다섯 번 찾은 사람이 35 가 아니라 5 로 센다.
  // search_daily 는 날짜별로 묶으므로 같은 말의 수가 두 표에서 달라진다 — 그러면 둘 다 못 믿는다.
  const rows = await sql<HotRow[]>`
    with capped as (
      select term, visitor,
             (created_at at time zone 'Asia/Seoul')::date as day,
             least(count(*), ${PERSON_CAP}) as hits
      from events
      where name = 'search'
        and channel = 'prod'
        and term is not null
        and created_at >= now() - (${days} * interval '1 day')
        ${narrow}
      group by term, visitor, day
    )
    select term, sum(hits)::int as hits, count(distinct visitor)::int as visitors
    from capped
    group by term
    order by hits desc, term asc
    limit ${limit}
  `;
  if (!threshold) return rows;
  const kept = rows.filter((row) => row.hits >= MIN_HITS && row.visitors >= MIN_VISITORS);
  // 줄이 모자라면 **빈 표**를 준다. 화면은 표가 비면 구역 자체를 안 그린다 (v4.6.0 과 같은 약속)
  return kept.length >= MIN_ROWS ? kept : [];
}

/**
 * 최근 `days` 일을 다시 세어 search_daily 에 박는다.
 * **지우고 다시 넣는다** — 늦게 도착한 이벤트가 있으면 전에 센 수가 틀리기 때문이다.
 * 한 판(transaction)이라 중간에 끊겨도 반쯤 지워진 표가 남지 않는다.
 */
export async function rollup(sql: Sql, days = 3): Promise<number> {
  return sql.begin(async (tx) => {
    const since = tx`(now() at time zone 'Asia/Seoul')::date - ${days}::int`;
    await tx`delete from search_daily where day >= ${since}`;
    const written = await tx`
      insert into search_daily (day, term, country, hits, visitors)
      with capped as (
        select (created_at at time zone 'Asia/Seoul')::date as day,
               term, country, visitor,
               least(count(*), ${PERSON_CAP}) as hits
        from events
        where name = 'search'
          and channel = 'prod'
          and term is not null
          and (created_at at time zone 'Asia/Seoul')::date >= ${since}
        group by 1, 2, 3, 4
      )
      select day, term, country, sum(hits)::int, count(distinct visitor)::int
      from capped
      group by day, term, country
    `;
    return written.count;
  });
}
