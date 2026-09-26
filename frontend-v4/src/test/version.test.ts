// ─────────────────────────────────────────────────────────────────────────────
// version.test.ts — 판 번호가 여러 자리에서 어긋나지 않는지 본다 (2026-09-22 v5 Phase 1-D)
//
// 왜 필요한가
//   CLAUDE.md §5 는 판을 올릴 때 고칠 곳을 여섯으로 적어 두고 "한 군데라도 빠지면 화면과
//   문서가 어긋난다" 고 경고한다. 사람이 여섯 번 안 틀리기를 바라는 것은 규칙이 아니라 기대다.
//
//   Phase 1 에서 셋이 사라졌다 — build.py 의 상수와 components/release.js 의 RELEASE_VER 은
//   content/version.json 을 읽게 됐고, v3 화면이 지워지며 그 자리도 없어졌다.
//   남은 넷(version.json · 패치노트 한글·영문 · CHANGELOG · README)을 이 검사가 견준다.
//
// 무엇을 안 보나
//   패치노트 **본문**은 안 본다. 사람이 쓰는 글이라 기계가 옳고 그름을 못 가린다.
//   여기서 보는 것은 번호와 날짜가 서로를 가리키는가 하나뿐이다.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// jsdom 에서 import.meta.url 은 file: 스킴이 아니다 — dstokens.test.ts 와 같은 방식으로 연다
const read = (path: string) => readFileSync(resolve(__dirname, '../../..', path), 'utf8');

const version = JSON.parse(read('content/version.json')) as { app: string; release: string };
const notesKo = read('content/release-notes.mjs');
const notesEn = read('content/release-notes.en.mjs');
const changelog = read('docs/CHANGELOG.md');
const readme = read('README.md');

/** 패치노트의 첫 묶음 머리 — `{ date: '2026-09-22 · v4.9.8', items: [` 의 date 만 */
const firstNoteDate = (source: string): string => {
  const hit = /date:\s*'([^']+)'/.exec(source);
  if (!hit) throw new Error('패치노트에서 첫 date 를 못 찾았습니다');
  return hit[1]!;
};

describe('판 번호는 한 곳이 정한다', () => {
  it('version.json 의 app 이 vX.Y.Z 꼴이다', () => {
    expect(version.app).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  // RELEASE_VER 은 빨간 점 판정에 쓰는 문자열이다 — 날짜 + 번호의 숫자만 이어 붙인 꼴이라
  // 값이 바뀌었는지만 보면 되지만, 규칙을 적어 두면 사람이 손으로 지어내지 않는다
  it('version.json 의 release 가 날짜-번호 꼴이고 app 과 같은 숫자를 쓴다', () => {
    expect(version.release).toMatch(/^\d{4}-\d{2}-\d{2}-\d+$/);
    const digits = version.app.replace(/[^\d]/g, '');
    expect(version.release.split('-').at(-1)).toBe(digits);
  });

  it('한글 패치노트의 맨 위가 지금 판이다', () => {
    expect(firstNoteDate(notesKo)).toContain(version.app);
  });

  it('영문 패치노트의 맨 위가 한글판과 같은 키다', () => {
    // RELEASE_NOTES_EN 은 date 를 키로 쓴다 — 글자 하나만 어긋나도 그 판이 영어로 안 나간다
    const firstKey = /^\s*'([^']+)':/m.exec(notesEn)?.[1];
    expect(firstKey).toBe(firstNoteDate(notesKo));
  });

  it('CHANGELOG 의 첫 날짜 묶음이 지금 판을 담고 있고 건수가 맞다', () => {
    const group = /<summary><b>(\d{4}-\d{2}-\d{2})<\/b> — (\d+)판 · (.+?)<\/summary>/.exec(changelog);
    expect(group, 'CHANGELOG 의 첫 날짜 묶음을 못 찾았습니다').not.toBeNull();
    const [, , count, list] = group!;
    expect(list).toContain(`<code>${version.app}</code>`);
    expect((list!.match(/<code>v/g) ?? []).length).toBe(Number(count));
  });

  it('README 의 첫 날짜 묶음이 CHANGELOG 와 같은 판을 같은 수만큼 적는다', () => {
    const group = /<summary><b>(\d{4}-\d{2}-\d{2})<\/b> — 릴리스 (\d+)개 · (.+?)<\/summary>/.exec(readme);
    expect(group, 'README 의 첫 날짜 묶음을 못 찾았습니다').not.toBeNull();
    const [, date, count, list] = group!;
    expect(list).toContain(`<code>${version.app}</code>`);
    expect((list!.match(/<code>v/g) ?? []).length).toBe(Number(count));

    const chGroup = /<summary><b>(\d{4}-\d{2}-\d{2})<\/b> — (\d+)판 · (.+?)<\/summary>/.exec(changelog)!;
    expect(date).toBe(chGroup[1]);
    expect(count).toBe(chGroup[2]);
  });
});
