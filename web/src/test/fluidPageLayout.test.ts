import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '../styles/pixel/shell.css'), 'utf8');

describe('화면 폭을 사용하는 데스크톱 본문', () => {
  it('본문과 제목에 같은 레일 제외 유동 폭을 적용한다', () => {
    expect(css).toContain('width: calc(100% - var(--rail-w))');
    expect(css).toContain('max-width: calc(100vw - var(--rail-w))');
    expect(css).toContain('padding-left: clamp(1.6rem, 2vw, 4.8rem)');
    expect(css).not.toContain('max-width: var(--content-w)');
  });
  it('작은 화면은 레일 없는 부모 폭 안에 머문다', () => {
    expect(css).toMatch(/:is\(\.layout, #page, \.page-head\) \{[^}]*min-width: 0; max-width: 100%/);
    expect(css.indexOf('width: calc(100% - var(--rail-w))')).toBeGreaterThan(css.indexOf('@media (min-width: 1100px)'));
  });
});
