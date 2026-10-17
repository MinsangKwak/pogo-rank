// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BossCard } from '../lib/bossBoard';
import { WeekList } from '../screens/Home';

vi.mock('../lib/useBossBoard', () => ({
  useCounterSource: () => ({}),
  countersOf: () => ({ rows: [{ sprite: 464, name: '다이맥스 거대코뿌리', en: 'Rhyperior', types: ['땅', '바위'] }] }),
  useBossBoard: () => ({ board: [] }),
}));
vi.mock('../lib/track', () => ({ track: vi.fn() }));
const card: BossCard = {
  id: 'dialga', kind: 'raid5', battle: 'raid', dex: 483, sprite: 483,
  name: '디아루가', form: '', detailName: '디아루가', types: ['강철', '드래곤'],
  when: '10.14–10.20', short: '10.14–10.20', hours: '10:00–20:00',
  live: true, days: 0, tier: 't5', at: 0,
};
afterEach(cleanup);

describe('홈 주간 보스의 주정보와 추천 위계', () => {
  it('이름, 종류, 상태, 날짜와 시간을 독립된 줄로 보존한다', () => {
    const { container } = render(createElement(WeekList, { board: [card], onOpen: vi.fn() }));
    const boss = container.querySelector('.home__week-boss')!;
    expect(boss.querySelector('b')?.textContent).toBe('디아루가');
    expect(boss.querySelector('.home__week-meta')?.textContent).toContain('5성 레이드');
    expect(boss.querySelector('.home__week-status')?.textContent).toBe('진행 중');
    expect([...boss.querySelectorAll('.home__week-when > span')].map(el => el.textContent)).toEqual(['10.14–10.20', '10:00–20:00']);
  });
  it('추천의 작은 그림과 전체 이름을 유지하고 각각의 상세를 연다', () => {
    const onOpen = vi.fn();
    const { container } = render(createElement(WeekList, { board: [card], onOpen }));
    const rec = container.querySelector<HTMLButtonElement>('.home__week-rec')!;
    expect(rec.querySelector('.px-ball')).toBeNull();
    expect(rec.querySelector('img')?.getAttribute('width')).toBe('32');
    expect(rec.querySelector('.home__week-rec-label')?.textContent).toBe('추천');
    expect(rec.querySelector('.home__week-rec-name')?.textContent).toBe('다이맥스 거대코뿌리');
    fireEvent.click(rec);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ sprite: 464, name: '다이맥스 거대코뿌리' }));
    fireEvent.click(container.querySelector('.home__week-boss')!);
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ sprite: 483, boss: 'raid5' }));
  });
  it('추천 라벨·기간을 분리하고 보스 그림·정보를 큰 카드로 배치한다', () => {
    const css = readFileSync(join(__dirname, '../styles/pixel/home.css'), 'utf8');
    expect(css).toMatch(/\.home__week-rec-label\s*\{[^}]*white-space: nowrap/);
    expect(css).toMatch(/\.home__week-when > span\s*\{[^}]*white-space: nowrap/);
    expect(css).toMatch(/\.home__week-slide\s*\{[^}]*width: clamp\(22rem, calc\(\(100% - 2\.4rem\) \/ 3\), 34rem\)/);
    expect(css).toMatch(/\.home__week-boss\s*\{[^}]*grid-template-columns: minmax\(7rem, 0\.75fr\) minmax\(0, 1\.25fr\)/);
    expect(css).toMatch(/\.home__week-rec\s*\{[^}]*min-height: var\(--tap\)/);
    expect(css).toMatch(/\.home__week-rec\s*\{[^}]*border: var\(--px-stroke\) solid var\(--line\)/);
    expect(css).toMatch(/\.home__week-art\s*\{[^}]*place-items: center/);
    expect(css).not.toContain('margin-left: 8.4rem');
  });
  it('일정 수와 자동 순환 안내는 제목 줄에 두고 하단에는 조작 버튼만 남긴다', () => {
    const source = readFileSync(join(__dirname, '../screens/Home.tsx'), 'utf8');
    const css = readFileSync(join(__dirname, '../styles/pixel/home.css'), 'utf8');
    expect(source).toContain('className="home__week-summary px-caption"');
    expect(source).toContain("{rows.length}개 일정{rows.length > 1 ? ' · 자동 순환' : ''}");
    expect(source.indexOf('className="home__week-controls"')).toBeLessThan(source.indexOf('>전체 일정 ↗</a>'));
    expect(css).toMatch(/\.home__week-summary\s*\{[^}]*margin-left: auto/);
    expect(css).toMatch(/\.home__week-controls\s*\{[^}]*align-items: center/);
  });
});
