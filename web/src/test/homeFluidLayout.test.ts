// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const css = readFileSync(join(__dirname, '../styles/pixel/home.css'), 'utf8');
const rule = (name: string) => new RegExp(`html body #root \\.${name} \\{([^}]+)\\}`).exec(css)![1]!;

describe('홈 유동형 배치', () => {
  it('320px 브리핑의 페이지 표시와 이동 단추는 다음 줄로 흐르고 터치 크기를 유지한다', () => {
    expect(rule('home__brief-pager')).toContain('flex-wrap: wrap');
    expect(rule('home__brief-pager')).toContain('min-width: 0');
    expect(rule('home__brief-nav')).toContain('flex: none');
    expect(rule('home__brief-nav')).toContain('margin-left: auto');
    const label = /\.home__brief-pager > \[aria-hidden\] \{([^}]+)\}/.exec(css)![1]!;
    expect(label).toContain('max-width: 100%');
    expect(label).toContain('white-space: pre-wrap');
    const buttons = /\.home__brief-nav > button \{([^}]+)\}/.exec(css)![1]!;
    expect(buttons).toContain('min-width: var(--tap)');
    expect(buttons).toContain('min-height: var(--tap)');
  });
  it('팀 판은 여섯 보스의 높이를 따라 늘어나지 않는다', () => {
    expect(rule('home__week-row2')).toContain('align-items: start');
    expect(rule('home__team')).toContain('align-self: start');
    expect(rule('home__week-row2')).toContain('clamp(28rem, 24vw, 36rem)');
  });
  it('주간 보스는 가용 폭에 따라 열을 늘리고 좁으면 한 열로 줄인다', () => {
    const list = rule('home__week-list');
    expect(list).toContain('display: grid');
    expect(list).toContain('repeat(auto-fit, minmax(min(100%, 24rem), 1fr))');
    expect(rule('home__week-panel')).toContain('height: 100%');
    expect(rule('home__week-rec')).toContain('margin-top: auto');
  });
  it('320px에서도 팀 그림 세 개가 동일한 정사각형으로 판 안에 들어간다', () => {
    expect(rule('home__team-balls')).toContain('repeat(3, minmax(0, 1fr))');
    expect(rule('home__team-balls')).toContain('width: 100%');
    expect(rule('home__team-balls')).toContain('max-width: 27.2rem');
    const art = /\.home__team-balls > \.px-ball \{([^}]+)\}/.exec(css)![1]!;
    expect(art).toContain('width: 100%');
    expect(art).toContain('height: auto');
    expect(art).toContain('aspect-ratio: 1');
  });
});
