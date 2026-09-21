// ─────────────────────────────────────────────────────────────────────────────
// lib/backup.ts — 백업이 살아 있는지 본다 (v4.8.0).
//
// **백업의 진짜 실패는 조용하다.** 워크플로는 초록인데 받아 온 문서가 절반이 됐거나,
// 몇 주째 안 돌았는데 아무도 모르는 쪽이다. 아티팩트 목록은 그걸 말해 주지 않는다 —
// 파일이 있다는 것과 그 안에 다 들어 있다는 것은 다른 말이다.
//
// 그래서 **잰 수**를 남기고 둘을 본다: 너무 오래됐는가, 지난번보다 급감했는가.
// 되돌릴 일이 생겼을 때 "언제 것을 받아야 하나" 도 여기서 답한다.
//
// 이 표에는 개인정보가 없다 (migrations/0002_backup_runs.sql).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import type { Sql } from '../db/client.ts';

/** 주 1회 도는 일이다. 여드레가 지나면 한 번은 걸렀다는 뜻이다 */
export const STALE_DAYS = 8;
/** 지난번보다 이만큼 줄면 묻는다 — 사람이 계정을 지울 수도 있으니 '틀렸다' 가 아니라 '보라' 다 */
export const DROP_RATIO = 0.3;

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
  const [latest, previous] = await recentRuns(sql, 2);
  const problems: string[] = [];

  if (!latest) {
    problems.push('백업 기록이 하나도 없습니다 — 워크플로가 한 번도 안 돌았거나 보고가 안 닿았습니다');
    return { ok: false, problems, latest: null, staleDays: STALE_DAYS, dropRatio: DROP_RATIO };
  }

  const days = (now.getTime() - latest.ran_at.getTime()) / 86_400_000;
  if (days > STALE_DAYS) {
    problems.push(`마지막 백업이 ${days.toFixed(1)}일 전입니다 (주 1회이므로 ${STALE_DAYS}일이 넘으면 한 번은 걸렀습니다)`);
  }

  // **수가 줄어든 것은 사고일 수도, 사람이 지운 것일 수도 있다.** 판정하지 않고 묻는다
  if (previous) {
    const before = totalOf(previous.counts);
    const after = totalOf(latest.counts);
    if (before > 0 && after < before * (1 - DROP_RATIO)) {
      problems.push(`문서 수가 ${before} → ${after} 로 줄었습니다 — 계정 삭제 때문인지 확인하세요`);
    }
  }

  return { ok: problems.length === 0, problems, latest, staleDays: STALE_DAYS, dropRatio: DROP_RATIO };
}
