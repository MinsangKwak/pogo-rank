// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
// 옛 서랍·노트 스킨까지 실제 import 순서로 읽는다. 새 규칙만 검사하면 크림색 배경 회귀를 놓친다.
const imports = [...source('styles.ts').matchAll(/import '\.\/([^']+\.css)'/g)].map((match) => match[1]!);
const css = imports.map(source).join('\n');
const shell = source('styles/pixel/shell.css');

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
});

function render(theme: 'light' | 'dark', markup: string) {
  document.documentElement.setAttribute('data-theme', theme);
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = `<div id="root">${markup}</div>`;
}

// jsdom은 사용자 정의 속성을 보존하지만 var() 색을 계산하지 않는다. 계산된 cascade의 토큰만 직접 푼다.
function resolved(style: CSSStyleDeclaration, value: string): string {
  for (let pass = 0; pass < 12 && value.includes('var('); pass += 1) {
    value = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_, token: string, fallback: string) =>
      style.getPropertyValue(token).trim() || fallback || '');
  }
  expect(value).not.toContain('var(');
  return value.trim();
}

function luminance(color: string): number {
  const rgb = color.startsWith('#')
    ? color.slice(1).match(/.{2}/g)!.map((value) => Number.parseInt(value, 16))
    : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  expect(rgb).toHaveLength(3);
  const linear = rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

function assertContrast(element: Element, min = 4.5) {
  const style = getComputedStyle(element);
  const foreground = resolved(style, style.color);
  // background-color longhand는 jsdom이 var() shorthand를 풀지 못하므로 작성된 background를 우선 쓴다.
  const background = resolved(style, style.background || style.backgroundColor);
  const [a, b] = [luminance(foreground), luminance(background)];
  expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `${foreground} / ${background}`).toBeGreaterThanOrEqual(min);
  expect(Number(style.opacity || '1')).toBe(1);
  return { style, foreground, background };
}

describe.each(['light', 'dark'] as const)('셸의 %s 테마 대비', (theme) => {
  it('Google 로그인과 로그인 후 주 행동에 실제 브랜드 배경이 있다', () => {
    render(theme, '<div class="drawer__panel"><div class="account"><button class="drawer__item account__login">Google로 로그인</button><div class="account__actions"><button class="drawer__item account__primary">가입 승인</button><button class="drawer__item">로그아웃</button><button class="drawer__item account__danger">계정 삭제</button></div></div></div>');
    for (const button of document.querySelectorAll('button')) assertContrast(button);
    for (const button of document.querySelectorAll('.account__login, .account__primary')) {
      const { style, foreground, background } = assertContrast(button);
      expect(background).toBe(resolved(style, 'var(--brand-primary)'));
      expect(foreground).toBe(resolved(style, 'var(--on-brand)'));
    }
  });

  it('계정의 비활성 주 행동은 글자를 흐리지 않고 점선으로 구분한다', () => {
    render(theme, '<div class="drawer__panel"><div class="account"><button class="drawer__item account__login" disabled>로그인 확인 중</button><button class="drawer__item account__primary" aria-disabled="true">저장 중</button></div></div>');
    for (const button of document.querySelectorAll('button')) {
      const { style, foreground, background } = assertContrast(button);
      expect(foreground).toBe(resolved(style, 'var(--muted)'));
      expect(background).toBe(resolved(style, 'var(--panel-2)'));
      expect(style.borderStyle).toBe('dashed');
    }
  });

  it('현재 메뉴와 잠긴 메뉴가 밝은·어두운 판에서 모두 읽힌다', () => {
    render(theme, '<nav><a class="px-nav__item" aria-current="page">포켓몬 도감</a><a class="px-nav__item" aria-disabled="true">내 포켓몬</a></nav>');
    for (const item of document.querySelectorAll('a')) assertContrast(item);
    expect(getComputedStyle(document.querySelector('[aria-disabled]')!).borderStyle).toBe('dashed');
  });

  it('머리 도구의 선택 상태와 비활성 상태가 서로의 색을 덮지 않는다', () => {
    render(theme, '<header class="page-head"><div class="page-head__actions"><button aria-pressed="true">선택됨</button><button aria-pressed="true" disabled>선택됨 · 사용 불가</button></div></header>');
    for (const button of document.querySelectorAll('button')) assertContrast(button);
    const off = getComputedStyle(document.querySelector('button:disabled')!);
    expect(resolved(off, off.color)).toBe(resolved(off, 'var(--muted)'));
    expect(off.borderStyle).toBe('dashed');
  });

  it('언어·지역 선택은 옛 둥근 모서리로 잘리지 않고 읽힌다', () => {
    render(theme, '<div class="drawer__panel"><div class="drawer__group drawer__locale"><button class="px-nav__item"><span class="px-nav__label">언어</span><span class="drawer__value">한국어</span></button></div></div>');
    expect(Number.parseFloat(getComputedStyle(document.querySelector('.drawer__locale')!).borderRadius)).toBe(0);
    assertContrast(document.querySelector('button')!);
  });
});

describe('계정 단추 상태 계약', () => {
  it('계정 단추가 px-skin에 기대지 않고 채움 변수를 실제 배경으로 쓴다', () => {
    const rule = /html body #root \.drawer__panel \.account \.drawer__item, html body #root \.drawer__panel \.account \.account__login \{([^}]+)\}/.exec(shell)![1]!;
    expect(rule).toContain('background: var(--px-fill)');
    expect(rule).toContain('border: var(--px-stroke) solid var(--px-line, var(--px-edge))');
  });

  it('주 행동의 hover는 글자와 어울리는 진한 브랜드 배경만 쓴다', () => {
    const rule = /\.account :is\(\.account__login, \.account__primary\):not\(:disabled\):not\(\[aria-disabled="true"\]\):hover \{([^}]+)\}/.exec(shell)![1]!;
    expect(rule).toContain('--px-fill: var(--brand-hover)');
    expect(rule).not.toMatch(/(?:^|;)\s*color:/);
  });
});
