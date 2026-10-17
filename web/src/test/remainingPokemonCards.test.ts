// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import BossAcc from '../components/BossAcc';
import SearchPalette from '../components/SearchPalette';
import Recs from '../components/detail/Recs';
import { Evo } from '../components/detail/Evo';
import { useSearchStore } from '../stores/search';

const fixture = vi.hoisted(() => ({
  dex: {
    FORM_LABELS: ['거다이맥스', '메가X', '메가Y'],
    TYPE_KO: { fire: '불꽃', flying: '비행', normal: '노말' },
    SPRITE_IDS: [4, 5, 6, 242, 815, 10034, 10035, 10210], SPRITE_ANIM_IDS: [],
    DEX_DATA: {
      dex: { '4': 4, '5': 5, '6': 6, '242': 242, '815': 815, '10034': 6, '10035': 6, '10210': 815 },
      names: { '4': '파이리', '5': '리자드', '6': '리자몽', '242': '해피너스', '815': '에이스번' },
      en: { '6': 'Charizard' },
      forms: { '4': { types: ['fire'] }, '5': { types: ['fire'] }, '6': { types: ['fire', 'flying'] }, '10034': { types: ['fire'] }, '10035': { types: ['fire', 'flying'] }, '10210': { types: ['fire'] } },
      evo: { '6': [[4], [5], [6]] },
      megas: { '6': [{ sprite: 10034, label: '메가X' }, { sprite: 10035, label: '메가Y', rel: false }] },
    },
  },
  dealers: [
    { sprite: 10210, name: '거다이맥스 에이스번', en: 'Cinderace', types: ['fire'], dmg: 300 },
    { sprite: 6, name: '리자몽', en: 'Charizard', types: ['fire', 'flying'], dmg: 200 },
  ],
  tank: { sprite: 242, name: '해피너스', en: 'Blissey', types: ['normal'], ehp: 900, mult: 1 },
}));

vi.mock('../lib/data', () => ({
  useDex: () => ({ data: fixture.dex }),
  useDexSoft: () => fixture.dex,
  useMax: () => ({ data: { DMAX_DATA: { fire: fixture.dealers }, DMAX_TANK: { fire: [fixture.tank] } } }),
  useSchedule: () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    return { data: { SCHEDULE_MONTHS: { [`${y}-${String(m).padStart(2, '0')}`]: {
      ym: { y, m }, items: [{ cat: 'dmax', t: 'fire', label: 'D-MAX 파이리', s: 1, e: 31 }],
    } } } };
  },
}));
vi.mock('../lib/track', () => ({ track: vi.fn(), trackSearchPick: vi.fn() }));
vi.mock('../lib/weekBosses', () => ({ useWeekBosses: () => ({ label: '이번 주 보스', bosses: [{ name: '리자몽', detailName: '리자몽', sprite: 6, types: ['fire', 'flying'] }] }) }));

const css = (name: string) => readFileSync(join(__dirname, '../styles/pixel', name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const modal = css('modal.css');
const ranks = css('ranks.css');

beforeEach(() => {
  localStorage.clear();
  useSearchStore.setState({ open: false });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true, value: function (this: HTMLDialogElement) { this.open = true; },
  });
});
afterEach(() => { cleanup(); useSearchStore.setState({ open: false }); });

function expectOutsidePanel(card: Element) {
  const ribbon = card.querySelector(':scope > .px-mon-ribbon');
  expect(ribbon).not.toBeNull();
  expect(card.classList.contains('px-skin')).toBe(false);
  expect(card.querySelector('button.px-skin .px-mon-ribbon')).toBeNull();
}

describe('추천·검색·진화 카드의 공통 도감 리본', () => {
  it('보스 파티는 원종 도감 번호, 실제 딜러 순위는 순위 리본을 쓴다', () => {
    const onOpen = vi.fn();
    const { container } = render(createElement(BossAcc, { onOpen, onGoBoss: vi.fn() }));
    const lists = container.querySelectorAll('.rk-recs');
    expect([...lists[0]!.querySelectorAll('.px-mon-ribbon')].map((node) => node.textContent)).toEqual(['#815', '#006', '#242']);
    expect([...lists[1]!.querySelectorAll('.px-mon-ribbon')].map((node) => node.textContent)).toEqual(['01', '02']);
    expect(lists[1]!.querySelector('.px-mon-ribbon')?.getAttribute('data-number-kind')).toBe('rank');
    for (const card of container.querySelectorAll('.rk-rec__wrap')) expectOutsidePanel(card);
    fireEvent.click(lists[0]!.querySelector('button')!);
    expect(onOpen).toHaveBeenCalledWith(fixture.dealers[0]);
  });

  it('상세 추천 후보는 폼 스프라이트를 도감 번호로 바꾸고 임의 순위를 만들지 않는다', () => {
    const onSwitch = vi.fn();
    const unknown = { sprite: 19999, name: '정보 없는 폼', en: '', types: [] };
    const rows = [fixture.dealers[0]!, unknown];
    const { container, getByRole } = render(createElement(Recs, { rows, onSwitch }));
    const cards = container.querySelectorAll('.pxd-rec__wrap');
    expectOutsidePanel(cards[0]!);
    expect(cards[0]!.querySelector('.px-mon-ribbon')?.textContent).toBe('#815');
    expect(cards[0]!.querySelector('.px-mon-ribbon')?.getAttribute('data-number-kind')).toBe('dex');
    expect(cards[1]!.querySelector('.px-mon-ribbon')).toBeNull();
    fireEvent.click(getByRole('button', { name: '거다이맥스 에이스번 상세 보기' }));
    expect(onSwitch).toHaveBeenCalledWith(rows[0]);
  });

  it('검색 결과 카드만 번호를 달고 최근·이번 주의 작은 칩은 그대로 둔다', () => {
    useSearchStore.setState({ open: true });
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(SearchPalette, { onOpen }));
    expect(container.querySelector('.pxd-palette__chip')).not.toBeNull();
    expect(container.querySelector('.pxd-palette__chip .px-mon-ribbon')).toBeNull();
    fireEvent.change(getByRole('combobox'), { target: { value: '리자몽' } });
    const card = container.querySelector('.pxd-palette__result')!;
    expectOutsidePanel(card);
    expect(card.querySelector('.px-mon-ribbon')?.textContent).toBe('#006');
    expect(card.querySelector('.pxd-palette__text')?.textContent).toContain('불꽃 · 비행');
    expect(card.querySelector('.pxd-palette__text')?.textContent).not.toContain('#006');
    fireEvent.keyDown(getByRole('combobox'), { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ sprite: 6, name: '리자몽', view: 'brief' }));
  });

  it('진화 세 단계와 메가 폼은 실제 종 번호, 원래 그림·선택 동작을 유지한다', () => {
    const onSwitch = vi.fn();
    const { container, getByRole } = render(createElement(Evo, { dex: 6, sprite: 6, onSwitch }));
    expect(container.querySelectorAll('.pxd-evo__stage:not(.pxd-evo__stage--mega)')).toHaveLength(3);
    expect([...container.querySelectorAll('.px-mon-ribbon')].map((node) => node.textContent)).toEqual(['#004', '#005', '#006', '#006', '#006']);
    for (const card of container.querySelectorAll('.pxd-evo__card')) expectOutsidePanel(card);
    expect(getByRole('button', { name: '리자몽 상세 보기' }).getAttribute('aria-current')).toBe('true');
    const mega = getByRole('button', { name: '메가X 리자몽 상세 보기' });
    expect(mega.querySelector('img')?.getAttribute('src')).toBe('/sprites/10034.png');
    fireEvent.click(mega);
    expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ sprite: 10034, name: '메가X 리자몽' }));
    expect(getByRole('button', { name: '메가Y 리자몽 상세 보기' }).textContent).toContain('미구현');
  });

  it('리본은 잘리지 않는 바깥판에 놓고 진화는 모바일 한 줄을 유지한다', () => {
    for (const selector of ['.pxd-rec__wrap', '.pxd-palette__result', '.pxd-evo__card', '.pxd-profile-wrap']) {
      const start = modal.indexOf(`${selector} {`);
      const rule = modal.slice(start, modal.indexOf('}', start));
      expect(rule).toContain('position: relative');
      expect(rule).not.toContain('clip-path');
      expect(rule).not.toContain('overflow: hidden');
    }
    expect(ranks).toMatch(/\.rk-rec__wrap \{[^}]*position: relative;[^}]*min-width: 0/);
    expect(modal).toMatch(/\.pxd-evo__stage \{ flex: 1 1 0; min-width: 0; flex-direction: column/);
    expect(modal).toContain('width: min(6.4rem, 100%); height: auto; aspect-ratio: 1');
    expect(modal).toMatch(/\.pxd-evo__card > \.px-mon-ribbon \{[^}]*min-height: 2\.4rem;[^}]*padding: 0 0\.4rem/);
    for (const selector of ['.pxd-palette__hit', '.pxd-rec', '.pxd-evo__mon']) {
      const start = modal.indexOf(`${selector} {`);
      expect(modal.slice(start, modal.indexOf('}', start))).toContain('min-height: var(--tap)');
    }
    const detail = readFileSync(join(__dirname, '../screens/MonDetail.tsx'), 'utf8');
    expect(detail).toMatch(/className="pxd-profile-wrap">\s*<PokemonNumberRibbon dex=\{dexNo \?\? undefined\}/);
  });
});
