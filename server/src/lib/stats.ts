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
  countries: Ranked[];
}

export interface AdminStats {
  generatedAt: string;
  days: number;
  users: UserStats;
  sessions: { active: number };
  favorites: { total: number; people: number; top: { dex: number; users: number }[] };
  search: EventStats;
  views: EventStats;
}

/** 기간 · 목록 길이의 끝 — 요청이 무엇을 달라 해도 이 안에서 센다 */
// 긴 끝은 400일 — '서비스 시작(9/14)부터 오늘까지' 를 한 번에 본다 (2026-09-24 주인 요청). 표가 작아 한 번에 세도 가볍다
export const STATS_LIMITS = { minDays: 7, maxDays: 400, top: 15 } as const;

// '오늘' 을 포함해 days 일 — 한국 날짜로
function span(sql: Sql, days: number) {
  return sql`generate_series((now() at time zone 'Asia/Seoul')::date - (${days}::int - 1), (now() at time zone 'Asia/Seoul')::date, interval '1 day')`;
}

async function userStats(sql: Sql, days: number): Promise<UserStats> {
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
    from ${span(sql, days)} as d
    left join (
      select (created_at at time zone 'Asia/Seoul')::date as day, count(*) as count
      from users group by 1
    ) as n on n.day = d::date
    order by d
  `;
  return { ...row!, newPerDay };
}

async function eventStats(sql: Sql, name: 'search' | 'view', days: number): Promise<EventStats> {
  // 검색은 고른 이름(term), 페이지뷰는 화면 id(surface)가 '무엇' 이다
  const what = name === 'search' ? sql`term` : sql`surface`;
  const scope = sql`
    name = ${name} and channel = 'prod'
    and (created_at at time zone 'Asia/Seoul')::date > (now() at time zone 'Asia/Seoul')::date - ${days}::int
  `;
  const [total] = await sql<{ hits: number; visitors: number }[]>`
    select count(*)::int as hits, count(distinct visitor)::int as visitors from events where ${scope}
  `;
  const perDay = await sql<DayHits[]>`
    select to_char(d, 'YYYY-MM-DD') as day, coalesce(e.hits, 0)::int as hits, coalesce(e.visitors, 0)::int as visitors
    from ${span(sql, days)} as d
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
  return { hits: total!.hits, visitors: total!.visitors, perDay, top, surfaces, countries };
}

/** 기간을 끝 안으로 — 스키마가 막지만 함수만 불러도 틀리지 않게 */
export function clampDays(days: number | undefined): number {
  const value = Number.isFinite(days) ? Math.trunc(days!) : 30;
  return Math.min(STATS_LIMITS.maxDays, Math.max(STATS_LIMITS.minDays, value));
}

export async function adminStats(sql: Sql, rawDays?: number): Promise<AdminStats> {
  const days = clampDays(rawDays);
  const [users, sessions, favTotals, favTop, search, views] = await Promise.all([
    userStats(sql, days),
    sql<{ active: number }[]>`
      select count(*)::int as active from sessions where revoked_at is null and expires_at > now()
    `,
    sql<{ total: number; people: number }[]>`
      select count(*)::int as total, count(distinct user_id)::int as people from favorites
    `,
    sql<{ dex: number; users: number }[]>`
      select dex, count(*)::int as users from favorites group by dex order by users desc, dex asc limit ${STATS_LIMITS.top}
    `,
    eventStats(sql, 'search', days),
    eventStats(sql, 'view', days),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    days,
    users,
    sessions: sessions[0]!,
    favorites: { ...favTotals[0]!, top: favTop },
    search,
    views,
  };
}
