-- 0003_backup_ack — "이 줄어듦은 사고가 아니다" 를 사람이 못 박는 자리 (v4.8.5)
--
-- **왜 두나 — 잣대를 창으로 잡으면 사고가 지워진다.** 컬렉션별 급감을 최근 몇 판과만 견주면,
-- 망가진 백업이 그 판 수만큼 쌓였을 때 성한 판이 창 밖으로 밀려나고 판정이 저절로 괜찮아진다
-- (v4.8.4 코드 리뷰). 그래서 잣대는 **여태까지의 가장 큰 수**다 — 창이 없다.
--
-- 그러면 진짜로 줄어든 경우에 영영 시끄러워진다. 시끄러우면 아무도 안 본다.
-- 그 하나를 여기서 끊는다: **사람이 손으로** 잣대를 내린다. 기계가 스스로 잊지는 못한다.
--
-- **개인정보가 없다.** 컬렉션 이름과 수뿐이다.
--
--   insert into backup_ack (collection, baseline, reason)
--   values ('users', 40, '2026-10-02 계정 정리 — 확인함')
--   on conflict (collection) do update
--     set baseline = excluded.baseline, reason = excluded.reason, acked_at = now();

create table if not exists backup_ack (
  collection text primary key check (length(collection) between 1 and 200),
  -- 이 수를 잣대로 삼는다. 여태 가장 컸던 수 대신 쓴다
  baseline   integer     not null check (baseline >= 0),
  acked_at   timestamptz not null default now(),
  reason     text        check (reason is null or length(reason) <= 500)
);
