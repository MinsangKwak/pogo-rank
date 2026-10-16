// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MonCard, { PokemonNumberRibbon } from '../components/MonCard';
import { RankRow } from '../components/Row';

const toggle = vi.hoisted(() => vi.fn());
vi.mock('../lib/useFavs', () => ({ useFavs: () => ({ has: (dex: number) => dex === 6, toggle }) }));
vi.mock('../lib/data', () => {
  const data = {
    FORM_LABELS: ['메가', '거다이맥스'], TYPE_KO: { fire: '불꽃', flying: '비행', grass: '풀', poison: '독' },
    DEX_DATA: { dex: { '10034': 6, '10210': 815 } }, SPRITE_IDS: [1, 6, 10034, 10210], SPRITE_ANIM_IDS: [],
  };
  return { useDex: () => ({ data }), useDexSoft: () => data, useMeta: () => ({ data: {} }) };
});
const css = (name: string) => readFileSync(join(__dirname, '../styles/pixel', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afterEach(() => { cleanup(); toggle.mockReset(); });

describe('모든 포켓몬 카드의 실제 번호 리본', () => {
  it.each([
    [{ rank: 1, dex: 815 }, '01', '1위', 'rank'],
    [{ rank: 123, dex: 6 }, '123', '123위', 'rank'],
    [{ dex: 1 }, '#001', '도감 번호 1', 'dex'],
    [{ dex: 1025 }, '#1025', '도감 번호 1025', 'dex'],
  ] as const)('순위와 도감 번호를 서로 바꾸거나 추정하지 않는다', (props, text, label, kind) => {
    const { container } = render(createElement(PokemonNumberRibbon, props));
    const ribbon = container.querySelector('.px-mon-ribbon')!;
    expect(ribbon.textContent).toBe(text);
    expect(ribbon.getAttribute('aria-label')).toBe(label);
    expect(ribbon.getAttribute('data-number-kind')).toBe(kind);
    expect(ribbon.classList.contains('is-first')).toBe(label === '1위');
  });

  it.each([{}, { dex: NaN }, { dex: Infinity }, { rank: 0 }, { rank: -1 }, { rank: 2.5 }])('알 수 없거나 유효하지 않은 번호를 만들지 않는다: %o', (props) => {
    const { container } = render(createElement(PokemonNumberRibbon, props));
    expect(container.textContent).toBe('');
  });

  it('도감 카드는 리본을 판 밖에 두고 원본 이미지·수치·즐겨찾기·상세 동작을 보존한다', () => {
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(MonCard, {
      sprite: 1, dex: 1, name: '이상해씨', types: ['grass', 'poison'], meta: '최대 CP 1,260 · 1세대', from: '도감', onOpen,
      badges: createElement('span', { className: 'px-badge' }, 'PvP 63'),
    }));
    const article = container.querySelector('.px-mon')!;
    const ribbon = article.querySelector('.px-mon-ribbon')!;
    const button = getByRole('button', { name: '이상해씨 상세 보기' });
    const favorite = getByRole('button', { name: '이상해씨 즐겨찾기' });
    expect(article.classList.contains('px-skin')).toBe(false);
    expect(button.classList.contains('px-skin')).toBe(true);
    expect(ribbon.parentElement).toBe(article);
    expect(favorite.parentElement).toBe(article);
    expect(button.querySelector('img')?.getAttribute('src')).toBe('/sprites/1.png');
    expect(button.textContent).toContain('풀 · 독');
    expect(button.textContent).toContain('최대 CP 1,260 · 1세대');
    expect(button.textContent).toContain('PvP 63');
    fireEvent.click(favorite);
    expect(toggle).toHaveBeenCalledWith(1, '도감');
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith({ sprite: 1, name: '이상해씨', types: ['grass', 'poison'], en: undefined });
  });

  it('폼 스프라이트는 도감 매핑으로만 번호를 찾고 순위가 있으면 순위 리본을 쓴다', () => {
    const { container, getByRole, rerender } = render(createElement(MonCard, { sprite: 10034, name: '메가 리자몽', types: ['fire'] }));
    expect(container.querySelector('.px-mon-ribbon')?.textContent).toBe('#006');
    expect(getByRole('button', { name: '메가 리자몽 즐겨찾기 해제' }).getAttribute('aria-pressed')).toBe('true');
    rerender(createElement(MonCard, { sprite: 10034, name: '메가 리자몽', rank: 12 }));
    expect(container.querySelector('.px-mon-ribbon')?.textContent).toBe('12');
    expect(container.querySelector('.px-mon__no')?.textContent).toBe('#006');
    rerender(createElement(MonCard, { sprite: 19999, name: '매핑 없는 폼' }));
    expect(container.querySelector('.px-mon-ribbon')).toBeNull();
    expect(container.querySelector('.px-mon__fav')).toBeNull();
  });

  it('순위와 도감 번호를 함께 받은 목록은 순위를 리본으로, 도감 번호를 보조 정보로 남긴다', () => {
    const { container } = render(createElement(RankRow, { sprite: 6, no: 6, rank: 12, name: '리자몽', types: ['fire'], score: '95' }));
    expect(container.querySelector('.px-mon-ribbon')?.textContent).toBe('12');
    expect(container.querySelector('.rk-row__meta .px-mon__no')?.textContent).toBe('#006');
  });

  it('목록도 폼을 원종 번호로 표시하며 없는 폼에는 가짜 번호를 붙이지 않는다', () => {
    const props = { sprite: 10210, name: '거다이맥스 에이스번', types: ['fire'], score: '3,412', label: '최대 CP' };
    const { container, rerender } = render(createElement(RankRow, props));
    expect(container.querySelector('.px-mon-ribbon')?.textContent).toBe('#815');
    expect(container.querySelector('.rk-row__score')?.textContent).toBe('3,412');
    rerender(createElement(RankRow, { ...props, sprite: 19999 }));
    expect(container.querySelector('.px-mon-ribbon')).toBeNull();
  });

  it('리본은 왼쪽 위에 겹치고 카드 그림과 도감 CP가 과도한 세로 공간을 차지하지 않는다', () => {
    const parts = css('parts.css');
    const ranks = css('ranks.css');
    expect(parts).toMatch(/\.px-mon-ribbon\s*\{[^}]*position: absolute;[^}]*top: -0\.4rem;[^}]*left: -0\.4rem;[^}]*pointer-events: none/);
    expect(parts).toMatch(/\.px-mon__art\s*\{[^}]*--ball: 8\.8rem/);
    expect(parts).toMatch(/\.px-mon__fav\s*\{[^}]*width: var\(--tap\); height: var\(--tap\)/);
    expect(parts).toMatch(/\.px-mon__badges:empty\s*\{ display: none/);
    const mobile = ranks.slice(ranks.lastIndexOf('@media (max-width: 699px)'));
    expect(mobile).toMatch(/\.rk-row--dex > \.rk-row__btn\s*\{[^}]*grid-template-columns: 5\.6rem minmax\(0, 1fr\) auto/);
    expect(mobile).toMatch(/\.rk-row--dex \.rk-row__metric\s*\{[^}]*flex-direction: column/);
  });
});
