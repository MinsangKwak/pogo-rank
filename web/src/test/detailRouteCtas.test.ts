// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import FormGuide, { FormStats } from '../components/detail/FormGuide';
import VsCard from '../components/detail/VsCard';
import { go } from '../lib/nav';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../lib/data', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (name: string) => ({ data: JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8')) });
  const dex = read('dex'), max = read('max'), pvp = read('pvp'), pve = read('pve'), usage = read('usage');
  return { useDex: () => dex, useMax: () => max, usePvp: () => pvp, usePve: () => pve, useUsage: () => usage };
});
vi.mock('../lib/nav', () => ({ go: vi.fn() }));
vi.mock('../lib/track', () => ({ track: vi.fn() }));
vi.mock('../lib/weekBosses', () => ({ useMaxSlidesSoft: () => [] }));
vi.mock('../lib/useBossBoard', () => ({ useBossBoard: () => ({ board: [] }), useCounterSource: () => ({}), countersOf: () => null }));
vi.mock('../lib/bossBoard', () => ({
  cardFor: () => ({ battle: 'raid', kind: 'raid3', tier: 3, detailName: '리자몽', name: '리자몽', dex: 6, types: ['fire'], live: true }),
  cardDday: () => '진행 중', cardWhen: () => '10.16–10.20',
}));

const mon = { sprite: 6, name: '리자몽', en: 'Charizard', types: ['fire', 'flying'] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('상세 본문의 모바일 이동 단추와 정보 보존', () => {
  it('솔플 계산기 이동만 표시하고 보스 기간·안내와 데스크톱 주소를 보존한다', () => {
    const onLeave = vi.fn();
    const { getByRole, container } = render(createElement(VsCard, { mon, dexNo: 6, onSwitch: vi.fn(), onLeave }));
    const button = getByRole('button', { name: '솔플 계산기에서 자세히' });
    expect(button.parentElement?.classList.contains('pxd-route-cta')).toBe(true);
    expect(container.textContent).toContain('10.16–10.20');
    fireEvent.click(button);
    expect(onLeave).toHaveBeenCalledOnce();
    expect(go).toHaveBeenCalledWith(`/pve/solo?boss=${encodeURIComponent('리자몽')}&tier=3`);
  });

  it('맥스 폼 이동 줄은 모바일에 같은 정보만 남기고 로컬 펼치기와 폼 전환은 유지한다', () => {
    const onSwitch = vi.fn();
    const { container, getByRole } = render(createElement(FormGuide, { mon, dexNo: 6, baseLabel: '일반', onSwitch }));
    const routes = [...container.querySelectorAll('button.pxd-route-cta')];
    const summaries = [...container.querySelectorAll('.pxd-route-summary')];
    expect(routes.length).toBeGreaterThan(0);
    expect(summaries).toHaveLength(routes.length);
    summaries.forEach((summary, index) => {
      expect(summary.textContent).toBe(routes[index]!.textContent!.replace('D-MAX 더보기 ', '').trim());
      expect(summary.querySelector('.pxd-form__go')).toBeNull();
      expect(summary.querySelector('button')).toBeNull();
    });
    expect(container.querySelector('details > summary')?.classList.contains('pxd-route-cta')).toBe(false);
    const mega = getByRole('button', { name: '메가X 폼으로 보기' });
    expect(mega.closest('.pxd-route-cta')).toBeNull();
    fireEvent.click(mega);
    expect(onSwitch).toHaveBeenCalledWith(expect.objectContaining({ name: '메가X 리자몽' }));
    fireEvent.click(routes[0]!);
    expect(go).toHaveBeenCalledWith('/dmax');
  });

  it('현재 D-MAX 화면에서 로컬 배틀 정보를 여는 맥스 폼 단추는 숨기지 않는다', () => {
    const onMaxHere = vi.fn();
    const { container, getAllByRole } = render(createElement(FormGuide, { mon, dexNo: 6, baseLabel: '일반', onSwitch: vi.fn(), onMaxHere }));
    expect(container.querySelector('.pxd-route-summary')).toBeNull();
    const button = getAllByRole('button', { name: /D-MAX 더보기/ })[0]!;
    expect(button.classList.contains('pxd-route-cta')).toBe(false);
    fireEvent.click(button);
    expect(onMaxHere).toHaveBeenCalledOnce();
    expect(go).not.toHaveBeenCalled();
  });

  it('PvP 순위 이동 줄의 리그·점수·순위를 모바일 비상호작용 줄에도 남긴다', () => {
    const ranked = JSON.parse(readFileSync('public/data/pvp.json', 'utf8')).PVP_DATA.great[0];
    const { container } = render(createElement(FormStats, { mon: ranked, dexNo: null, baseLabel: '일반' }));
    const buttons = [...container.querySelectorAll('button.pxd-rank.pxd-route-cta')];
    const summaries = [...container.querySelectorAll('.pxd-rank.pxd-route-summary')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(summaries.map((node) => node.textContent)).toEqual(buttons.map((node) => node.textContent));
    fireEvent.click(buttons[0]!);
    expect(go).toHaveBeenCalledWith('/pvp');
  });

  it('추천·일정·개체값 이동은 동작 줄을 접고 즐겨찾기 소식은 읽을 수 있게 남긴다', () => {
    const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
    const form = source('components/detail/FormGuide.tsx');
    expect(form).toContain('<Actions routeOnly>{go}</Actions>');
    expect(form).toMatch(/<Actions routeOnly><button[^\n]+go\('\/schedule'\)/);
    expect(form).toMatch(/<Actions routeOnly>\s*<button[^\n]+board.toMax\(/);
    expect(source('components/detail/IvRank.tsx')).toContain('<Actions routeOnly>');
    const detail = source('screens/MonDetail.tsx');
    expect(detail).toContain('pxd-favnews pxd-route-cta');
    expect(detail).toContain('className="px-caption pxd-favnews pxd-route-summary">{favNewsContent}');
  });
});
