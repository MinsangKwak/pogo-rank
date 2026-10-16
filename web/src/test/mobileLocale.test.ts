// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppBar, Drawer } from '../components/Shell';
import { lang, setLang } from '../lib/i18n';
import { region, setRegion } from '../lib/region';
import { track } from '../lib/track';

vi.mock('../lib/data', () => ({ useMetaSoft: () => undefined }));
vi.mock('../lib/track', () => ({ track: vi.fn() }));
vi.mock('../components/Account', () => ({ default: () => null }));
vi.mock('../components/Trainers', () => ({ default: () => null }));

const props = { open: true, now: 'home', onClose: vi.fn(), onConsent: vi.fn(), onNote: vi.fn() };
const shell = readFileSync(join(__dirname, '../styles/pixel/shell.css'), 'utf8');

beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }));
  setRegion('kr');
  await setLang('ko');
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('모바일 전체 메뉴의 언어·일정 지역', () => {
  it('머리줄 없이도 메뉴 상단에서 두 설정을 찾고 누를 수 있다', () => {
    const { container } = render(createElement(Drawer, props));
    const controls = container.querySelector('.drawer__locale')!;
    expect(controls.querySelector('#menu-language')?.textContent).toContain('한국어');
    expect(controls.querySelector('#menu-region')?.textContent).toContain('KR · 한국');
    expect(controls.nextElementSibling?.className).toBe('nav-menu');
    expect(controls.getAttribute('data-i18n')).toBe('off');
    expect(shell).toMatch(/\.drawer__locale \.px-nav__item \{ min-height: var\(--tap\)/);
    expect(shell).toMatch(/\.drawer__locale \.px-nav__label \{ white-space: normal/);
    expect(shell).toContain('.app-bar { display: none; min-height: 0; padding: 0; border: 0; }');
  });

  it('언어를 왕복 전환해 저장하며 일정 지역과 열린 메뉴는 유지한다', async () => {
    setRegion('eu');
    const { container } = render(createElement(Drawer, props));
    const button = container.querySelector<HTMLButtonElement>('#menu-language')!;
    fireEvent.click(button);
    await waitFor(() => expect(lang()).toBe('en'));
    expect(button.textContent).toContain('English');
    expect(localStorage.getItem('pogo_lang')).toBe('en');
    expect(region()).toBe('eu');
    expect(container.querySelector('#menu-region')?.textContent).toContain('EU · Europe');
    expect(track).toHaveBeenCalledWith('lang_switch', { lang: 'en' });
    fireEvent.click(button);
    await waitFor(() => expect(lang()).toBe('ko'));
    expect(button.textContent).toContain('한국어');
    expect(localStorage.getItem('pogo_lang')).toBe('ko');
    expect(region()).toBe('eu');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('지역을 왕복 전환해 저장하며 언어와 열린 메뉴는 유지한다', async () => {
    await setLang('en');
    const { container } = render(createElement(Drawer, props));
    const button = container.querySelector<HTMLButtonElement>('#menu-region')!;
    fireEvent.click(button);
    expect(region()).toBe('eu');
    expect(localStorage.getItem('pogo_region')).toBe('eu');
    expect(button.textContent).toContain('EU · Europe');
    expect(track).toHaveBeenCalledWith('region_switch', { region: 'eu' });
    fireEvent.click(button);
    expect(region()).toBe('kr');
    expect(localStorage.getItem('pogo_region')).toBe('kr');
    expect(button.textContent).toContain('KR · Korea');
    expect(lang()).toBe('en');
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('메뉴를 다시 열어도 선택을 보존하고 데스크톱 버튼과 동기화한다', async () => {
    const { container, rerender } = render(createElement('div', null,
      createElement(AppBar, { onMenu: vi.fn() }), createElement(Drawer, props)));
    fireEvent.click(container.querySelector('#menu-region')!);
    fireEvent.click(container.querySelector('#menu-language')!);
    await waitFor(() => expect(lang()).toBe('en'));
    expect(container.querySelector('#lang-toggle')?.textContent).toBe('KR');
    expect(container.querySelector('#region-toggle')?.textContent).toContain('EU');
    rerender(createElement(Drawer, { ...props, open: false }));
    expect(container.querySelector('#menu-language')).toBeNull();
    rerender(createElement(Drawer, props));
    expect(container.querySelector('#menu-language')?.textContent).toContain('English');
    expect(container.querySelector('#menu-region')?.textContent).toContain('EU · Europe');
  });
});
