'use strict';
// 새 디자인(src/styles/cinema) 이 규칙 안에 서 있는지 — 색은 토큰, 크기 · 간격 · 줄 높이는 격자, 반경은 토큰 넷 (CLAUDE.md §1-b · §7)
//
// 왜 생겼나 — 2026-09-25 새 디자인(ae64ee8)이 화면 파일 아홉 개에 hex 색 수백 개 · !important 60여 개 ·
// 격자 밖 크기(13 · 15 · 18 · 26 · 38 · 56px)를 적어 들어왔다. 라이트 모드에서는 그림 위 글자가 사라졌다.
// 지침만 적어 두면 또 샌다 — 이 검사가 새 파일에 같은 것이 들어오면 세운다
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const STYLES = join(__dirname, '..', 'styles');
const CINEMA = join(STYLES, 'cinema');
const files = readdirSync(CINEMA).filter((name) => name.endsWith('.css'));
// 주석은 뺀다 — 설명 글에 적은 hex · px 은 규칙이 아니다
const bare = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const sources = files.map((name) => ({ name, css: bare(readFileSync(join(CINEMA, name), 'utf8')) }));

function allCss(dir: string): string {
  return readdirSync(dir, { withFileTypes: true }).map((one) =>
    one.isDirectory() ? allCss(join(dir, one.name)) : one.name.endsWith('.css') ? readFileSync(join(dir, one.name), 'utf8') : '').join('\n');
}

// 선언 하나씩 — `속성: 값`
function declarations(css: string): { prop: string; value: string }[] {
  return [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)].map((m) => ({ prop: m[1]!, value: m[2]!.trim() }));
}

const FONT_SIZES = new Set(['1.2', '1.4', '1.6', '2.2', '2.8', '4.2']);
const LINE_HEIGHTS = new Set(['1', '1.2', '1.5', '1.7']);
const SPACING = /^(margin|padding|gap|row-gap|column-gap|top|right|bottom|left|inset)(-|$)/;

describe('새 디자인 — 규칙 안에 선다', () => {
  it('새 디자인 파일이 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('색은 토큰으로만 — hex · rgb() · hsl() 을 적지 않는다', () => {
    for (const { name, css } of sources) {
      const hits = css.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g) ?? [];
      expect(hits, `${name}: ${hits.join(', ')}`).toEqual([]);
    }
  });

  it('!important 를 쓰지 않는다 — 이기려면 토큰을 바꾼다', () => {
    for (const { name, css } of sources) expect(css.includes('!important'), name).toBe(false);
  });

  it('글자 크기는 격자 여섯 칸', () => {
    for (const { name, css } of sources) {
      for (const { prop, value } of declarations(css)) {
        if (prop !== 'font-size' && prop !== 'font') continue;
        const size = /(\d+(?:\.\d+)?)(rem|px)(?:\/|\s|$)/.exec(value);
        if (!size) continue;
        expect(size[2], `${name}: ${prop}: ${value}`).toBe('rem');
        expect(FONT_SIZES.has(size[1]!), `${name}: ${prop}: ${value}`).toBe(true);
      }
    }
  });

  it('줄 높이는 1 · 1.2 · 1.5 · 1.7', () => {
    for (const { name, css } of sources) {
      for (const { prop, value } of declarations(css)) {
        const height = prop === 'line-height' ? value : prop === 'font' ? /\/([\d.]+)/.exec(value)?.[1] : undefined;
        if (height === undefined) continue;
        expect(LINE_HEIGHTS.has(height), `${name}: ${prop}: ${value}`).toBe(true);
      }
    }
  });

  it('간격은 0.4rem 격자 (0.2 는 머리카락 선 하나만)', () => {
    for (const { name, css } of sources) {
      for (const { prop, value } of declarations(css)) {
        if (!SPACING.test(prop) || value.includes('calc(') || value.includes('env(')) continue;
        for (const rem of value.matchAll(/(-?\d*\.?\d+)rem/g)) {
          const tenths = Math.round(Math.abs(Number(rem[1])) * 10);
          expect(tenths % 4 === 0 || tenths === 2, `${name}: ${prop}: ${value}`).toBe(true);
        }
        expect(/\d+px/.test(value), `${name}: ${prop}: ${value} — px 대신 rem`).toBe(false);
      }
    }
  });

  it('반경은 토큰 넷(--r-panel · --r-box · --r-ctl · --r-tag) · 0 · 50% 만', () => {
    for (const { name, css } of sources) {
      for (const { prop, value } of declarations(css)) {
        if (prop !== 'border-radius') continue;
        const bits = value.replace(/var\(--r-(panel|box|ctl|tag)\)/g, '').replace(/\b0\b|50%/g, '').trim();
        expect(bits, `${name}: border-radius: ${value}`).toBe('');
      }
    }
  });

  it('쓰는 토큰은 어딘가에 정의돼 있다 — 없는 이름은 색이 통째로 빠진다 (§1-c)', () => {
    const defined = new Set([...allCss(STYLES).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
    // 화면이 style 로 넣는 값 — MaxSlider(--banner-progress) · Schedule(--category-color) · MaxPoster(--hero-focus)
    for (const runtime of ['--banner-progress', '--category-color', '--hero-focus']) defined.add(runtime);
    for (const { name, css } of sources) {
      for (const used of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
        expect(defined.has(used[1]!), `${name}: ${used[1]} 가 정의돼 있지 않습니다`).toBe(true);
      }
    }
  });
});
