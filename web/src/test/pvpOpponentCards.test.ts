// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PvpDeck from '../screens/PvpDeck';
import { useRankStore } from '../stores/rank';

const fixture = vi.hoisted(() => {
  const row = (sprite: number, name: string, type: string, rank: number) => ({ sprite, name, types: [type], rank, score: 100 - rank, en: '', fast: '기본 기술', charged: '차지 기술' });
  const pool = [row(25, '피카츄', 'electric', 1), row(6, '리자몽', 'fire', 2), row(9, '거북왕', 'water', 3), row(133, '이브이', 'normal', 4)];
  const bosses = [...pool, row(10034, '메가리자몽X', 'fire', 5)];
  return {
    dex: { TYPE_KO: { electric: '전기', fire: '불꽃', water: '물', normal: '노말' }, DEX_DATA: { chart: {}, dex: { '10034': 6 }, names: {}, forms: {} } },
    max: { DMAX_DATA: {}, DMAX_TANK: {}, DMAX_TIER: {}, MAX_POOL: {} },
    pve: { PVE_DATA: {}, PVE_EASY: {}, BOSS_LIST: bosses },
    pvp: { PVP_DATA: { great: pool }, VALUE_DATA: {}, SHEET_DATA: {} },
  };
});
vi.mock('../lib/data', () => ({
  useDex: () => ({ data: fixture.dex }), useDexSoft: () => fixture.dex,
  useMax: () => ({ data: fixture.max }), usePve: () => ({ data: fixture.pve }), usePvp: () => ({ data: fixture.pvp }),
}));
vi.mock('../lib/useFavs', () => ({ useFavs: () => ({ favs: [], has: () => false, toggle: vi.fn() }) }));
vi.mock('../lib/track', () => ({ track: vi.fn(), trackSearchPick: vi.fn() }));

beforeEach(() => {
  useRankStore.setState({ league: 'great' });
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
});
afterEach(cleanup);

const css = readFileSync(join(__dirname, '../styles/pixel/tools.css'), 'utf8');
const baseGrid = /html body #root \.pxt-pvp \.pxt-slots, html body #root \.pxt-foes > \.pxt-cands \{[^}]+\}/.exec(css)![0];
const mobile = /@media \(max-width: 699px\) \{([\s\S]*?)\n\}/.exec(css)![1]!;

describe('PvP 추천·상대 카드 3열 통일', () => {
  it('추천 덱과 상대 세 칸이 같은 너비의 3열을 쓰고 외부 판의 추가 여백이 없다', () => {
    const { container, getByRole } = render(createElement(PvpDeck, { onOpen: vi.fn() }));
    const foes = getByRole('region', { name: '상대 포켓몬 1–3마리' });
    expect(foes.classList.contains('pxt-sec')).toBe(true);
    expect(foes.classList.contains('px-panel')).toBe(false);
    expect(within(foes).getByRole('list', { name: '상대 포켓몬 세 칸' }).children).toHaveLength(3);
    expect(container.querySelectorAll('.pxt-slots > .pxt-slot--compact')).toHaveLength(3);
    expect(foes.querySelector('.px-mon-ribbon')).toBeNull();
    expect(baseGrid).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });

  it('상대 추가·중복 제외·변경·상세 열기·삭제가 같은 카드 안에서 동작한다', () => {
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(PvpDeck, { onOpen }));
    const foes = getByRole('region', { name: '상대 포켓몬 1–3마리' });
    const pick = (slot: number, name: string, change = false) => {
      fireEvent.click(within(foes).getByRole('button', { name: `상대 ${slot} ${change ? '변경' : '추가'}` }));
      const dialog = container.querySelector('dialog')!;
      const item = within(dialog).getByText(name).closest('li')!;
      fireEvent.click(within(item).getByRole('button', { name: '선택' }));
      fireEvent.click(within(dialog).getByRole('button', { name: `${name} 적용` }));
      expect(container.querySelector('dialog')).toBeNull();
    };
    pick(1, '피카츄');
    fireEvent.click(within(foes).getByRole('button', { name: '상대 2 추가' }));
    expect(within(container.querySelector('dialog')!).queryByText('피카츄')).toBeNull();
    fireEvent.click(within(container.querySelector('dialog')!).getByRole('button', { name: '취소' }));
    pick(2, '거북왕');
    pick(1, '메가리자몽X', true);
    expect(foes.querySelector('.px-mon-ribbon')?.textContent).toBe('#006');
    expect(foes.querySelector('[data-number-kind="rank"]')).toBeNull();
    fireEvent.click(within(foes).getByRole('button', { name: '메가리자몽X 상세 보기' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ sprite: 10034, name: '메가리자몽X' }));
    fireEvent.click(within(foes).getByRole('button', { name: '메가리자몽X 빼기' }));
    expect(within(foes).queryByText('메가리자몽X')).toBeNull();
    expect(within(foes).getByText('거북왕')).toBeTruthy();
    expect(foes.querySelectorAll('.pxt-cand')).toHaveLength(3);
  });

  it.each([320, 375])('%ipx에서도 두 그리드가 같은 3열·작은 간격을 유지하고 이름과 동작은 줄바꿈한다', (width) => {
    // jsdom은 실제 픽셀 배치를 계산하지 않으므로 좁은 화면에 적용되는 제약을 검사한다.
    const gap = /html body #root \.pxt-pvp \.pxt-slots, html body #root \.pxt-foes > \.pxt-cands \{[^}]+\}/.exec(mobile)![0];
    expect(gap).toContain('gap: 0.8rem');
    expect(mobile).toContain('.pxt-foes .pxt-cand__panel > .px-ball { --ball: 6.4rem; }');
    expect(mobile).toContain('.pxt-foes .pxt-foe-pick { flex-basis: 100%; padding: 0 0.4rem; }');
    expect(css).toMatch(/\.pxt-foes \.pxt-cand__ops \.px-btn \{[^}]*min-height: var\(--tap\)[^}]*white-space: normal[^}]*overflow-wrap: anywhere/);
    const style = document.createElement('style');
    style.textContent = `${baseGrid}${gap}`;
    document.head.append(style);
    try {
      const { container } = render(createElement('div', { id: 'root', style: { width } }, createElement(PvpDeck, { onOpen: vi.fn() })));
      for (const grid of container.querySelectorAll('.pxt-slots, .pxt-foes > .pxt-cands')) {
        expect(getComputedStyle(grid).gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
        expect(getComputedStyle(grid).gap).toBe('0.8rem');
      }
    } finally { style.remove(); }
  });
});
