// ─────────────────────────────────────────────────────────────────────────────
// lib/stats.ts — 루트 관리자 통계 화면이 읽는 숫자 (2026-09-24)
//
// **모아 센 값만 내보낸다.** 이메일 · 이름 · 방문자 난수 ID 는 한 칸도 안 나간다 —
// 누가 무엇을 찾았는지가 아니라 몇 명이 무엇을 찾았는지를 본다. 사람 목록은 /v1/admin/users 가 따로 있다.
//
// **날짜는 한국 날짜다.** 운영자가 보는 '오늘' 이 UTC 로 갈리면 밤 9시 이후 숫자가 내일로 넘어간다.
// 빈 날은 0 으로 채운다 — 줄이 빠지면 그래프가 그날을 건너뛰어 추세가 거짓말을 한다.
//
// 표는 셋을 읽는다: users · favorites (계정), events (검색 · 페이지뷰). channel='prod' 만 센다 — dev 에서 누른 것은 운영 숫자가 아니다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';
import { hotRows, hotMons, PERSON_CAP, type DateRange } from './hot.ts';
import { MON_VIEW_PREFIX } from './contract.ts';

export interface DayCount { day: string; count: number }
export interface DayHits { day: string; hits: number; visitors: number }
export interface Ranked { key: string; hits: number; visitors: number }

export interface UserStats {
  total: number;
  pending: number;
  approved: number;
  admin: number;
  root: number;
  beta: number;
  /** 마지막 로그인·토큰 갱신이 이 안에 든 사람 */
  active1d: number;
  active7d: number;
  active30d: number;
  newPerDay: DayCount[];
}

export interface EventStats {
  hits: number;
  visitors: number;
  perDay: DayHits[];
  /** 검색은 고른 이름, 페이지뷰는 화면 id */
  top: Ranked[];
  /** 검색은 검색창 구분, 페이지뷰는 비어 있다 */
  surfaces: Ranked[];
  /**
   * 검색만 — 순위(/v1/hot)와 **같은 계산**(사람당 하루 한도 · 문턱)으로 고른 줄. 페이지뷰는 비어 있다.
   * `top` 은 한도 없이 센 상위 15 라, 한 사람이 밀어 올린 말이 자리를 다 먹으면 문턱을 넘은 말이 그 안에 없을 수 있다
   * (Codex, PR #221) — 준비도는 이 줄로 잰다. 줄 수가 모자라도 비우지 않는다 ("2 / 3" 을 보여야 한다)
   */
  hot: Ranked[];
  /**
   * 검색만 — **하루 창**(/v1/hot?days=1 과 같은 계산)에서 문턱을 넘은 줄. 기간 창의 `hot` 과 하루 평균을 섞으면
   * 어느 하루도 이름 셋을 못 채웠는데 "하루 창을 켤 수 있다" 고 적을 수 있다 (Codex, PR #229) — 판정은 이 줄 수로 한다
   */
  hotToday: Ranked[];
  /** 페이지뷰만 — 상세 팝업을 연 포켓몬(`mon-<번호>`)을 /v1/mons/hot 과 같은 계산으로 모은 줄. key 는 도감 번호. 검색은 비어 있다 */
  mons: Ranked[];
  countries: Ranked[];
}

/** 한 시간 칸 — hour 는 한국 시각 0~23, `hour시 ~ hour+1시` 창 */
export interface HourSlot { hour: number; hits: number; visitors: number; mons: Ranked[] }

/** 통계가 세는 기간 — 한국 날짜, 양끝을 넣는다. days 는 그 안의 날 수 */
export interface StatRange extends DateRange { days: number }

export interface AdminStats {
  generatedAt: string;
  days: number;
  from: string;
  to: string;
  users: UserStats;
  sessions: { active: number };
  favorites: { total: number; people: number; top: { dex: number; users: number }[] };
  search: EventStats;
  views: EventStats;
}

/** 기간 · 목록 길이의 끝 — 요청이 무엇을 달라 해도 이 안에서 센다 */
// 긴 끝은 400일 — '서비스 시작(9/14)부터 오늘까지' 를 한 번에 본다 (2026-09-24 주인 요청). 표가 작아 한 번에 세도 가볍다
export const STATS_LIMITS = { minDays: 7, maxDays: 400, top: 15, hourTop: 5 } as const;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 지금의 한국 날짜 'YYYY-MM-DD' */
export function kstDay(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 날짜에 n 일을 더한다 — 'YYYY-MM-DD' 끼리 */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** 두 날짜 사이의 날 수 — 양끝을 넣는다 */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** 'YYYY-MM-DD' 꼴이고 달력에 있는 날인지 — 2026-02-30 은 꼴은 맞아도 날이 아니다 */
export function isDay(value: string | undefined): value is string {
  if (!value || !DAY_RE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/**
 * 요청의 기간을 한국 날짜 양끝으로 푼다 (2026-09-30 주인 요청 — 달력으로 직접 고르는 기간).
 * - `from` · `to` 가 오면 그대로 — 둘 다 있어야 하고, from ≤ to ≤ 오늘, 길이는 maxDays 안
 * - 없으면 `days` — 오늘을 넣어 days 일 (옛 요청과 같다)
 * 틀린 요청은 이유를 돌려준다 — 스키마가 꼴은 막지만 날짜 순서 · 미래 · 길이는 여기서 본다
 */
export function resolveRange(query: { days?: number | undefined; from?: string | undefined; to?: string | undefined }, now: Date = new Date()): StatRange | { error: string } {
  const today = kstDay(now);
  if (query.from !== undefined || query.to !== undefined) {
    if (!isDay(query.from) || !isDay(query.to)) return { error: '기간은 from · to 를 YYYY-MM-DD 로 둘 다 주세요' };
    if (query.from > query.to) return { error: '시작이 끝보다 늦어요' };
    if (query.to > today) return { error: '끝은 오늘(한국 날짜)까지예요' };
    const days = daysBetween(query.from, query.to);
    if (days > STATS_LIMITS.maxDays) return { error: `기간은 ${STATS_LIMITS.maxDays}일까지예요` };
    return { from: query.from, to: query.to, days };
  }
  const days = clampDays(query.days);
  return { from: shiftDay(today, -(days - 1)), to: today, days };
}

// 기간의 날을 하루씩 — 한국 날짜로, 양끝을 넣는다
function span(sql: Sql, range: DateRange) {
  return sql`generate_series(${range.from}::date, ${range.to}::date, interval '1 day')`;
}

async function userStats(sql: Sql, range: DateRange): Promise<UserStats> {
  const [row] = await sql<Omit<UserStats, 'newPerDay'>[]>`
    select count(*)::int as total,
           count(*) filter (where role = 'pending')::int as pending,
           count(*) filter (where role = 'approved')::int as approved,
           count(*) filter (where role = 'admin')::int as admin,
           count(*) filter (where role = 'root')::int as root,
           count(*) filter (where beta)::int as beta,
           count(*) filter (where last_seen_at >= now() - interval '1 day')::int as "active1d",
           count(*) filter (where last_seen_at >= now() - interval '7 days')::int as "active7d",
           count(*) filter (where last_seen_at >= now() - interval '30 days')::int as "active30d"
    from users
  `;
  const newPerDay = await sql<DayCount[]>`
    select to_char(d, 'YYYY-MM-DD') as day, coalesce(n.count, 0)::int as count
    from ${span(sql, range)} as d
    left join (
      select (created_at at time zone 'Asia/Seoul')::date as day, count(*) as count
      from users group by 1
    ) as n on n.day = d::date
    order by d
  `;
  return { ...row!, newPerDay };
}

async function eventStats(sql: Sql, name: 'search' | 'view', range: StatRange): Promise<EventStats> {
  // 검색은 고른 이름(term), 페이지뷰는 화면 id(surface)가 '무엇' 이다.
  // 상세 팝업(`mon-<번호>`)은 화면 표에서 'mon' 하나로 접는다 — 포켓몬별 줄은 아래 mons 가 따로 센다 (2026-09-29)
  const what = name === 'search' ? sql`term` : sql`(case when surface like 'mon-%' then 'mon' else surface end)`;
  const scope = sql`
    name = ${name} and channel = 'prod'
    and (created_at at time zone 'Asia/Seoul')::date between ${range.from}::date and ${range.to}::date
  `;
  const [total] = await sql<{ hits: number; visitors: number }[]>`
    select count(*)::int as hits, count(distinct visitor)::int as visitors from events where ${scope}
  `;
  const perDay = await sql<DayHits[]>`
    select to_char(d, 'YYYY-MM-DD') as day, coalesce(e.hits, 0)::int as hits, coalesce(e.visitors, 0)::int as visitors
    from ${span(sql, range)} as d
    left join (
      select (created_at at time zone 'Asia/Seoul')::date as day, count(*) as hits, count(distinct visitor) as visitors
      from events where ${scope} group by 1
    ) as e on e.day = d::date
    order by d
  `;
  const top = await sql<Ranked[]>`
    select ${what} as key, count(*)::int as hits, count(distinct visitor)::int as visitors
    from events where ${scope} and ${what} is not null
    group by 1 order by hits desc, key asc limit ${STATS_LIMITS.top}
  `;
  const surfaces = name === 'search' ? await sql<Ranked[]>`
    select surface as key, count(*)::int as hits, count(distinct visitor)::int as visitors
    from events where ${scope} and surface is not null
    group by 1 order by hits desc, key asc limit ${STATS_LIMITS.top}
  ` : [];
  const countries = await sql<Ranked[]>`
    select country as key, count(*)::int as hits, count(distinct visitor)::int as visitors
    from events where ${scope}
    group by 1 order by visitors desc, hits desc, key asc limit ${STATS_LIMITS.top}
  `;
  // 기간 창은 위 표와 같은 한국 날짜 양끝이다. 하루 창(hotToday)만 '지금부터 하루' — 운영 순위가 그 창을 쓴다
  const asRanked = (row: { term: string; hits: number; visitors: number }): Ranked => ({ key: row.term, hits: row.hits, visitors: row.visitors });
  const [hot, hotToday] = name === 'search'
    ? await Promise.all([
      hotRows(sql, { days: range.days, range, limit: STATS_LIMITS.top, threshold: true, fold: false }).then((rows) => rows.map(asRanked)),
      hotRows(sql, { days: 1, limit: STATS_LIMITS.top, threshold: true, fold: false }).then((rows) => rows.map(asRanked)),
    ])
    : [[], []];
  const mons = name === 'view'
    ? (await hotMons(sql, { days: range.days, range, limit: STATS_LIMITS.top })).map((row) => ({ key: String(row.dex), hits: row.hits, visitors: row.visitors }))
    : [];
  return { hits: total!.hits, visitors: total!.visitors, perDay, top, surfaces, countries, hot, hotToday, mons };
}

/** 기간을 끝 안으로 — 스키마가 막지만 함수만 불러도 틀리지 않게 */
export function clampDays(days: number | undefined): number {
  const value = Number.isFinite(days) ? Math.trunc(days!) : 30;
  return Math.min(STATS_LIMITS.maxDays, Math.max(STATS_LIMITS.minDays, value));
}

/**
 * 하루를 24칸으로 — 칸마다 상세 팝업을 연 포켓몬 상위 (2026-09-30 주인 요청: "00~01시 · 01~02시 … 하루 단위 탭").
 * 사람당 한도는 **칸 안에서** PERSON_CAP — 한 사람이 한 시간에 같은 팝업을 스무 번 열어도 다섯으로 센다.
 * 하루 한도(hotMons)와 창이 달라 칸의 합이 하루 표와 같지 않을 수 있다 — 이 표는 "언제 보는가" 를 읽는 표다.
 * 빈 칸도 0 으로 준다 — 화면이 24줄을 늘 같은 자리에 그린다
 */
export async function hourlyMons(sql: Sql, day: string, limit: number = STATS_LIMITS.hourTop): Promise<HourSlot[]> {
  const like = `${MON_VIEW_PREFIX}%`;
  const rows = await sql<{ hour: number; dex: number; hits: number; visitors: number }[]>`
    with capped as (
      select substr(surface, ${MON_VIEW_PREFIX.length + 1})::int as dex, visitor,
             extract(hour from created_at at time zone 'Asia/Seoul')::int as hour,
             least(count(*), ${PERSON_CAP}) as hits
      from events
      where name = 'view'
        and channel = 'prod'
        and surface like ${like}
        and surface ~ '^mon-[0-9]{1,5}$'
        and (created_at at time zone 'Asia/Seoul')::date = ${day}::date
      group by 1, 2, 3
    ), ranked as (
      select hour, dex, sum(hits)::int as hits, count(distinct visitor)::int as visitors,
             row_number() over (partition by hour order by count(distinct visitor) desc, sum(hits) desc, dex asc) as place
      from capped
      group by hour, dex
    )
    select hour, dex, hits, visitors from ranked where place <= ${limit} order by hour, place
  `;
  const totals = await sql<{ hour: number; hits: number; visitors: number }[]>`
    with capped as (
      select visitor, extract(hour from created_at at time zone 'Asia/Seoul')::int as hour,
             least(count(*), ${PERSON_CAP}) as hits
      from events
      where name = 'view'
        and channel = 'prod'
        and surface like ${like}
        and surface ~ '^mon-[0-9]{1,5}$'
        and (created_at at time zone 'Asia/Seoul')::date = ${day}::date
      group by surface, visitor, hour
    )
    select hour, sum(hits)::int as hits, count(distinct visitor)::int as visitors from capped group by hour
  `;
  const slots: HourSlot[] = Array.from({ length: 24 }, (_, hour) => ({ hour, hits: 0, visitors: 0, mons: [] }));
  for (const row of totals) {
    slots[row.hour]!.hits = row.hits;
    slots[row.hour]!.visitors = row.visitors;
  }
  for (const row of rows) slots[row.hour]!.mons.push({ key: String(row.dex), hits: row.hits, visitors: row.visitors });
  return slots;
}

export async function adminStats(sql: Sql, query: { days?: number | undefined; from?: string | undefined; to?: string | undefined } = {}): Promise<AdminStats> {
  const range = resolveRange(query);
  // 틀린 기간은 라우트가 400 으로 먼저 돌려보낸다 — 함수만 부른 쪽에는 기본 30일을 준다
  const { from, to, days } = 'error' in range ? (resolveRange({}) as StatRange) : range;
  // 살아 있는 로그인 = 사슬(family)마다 아직 안 쓴 토큰 하나. 회전된 옛 토큰은 used_at 만 찍히고 끊기지 않아
  // 그것까지 세면 기기 수가 아니라 갱신 횟수가 된다 (2026-09-24 운영에서 7명에 38 로 보였다)
  const [users, sessions, favTotals, favTop, search, views] = await Promise.all([
    userStats(sql, { from, to }),
    sql<{ active: number }[]>`
      select count(*)::int as active from sessions
      where revoked_at is null and used_at is null and expires_at > now()
    `,
    sql<{ total: number; people: number }[]>`
      select count(*)::int as total, count(distinct user_id)::int as people from favorites
    `,
    sql<{ dex: number; users: number }[]>`
      select dex, count(*)::int as users from favorites group by dex order by users desc, dex asc limit ${STATS_LIMITS.top}
    `,
    eventStats(sql, 'search', { from, to, days }),
    eventStats(sql, 'view', { from, to, days }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    days,
    from,
    to,
    users,
    sessions: sessions[0]!,
    favorites: { ...favTotals[0]!, top: favTop },
    search,
    views,
  };
}
