// ─────────────────────────────────────────────────────────────────────────────
// lib/backup.ts — 백업이 살아 있는지 본다 (v4.8.0).
//
// **백업의 진짜 실패는 조용하다.** 워크플로는 초록인데 받아 온 문서가 절반이 됐거나,
// 몇 주째 안 돌았는데 아무도 모르는 쪽이다. 아티팩트 목록은 그걸 말해 주지 않는다 —
// 파일이 있다는 것과 그 안에 다 들어 있다는 것은 다른 말이다.
//
// 그래서 **잰 수**를 남기고 셋을 본다: 너무 오래됐는가, **지난번과 사이가 떴는가**, 급감했는가.
// 되돌릴 일이 생겼을 때 "언제 것을 받아야 하나" 도 여기서 답한다.
//
// **간격을 따로 보는 이유** (v4.8.1 코드 리뷰). 워크플로는 기록을 **넣고 나서** 되묻는다 —
// 그 자리에서 '마지막 백업의 나이' 는 언제나 0 에 가까워, 한 주를 걸렀어도 절대 안 걸린다.
// 걸렀다는 사실은 **지난번과 이번 사이**에만 남아 있다.
//
// **급감은 컬렉션마다 본다** (같은 리뷰). 총합만 보면 users 가 100 → 0 이 돼도
// allowlist 가 100 → 200 이면 총합이 같아 그대로 통과한다 —
// 각각 따로 되돌리는 표이므로 하나가 통째로 사라진 것이 가려지면 안 된다.
//
// **그 잣대는 바로 앞 판이 아니라 최근 판들의 가장 큰 수다** (v4.8.4 코드 리뷰).
// 앞 한 판만 보면 100 → 0 → 0 이 두 번째 판에서 통과한다 — 견줄 앞이 이미 0 이라서다.
// 안 고쳐진 손실은 고쳐질 때까지 계속 보여야 한다.
//
// 이 표에는 개인정보가 없다 (migrations/0002_backup_runs.sql).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';

/** 주 1회 도는 일이다. 여드레가 지나면 한 번은 걸렀다는 뜻이다 */
export const STALE_DAYS = 8;
/** 지난번보다 이만큼 줄면 묻는다 — 사람이 계정을 지울 수도 있으니 '틀렸다' 가 아니라 '보라' 다 */
export const DROP_RATIO = 0.3;
/**
 * 컬렉션별 잣대를 **이만큼 거슬러** 잡는다 (v4.8.4 코드 리뷰).
 *
 * 바로 앞 한 판만 보면 `users: 100 → 0 → 0` 이 **일주일 만에 괜찮아진다** —
 * 두 번째 판에서는 앞이 이미 0 이라 견줄 것이 없고 총합도 안 줄었기 때문이다.
 * 고쳐지지 않은 손실이 시간이 지났다고 사라지면 안 되므로 최근 판들의 **가장 큰 수**와 견준다.
 * 주 1회이므로 다섯 판이면 한 달이 조금 넘는다.
 */
export const LOOKBACK_RUNS = 5;

export interface BackupRun {
  ran_at: Date;
  location: string;
  bytes: string;
  sha256: string;
  counts: Record<string, number>;
  note: string | null;
}

export interface BackupHealth {
  ok: boolean;
  /** 사람이 읽을 판정. ok 면 비어 있다 */
  problems: string[];
  latest: BackupRun | null;
  staleDays: number;
  dropRatio: number;
}

const totalOf = (counts: Record<string, number>) =>
  Object.values(counts).reduce((sum, one) => sum + one, 0);

export async function recentRuns(sql: Sql, limit = 10): Promise<BackupRun[]> {
  return sql<BackupRun[]>`
    select ran_at, location, bytes::text as bytes, sha256, counts, note
    from backup_runs order by ran_at desc limit ${limit}`;
}

export async function backupHealth(sql: Sql, now: Date = new Date()): Promise<BackupHealth> {
  const runs = await recentRuns(sql, LOOKBACK_RUNS);
  const [latest, previous] = runs;
  const problems: string[] = [];

  if (!latest) {
    problems.push('백업 기록이 하나도 없습니다 — 워크플로가 한 번도 안 돌았거나 보고가 안 닿았습니다');
    return { ok: false, problems, latest: null, staleDays: STALE_DAYS, dropRatio: DROP_RATIO };
  }

  const days = (now.getTime() - latest.ran_at.getTime()) / 86_400_000;
  if (days > STALE_DAYS) {
    problems.push(`마지막 백업이 ${days.toFixed(1)}일 전입니다 (주 1회이므로 ${STALE_DAYS}일이 넘으면 한 번은 걸렀습니다)`);
  }

  if (previous) {
    // **간격은 방금 넣은 줄이 지우지 못한다.** 위의 나이는 워크플로 안에서 늘 0 이라
    // 걸른 주가 거기 안 남는다 — 남아 있는 곳은 지난번과 이번 **사이**뿐이다
    const gap = (latest.ran_at.getTime() - previous.ran_at.getTime()) / 86_400_000;
    if (gap > STALE_DAYS) {
      problems.push(`지난번 백업과 ${gap.toFixed(1)}일 벌어졌습니다 — 그 사이 한 번은 걸렀습니다`);
    }

    // **수가 줄어든 것은 사고일 수도, 사람이 지운 것일 수도 있다.** 판정하지 않고 묻는다
    const before = totalOf(previous.counts);
    const after = totalOf(latest.counts);
    if (before > 0 && after < before * (1 - DROP_RATIO)) {
      problems.push(`문서 수가 ${before} → ${after} 로 줄었습니다 — 계정 삭제 때문인지 확인하세요`);
    }

    // 총합이 그대로여도 한 표가 통째로 비었을 수 있다. 컬렉션은 각각 되돌리는 것이라 따로 본다.
    //
    // **잣대는 바로 앞 판이 아니라 최근 판들의 가장 큰 수다.** 앞 한 판만 보면
    // 100 → 0 → 0 이 두 번째 판에서 통과한다 — 견줄 앞이 이미 0 이라서다.
    // 안 고쳐진 손실은 고쳐질 때까지 계속 보여야 한다
    const best = new Map<string, number>();
    for (const run of runs.slice(1)) {
      for (const [name, count] of Object.entries(run.counts)) {
        best.set(name, Math.max(best.get(name) ?? 0, count));
      }
    }
    for (const [name, was] of best) {
      if (was <= 0) continue;
      const nowCount = latest.counts[name] ?? 0;
      if (!(name in latest.counts)) {
        problems.push(`컬렉션 ${name} 이 이번 백업에 아예 없습니다 (최근 ${was}건) — 되돌릴 수 없는 상태입니다`);
      } else if (nowCount < was * (1 - DROP_RATIO)) {
        problems.push(`컬렉션 ${name} 이 ${was} → ${nowCount} 로 줄었습니다 (최근 ${LOOKBACK_RUNS}판 기준) — 계정 삭제 때문인지 확인하세요`);
      }
    }
  }

  return { ok: problems.length === 0, problems, latest, staleDays: STALE_DAYS, dropRatio: DROP_RATIO };
}
