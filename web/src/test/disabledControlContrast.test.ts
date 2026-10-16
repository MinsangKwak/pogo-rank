// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const parts = readFileSync(join(__dirname, '../styles/pixel/parts.css'), 'utf8');
const disabled = /html body #root \.px-btn:is\(:disabled, \[aria-disabled="true"\]\)\s*\{([^}]+)\}/.exec(parts)![0];
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('비활성 단추 가독성', () => {
  it('투명도로 글자를 흐리게 하지 않고 중립 판·점선으로 비활성을 구분한다', () => {
    expect(disabled).toContain('opacity: 1');
    expect(disabled).toContain('--px-fill: var(--panel-2)');
    expect(disabled).toContain('--px-line: var(--line)');
    expect(disabled).toContain('color: var(--muted)');
    expect(disabled).toContain('border-style: dashed');
    expect(disabled).toContain('cursor: not-allowed');
    expect(disabled).toContain('translate: none');
    expect(parts).not.toContain('opacity: 0.45');
  });

  it.each(['#a6b7bb', '#4d6367'])('밝고 어두운 테마에서 기본·선택·주 행동 단추를 모두 읽을 수 있다: %s', (muted) => {
    // jsdom은 변수 배경을 계산하지 않으므로 색 토큰만 실제 테마 값으로 치환한다.
    const concrete = disabled.replaceAll('var(--muted)', muted).replaceAll('var(--line)', '#65777b').replaceAll('var(--panel-2)', '#203e46').replaceAll('var(--px-shadow)', '#071d24');
    document.head.innerHTML = `<style>html body .px-btn--primary, html body .px-btn[aria-pressed="true"] { color: #fff7e8; opacity: .45; border-style: solid; }${concrete}</style>`;
    document.body.innerHTML = '<div id="root"><button class="px-btn px-skin px-btn--primary" disabled>계산</button><button class="px-btn px-skin" aria-pressed="true" aria-disabled="true">선택</button></div>';
    const enabled = document.createElement('span');
    enabled.style.color = muted;
    document.body.appendChild(enabled);
    for (const button of document.querySelectorAll('button')) {
      const style = getComputedStyle(button);
      expect(style.opacity).toBe('1');
      expect(style.borderStyle).toBe('dashed');
      expect(style.color).toBe(getComputedStyle(enabled).color);
      expect(style.cursor).toBe('not-allowed');
    }
    expect(document.querySelector('button')!.disabled).toBe(true);
  });

  it('hover·선택색보다 높은 범위의 disabled 규칙을 마지막에 적용한다', () => {
    expect(parts.indexOf(disabled)).toBeGreaterThan(parts.indexOf('html body .px-btn--primary:hover'));
    expect(parts.indexOf(disabled)).toBeGreaterThan(parts.indexOf('html body .px-btn[aria-pressed="true"]'));
    expect(disabled).toContain('html body #root');
  });
});
