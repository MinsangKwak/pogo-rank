// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Eggs, Raids } from '../screens/Gameday';
import { usePrefStore } from '../stores/pref';

const fixtures = vi.hoisted(() => ({
  mons: [{ sprite: 483, name: '디아루가', types: ['steel', 'dragon'], weather: ['눈', '바람'], shiny: true, cp: { min: 2217, max: 2307 }, cpBoost: { min: 2771, max: 2884 } }],
  counters: [
    { sprite: 383, name: '원시 그란돈', en: 'Groudon', types: ['ground'] },
    { sprite: 448, name: '메가 루카리오', en: 'Lucario', types: ['fighting', 'steel'] },
    { sprite: 645, name: '섀도우 영물폼 랜드로스', en: 'Landorus', types: ['ground', 'flying'] },
  ],
  ready: true,
  showOther: false,
}));
vi.mock('../lib/data', () => ({
  useGameday: () => ({ data: { GAMEDAY: { fetched: '2026-10-16', raids: { '5성': fixtures.mons, ...(fixtures.showOther ? {
    '3성': [{ sprite: 127, name: '쁘사이저', types: ['bug'], cp: { min: 1613, max: 1690 } }],
    '메가': [{ sprite: 10040, name: '메가 쁘사이저', types: ['bug', 'flying'] }],
  } : {}) }, eggs: { '2km': [{ sprite: 172, name: '피츄', types: ['electric'], shiny: true, cp: { min: 240, max: 270 } }] } } } }),
  useDex: () => ({ data: {
    TYPE_KO: { steel: '강철', dragon: '드래곤', ground: '땅', fighting: '격투', flying: '비행', bug: '벌레', electric: '전기' },
    FORM_LABELS: ['섀도우', '영물폼', '원시', '메가'],
    // 실제 dex.json처럼 폼 번호만 매핑한다. 일반 종 번호는 dexNoOf의 fallback이 맡는다.
    DEX_DATA: { dex: { '10040': 127 } }, SPRITE_IDS: [483, 383, 448, 645, 127, 10040, 172], SPRITE_ANIM_IDS: [],
  } }),
}));
vi.mock('../lib/useBossBoard', () => ({
  useBossBoard: () => ({ board: [{ kind: 'raid5', detailName: '디아루가', when: '10.14 (수) — 10.20 (화)' }] }),
  useCounterSource: () => ({}),
  countersOf: () => fixtures.ready ? { types: ['ground', 'fighting'], rows: fixtures.counters } : null,
}));
vi.mock('../components/Slots', () => ({ Slot: ({ children }: { children: ReactNode }) => children }));
const css = readFileSync(join(__dirname, '../styles/pixel/news.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
afterEach(cleanup);
beforeEach(() => {
  fixtures.ready = true;
  fixtures.showOther = false;
  usePrefStore.setState({ cols: { raids: 'grid' } });
});

describe('모바일 레이드 보스 정보와 리본', () => {
  it('도감 번호 리본을 판 밖에 두고 실제 보스 정보와 CP를 모두 남긴다', () => {
    const { container } = render(createElement(Raids, { onOpen: vi.fn() }));
    const frame = container.querySelector('.nw-boss-frame')!;
    const ribbon = frame.querySelector('.nw-boss__dex')!;
    expect(ribbon.parentElement).toBe(frame);
    expect(ribbon.getAttribute('data-number-kind')).toBe('dex');
    expect(ribbon.textContent).toBe('#483');
    expect(frame.classList.contains('px-skin')).toBe(false);
    const boss = frame.querySelector('.nw-boss')!;
    expect(boss.classList.contains('px-skin')).toBe(true);
    for (const text of ['디아루가', '강철 · 드래곤', '10.14 (수) — 10.20 (화)', '눈 · 바람 부스트', '이로치 가능', '2217–2307', '2771–2884', 'Lv.20', 'Lv.25']) expect(boss.textContent).toContain(text);
    expect(boss.textContent).not.toContain('개체값 100% 기준 범위');
  });

  it('추천 순위 1·2·3을 카드 왼쪽 위 공통 리본으로 분리하고 각 상세를 연다', () => {
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(Raids, { onOpen }));
    const items = [...container.querySelectorAll('.nw-counter-item')];
    expect(items).toHaveLength(3);
    items.forEach((item, index) => {
      const ribbon = item.querySelector('.nw-counter__rank')!;
      expect(ribbon.parentElement).toBe(item);
      expect(ribbon.getAttribute('data-number-kind')).toBe('rank');
      expect(ribbon.getAttribute('aria-label')).toBe(`${index + 1}위`);
      expect(ribbon.textContent).toBe(`0${index + 1}`);
      const button = within(item as HTMLElement).getByRole('button');
      expect(button.contains(ribbon)).toBe(false);
      expect(button.textContent).toContain(fixtures.counters[index]!.name.split(' ').at(-1));
      fireEvent.click(button);
      expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ sprite: fixtures.counters[index]!.sprite, name: fixtures.counters[index]!.name }));
    });
    fireEvent.click(getByRole('button', { name: '보스 상세 보기' }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ sprite: 483, name: '디아루가' }));
    expect(within(container.querySelector('.nw-boss__actions')! as HTMLElement).getByRole('link', { name: '솔플 계산기' }).getAttribute('href')).toBe('/pve/solo');
  });

  it('카드·목록을 반복 전환해도 5성 보스가 중복되지 않는다', () => {
    const { container, getByRole } = render(createElement(Raids, { onOpen: vi.fn() }));
    for (const mode of ['목록', '카드', '목록']) {
      fireEvent.click(getByRole('button', { name: new RegExp(mode) }));
      expect(container.querySelectorAll('.nw-boss-frame')).toHaveLength(1);
      expect(container.querySelector('.nw-boss-grid')?.getAttribute('data-view')).toBe(mode === '카드' ? 'grid' : 'list');
      expect(container.querySelectorAll('.nw-row')).toHaveLength(0);
      expect(container.querySelectorAll('.nw-counter-item')).toHaveLength(3);
    }
  });

  it('메가·일반 보스 목록도 실제 도감 번호 리본과 상세 동작을 유지한다', () => {
    fixtures.showOther = true;
    usePrefStore.setState({ cols: { raids: 'list' } });
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(Raids, { onOpen }));
    const item = container.querySelector('.nw-row-item')!;
    const ribbon = item.querySelector('.nw-row__dex')!;
    expect(ribbon.parentElement).toBe(item);
    expect(ribbon.textContent).toBe('#127');
    expect(ribbon.getAttribute('data-number-kind')).toBe('dex');
    expect(item.textContent).toContain('벌레');
    expect(item.textContent).toContain('1613–1690');
    expect([...container.querySelectorAll('.nw-row__dex')].map((node) => node.textContent)).toEqual(['#127', '#127']);
    expect(getByRole('button', { name: '메가 쁘사이저 상세 보기' }).querySelector('img')?.getAttribute('src')).toBe('/sprites/10040.png');
    fireEvent.click(getByRole('button', { name: '쁘사이저 상세 보기' }));
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ sprite: 127, name: '쁘사이저' }));
  });

  it('일반 종 매핑이 없는 알 목록도 도감 리본·부화 정보·상세 동작을 유지한다', () => {
    usePrefStore.setState({ cols: { eggs: 'list' } });
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(Eggs, { onOpen }));
    const item = container.querySelector('.nw-row-item')!;
    expect(item.querySelector('.nw-row__dex')?.textContent).toBe('#172');
    for (const text of ['피츄', '전기', '부화 CP 240–270', '이로치']) expect(item.textContent).toContain(text);
    fireEvent.click(getByRole('button', { name: '피츄 상세 보기' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ sprite: 172, name: '피츄' }));
  });

  it('추천 데이터가 아직 없어도 보스의 CP와 상세 동작은 남긴다', () => {
    fixtures.ready = false;
    const onOpen = vi.fn();
    const { container, getByRole } = render(createElement(Raids, { onOpen }));
    expect(container.querySelector('.nw-boss__counters')).toBeNull();
    expect(container.querySelector('.nw-boss__metrics')?.textContent).toContain('2217–2307');
    fireEvent.click(getByRole('button', { name: '보스 상세 보기' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toMatch(/NaN|undefined|Infinity|\[object Object\]/);
  });

  it('PC 격자는 가용 폭에 따라 채우고 넓은 단일 판은 추천을 옆에 배치한다', () => {
    const { container } = render(createElement(Raids, { onOpen: vi.fn() }));
    expect(container.querySelector('.nw-boss-grid > .nw-boss-frame')).not.toBeNull();
    expect(css).toMatch(/\.nw-boss-grid \{[^}]*repeat\(auto-fit, minmax\(min\(100%, 48rem\), 1fr\)\)/);
    const desktop = css.slice(css.indexOf('@media (min-width: 700px)'), css.lastIndexOf('@media (max-width: 699px)'));
    expect(desktop).toMatch(/\.nw-boss__main, html body #root \.nw-boss__side \{ display: contents/);
    expect(desktop).toMatch(/\.nw-counters \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(desktop).toContain('@container (min-width: 84rem)');
    expect(desktop).toMatch(/\.nw-boss__counters \{[^}]*grid-column: 3; grid-row: 1 \/ 5/);
  });

  it('모바일은 이미지가 이름 옆, CP 두 칸, 추천 세 칸으로 배치되고 터치 영역을 유지한다', () => {
    const mobile = css.slice(css.lastIndexOf('@media (max-width: 699px)'));
    expect(mobile).toContain('@media (max-width: 359px)');
    expect(mobile).toMatch(/\.nw-boss \{[^}]*grid-template-columns: minmax\(0, 1fr\) 8rem/);
    expect(mobile).toMatch(/\.nw-boss__art \{[^}]*grid-column: 2;[^}]*grid-row: 2;[^}]*--ball: 8rem/);
    expect(mobile).toMatch(/\.nw-boss__metrics \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(mobile).toMatch(/\.nw-counters \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(mobile).toMatch(/\.nw-boss__actions > \.px-btn \{[^}]*min-height: var\(--tap\)/);
    expect(css).toMatch(/\.nw-counter \{[^}]*min-height: var\(--tap\)/);
    expect(css).toMatch(/\.nw-counter__name \{[^}]*overflow-wrap: anywhere/);
  });
});
