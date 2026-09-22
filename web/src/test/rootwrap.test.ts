// ─────────────────────────────────────────────────────────────────────────────
// rootwrap.test.ts — CSS 가 기대는 DOM 이 실제로 있는지 본다
//
// **왜 생겼나.** Next.js 로 옮기며 `<div id="root">` 가 빠졌다. v4 의 CSS 307군데가
// `html body #root …` 로 시작하는데(v3 스킨을 이기려고 올린 접두사), 그 순간 홈 배치 ·
// 카드 격자 · 판 색이 통째로 죽은 규칙이 됐다.
//
// **오류도 경고도 안 났다.** 빌드는 성공했고, 배포 검사도 초록이었다 — 그 검사는 글자만 쟀다.
// 사람이 눈으로 볼 때까지 아무도 몰랐다. 없는 선택자는 조용히 아무것도 안 할 뿐이다.
//
// 그래서 **둘을 견준다**: CSS 가 여전히 그 접두사를 쓰는가, 그리고 문서가 그 자리를 세우는가.
// 접두사를 다 걷어내면(styles.ts 의 '남은 정리 항목') 이 검사는 스스로 통과한다 —
// 지킬 것이 없어지기 때문이다. 검사가 정리를 막지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = join(__dirname, '..', 'styles');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
    one.isDirectory() ? cssFiles(join(dir, one.name))
      : one.name.endsWith('.css') ? [join(dir, one.name)] : []);
}

describe('CSS 가 기대는 자리', () => {
  const rules = cssFiles(STYLES)
    .concat(join(__dirname, '..', 'root.css'))
    .reduce((n, f) => n + (readFileSync(f, 'utf8').match(/#root\b/g)?.length ?? 0), 0);

  it('#root 에 기대는 규칙이 있으면 문서가 그 자리를 세운다', () => {
    if (rules === 0) return;   // 접두사를 다 걷어냈다 — 지킬 것이 없다
    const layout = readFileSync(join(__dirname, '..', '..', 'app', 'layout.tsx'), 'utf8');
    expect(layout, `CSS ${rules}군데가 #root 를 기대는데 app/layout.tsx 가 그 자리를 안 세웁니다`)
      .toMatch(/id="root"/);
  });

  it('#root 는 레이아웃에서 비켜선다 — 한 겹이 더 생기면 v3 배치가 밀린다', () => {
    const root = readFileSync(join(__dirname, '..', 'root.css'), 'utf8');
    expect(root).toMatch(/#root\s*\{[^}]*display:\s*contents/);
  });
});
