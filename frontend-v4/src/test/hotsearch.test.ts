// ─────────────────────────────────────────────────────────────────────────────
// test/hotsearch.test.ts — 인기 검색어 줄이 어떤 값에도 새지 않는다
//
// 이 표는 **다른 표와 달리 빌드가 모든 칸을 못 채운다.** GA 에서 온 이름이라
// 우리 이름표에 없으면 sprite 가 없고, 집계 전이면 asOf 가 null 이다.
// 화면 훑기(check_screens.mjs)도 이 구역을 못 본다 — 미리보기에는 표가 비어 있어
// 구역 자체가 안 그려지기 때문이다. 그래서 그물을 여기에 둔다 (CLAUDE.md §1).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { num } from '../lib/cell';
import { asOfLabel, barWidth } from '../components/HotSearch';

const LEAK = /NaN|undefined|null|Infinity|\[object Object\]/;

describe('인기 검색어 — 기준 시각', () => {
  it('낮 집계는 12시로 읽힌다', () => {
    expect(asOfLabel('2026-09-20T12:00:00+09:00')).toBe('9월 20일 12시');
  });

  // 자정 집계를 '0시' 로 적으면 그 전날 마감인데 오늘 새벽처럼 읽힌다
  it('자정 집계는 0시가 아니라 24시다', () => {
    expect(asOfLabel('2026-09-21T00:00:00+09:00')).toBe('9월 21일 24시');
  });

  // 보는 사람의 시간대로 옮기면 한국 기준 12시가 11시나 13시로 어긋난다
  it('시간대를 옮기지 않는다 — 글자를 그대로 읽는다', () => {
    expect(asOfLabel('2026-09-20T12:00:00+09:00')).not.toContain('11시');
    expect(asOfLabel('2026-09-20T12:00:00+09:00')).not.toContain('13시');
  });

  it('모양이 깨진 값에는 빈 글자를 준다 — 새지 않는다', () => {
    for (const bad of ['', 'nope', '2026-09', 'null']) {
      expect(asOfLabel(bad)).toBe('');
    }
  });
});

describe('인기 검색어 — 막대 너비', () => {
  it('1위는 100%, 절반은 50%', () => {
    expect(barWidth(412, 412)).toBe(100);
    expect(barWidth(206, 412)).toBe(50);
  });

  // 꼴찌가 1회여도 막대가 아예 사라지면 줄이 비어 보인다
  it('아주 작아도 최소 굵기를 남긴다', () => {
    expect(barWidth(1, 9999)).toBeGreaterThanOrEqual(6);
  });

  it('1위가 0이거나 값이 이상해도 0~100 을 벗어나지 않는다', () => {
    for (const [count, top] of [[5, 0], [0, 0], [-3, 10], [999, 10]] as const) {
      const width = barWidth(count, top);
      expect(Number.isFinite(width)).toBe(true);
      expect(width).toBeGreaterThanOrEqual(0);
      expect(width).toBeLessThanOrEqual(100);
    }
  });
});

describe('인기 검색어 — 횟수 칸', () => {
  it('관문을 지난 값에는 새는 글자가 없다', () => {
    for (const value of [131, 0, undefined, null, NaN, Infinity, '412']) {
      expect(LEAK.test(`${num(value)}회`)).toBe(false);
    }
  });
});

// 미리보기 샘플이 운영으로 새면 가짜 수를 진짜처럼 보여 주는 사고다.
// 집계 스크립트는 BUILD_CHANNEL=dev 일 때만 그 길로 가고, 운영 워크플로는 그 값을 주지 않는다.
describe('인기 검색어 — 미리보기 샘플이 운영으로 새지 않는다', () => {
  // __dirname 을 쓴다 — import.meta.url 은 vite 가 /@fs 를 붙여 파일을 못 연다 (datasweep.test.ts 와 같은 방식)
  const yaml = readFileSync(resolve(__dirname, '../../../.github/workflows/deploy.yml'), 'utf-8');

  it('운영 워크플로의 집계 단계에 BUILD_CHANNEL 이 없다', () => {
    const step = yaml.slice(yaml.indexOf('name: 인기 검색어 집계'));
    // 다음 단계가 시작되기 전까지가 이 단계의 몫이다
    const body = step.slice(0, step.indexOf('\n      - name:', 1));
    expect(body).toContain('GA_SA_JSON');
    expect(body).not.toContain('BUILD_CHANNEL');
  });

  it('작업 수준 env 가 없어 다른 단계의 채널이 번지지 않는다', () => {
    const job = yaml.slice(yaml.indexOf('jobs:'), yaml.indexOf('steps:'));
    expect(job).not.toContain('env:');
  });
});

// 이 브라우저에 세는 표 — 저장소가 막혀 있어도 화면이 멀쩡해야 한다
describe('인기 검색어 — 이 브라우저에 센 것', () => {
  it('저장된 것이 없으면 빈 목록이다', async () => {
    const { readLocalPicks, LOCAL_PICK_KEY } = await import('../lib/track');
    localStorage.removeItem(LOCAL_PICK_KEY);
    expect(readLocalPicks()).toEqual([]);
  });

  it('많이 고른 것이 위로 온다', async () => {
    const { readLocalPicks, LOCAL_PICK_KEY } = await import('../lib/track');
    localStorage.setItem(LOCAL_PICK_KEY, JSON.stringify([
      { name: '가디안', sprite: 282, count: 2 },
      { name: '뮤츠', sprite: 150, count: 5 },
    ]));
    expect(readLocalPicks().map((one) => one.name)).toEqual(['뮤츠', '가디안']);
  });

  // 남의 값이나 예전 판이 남긴 모양이 들어와도 줄을 세우면 안 된다 (§1)
  it('모양이 깨진 값은 걸러 낸다', async () => {
    const { readLocalPicks, LOCAL_PICK_KEY } = await import('../lib/track');
    localStorage.setItem(LOCAL_PICK_KEY, JSON.stringify([
      { name: '뮤츠', count: 3 }, null, { name: 7, count: 1 }, { name: '가디안', count: NaN }, '뮤',
    ]));
    expect(readLocalPicks()).toEqual([{ name: '뮤츠', count: 3 }]);
  });

  it('저장소가 깨져 있어도 터지지 않는다', async () => {
    const { readLocalPicks, LOCAL_PICK_KEY } = await import('../lib/track');
    localStorage.setItem(LOCAL_PICK_KEY, '{이건 JSON 이 아니다');
    expect(readLocalPicks()).toEqual([]);
  });
});
