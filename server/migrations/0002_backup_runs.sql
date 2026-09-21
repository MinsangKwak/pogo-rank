-- 0002_backup_runs — 백업이 언제 어떻게 돌았는지 (v4.8.0)
--
-- **개인정보가 없다.** 백업 내용물은 암호화돼 다른 데(GCS)에 있고, 이 표에는 **잰 수**만 남는다 —
-- 언제, 어디에, 몇 바이트, 해시, 컬렉션별 문서 **수**. 이름도 이메일도 트레이너 코드도 없다.
-- 그래서 이 표가 생겨도 개인정보처리방침의 수집 항목은 늘지 않는다.
--
-- **왜 두나 — 백업의 진짜 실패는 조용하다.** 워크플로는 초록인데 받아 온 문서가 절반이 됐거나,
-- 몇 주째 안 돌았는데 아무도 모르는 쪽이다. 아티팩트 목록은 그걸 말해 주지 않는다.
-- 수를 남겨 두면 "지난번보다 급감" 과 "너무 오래됨" 을 기계가 본다.

create table if not exists backup_runs (
  id       bigint generated always as identity primary key,
  -- 워크플로가 백업을 마친 시각
  ran_at   timestamptz not null default now(),
  -- 암호화본이 떨어진 곳. 'gs://…' 또는 'actions-artifact://…'
  location text        not null,
  bytes    bigint      not null,
  -- 암호화본의 sha256. 같은 파일인지, 받은 것이 온전한지 대어 볼 수 있다
  sha256   char(64)    not null,
  -- 컬렉션별 문서 수 {"allowlist": 7, "users": 7, …}. **수만 센다**
  counts   jsonb       not null default '{}'::jsonb,
  note     text,

  constraint backup_runs_bytes_ok    check (bytes > 0),
  constraint backup_runs_sha_ok      check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint backup_runs_location_ok check (char_length(location) between 1 and 500)
);

-- 늘 최근 것부터 본다
create index if not exists backup_runs_ran_idx on backup_runs (ran_at desc);
