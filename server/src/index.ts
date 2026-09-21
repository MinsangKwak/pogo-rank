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
const sql = makeDb(env.databaseUrl);

const applied = await migrate(sql);
if (applied.length) console.log(`마이그레이션 적용: ${applied.join(', ')}`);

const app = await buildApp(env, sql);

// Cloud Run 은 컨테이너 밖에서 들어온다 — 0.0.0.0 이 아니면 아무 요청도 안 닿는다
await app.listen({ port: env.port, host: '0.0.0.0' });

// 인스턴스를 내릴 때 열린 연결을 놓아 준다. 안 놓으면 Neon 쪽에 좀비 세션이 쌓인다
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void app.close().then(() => sql.end({ timeout: 5 })).then(() => process.exit(0));
  });
}
