// @vitest-environment jsdom
// 전수 점검(2026-10-17)에서 잡은 둘이 되돌아오지 않는지 본다 —
//   ① 글자 한 줄짜리 링크의 손가락 자리가 44px(--tap) 아래로 떨어지던 것
//   ② 일정 분류 배지가 타입색 글자라 라이트에서 1.2:1 까지 묻히던 것
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');
const parts = read('styles/pixel/parts.css').replace(/\/\*[\s\S]*?\*\//g, '');
const schedule = read('screens/Schedule.tsx');

describe('글자 링크의 손가락 자리와 일정 배지 글자색', () => {
  it('더보기 · 보스 상세 확인 · 바닥글 링크는 가상 요소로 세로 44px 을 받는다', () => {
    const sel = 'html body :is(.px-sec__more, .nw-ev__link, .home__check-more, footer .foot-links a, footer .foot-links button)';
    expect(parts).toContain(`${sel} { position: relative; }`);
    const after = parts.indexOf(`${sel}::after {`);
    expect(after, '가상 요소 규칙이 없다').toBeGreaterThan(-1);
    const block = parts.slice(after, parts.indexOf('}', after));
    expect(block).toContain('height: var(--tap)');
    expect(block).toContain("content: ''");
  });
  it('일정 분류 배지는 점만 분류색이고 글자는 기본색이다', () => {
    expect(schedule).not.toMatch(/<NwBadge[^>]*color=\{cat/);
    expect(schedule).toContain('className="nw-cal__dot" style={{ background: cat?.color }}');
  });
});
