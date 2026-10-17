// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PveTable } from '../screens/Ranks';
import type { PveRow } from '../types/data';

vi.mock('../lib/data', () => ({
  useDex: () => ({ data: {
    FORM_LABELS: ['메가', '섀도우'], TYPE_KO: { steel: '강철', psychic: '에스퍼', dragon: '드래곤', flying: '비행' },
    SPRITE_IDS: [376, 373], SPRITE_ANIM_IDS: [],
  } }),
  useUsage: () => ({ data: { USAGE_PLACES: {} } }),
}));
const rows: PveRow[] = [
  { sprite: 376, name: '메타그로스', en: 'Metagross', types: ['steel', 'psychic'], fast: '연속자르기', charged: '코멧펀치', dps: 14.3, tdo: 149, score: 66, ratio: 66, tier: 'S' },
  { sprite: 373, name: '보만다', en: 'Salamence', types: ['dragon', 'flying'], fast: '드래곤테일', charged: '공중날기', dps: 14.8, tdo: 150, score: 65, ratio: 65, tier: 'S', unrel: true },
];
const props = { rows, mode: 'easy' as const, dexTable: {}, rankOf: (_row: PveRow, index: number) => index + 7, onOpen: vi.fn() };
const css = readFileSync(join(__dirname, '../styles/pixel/ranks.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afterEach(() => { cleanup(); props.onOpen.mockReset(); });

describe('레이드 티어표의 모바일 카드', () => {
  it('새 순위를 만들지 않고 카드와 같은 번호 출처를 리본으로 표시한다', () => {
    const { container } = render(createElement(PveTable, props));
    const ranks = [...container.querySelectorAll('.px-mon-ribbon')];
    expect(ranks.map((node) => node.textContent)).toEqual(['07', '08']);
    expect(ranks.map((node) => node.getAttribute('aria-label'))).toEqual(['7위', '8위']);
    expect(container.querySelector('.is-first')).toBeNull();
    expect(container.querySelector('tbody tr.is-unreleased')).not.toBeNull();
  });

  it('그림·이름·타입·추천 기술·DPS·TDO·점수와 열 이름을 모두 보존한다', () => {
    const { container } = render(createElement(PveTable, props));
    const first = container.querySelector('tbody tr')!;
    expect(first.querySelector('img')?.getAttribute('src')).toBe('/sprites/376.png');
    expect(first.querySelector('.rk-row__name')?.textContent).toBe('메타그로스');
    expect(first.querySelector('.rk-row__types')?.textContent).toBe('#376 · 강철 · 에스퍼');
    expect(first.querySelector('.rk-table__moves')?.textContent).toBe('연속자르기 · 코멧펀치');
    expect([...first.querySelectorAll('.rk-table__metric')].map((node) => [node.getAttribute('data-label'), node.textContent]))
      .toEqual([['DPS', '14.3'], ['TDO', '149'], ['점수', '66점']]);
    expect([...container.querySelectorAll('thead th')].map((node) => node.textContent)).toEqual(['순위', '포켓몬', '추천 기술', 'DPS', 'TDO', '점수']);
  });

  it('전체 모드에는 원래 없던 점수 칸을 추가하지 않는다', () => {
    const { container } = render(createElement(PveTable, { ...props, mode: 'all' }));
    expect(container.querySelector('.rk-table__score')).toBeNull();
    expect(container.querySelectorAll('thead th')).toHaveLength(5);
    expect(container.querySelectorAll('tbody tr:first-child .rk-table__metric')).toHaveLength(2);
  });

  it('마우스와 키보드로 같은 포켓몬 상세를 연다', () => {
    const { getByRole } = render(createElement(PveTable, props));
    const first = getByRole('button', { name: '메타그로스 상세 보기' });
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'Enter' });
    fireEvent.keyDown(first, { key: ' ' });
    expect(props.onOpen).toHaveBeenCalledTimes(3);
    expect(props.onOpen).toHaveBeenLastCalledWith(rows[0]);
  });

  it('모바일은 리본을 밖으로 빼고 그림·이름은 한 줄, 수치는 세 칸에 나란히 배치한다', () => {
    const start = css.indexOf('@media (max-width: 699px)', css.indexOf('.rk-tablewrap'));
    const mobile = css.slice(start, css.indexOf('html body #root .rk-info', start));
    expect(mobile).toMatch(/\.rk-tablewrap\s*\{[^}]*overflow: visible; clip-path: none/);
    expect(mobile).toMatch(/\.rk-table tbody tr\s*\{[^}]*position: relative;[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(mobile).toMatch(/\.rk-table__rank \.px-mon-ribbon\s*\{ position: absolute; top: -0\.4rem; left: -0\.4rem/);
    expect(mobile).toMatch(/\.rk-table tbody td\.rk-table__mon\s*\{ display: flex;[^}]*grid-column: 1 \/ -1/);
    expect(mobile).toMatch(/\.rk-table tbody td\.rk-table__moves\s*\{[^}]*grid-column: 1 \/ -1/);
    const metric = /\.rk-table tbody td\.rk-table__metric\s*\{([^}]+)\}/.exec(mobile)![1]!;
    expect(metric).not.toContain('grid-column: 1 / -1');
    expect(metric).toContain('flex-direction: column');
    expect(metric).toContain('border-top:');
    expect(css).toMatch(/\.rk-table__rank \.px-mon-ribbon\s*\{ position: relative; top: auto; left: auto/);
  });
});
