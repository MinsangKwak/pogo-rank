// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CandRow, PickedCard, SlotCard } from '../components/ToolBits';
import { WeekList } from '../screens/Home';
import DmaxDeck from '../screens/DmaxDeck';
import type { BossCard } from '../lib/bossBoard';

const fixture = vi.hoisted(() => {
  const dealer = (sprite: number, name: string) => ({ sprite, name, en: '', types: ['fire'], fast: '불꽃세례', charged: 'fire', dmg: 234, bulk: 123, score: 100 });
  const dealers = [dealer(6, '리자몽'), dealer(38, '나인테일'), dealer(59, '윈디')];
  const tanks = [{ ...dealer(9, '거북왕'), ehp: 28500, hp: 200, def: 180 }];
  const dex = { TYPE_KO: { fire: '불꽃', water: '물' }, DEX_DATA: { dex: { '10034': 6 }, names: {}, forms: {}, chart: {} } };
  return { dex, max: { DMAX_DATA: { overall: dealers, water: dealers }, DMAX_TANK: { overall: tanks, water: tanks }, DMAX_TIER: { overall: dealers }, MAX_POOL: {} } };
});
vi.mock('../lib/data', () => ({
  useDexSoft: () => fixture.dex,
  useDex: () => ({ data: fixture.dex }),
  useMax: () => ({ data: fixture.max }),
  usePve: () => ({ data: { PVE_DATA: {} } }),
  usePvp: () => ({ data: { PVP_DATA: {} } }),
  useSchedule: () => ({ data: { SCHEDULE_MONTHS: {} } }),
}));
vi.mock('../lib/useBossBoard', () => ({
  useCounterSource: () => ({}),
  countersOf: () => ({ rows: [{ sprite: 464, name: '거대코뿌리', en: 'Rhyperior', types: ['ground', 'rock'] }] }),
}));
vi.mock('../lib/useFavs', () => ({ useFavs: () => ({ favs: [], has: () => false, toggle: vi.fn() }) }));
vi.mock('../lib/schedule', () => ({ weekBoss: () => null }));
vi.mock('../lib/useSearch', () => ({ useSearch: () => '' }));
vi.mock('../lib/track', () => ({ track: vi.fn() }));

beforeEach(() => { history.replaceState(null, '', '/dmax/deck'); });
afterEach(cleanup);

const slotProps = { index: 1, role: '딜러', sprite: 10034, name: '메가리자몽X', types: '불꽃 · 드래곤', moves: '불꽃세례 · 불꽃 맥스', metric: 'MAX SCORE', value: '234', note: '맥스 피해 234 · 내구 123' };

describe('홈·도구 포켓몬 번호 리본', () => {
  it('주간 보스는 일정 순서가 아닌 실제 도감 번호를 표시한다', () => {
    const boss: BossCard = { id: 'dialga', kind: 'raid5', battle: 'raid', dex: 483, sprite: 483, name: '디아루가', form: '', detailName: '디아루가', types: ['steel', 'dragon'], when: '10.14–10.20', short: '10.14–10.20', hours: '', live: true, days: 0, tier: 't5', at: 0 };
    const { container } = render(createElement(WeekList, { board: [boss], onOpen: vi.fn() }));
    const ribbon = container.querySelector('.home__week-row > .px-mon-ribbon')!;
    expect(ribbon.textContent).toBe('#483');
    expect(ribbon.getAttribute('data-number-kind')).toBe('dex');
    expect(container.querySelector('.home__week-rec .px-mon-ribbon')).toBeNull();
    expect(container.querySelector('.home__week-panel .px-mon-ribbon')).toBeNull();
  });

  it('후보의 폼 번호를 원종 번호로 바꾸고 출전 칸 라벨을 따로 둔다', () => {
    const onOpen = vi.fn();
    const { container, getByRole, getByText } = render(createElement(CandRow, { sprite: 10034, name: '메가리자몽X', no: '02', lines: ['불꽃 · 드래곤', '불꽃세례 · 블라스트번'], onOpen }));
    expect(container.querySelector('.px-mon-ribbon')?.textContent).toBe('#006');
    expect(getByText('SLOT 02')).toBeTruthy();
    expect(getByText('불꽃세례 · 블라스트번')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: '메가리자몽X 상세 보기' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('개체값 검색은 폼 스프라이트 번호를 도감 번호처럼 중복 표시하지 않는다', () => {
    const source = readFileSync(join(__dirname, '../screens/IvRankPage.tsx'), 'utf8');
    expect(source).not.toContain("String(hit.sprite).padStart");
    expect(source).toContain("lines={[hit.types.map(ko).join(' · ')]}");
  });

  it('빈 칸이나 모르는 폼에 가짜 순위·도감 번호를 만들지 않는다', () => {
    const { container, rerender } = render(createElement(CandRow, { sprite: null, name: '비어 있어요', no: '03' }));
    expect(container.querySelector('.px-mon-ribbon')).toBeNull();
    expect(container.textContent).toContain('SLOT 03');
    rerender(createElement(CandRow, { sprite: 19999, name: '알 수 없는 폼' }));
    expect(container.querySelector('.px-mon-ribbon')).toBeNull();
  });

  it('선택 카드의 해제 동작과 번호를 보존한다', () => {
    const onClear = vi.fn();
    const { container, getByRole } = render(createElement(PickedCard, { sprite: 25, name: '피카츄', lines: ['전기'], onClear }));
    expect(container.querySelector('.pxt-boss > .px-mon-ribbon')?.textContent).toBe('#025');
    fireEvent.click(getByRole('button', { name: '선택 해제' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('팀 슬롯은 실제 도감 리본과 별개의 SLOT 라벨을 갖는다', () => {
    const { container, getByText } = render(createElement(SlotCard, slotProps));
    expect(container.querySelector('.pxt-slot > .px-mon-ribbon')?.textContent).toBe('#006');
    expect(getByText('SLOT 02')).toBeTruthy();
    expect(container.querySelector('[data-number-kind="rank"]')).toBeNull();
  });
});

describe('D-MAX 세 칸을 한눈에 보는 모바일 구성', () => {
  it('압축 카드도 상세 열기·교체와 타입·기술·판단 근거를 보존한다', () => {
    const onOpen = vi.fn(); const onSwap = vi.fn();
    const { container, getByRole } = render(createElement(SlotCard, { ...slotProps, compact: true, onOpen, onSwap }));
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain(slotProps.types);
    expect(details.textContent).toContain(slotProps.moves);
    expect(details.textContent).toContain(slotProps.note);
    expect(container.querySelector('.pxt-slot__body')?.textContent).not.toContain(slotProps.moves);
    fireEvent.click(container.querySelector('summary')!);
    expect(details.open).toBe(true);
    fireEvent.click(getByRole('button', { name: '메가리자몽X 상세 보기' }));
    fireEvent.click(getByRole('button', { name: '메가리자몽X 교체' }));
    expect(onOpen).toHaveBeenCalledOnce(); expect(onSwap).toHaveBeenCalledOnce();
  });

  it('보스 타입은 현재 값을 남기고 접히며, 선택 후 다시 닫힌다', () => {
    const { container, getByRole } = render(createElement(DmaxDeck, { onOpen: vi.fn() }));
    expect(container.querySelectorAll('.pxt-slots > .pxt-slot--compact')).toHaveLength(3);
    const toggle = getByRole('button', { name: /보스 타입 전체 변경/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('dmax-boss-types');
    expect(container.querySelector<HTMLElement>('#dmax-boss-types')?.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(getByRole('button', { name: '물' }));
    expect(getByRole('button', { name: /보스 타입 물 변경/ }).getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector<HTMLElement>('#dmax-boss-types')?.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it('검색 라벨과 입력의 최소 너비를 풀어 좁은 보스 판 안으로 줄어들게 한다', () => {
    const css = readFileSync(join(__dirname, '../styles/pixel/tools.css'), 'utf8');
    const row = /html body #root \.pxt-target__row \{[^}]+\}/.exec(css)![0];
    const label = /html body #root \.pxt-target__search \{[^}]+\}/.exec(css)![0];
    const input = /html body #root \.pxt-target__search input \{[^}]+\}/.exec(css)![0];
    expect(row).toContain('min-width: 0');
    expect(label).toContain('flex: 1 1 28rem');
    expect(label).toContain('min-width: 0');
    expect(label).toContain('max-width: 100%');
    expect(input).toContain('min-width: 0');
    const style = document.createElement('style');
    style.textContent = `${row}${label}${input}`;
    document.head.append(style);
    try {
      const { container } = render(createElement('div', { id: 'root' }, createElement(DmaxDeck, { onOpen: vi.fn() })));
      const search = container.querySelector('.pxt-target__search')!;
      expect(getComputedStyle(search).minWidth).toBe('0px');
      expect(getComputedStyle(search).maxWidth).toBe('100%');
      expect(getComputedStyle(search.querySelector('input')!).minWidth).toBe('0px');
    } finally { style.remove(); }
  });

  it('모바일 3열은 D-MAX에 한정하고 기존 후보 메타 줄바꿈을 유지한다', () => {
    const css = readFileSync(join(__dirname, '../styles/pixel/tools.css'), 'utf8');
    expect(css).toMatch(/\.pxt-dmax \.pxt-slots \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.pxt-cand__panel \{ flex-wrap: wrap/);
    expect(css).toMatch(/\.pxt-cand__ops \{ flex-basis: 100%/);
    expect(css).toMatch(/\.pxt-slot__details > summary \{[^}]*min-height: var\(--tap\)/);
    expect(css).not.toMatch(/\.pxt-slot--compact[^{}]*\{[^}]*display: none/);
  });
});
