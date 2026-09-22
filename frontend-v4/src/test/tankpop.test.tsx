// ─────────────────────────────────────────────────────────────────────────────
// test/tankpop.test.tsx — 11월 탱커 팝업이 실데이터로 빈 칸 없이 서는가 (§1)
//
// 도감번호만 적어 두고 이름·타입·그림을 데이터에서 읽으니, 번호 하나가 틀리면 대시(—)가 뜬다.
// 그 대시가 곧 사고다 — 실물 데이터로 본문을 그려 대시·NaN·undefined 가 없는지 본다.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { DexBundle, MaxBundle } from '../types/data';
import { NOV_TANK, TankPopupBody, autoOpenHere, ehpRank, pickFor, recordDismiss, shouldAutoOpen, todayKey } from '../components/TankPopup';
import { track } from '../lib/track';

vi.mock('../lib/track', () => ({ track: vi.fn() }));

// CI 는 `npm test` 를 `npm run data` 보다 **먼저** 돌려 public/data 가 없다 (dev 배포 #299 가 그래서 섰다).
// 꾸러미가 없으면 데이터 묶음은 건너뛴다 — `npm run build` 안의 vitest 가 데이터를 갖고 한 번 더 돈다.
// 읽기는 beforeAll 안에서 — skipIf 여도 모듈 몸통은 실행되므로 위에서 읽으면 그 자리에서 터진다.
const DATA = resolve(__dirname, '../../public/data');
const HAVE = existsSync(resolve(DATA, 'dex.json')) && existsSync(resolve(DATA, 'max.json'));
const load = <T,>(name: string): T => JSON.parse(readFileSync(resolve(DATA, name), 'utf8')) as T;
let dex: DexBundle;
let max: MaxBundle;

describe('자동으로 여는 조건', () => {
  const today = '2026-11-01';
  it.each([
    ['처음 온 사람', null, null, true],
    ['오늘 숨김', today, null, false],
    ['어제 숨김 — 오늘은 다시', '2026-10-31', null, true],
    ['이 세션에서 이미 봤다', null, '1', false],
  ] as const)('%s', (_label, hide, seen, want) => {
    expect(shouldAutoOpen(hide, seen, today)).toBe(want);
  });
  it('오늘 열쇠는 YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 10, 5))).toBe('2026-11-05');
  });
  it('홈 라우트에서만 연다 — #/mon/… 뒤에 깔린 홈에서는 안 연다', () => {
    expect(autoOpenHere('home', null, null, today)).toBe(true);
    expect(autoOpenHere('mon', null, null, today)).toBe(false);
  });
  it('닫음 기록은 통계를 한 건만 찍는다 — 하루 숨김도 hide 하나', () => {
    vi.mocked(track).mockClear();
    recordDismiss('hide', today);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('home_popup', { id: 'novtank', action: 'hide' });
    expect(localStorage.getItem('pogo_novtank_hide')).toBe(today);
    expect(sessionStorage.getItem('pogo_novtank_seen')).toBe('1');
  });
});

describe.skipIf(!HAVE)('본문 — 실데이터로 빈 칸 없이 (public/data 가 있을 때)', () => {
  beforeAll(() => { dex = load<DexBundle>('dex.json'); max = load<MaxBundle>('max.json'); });
  it('적어 둔 도감번호가 전부 도감에 있다', () => {
    const ids = new Set<number>();
    for (const boss of NOV_TANK.bosses) { ids.add(boss.dex); boss.picks.forEach((p) => ids.add(p.dex)); if (boss.aside) ids.add(boss.aside.dex); }
    NOV_TANK.order.rows.forEach((r) => ids.add(r.dex)); ids.add(NOV_TANK.order.owned.dex);
    NOV_TANK.overall.rows.forEach((r) => ids.add(r.dex));
    for (const id of ids) {
      expect(dex.DEX_DATA.names[String(id)], `names[${id}]`).toBeTruthy();
      expect(dex.DEX_DATA.forms[String(id)]?.types.length, `forms[${id}].types`).toBeGreaterThan(0);
      expect(dex.SPRITE_IDS.includes(id), `sprite ${id}`).toBe(true);
    }
  });
  it('그려진 이름 칸에 대시가 없고, 글자에 NaN·undefined 가 없다', () => {
    const { container } = render(<TankPopupBody dex={dex} max={max} onOpen={() => {}} onClose={() => {}} onHide={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/NaN|undefined|null|\[object/);
    // 이름 칸만 본다 — 안내문의 문장 부호 '—' 는 대시가 아니다. 타입 알약의 <b> 는 이름이 아니라 뺀다
    const names = [...container.querySelectorAll('.tankpop__mon > span > b')].map((b) => b.textContent);
    expect(names.length).toBe(3 + 3 + 5 + 10);
    expect(names.filter((n) => n === '—')).toEqual([]);
    // 보스 이름은 카드 머리에 — 둘 다 실명이어야 한다
    expect(text).toContain('디아루가');
    expect(text).toContain('펄기아');
  });
  it('상세로 넘길 때 폼을 잃지 않는다 — 거다이맥스는 제 스프라이트, 다이맥스는 종 번호', () => {
    const snorlax = pickFor(dex, max, 143, '거다이맥스');
    expect(snorlax.sprite).toBe(10206);
    expect(snorlax.name).toBe('거다이맥스 잠만보');
    expect(snorlax.en).toBe('Snorlax');
    expect(snorlax.types?.length).toBeGreaterThan(0);
    const blissey = pickFor(dex, max, 242, '다이맥스');
    expect(blissey.sprite).toBe(242);
    expect(blissey.name).toBe('다이맥스 해피너스');
  });
  it('우리 표의 EHP 순위가 붙는다 — 표에 없는 종은 칸을 세우지 않는다', () => {
    expect(ehpRank(max, 'Blissey')?.rank).toBe(1);
    expect(ehpRank(max, 'Excadrill')).toBeNull();
    expect(ehpRank(max, undefined)).toBeNull();
  });
});
