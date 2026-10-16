// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RankRow, type RankRowProps } from '../components/Row';

vi.mock('../lib/data', () => ({
  useDex: () => ({ data: {
    FORM_LABELS: ['거다이맥스', '다이맥스', '섀도우'],
    TYPE_KO: { fire: '불꽃', flying: '비행', normal: '노말' },
    SPRITE_IDS: [10210, 250, 242], SPRITE_ANIM_IDS: [],
  } }),
  useMeta: () => ({ data: { RANK_DELTA_DATE: new Date().toISOString().slice(0, 10), RANK_FRESH_DAYS: 14 } }),
}));

const row: RankRowProps = {
  sprite: 10210, name: '거다이맥스 에이스번', en: 'Cinderace', types: ['fire'], rank: 1,
  label: '맥스 피해', score: '432', sub: '맥스 피해 · 내구 23', lines: ['거다이맥스', '불꽃 타입'],
  badges: createElement('span', { className: 'px-badge px-skin px-badge--ko' }, '활용 15곳'),
};
const css = readFileSync(join(__dirname, '../styles/pixel/ranks.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afterEach(cleanup);

describe('순위 목록의 리본과 정보 위계', () => {
  it('순위는 잘리는 판의 바깥, 본문 전체는 기존 상세 단추로 유지한다', () => {
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(RankRow, { ...row, onOpen }));
    const item = container.querySelector('.rk-row')!;
    const ribbon = item.querySelector('.rk-row__rank')!;
    const button = getByRole('button', { name: '거다이맥스 에이스번 상세 보기' });
    expect(item.classList.contains('rk-row--ranked')).toBe(true);
    expect(item.classList.contains('px-skin')).toBe(false);
    expect(ribbon.parentElement).toBe(item);
    expect(ribbon.textContent).toBe('01');
    expect(ribbon.getAttribute('aria-label')).toBe('1위');
    expect(ribbon.classList.contains('is-first')).toBe(true);
    expect(button.classList.contains('px-skin')).toBe(true);
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(button.querySelector('img')?.getAttribute('src')).toBe('/sprites/10210.png');
  });

  it('이름은 폼 배지와 함께 읽고 활용·변동은 타입 옆의 보조 정보로 분리한다', () => {
    const { container } = render(createElement(RankRow, { ...row, delta: 2 }));
    const name = container.querySelector('.rk-row__name')!;
    expect(name.querySelector('b')?.textContent).toBe('에이스번');
    expect(name.textContent).toContain('거다이맥스');
    expect(name.textContent).not.toContain('활용');
    expect(name.querySelector('.delta')).toBeNull();
    const meta = container.querySelector('.rk-row__meta')!;
    expect(meta.querySelector('.rk-row__types')?.textContent).toBe('불꽃');
    expect(meta.querySelector('.rk-row__badges')?.textContent).toContain('활용 15곳');
    expect(meta.querySelector('.delta')).not.toBeNull();
    expect([...container.querySelectorAll('.rk-row__lines > span')].map((node) => node.textContent)).toEqual(['거다이맥스', '불꽃 타입']);
  });

  it.each([
    ['맥스 피해', '432', '맥스 피해 · 내구 23', '내구 23'],
    ['EHP', '59', 'EHP · 받는 배율 ×2 · 체력 403 × 방어 145', '받는 배율 ×2 · 체력 403 × 방어 145'],
    ['DPS', '14.3', 'DPS · TDO 149', 'TDO 149'],
    ['점수', '100%', '공격 201 · 위력 450 · 자속 · 내구 27', '공격 201 · 위력 450 · 자속 · 내구 27'],
    ['점수', '97.5', '전체 12위', '전체 12위'],
  ])('주 수치 %s는 보존하고 중복 라벨만 줄인다', (label, score, sub, expected) => {
    const { container } = render(createElement(RankRow, { ...row, label, score, sub }));
    const metric = container.querySelector('.rk-row__metric')!;
    expect(metric.querySelector('.rk-row__label')?.textContent).toBe(label);
    expect(metric.querySelector('.rk-row__score')?.textContent).toBe(score);
    expect(container.querySelector('.rk-row__sub')?.textContent).toBe(expected);
  });

  it('순위가 없는 도감 행은 리본 없이 기존 번호·배지·수치 구조를 유지한다', () => {
    const { container } = render(createElement(RankRow, { ...row, rank: undefined, no: 815 }));
    const item = container.querySelector('.rk-row')!;
    expect(item.classList.contains('px-skin')).toBe(true);
    expect(item.classList.contains('rk-row--ranked')).toBe(false);
    expect(item.querySelector('.rk-row__rank')).toBeNull();
    expect(item.querySelector('.rk-row__btn')?.classList.contains('px-skin')).toBe(false);
    expect(item.querySelector('.rk-row__no')?.textContent).toBe('#0815');
    expect(item.querySelector('.rk-row__name')?.textContent).toContain('활용 15곳');
    expect(item.querySelector('.rk-row__metric')).toBeNull();
    expect(item.querySelector('.rk-row__sub')?.textContent).toBe('맥스 피해 · 내구 23');
  });

  it('세 자리 순위·미구현과 보조 수치가 없는 PvP 행도 정보를 잃지 않는다', () => {
    const { container } = render(createElement(RankRow, { ...row, rank: 123, unrel: true, sub: undefined, lines: [], badges: undefined }));
    const item = container.querySelector('.rk-row')!;
    expect(item.classList.contains('is-unreleased')).toBe(true);
    expect(item.querySelector('.rk-row__rank')?.textContent).toBe('123');
    expect(item.querySelector('.rk-row__rank')?.classList.contains('is-first')).toBe(false);
    expect(item.querySelector('.rk-row__lines')).toBeNull();
    expect(item.querySelector('.rk-row__sub')).toBeNull();
    expect(item.querySelector('.rk-row__badges')?.textContent).toBe('');
  });

  it('리본의 별도 칸과 모바일 가로 넘침이 돌아오지 않도록 배치를 고정한다', () => {
    expect(css).toMatch(/\.rk-row--ranked > \.rk-row__rank\s*\{[^}]*position: absolute;[^}]*top: -0\.4rem;[^}]*left: -0\.4rem;[^}]*pointer-events: none/);
    expect(css).toMatch(/\.rk-row__btn:not\(\.px-skin\)\s*\{ border: 0; background: none; \}/);
    const baseButton = /html body #root \.rk-row__btn\s*\{([^}]+)\}/.exec(css)![1]!;
    expect(baseButton).not.toContain('border:');
    expect(baseButton).not.toContain('background:');
    expect(css).toMatch(/\.rk-row--ranked > \.rk-row__btn\s*\{[^}]*grid-template-columns: 6\.4rem minmax\(0, 1fr\) auto/);
    const mobile = css.slice(css.lastIndexOf('@media (max-width: 699px)'));
    expect(mobile).toMatch(/\.rk-row--ranked > \.rk-row__btn\s*\{[^}]*grid-template-columns: 6\.4rem minmax\(0, 1fr\);/);
    expect(mobile).toMatch(/\.rk-row--ranked \.rk-row__stats\s*\{[^}]*grid-column: 1 \/ -1;[^}]*border-top:/);
    expect(css).toMatch(/\.rk-row--ranked \.rk-row__lines > span\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere/);
    expect(css).toMatch(/\.rk-row--ranked \.rk-row__sub\s*\{[^}]*max-width: 24rem;[^}]*overflow-wrap: anywhere/);
    expect(mobile).toMatch(/\.rk-row--ranked \.rk-row__sub\s*\{[^}]*min-width: 0;[^}]*max-width: none/);
  });
});
