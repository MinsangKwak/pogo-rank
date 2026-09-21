// ─────────────────────────────────────────────────────────────────────────────
// legalsync — **약관·방침은 v3 와 v4 가 같은 말을 해야 한다.**
//
// 두 판이 같은 도메인을 쓰는 동안 한쪽만 개정되면, 어느 화면을 열었느냐로 동의 범위가 갈린다.
// v4.7.1 에 검색어 기록을 적으면서 고칠 자리가 두 파일에 아홉 군데였다 — 사람이 세다 빠뜨릴 수다.
// 지침("둘 다 고친다")만 적어 두면 또 샌다(CLAUDE.md §1 과 같은 판단). 그래서 기계가 센다.
//
// **파일 모양이 아니라 문장을 견준다.** v3 는 el() 트리, v4 는 JSX 라 생김새가 다르다 —
// 같아야 하는 것은 사용자가 읽는 문구다.
//
//   v3  frontend/scripts/components/privacy.js · terms.js
//   v4  frontend-v4/src/screens/Legal.tsx · components/TermsConsent.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(__dirname, '../../../', path), 'utf-8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const norm = (t: string) => t.replace(/\s+/g, ' ').trim();

/**
 * 사용자가 읽는 문장만 고른다 — 한글이 든 30자 이상.
 * 짧은 것(제목·라벨)은 뺀다: 두 판이 그 자리를 다른 문법으로 적어(sec() vs <Sec title>) 견줄 수 없다.
 */
function sentences(paths: string[], jsx: boolean): Set<string> {
  const out = new Set<string>();
  const add = (text: string) => {
    const one = norm(text);
    if (one.length >= 30 && /[가-힣]/.test(one)) out.add(one);
  };
  for (const path of paths) {
    const src = stripComments(read(path));
    for (const m of src.matchAll(/'((?:[^'\\]|\\.)*)'/g)) add((m[1] ?? '').replace(/\\'/g, "'"));
    for (const m of src.matchAll(/`((?:[^`\\]|\\.)*)`/g)) add(m[1] ?? '');
    if (!jsx) continue;
    // JSX 본문은 tsx 에서만 꺼낸다 — js 에서 { } 는 그냥 객체 괄호라 아무 코드나 걸린다.
    //   ① 태그를 지운다 → 속성값(className·aria-label)이 같이 사라져 남는 따옴표는 본문 안의 인용부호다
    //   ② 문자열을 지운다 → 위에서 이미 담았고, 지워야 남는 { } 의 짝이 맞는다(`${X}` 의 중괄호 때문)
    //   ③ { } 표현식을 지운다 → 남는 것이 본문뿐이다
    const bare = src.replace(/<[^>]*>/g, '\n')
      .replace(/'(?:[^'\\\n]|\\.)*'/g, ' ')
      .replace(/`(?:[^`\\]|\\.)*`/g, ' ');
    for (const line of bare.replace(/\{[^{}]*\}/g, '\n').split('\n')) add(line);
  }
  return out;
}

const v3 = sentences(['frontend/scripts/components/privacy.js', 'frontend/scripts/components/terms.js'], false);
const v4 = sentences(['frontend-v4/src/screens/Legal.tsx', 'frontend-v4/src/components/TermsConsent.tsx'], true);
const onlyIn = (a: Set<string>, b: Set<string>) => [...a].filter((one) => !b.has(one));

describe('약관·방침이 v3 와 v4 에서 같은 말을 한다', () => {
  it('v3 에만 있는 문장이 없다 — v4 를 고치고 v3 를 빠뜨린 자리', () => {
    expect(onlyIn(v3, v4)).toEqual([]);
  });

  it('v4 에만 있는 문장이 없다 — v3 를 고치고 v4 를 빠뜨린 자리', () => {
    expect(onlyIn(v4, v3)).toEqual([]);
  });

  // 정규식이 헛돌면 위 둘은 늘 통과한다 — 그물이 비어 있지 않은지 함께 본다
  it('셀 문장이 실제로 있다', () => {
    expect(v3.size).toBeGreaterThan(50);
    expect(v4.size).toBeGreaterThan(50);
  });

  it('이번 판에 더한 문장이 양쪽에 다 있다', () => {
    for (const set of [v3, v4]) {
      expect([...set].some((one) => one.includes('검색어 기록(moncamp 수집 서버)'))).toBe(true);
      expect([...set].some((one) => one.includes('IP 주소는 저장하지 않습니다'))).toBe(true);
    }
  });
});
