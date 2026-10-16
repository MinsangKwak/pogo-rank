// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const css = (name: string) => readFileSync(join(__dirname, '../styles/pixel', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const parts = css('parts.css');
const shell = css('shell.css');
const modal = css('modal.css');

describe('모바일 머리와 바텀 시트 회귀', () => {
  it('하단 바 구간에서도 머리줄은 브랜드 · 계정 진입으로 남고 이동 단추는 하단 바가 맡는다', () => {
    const mobile = /@media \(max-width: 1099px\) \{([\s\S]*?)\n\}/.exec(shell)![1]!;
    // 2026-10-17 머리줄을 지우던 규칙을 걷었다 — 작은 화면에도 로그인 · 마이페이지 단추가 머리에 선다
    expect(mobile).toContain('.app-bar { display: flex; min-height: 5.6rem;');
    expect(mobile).toContain('.app-bar .app-bar__account { display: inline-flex; }');
    expect(mobile).toMatch(/#search-toggle, html body #root \.app-bar #menu-toggle \{ display: none; \}/);
    expect(mobile).toContain('html body::before { top: 0; left: 0; }');
    expect(shell).not.toContain('min-height: 8.4rem');
  });
  it('루트 자식 규칙보다 강한 선택자로 팝업을 뷰포트에 고정한다', () => {
    const base = /html body #root \.px-dialog \{([^}]+)\}/.exec(parts)![0];
    expect(base).toContain('position: fixed');
    expect(base).toContain('height: 100dvh');
    expect(base).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(parts).toMatch(/\.px-dialog__panel \{[^}]*min-width: 0; max-width: 100%/);
    document.head.innerHTML = `<style>html body > #root > * { position: relative; z-index: 1; }${base}</style>`;
    document.body.innerHTML = '<div id="root"><dialog class="px-dialog" open></dialog></div>';
    expect(getComputedStyle(document.querySelector('dialog')!).position).toBe('fixed');
    expect(getComputedStyle(document.querySelector('dialog')!).zIndex).toBe('100');
    document.head.innerHTML = ''; document.body.innerHTML = '';
  });
  it('모바일 판은 하단 기준, 최대85vh이며 머리·바닥 대신 본문만 스크롤한다', () => {
    const mobile = /@media \(max-width: 699px\) \{([\s\S]*?)\n\}/.exec(parts.slice(parts.indexOf('html body #root .px-dialog {')))![1]!;
    expect(mobile).toContain('place-items: end stretch');
    expect(mobile).toContain('max-height: min(85vh, calc(100dvh - env(safe-area-inset-top)))');
    expect(mobile).toContain('height: auto');
    expect(parts).toMatch(/\.px-dialog__body \{[^}]*min-height: 0;[^}]*overflow-y: auto/);
    expect(parts).toMatch(/\.px-dialog__head \{ flex: none/);
    expect(parts).toMatch(/\.px-dialog__foot \{ flex: none/);
    expect(modal).toContain('env(safe-area-inset-bottom)');
  });
  it('진화 단계는 한 줄에 맞고 요약 이동 단추와 빈 바닥은 모바일에서 접는다', () => {
    expect(modal).toMatch(/\.pxd-evo__stage \{ flex: 1 1 0; min-width: 0; flex-direction: column/);
    expect(modal).toContain('.px-dialog .pxd-route-cta { display: none; }');
    expect(modal).not.toContain('.pxd-dialog--brief .pxd__foot { display: grid;');
  });
});
