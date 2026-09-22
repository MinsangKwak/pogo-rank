// ─────────────────────────────────────────────────────────────────────────────
// index.ts — 부팅. 환경을 읽고, DB 를 잡고, 듣는다.
//
// 마이그레이션을 **부팅에서 돌린다.** 배포 파이프라인에 단계를 하나 더 두면 그 단계를
// 빠뜨린 배포가 언젠가 난다 — 표가 없는 채로 뜬 서버는 이벤트를 받아 통째로 버린다.
// 마이그레이션은 이미 적용한 것을 건너뛰므로 여러 인스턴스가 같이 떠도 한 번만 돈다.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { readEnv } from './env.ts';
import { makeDb } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { buildApp } from './app.ts';

const env = readEnv();

// **마이그레이션은 직접 연결로 돌리고 바로 닫는다** (v5 Phase 7).
// 풀러(PgBouncer)는 트랜잭션마다 연결을 돌려쓰므로 세션에 거는 잠금이 안 산다 —
// create index 같은 문장이 조용히 어긋날 수 있는 자리다.
// 부팅에 한 번뿐이라 연결 하나를 따로 여는 값이 싸다
{
  const direct = makeDb(env.migrationUrl);
  try {
    const applied = await migrate(direct);
    if (applied.length) console.log(`마이그레이션 적용: ${applied.join(', ')}`);
  } finally {
    await direct.end();
  }
}

// 평소 요청은 풀링으로 간다 — 인스턴스가 여럿 뜨는 자리라 직접 연결을 아낀다
const sql = makeDb(env.databaseUrl);
const app = await buildApp(env, sql);

// Cloud Run 은 컨테이너 밖에서 들어온다 — 0.0.0.0 이 아니면 아무 요청도 안 닿는다
await app.listen({ port: env.port, host: '0.0.0.0' });

// 인스턴스를 내릴 때 열린 연결을 놓아 준다. 안 놓으면 Neon 쪽에 좀비 세션이 쌓인다
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void app.close().then(() => sql.end({ timeout: 5 })).then(() => process.exit(0));
  });
}
