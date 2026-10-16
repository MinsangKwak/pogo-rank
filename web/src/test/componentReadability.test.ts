// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = (name: string) => readFileSync(join(__dirname, '../styles/pixel', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tools = css('tools.css');
const admin = css('admin.css');
const mobile = (source: string, width: number) => [...source.matchAll(new RegExp(`@media \\(max-width: ${width}px\\) \\{([\\s\\S]*?)\\n\\}`, 'g'))].map((match) => match[1]).join('\n');
const rule = (source: string, selector: string) => {
  const at = source.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  return source.slice(at, source.indexOf('}', at) + 1);
};

afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

describe('도구·관리자 가독성 회귀', () => {
  it('모바일 후보의 기술·조건을 숨기지 않고 동작 단추를 별도 줄에 둔다', () => {
    const narrow = mobile(tools, 699);
    expect(rule(narrow, 'html body #root .pxt-cand')).toContain('flex-wrap: wrap');
    expect(rule(narrow, 'html body #root .pxt-cand__ops')).toContain('flex-basis: 100%');
    expect(rule(narrow, 'html body #root .pxt-cand__ops .px-btn')).toContain('min-height: var(--tap)');
    document.head.innerHTML = `<style>${rule(narrow, 'html body #root .pxt-cand__text .px-caption.px-muted')}</style>`;
    document.body.innerHTML = '<div id="root"><span class="pxt-cand__text"><b>포켓몬</b><span class="px-caption px-muted">날개치기 · 블라스트번</span></span></div>';
    expect(getComputedStyle(document.querySelector('.px-caption')!).display).toBe('block');
    expect(tools).not.toMatch(/\.pxt-cand__text[^{}]*\{[^}]*display:\s*none/);
  });

  it('후보와 슬롯의 긴 이름·기술은 안전하게 줄바꿈한다', () => {
    expect(tools).toMatch(/:is\(\.pxt-cand__text, \.pxt-boss__text, \.pxt-slot__body, \.pxt-slot__metric\) \{ overflow-wrap: anywhere/);
    expect(rule(tools, 'html body #root .pxt-slot__head')).toContain('flex-wrap: wrap');
    expect(rule(tools, 'html body #root .pxt-cand.is-empty')).toContain('opacity: 1');
  });

  it('모바일 대응력 표는 긴 포켓몬명과 배지를 셀 안에서 접는다', () => {
    const narrow = mobile(tools, 699);
    expect(rule(narrow, 'html body #root .pxt-table th[scope="row"]')).toContain('white-space: normal');
    const cell = rule(narrow, 'html body #root .pxt-table td');
    expect(cell).toContain('flex-wrap: wrap');
    expect(cell).toContain('min-width: 0');
    expect(cell).toContain('overflow-wrap: anywhere');
    expect(rule(narrow, 'html body #root .pxt-table td::before')).toContain('overflow-wrap: anywhere');
  });

  it('320px 화면에서 개체값 입력과 표는 단일 열로 다시 흐른다', () => {
    const narrow = mobile(tools, 399);
    expect(rule(narrow, 'html body #root .pxt-ivbox')).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(rule(narrow, 'html body #root .pxt-ivbox .px-stepper')).toContain('var(--tap) minmax(0, 1fr) var(--tap)');
    expect(rule(narrow, 'html body #root .pxt-table tr')).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('통계를 다시 받는 동안에도 기존 수치·안내의 대비를 유지한다', () => {
    const page = rule(admin, 'html body #root .adm-page.is-busy');
    const stats = rule(admin, 'html body #root .stat-page.is-busy, html body #root .stat-hours.is-busy table');
    document.head.innerHTML = `<style>${page}${stats}</style>`;
    document.body.innerHTML = '<div id="root"><div class="adm-page is-busy"><section class="stat-hours is-busy"><table><tbody><tr><td>123</td></tr></tbody></table></section></div><div class="stat-page is-busy"></div></div>';
    for (const element of document.querySelectorAll('.adm-page, .stat-page, .stat-hours table')) {
      expect(getComputedStyle(element).opacity).toBe('1');
    }
  });

  it('관리자 이용자 이름·이메일은 줄임표 대신 모두 읽을 수 있다', () => {
    const text = rule(admin, 'html body #root .adm-who__text > *');
    document.head.innerHTML = `<style>${text}</style>`;
    document.body.innerHTML = '<div id="root"><span class="adm-who__text"><span>long-address@example.com</span></span></div>';
    const style = getComputedStyle(document.querySelector('.adm-who__text > span')!);
    expect(style.whiteSpace).toBe('normal');
    expect(style.overflowWrap).toBe('anywhere');
    expect(rule(admin, 'html body #root .adm-me__body, html body #root .adm-profile__body')).toContain('overflow-wrap: anywhere');
  });

  it('좁은 관리자 화면은 긴 순위명을 접고 시간대 표만 가로 스크롤한다', () => {
    const narrow = mobile(admin, 699);
    expect(rule(narrow, 'html body #root .stat-rank tbody th .stat-rank__name')).toContain('white-space: normal');
    expect(rule(narrow, 'html body #root .stat-hours .px-table')).toContain('overflow-x: auto');
    expect(rule(mobile(admin, 399), 'html body #root .adm-tiles')).toContain('--cols: 1');
  });
});
