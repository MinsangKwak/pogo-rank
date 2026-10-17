// @vitest-environment jsdom
// 넓은 화면의 포켓몬 카드에서 볼(그림)이 0 높이로 사라지던 회귀 (2026-10-17) —
// --ball 에 % 높이를 주면 부모 높이가 정해지지 않은 flex 줄에서 0 으로 풀린다. 너비를 따라 정사각으로 둔다
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const parts = readFileSync(join(__dirname, '../styles/pixel/parts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

describe('카드 볼 크기', () => {
  it('넓은 화면 카드의 볼은 % 높이가 아니라 aspect-ratio 로 정사각을 만든다', () => {
    const wide = /@media \(min-width: 700px\) \{([\s\S]*?)\n\}/.exec(parts)![1]!;
    expect(wide).toContain('.px-mon__body .px-mon__art .px-ball { --ball: 100%; height: auto; aspect-ratio: 1 / 1; }');
    expect(parts).not.toMatch(/--ball: clamp\([^)]*100%[^)]*\)/);
  });
});
