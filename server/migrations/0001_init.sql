-- 0001_init — 수집기의 표 둘.
--
-- 왜 표가 둘인가
--   events       원본 한 줄. GA4 가 끝내 안 돌려주는 바로 그것이다.
--   search_daily 일별 집계. 원본을 언젠가 잘라내도 순위의 역사는 남기려고 둔다.
--
-- 조회(/v1/hot)는 events 를 직접 센다 — 지금 규모에서는 그쪽이 정확하고 충분히 빠르다.
-- search_daily 는 '원본을 지워도 되게' 만드는 보험이지, 조회를 빠르게 하려는 캐시가 아니다.

create table if not exists events (
  id          bigint generated always as identity primary key,
  -- 이벤트 이름. 화이트리스트를 코드가 막지만, 표에도 길이 제한을 둔다
  name        text        not null,
  -- 익명 방문자 ID. 브라우저가 만든 난수이고 사람과 이어지지 않는다 (CLAUDE.md §3)
  visitor     text        not null,
  -- search 이벤트의 완성어. 다른 이벤트에는 없다
  term        text,
  -- 어느 검색창인가 (dex · solo_boss · pvp_deck · iv_rank …)
  surface     text,
  -- ISO 3166-1 alpha-2. 'ZZ' 는 모름 — **IP 는 저장하지 않는다.** 받는 즉시 국가만 뽑고 버린다
  country     char(2)     not null default 'ZZ',
  -- 'prod' | 'dev'. 미리보기가 운영 순위로 새지 않게 가른다 (v4.5.6 과 같은 이유)
  channel     text        not null default 'prod',
  -- 아직 컬럼으로 승격하지 않은 값. 내년에 생길 이벤트를 위해 열어 둔다
  props       jsonb       not null default '{}'::jsonb,
  -- 브라우저가 말한 시각. **믿지 않는다** — 오프라인에서 모아 보낼 때를 위해 남길 뿐이다
  occurred_at timestamptz,
  -- 서버가 받은 시각. **집계는 이쪽을 쓴다**
  created_at  timestamptz not null default now(),

  constraint events_name_len    check (char_length(name) between 1 and 40),
  constraint events_visitor_len check (char_length(visitor) between 8 and 64),
  constraint events_term_len    check (term is null or char_length(term) between 1 and 100),
  constraint events_surface_len check (surface is null or char_length(surface) between 1 and 40),
  constraint events_channel_ok  check (channel in ('prod', 'dev'))
);

-- 집계가 늘 무는 조건: 이름 + 받은 시각 범위
create index if not exists events_name_created_idx on events (name, created_at desc);
-- 같은 사람이 같은 말을 몇 번 했는지 — 사람당 한도를 걸 때 탄다
create index if not exists events_term_visitor_idx on events (term, visitor) where term is not null;

create table if not exists search_daily (
  -- KST 기준 날짜. 한국어 서비스라 '어제' 는 한국의 어제다
  day      date    not null,
  term     text    not null,
  country  char(2) not null,
  hits     integer not null,
  visitors integer not null,
  primary key (day, term, country)
);
