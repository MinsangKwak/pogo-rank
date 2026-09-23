// ─────────────────────────────────────────────────────────────────────────────
// scripts/copy-assets.mjs — 그림을 이 앱 옆으로 옮긴다 (v5 Phase 7)
//
// 스프라이트 2,000여 장은 v3 빌드(backend/sprites.py)가 만든다. **두 벌 두지 않는다** —
// 15MB 가 저장소에 두 번 들어가면 받는 사람마다 두 번 받는다.
//
// 링크로 걸지 않고 복사하는 이유: Vercel 은 `public/` 안의 **진짜 파일**만 올린다.
// ─────────────────────────────────────────────────────────────────────────────
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = resolve(here, '../public');

let moved = 0;
for (const name of ['sprites', 'sprites-anim']) {
  const from = resolve(repo, 'dist', name);
  if (!existsSync(from)) {
    console.log(`  ${name} 없음 — 건너뜁니다 (python3 backend/build.py 를 먼저 돌리면 생깁니다)`);
    continue;
  }
  mkdirSync(resolve(out, name), { recursive: true });
  cpSync(from, resolve(out, name), { recursive: true });
  moved += 1;
}
console.log(`그림 묶음 ${moved}개를 web/public 으로 옮겼습니다`);
