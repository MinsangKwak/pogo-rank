// ─────────────────────────────────────────────────────────────────────────────
// navlinks.test.ts — 어떤 클릭을 앱 안 이동으로 가로채는가 (lib/nav.ts internalHref)
//
// 가로채면 안 되는 것을 가로채면 사람이 원하던 일(새 탭 · 다운로드 · 도면)이 조용히 사라진다.
// 가로채야 할 것을 놓치면 문서를 다시 열어 '깨졌다가 다시 그려진다' (2026-09-23 dev 제보).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { internalHref } from '../lib/nav';

const here = { origin: 'https://moncamp.kr', pathname: '/', search: '' };
const click = (over: Partial<MouseEvent> = {}) => ({
  defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over,
});
const a = (href: string, over: { target?: string; attrs?: string[] } = {}) => ({
  href: new URL(href, here.origin).href,
  target: over.target ?? '',
  hasAttribute: (name: string) => (over.attrs ?? []).includes(name),
});

describe('앱 안 이동으로 가로챈다', () => {
  it('메뉴 줄 · 홈 타일 · 카드 같은 앱 주소', () => {
    expect(internalHref(click(), a('/dex'), here)).toBe('/dex');
    expect(internalHref(click(), a('/mon/25'), here)).toBe('/mon/25');
    expect(internalHref(click(), a('/pvp/deck?b=1'), here)).toBe('/pvp/deck?b=1');
  });
});

describe('브라우저에 맡긴다', () => {
  it('새 탭 · 새 창 · 가운데 버튼', () => {
    expect(internalHref(click({ metaKey: true }), a('/dex'), here)).toBeNull();
    expect(internalHref(click({ ctrlKey: true }), a('/dex'), here)).toBeNull();
    expect(internalHref(click({ shiftKey: true }), a('/dex'), here)).toBeNull();
    expect(internalHref(click({ button: 1 }), a('/dex'), here)).toBeNull();
    expect(internalHref(click(), a('/dex', { target: '_blank' }), here)).toBeNull();
  });
  it('이미 누가 처리한 클릭(<Link>)', () => {
    expect(internalHref(click({ defaultPrevented: true }), a('/dex'), here)).toBeNull();
  });
  it('다른 사이트 · 다운로드 · 파일', () => {
    expect(internalHref(click(), a('https://github.com/MinsangKwak/pogo-rank'), here)).toBeNull();
    expect(internalHref(click(), a('/data/dex.json', { attrs: ['download'] }), here)).toBeNull();
    expect(internalHref(click(), a('/sprites/25.png'), here)).toBeNull();
    expect(internalHref(click(), a('/robots.txt'), here)).toBeNull();
  });
  it('도면(/storybook) — 앱 밖의 판', () => {
    expect(internalHref(click(), a('/storybook/'), here)).toBeNull();
    expect(internalHref(click(), a('/storybook'), here)).toBeNull();
  });
  it('같은 문서 안의 건너뛰기 링크(#content)', () => {
    expect(internalHref(click(), a('/#content'), here)).toBeNull();
  });
});
