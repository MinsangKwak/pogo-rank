// ─────────────────────────────────────────────────────────────────────────────
// test/dbUrl.ts — 검사가 붙어도 되는 DB 인지 가린다 (v5 Phase 3)
//
// **왜 필요한가.** 스키마 검사는 `drop schema public cascade` 로 시작한다 — 앞선 실행이 남긴
// 것이 결과를 바꾸지 않게 하려면 빈 자리에서 출발해야 한다. 그 문장은 겨눈 곳이 어디든 다 지운다.
//
// 전에는 통합 검사가 **`DATABASE_URL`** 을 읽었다. 그건 서버가 운영에서 쓰는 이름이다.
// 로컬에서 `.env` 를 읽어 들이거나 CI 에서 시크릿이 그 이름으로 들어오면, 검사가
// 운영 DB 를 지우고 시작한다. 이름 하나 차이로 돌이킬 수 없는 일이 난다.
//
// 그래서 둘을 막는다.
//   ① 검사는 **`TEST_DATABASE_URL`** 만 읽는다. 운영 이름과 겹치지 않는다.
//   ② 그 값이 **버려도 되는 DB** 로 보이지 않으면 아예 안 돈다 — 로컬이거나 이름이 `_test` 로 끝나거나.
//
// 안전장치가 틀리는 쪽은 "못 돈다" 다. 그쪽 실패는 눈에 보이고 고칠 수 있다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '']);

/** 이 주소가 지워도 되는 자리인가 — 아니면 왜 아닌지를 돌려준다 */
export function disposableReason(url: string): string | null {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return '주소를 읽지 못했습니다'; }

  const database = parsed.pathname.replace(/^\//, '');
  if (!database) return '데이터베이스 이름이 없습니다';
  if (LOCAL_HOSTS.has(parsed.hostname)) return null;
  if (database.endsWith('_test')) return null;
  return `로컬도 아니고 이름이 _test 로 끝나지도 않습니다 (${parsed.hostname}/${database}) — `
       + '검사는 스키마를 지우고 시작하므로 여기서는 안 돕니다';
}

/**
 * 검사가 쓸 DB 주소. 없으면 빈 문자열이라 `describe.skipIf(!url)` 이 통째로 건너뛴다.
 * **값이 있는데 위험해 보이면 던진다** — 조용히 건너뛰면 "왜 안 도는지" 를 아무도 모른다
 */
export function testDatabaseUrl(): string {
  const url = (process.env['TEST_DATABASE_URL'] ?? '').trim();
  if (!url) return '';
  const reason = disposableReason(url);
  if (reason) throw new Error(`TEST_DATABASE_URL 이 위험합니다 — ${reason}`);
  return url;
}
