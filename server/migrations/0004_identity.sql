-- 0004_identity — 로그인·권한·개인 데이터를 Firestore 에서 가져온다 (v5 Phase 3)
--
-- **무엇을 옮기나.** v2.2.0 부터 Firebase Auth 와 Firestore 가 하던 일이다.
--   users/{uid}        본인 데이터 — email · name · favs
--   allowlist/{email}  승인된 사람. admin: true 면 위임 관리자, beta: true 면 실험 기능 참가자
--   requests/{email}   가입 요청 — 로그인은 했지만 아직 승인 안 된 사람
--   trainers/{name}    트레이너 코드 — 승인된 사람이 읽고 관리자가 쓴다
--
-- **네 컬렉션이 표 셋이 된다.** allowlist 와 requests 는 따로 있을 이유가 없었다 —
-- Firestore 의 보안 규칙이 이메일로만 문서를 찾을 수 있어서 갈라 둔 것이지, 뜻으로 보면
-- 둘 다 "이 사람이 어디까지 할 수 있는가" 하나다. 관계형에서는 users.role 한 칸이다.
--
-- **mons 는 안 만든다.** 규칙에는 개체 300마리 자리가 있지만 v4 화면이 한 번도 안 쓴다
-- (개인정보처리방침도 plan_guest_mons 를 '브라우저에만' 이라고 적는다). 쓸 때 표를 더한다.

-- ── 사람 ─────────────────────────────────────────────────────────────────────
create table if not exists users (
  id           bigint generated always as identity primary key,

  -- **신원은 이메일이 아니라 google_sub 다.** 이메일은 바뀔 수 있고 재사용될 수도 있다.
  -- sub 는 구글이 그 계정에 영원히 붙여 두는 값이라, 이메일이 바뀌어도 같은 사람이다
  google_sub   text not null unique check (length(google_sub) between 1 and 255),

  -- 소문자로만 담는다. Firestore 규칙이 myEmail() 에서 .lower() 를 부르던 것과 같은 약속이다 —
  -- citext 확장을 켜는 대신 제약으로 적으면 읽는 사람이 규칙을 눈으로 본다
  email        text not null unique
               check (email = lower(email) and length(email) between 3 and 320),

  display_name text not null default '' check (length(display_name) <= 200),
  photo_url    text not null default '' check (length(photo_url) <= 1000),

  -- 권한 넷. enum 대신 제약으로 적는다 — 값을 더할 때 ALTER TYPE 을 안 해도 된다
  --   pending   로그인은 했지만 아직 승인 전. 담아 두기(즐겨찾기)까지만 된다
  --   approved  승인된 사람
  --   admin     위임 관리자 — 운영을 돕는다. 사람을 들이고 내보내지는 못한다
  --   root      만든 사람. 가입 승인·관리자 지정·실험 기능 지정이 여기만 열린다
  role         text not null default 'pending'
               check (role in ('pending', 'approved', 'admin', 'root')),

  -- 실험 기능 참가자 표식. 권한(role)과 **다른 축**이다 — v4.0.1 에서 깃발 둘을 가른 이유가
  -- 이것이다. 실험 기능을 열어 주려다 유저 목록까지 넘기는 일이 없게 한다
  beta         boolean not null default false,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- 관리자 화면이 '승인 대기' 와 '승인된 사람' 을 나눠 읽는다
create index if not exists users_role_idx on users (role);

-- ── 로그인 세션 ──────────────────────────────────────────────────────────────
--
-- **토큰을 저장하지 않는다. 해시만 둔다.** DB 가 통째로 새도 남의 세션으로 로그인할 수 없다.
--
-- **IP 를 안 남긴다.** CLAUDE.md §3 — 사람을 가리키는 값은 어느 표에도 두지 않는다.
-- 수집 서버가 IP 를 안 남기기로 한 것과 같은 약속이고, 세션이라고 예외가 되지 않는다.
--
-- **회전(rotation)과 사슬(family).** 리프레시 토큰은 한 번 쓰면 새것으로 갈린다.
-- 이미 쓴 것이 또 오면 둘 중 하나다 — 네트워크가 답을 잃어 같은 것을 두 번 보냈거나,
-- 누가 훔쳐 갔거나. 구분할 방법이 없으므로 **그 사슬 전체를 끊는다.** 훔친 쪽도 원래 쪽도
-- 다시 로그인해야 한다. 불편하지만, 훔친 쪽만 조용히 살아 있는 것보다 낫다
create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      bigint not null references users (id) on delete cascade,

  -- sha256(리프레시 토큰). 토큰 자체는 브라우저의 쿠키에만 있다
  refresh_hash bytea not null unique,

  -- 한 번 로그인해서 생긴 회전 사슬. 재사용이 잡히면 이 값으로 형제를 전부 끊는다
  family_id    uuid not null,

  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  -- 회전되어 이미 쓰인 시각. 값이 있는데 또 들어오면 재사용이다
  used_at      timestamptz,
  revoked_at   timestamptz,

  -- 사용자에게 '어디서 로그인했나' 를 보여 주는 용도. 사람을 가리키는 값이 아니다
  user_agent   text not null default '' check (length(user_agent) <= 500)
);

create index if not exists sessions_user_idx   on sessions (user_id);
create index if not exists sessions_family_idx on sessions (family_id);
-- 만료된 것을 쓸어 담는 일이 주기적으로 돈다
create index if not exists sessions_expires_idx on sessions (expires_at);

-- ── 담아 둔 포켓몬 (★ 즐겨찾기) ──────────────────────────────────────────────
--
-- **배열이 아니라 줄로 둔다.** Firestore 는 users/{uid}.favs 에 number[] 로 담았고,
-- 한 마리를 더할 때마다 배열을 통째로 덮어써서 다른 기기의 변경과 부딪혔다
-- (그래서 authApi 에 arrayEdit 이 따로 있었다). 줄이면 그 문제가 없다.
--
-- 상한 1,000 은 앱이 지킨다 — 세는 제약은 SQL 로 깔끔하게 안 되고, 넣을 때 한 번 세면 된다.
-- 승인 대기인 사람은 200 까지다 (Firestore 규칙의 favsOnly 와 같은 값)
create table if not exists favorites (
  user_id  bigint  not null references users (id) on delete cascade,
  -- 스프라이트 id 다. 폼(메가·거다이맥스)마다 다른 값이라 도감번호보다 크다
  dex      integer not null check (dex > 0),
  added_at timestamptz not null default now(),
  primary key (user_id, dex)
);

-- ── 트레이너 코드 ────────────────────────────────────────────────────────────
--
-- 승인된 사람이 읽고 관리자가 쓴다. **코드는 저장소에 안 박는다** (CLAUDE.md §3) —
-- 전에는 Firestore 에만 뒀고, 이제 여기에만 둔다
create table if not exists trainers (
  id         bigint generated always as identity primary key,
  name       text not null unique check (length(name) between 1 and 200),
  code       text not null check (length(code) between 1 and 50),
  -- 화면에 보이는 차례. 관리자가 끌어 옮긴다
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trainers_order_idx on trainers (sort_order, name);
