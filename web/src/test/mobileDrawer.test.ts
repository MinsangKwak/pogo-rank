// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Drawer } from '../components/Shell';

vi.mock('../lib/data', () => ({ useMetaSoft: () => undefined }));
vi.mock('../lib/track', () => ({ track: vi.fn() }));
vi.mock('../components/Account', () => ({ default: () => null }));
vi.mock('../components/Trainers', () => ({ default: () => null }));

const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const styles = [...source('styles.ts').matchAll(/import '\.\/([^']+\.css)'/g)].map((match) => source(match[1]!)).join('\n');
const cap = 'min(85vh, calc(100dvh - env(safe-area-inset-top)))';

function computedCap() {
  const probe = document.createElement('div');
  probe.style.maxHeight = cap;
  document.body.append(probe);
  const value = getComputedStyle(probe).maxHeight;
  probe.remove();
  return value;
}

// jsdom은 뷰포트 미디어 조건을 계산하지 않는다. 실제 import 순서의 CSSOM에서 해당 너비 규칙만 펼친다.
function atWidth(width: number) {
  const sheet = document.createElement('style');
  sheet.textContent = styles;
  document.head.append(sheet);
  const active = (rules: CSSRuleList): string => [...rules].map((rule) => {
    if (rule.type === CSSRule.STYLE_RULE) return rule.cssText;
    if (rule.type !== CSSRule.MEDIA_RULE) return '';
    const media = rule as CSSMediaRule;
    const max = /max-width:\s*(\d+)px/.exec(media.conditionText);
    const min = /min-width:\s*(\d+)px/.exec(media.conditionText);
    if ((!max && !min) || (max && width > Number(max[1])) || (min && width < Number(min[1]))) return '';
    return active(media.cssRules);
  }).join('\n');
  sheet.textContent = active(sheet.sheet!.cssRules);
}

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
});

function mountDrawer() {
  const onClose = vi.fn();
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  render(createElement(Drawer, { open: true, now: 'home', onClose, onConsent: vi.fn(), onNote: vi.fn() }), { container: root });
  return onClose;
}

describe('전체 메뉴와 남은 옛 팝업의 모바일 시트', () => {
  it.each([320, 640, 699])('%ipx 전체 메뉴는 화면 높이를 채우고 패널 안에서 스크롤된다', (width) => {
    atWidth(width);
    const onClose = mountDrawer();
    const panel = document.querySelector<HTMLElement>('.drawer__panel')!;
    const style = getComputedStyle(panel);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe('0px');
    expect(style.bottom).toBe('auto');
    expect(style.height).toBe('100dvh');
    expect(style.maxHeight).toBe('none');
    expect(style.overflowY).toBe('auto');
    expect(style.overscrollBehavior).toBe('contain');
    const head = getComputedStyle(panel.querySelector('.drawer__head')!);
    expect(head.position).toBe('sticky');
    expect(head.top).toBe('0px');
    expect(head.height).toBe('auto');
    expect(head.flexShrink).toBe('0');
    expect(getComputedStyle(panel.querySelector('.nav-menu')!).flexShrink).toBe('0');
    expect(panel.querySelector('#menu-settings')).not.toBeNull();
    expect(panel.querySelector('.drawer__meta')).not.toBeNull();
    const close = panel.querySelector<HTMLButtonElement>('#drawer-close')!;
    expect(getComputedStyle(close).width).toBe('var(--tap)');
    close.focus();
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(['light', 'dark'] as const)('%s에서 옛 팝업은 닫기 줄을 포함해 높이를 제한하고 본문만 스크롤한다', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    atWidth(699);
    document.body.innerHTML = `<div id="root"><dialog class="modal" open><div class="modal__wrap"><button class="modal__close">닫기</button><div class="modal__box"><div class="admin">내용</div></div></div></dialog></div>`;
    const overlay = getComputedStyle(document.querySelector('dialog')!);
    expect(overlay.position).toBe('fixed');
    expect(overlay.alignItems).toBe('flex-end');
    expect(overlay.padding).toBe('0px');
    const wrap = getComputedStyle(document.querySelector('.modal__wrap')!);
    expect(wrap.boxSizing).toBe('border-box');
    expect(wrap.display).toBe('flex');
    expect(wrap.flexDirection).toBe('column');
    expect(wrap.maxHeight).toBe(computedCap());
    expect(wrap.overflow).toBe('hidden');
    const body = getComputedStyle(document.querySelector('.modal__box')!);
    expect(body.minHeight).toBe('0px');
    expect(body.maxHeight).toBe('none');
    expect(body.overflowY).toBe('auto');
    expect(body.flexShrink).toBe('1');
    const close = getComputedStyle(document.querySelector('.modal__close')!);
    expect(close.position).toBe('absolute');
    expect(close.width).toBe('var(--tap)');
    expect(close.height).toBe('var(--tap)');
    expect(close.top).toBe('8px');
    expect(['56px', '5.6rem']).toContain(wrap.paddingTop);
  });

  it('700px 이상에서는 기존 오른쪽 전체 높이 메뉴를 유지한다', () => {
    atWidth(700);
    mountDrawer();
    const panel = getComputedStyle(document.querySelector('.drawer__panel')!);
    expect(panel.top).toBe('0px');
    expect(panel.height).toBe('100%');
    expect(panel.maxHeight).not.toBe(computedCap());
  });

  it('모바일에서 열린 전체 메뉴는 PC 너비로 전환될 때 자동으로 닫힌다', () => {
    atWidth(699);
    let change: (() => void) | undefined;
    let desktop = false;
    const query = {
      get matches() { return desktop; },
      media: '(min-width: 1100px)',
      addEventListener: (_type: string, listener: () => void) => { change = listener; },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', vi.fn(() => query));
    const onClose = mountDrawer();
    desktop = true;
    change?.();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('페이지형 상세와 닫힌 옛 dialog는 모바일 시트로 열지 않는다', () => {
    atWidth(320);
    document.body.innerHTML = '<div id="root"><dialog id="page" class="modal modal--page" open><div class="modal__wrap"><div class="modal__box">페이지</div></div></dialog><dialog id="closed" class="modal"><div class="modal__wrap"></div></dialog></div>';
    expect(getComputedStyle(document.querySelector('#page .modal__wrap')!).maxHeight).not.toBe(computedCap());
    expect(getComputedStyle(document.querySelector('#closed')!).display).toBe('none');
  });
});
