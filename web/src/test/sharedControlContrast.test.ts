// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const parts = readFileSync(join(__dirname, '../styles/pixel/parts.css'), 'utf8');
describe('공통 스킨의 의미 있는 글자색', () => {
  it('기본 판은 주 행동·선택 상태·배지의 전용 글자색을 덮지 않는다', () => {
    const skin = /html body #root \.px-skin, html body \.px-skin \{([^}]+)\}/.exec(parts)![0];
    expect(skin).not.toMatch(/(?:^|[;{])\s*color:/);
    for (const foreground of ['#f5f0da', '#17343c']) {
      const primary = /html body \.px-btn--primary \{([^}]+)\}/.exec(parts)![0];
      document.head.innerHTML = `<style>body { color: ${foreground}; }${skin}${primary.replace('var(--on-brand)', '#fff7e8')}</style>`;
      document.body.innerHTML = '<div id="root"><button class="px-skin px-btn px-btn--primary">열기</button></div>';
      expect(getComputedStyle(document.querySelector('button')!).color).toBe('rgb(255, 247, 232)');
    }
    document.head.innerHTML = ''; document.body.innerHTML = '';
  });
  it('사이트 하단 링크 색은 상세 팝업의 주 행동을 덮지 않는다', () => {
    const shell = readFileSync(join(__dirname, '../styles/pixel/shell.css'), 'utf8');
    expect(shell).not.toContain('html body #root footer a, html body #root footer button {');
    expect(shell).toContain('footer .foot-links a, html body #root footer .foot-links button {');
  });
  it('긴 제목은 한국어 어절을 우선 보존하되 좁은 판에서 넘치지 않는다', () => {
    for (const cls of ['px-title', 'px-display', 'px-heading', 'px-mon__name']) {
      const rule = new RegExp('html body \\.' + cls + ' \\{([^}]+)\\}').exec(parts)![1]!;
      expect(rule).toContain('word-break: keep-all');
      expect(rule).toContain('overflow-wrap: anywhere');
    }
  });
});
