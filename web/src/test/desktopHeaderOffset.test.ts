// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppBar } from '../components/Shell';

vi.mock('../lib/data', () => ({ useMetaSoft: () => undefined }));
vi.mock('../lib/track', () => ({ track: vi.fn() }));

const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const styles = [...source('styles.ts').matchAll(/import '\.\/([^']+\.css)'/g)].map((match) => source(match[1]!)).join('\n');
const shell = source('styles/pixel/shell.css');
let height = 90;
let resize: () => void;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  height = 90;
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { x: 0, y: 0, top: 0, left: 0, width: 1188, height: this.classList.contains('app-bar') ? height : 0, right: 1188, bottom: height, toJSON: () => ({}) };
  });
  document.head.innerHTML = `<style>${styles}</style>`;
});
afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = () => render(createElement('div', { id: 'root' },
  createElement('a', { className: 'skip-link', href: '#content' }, '본문으로 건너뛰기'),
  createElement(AppBar, { onMenu: vi.fn() }),
  createElement('aside', { className: 'app-nav' }, '로그인'),
  createElement('main', { id: 'content' })));

describe('헤더 아래 레일 시작점', () => {
  it('건너뛰기 링크는 흐름 밖에 있고 포커스하면 헤더 위에 나타난다', () => {
    const { container } = mount();
    const skip = container.querySelector<HTMLAnchorElement>('.skip-link')!;
    expect(getComputedStyle(skip).position).toBe('fixed');
    expect(getComputedStyle(skip).zIndex).toBe('100');
    expect(Number.parseFloat(getComputedStyle(skip).top)).toBeLessThan(0);
    skip.focus();
    // jsdom은 focus()만으로 계산 스타일 캐시를 비우지 않는다.
    skip.classList.add('focus-cache-refresh');
    expect(document.activeElement).toBe(skip);
    expect(Number.parseFloat(getComputedStyle(skip).top)).toBeGreaterThan(0);
    expect(skip.getAttribute('href')).toBe('#content');
  });

  it('90px 헤더와 레일이 같은 실측 변수를 쓰며 글꼴 변경도 따라간다', () => {
    const { container } = mount();
    expect(document.body.style.getPropertyValue('--app-bar-height')).toBe('90px');
    expect(observe).toHaveBeenCalledWith(container.querySelector('.app-bar'));
    expect(getComputedStyle(container.querySelector('.app-nav')!).top).toBe('var(--app-bar-height)');
    height = 113.5;
    resize();
    expect(document.body.style.getPropertyValue('--app-bar-height')).toBe('113.5px');
    expect(shell).toMatch(/html body::before \{[^}]*top: var\(--app-bar-height\)/);
  });

  it('높이 0 측정도 그대로 적고 데스크톱 복귀 시 다시 측정한다 — 모바일 머리줄은 브랜드·계정 진입으로 남는다', () => {
    mount();
    height = 0;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.style.getPropertyValue('--app-bar-height')).toBe('0px');
    height = 90;
    resize();
    expect(document.body.style.getPropertyValue('--app-bar-height')).toBe('90px');
    // 2026-10-17 모바일에도 머리줄이 선다(브랜드 · 로그인 단추). 이동은 하단 바가 맡는다
    expect(shell).toMatch(/@media \(max-width: 1099px\) \{[\s\S]*?\.app-bar \{ display: flex; min-height: 5\.6rem;/);
  });

  it('셸을 떠나면 관찰과 이전 높이를 정리한다', () => {
    const { unmount } = mount();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(document.body.style.getPropertyValue('--app-bar-height')).toBe('');
    height = 110;
    window.dispatchEvent(new Event('resize'));
    expect(document.body.style.getPropertyValue('--app-bar-height')).toBe('');
  });
});
