// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = (path: string) => readFileSync(join(__dirname, '../styles', path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const legacy = css('v3/pixel.css');
const parts = css('pixel/parts.css');
const shell = css('pixel/shell.css');

describe('픽셀 포켓몬 그림과 모바일 이동 회귀', () => {
  it('옛 배경 공의 흐림·투명도·가상 요소는 배경 안에서만 적용한다', () => {
    const selectors = [...legacy.matchAll(/([^{}]+)\{/g)]
      .flatMap((match) => match[1]!.split(','))
      .filter((selector) => selector.includes('.px-ball'));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) expect(selector, selector).toContain('#px-bg');
  });

  it('실제 그림 틀에는 흐림이나 투명도가 없고 원본을 볼 위에 놓는다', () => {
    const legacyBall = /#px-bg \.px-ball\s*\{([^}]+)\}/.exec(legacy)![0];
    const artwork = /html body \.px-ball\s*\{([^}]+)\}/.exec(parts)![0];
    document.head.innerHTML = `<style>${legacyBall}\n${artwork}</style>`;
    document.body.innerHTML = '<div id="px-bg"><div class="px-ball"></div></div><span class="px-ball"><img src="/sprites/25.png" alt=""></span>';
    const decoration = getComputedStyle(document.querySelector('#px-bg .px-ball')!);
    const imageFrame = getComputedStyle(document.querySelector('body > .px-ball')!);
    expect(decoration.opacity).toBe('0.05');
    expect(imageFrame.opacity).not.toBe('0.05');
    expect(imageFrame.filter).not.toContain('blur');
    expect(imageFrame.display).toBe('inline-block');
    expect(imageFrame.position).toBe('relative');
    expect(artwork).toContain('/images/pixel/pokeball.svg');
    expect(parts).toMatch(/\.px-ball > img[^{}]*\{[^}]*object-fit: contain/);
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('하단 이동이 나오는 구간에서만 머리의 중복 이동을 숨긴다', () => {
    const mobile = /@media \(max-width: 1099px\) \{([\s\S]*?)\n\}/.exec(shell)![1]!;
    expect(mobile).toContain('.px-bottom { display: flex; }');
    expect(mobile).toMatch(/\.app-bar__actions[^{}]*\{ display: none; \}/);
    expect(mobile).toMatch(/\.app-search \{ display: none; \}/);
    expect(shell).toContain('.app-bar__actions { display: flex;');
    const component = readFileSync(join(__dirname, '../components/Shell.tsx'), 'utf8');
    const bottom = component.slice(component.indexOf('export function BottomBar'), component.indexOf('export function Drawer'));
    expect(bottom).toContain("openSearch('bottom')");
    expect(bottom).toContain("'전체 메뉴', 'menu'");
    expect(bottom).toContain('onClick: onMenu');
  });
});
