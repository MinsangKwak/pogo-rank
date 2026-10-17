// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PageHead } from '../components/Shell';
import { routeById } from '../routes';

vi.mock('../lib/data', () => ({ useMetaSoft: () => undefined }));
vi.mock('../components/Account', () => ({ default: () => null }));
vi.mock('../components/Trainers', () => ({ default: () => null }));

const shell = readFileSync(join(__dirname, '../styles/pixel/shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const mobile = [...shell.matchAll(/@media \(max-width: 1099px\) \{([\s\S]*?)\n\}/g)].map((match) => match[1]).join('\n');
const phone = [...shell.matchAll(/@media \(max-width: 699px\) \{([\s\S]*?)\n\}/g)].map((match) => match[1]).join('\n');
const rule = (selector: string) => {
  const at = shell.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return shell.slice(at, shell.indexOf('}', at) + 1);
};
const base = [
  rule('html body #root .page-head .page-head__crumb'),
  rule('html body #root .page-head .page-head__actions'),
  rule('html body #root .page-head .page-head__actions button'),
].join('\n');
const style = (narrow: boolean) => { document.head.innerHTML = `<style>${base}${narrow ? mobile + phone : ''}</style>`; };

afterEach(() => { cleanup(); document.head.innerHTML = ''; });

const fixture = (onView = vi.fn(), onCalculate = vi.fn(), onOpen = vi.fn()) => render(createElement('div', { id: 'root' },
  createElement('header', { className: 'page-head' },
    createElement('div', { className: 'page-head__actions' },
      createElement('button', { className: 'tool-btn' }, '솔플 계산기'),
      createElement('a', { href: '/schedule' }, '이벤트 일정'),
      createElement('button', { className: 'view-toggle', onClick: onView }, '보기 전환'),
      createElement('label', { className: 'check-toggle' }, createElement('input', { type: 'checkbox' }), '미구현 포함'))),
  createElement('main', null,
    createElement('button', { onClick: onCalculate }, '계산하기'),
    createElement('button', { onClick: onOpen }, '포켓몬 상세 열기'))));

describe('모바일 화면 머리와 이동 단추', () => {
  it('한국어 부모 위치와 영문 설명은 순서를 유지하며 각각 별도 줄로 놓는다', () => {
    style(true);
    const { container } = render(createElement('div', { id: 'root' }, createElement(PageHead, { route: routeById('pve-solo')!, actionsRef: () => {} })));
    const crumb = container.querySelector('.page-head__crumb')!;
    const parent = crumb.querySelector('.page-head__crumb-up')!;
    const context = crumb.querySelector('.page-head__crumb-now')!;
    expect(parent.textContent).toBe('레이드 · PvE');
    expect(parent.getAttribute('href')).toBe('/pve');
    expect(context.textContent).toBe('RAID SIMULATOR / EXPERIMENTAL');
    expect(context.getAttribute('data-i18n')).toBe('off');
    expect(parent.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getComputedStyle(crumb).flexDirection).toBe('column');
    expect(getComputedStyle(crumb).alignItems).toBe('flex-start');
    expect(getComputedStyle(context).overflowWrap).toBe('anywhere');
    expect(getComputedStyle(context).whiteSpace).toBe('normal');
    expect(mobile).toContain('font: 400 1.2rem/1.5 var(--font-pixel)');
    for (const separator of crumb.querySelectorAll('.page-head__crumb-sep')) expect(getComputedStyle(separator).display).toBe('none');
  });

  it('부모가 없는 화면에 빈 부모 위치 줄을 추가하지 않는다', () => {
    const { container } = render(createElement(PageHead, { route: routeById('dex')!, actionsRef: () => {} }));
    expect(container.querySelector('.page-head__crumb-up')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('.page-head__crumb-now')?.textContent).toBe('POKÉDEX / DISCOVERY');
  });

  it('머리의 경로 이동 단추만 숨기고 보기·필터·계산·포켓몬 열기는 유지한다', () => {
    style(true);
    const onView = vi.fn(), onCalculate = vi.fn(), onOpen = vi.fn();
    const { container, getByText } = fixture(onView, onCalculate, onOpen);
    expect(getComputedStyle(container.querySelector('.tool-btn')!).display).toBe('none');
    expect(getComputedStyle(container.querySelector('.page-head__actions a')!).display).toBe('none');
    expect(getComputedStyle(container.querySelector('.page-head__actions')!).display).toBe('flex');
    expect(getComputedStyle(container.querySelector('.view-toggle')!).display).not.toBe('none');
    expect(getComputedStyle(container.querySelector('.check-toggle')!).display).not.toBe('none');
    fireEvent.click(getByText('보기 전환')); fireEvent.click(getByText('계산하기')); fireEvent.click(getByText('포켓몬 상세 열기'));
    expect(onView).toHaveBeenCalledOnce(); expect(onCalculate).toHaveBeenCalledOnce(); expect(onOpen).toHaveBeenCalledOnce();
  });

  it('이동 단추만 있거나 아직 비어 있는 머리 동작 줄은 공간도 남기지 않는다', () => {
    style(true);
    const { container } = render(createElement('div', { id: 'root' }, createElement('header', { className: 'page-head' },
      createElement('div', { className: 'page-head__actions' }, createElement('button', { className: 'tool-btn' }, '솔플 계산기')),
      createElement('div', { className: 'page-head__actions', 'data-reserve': '' }))));
    for (const actions of container.querySelectorAll('.page-head__actions')) expect(getComputedStyle(actions).display).toBe('none');
  });

  it('데스크톱에는 경로 이동 단추와 기존 머리 조작을 그대로 둔다', () => {
    style(false);
    const { container } = fixture();
    expect(getComputedStyle(container.querySelector('.tool-btn')!).display).toBe('inline-flex');
    expect(getComputedStyle(container.querySelector('.page-head__actions a')!).display).not.toBe('none');
    expect(getComputedStyle(container.querySelector('.page-head__actions')!).display).toBe('flex');
  });

  it('좁은 제목은 화면에 맞춰 줄어들고 긴 단어는 머리 안에서 줄바꿈한다', () => {
    expect(phone).toContain('.page-head h2 { margin-top: 1.2rem; font-size: clamp(2.4rem, 6.5vw, 2.8rem); }');
    expect(mobile).toContain('.page-head :is(h2, .page-head__desc) { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }');
    expect(mobile).toContain('.page-head .page-head__actions :is(.tool-btn, a[href]) { display: none; }');
  });
});
