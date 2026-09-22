// ─────────────────────────────────────────────────────────────────────────────
// test/dstokens.test.ts — 디자인 시스템이 격자 밖으로 못 나가게 하는 그물
//
// 지침만 적어 두면 샌다 (CLAUDE.md §1 의 교훈). 여기서 넷을 기계가 잡는다 —
//   1. ds/tokens.ts 가 적은 이름이 tokens.css 에 **실제로 있는가**
//      없으면 화면에 `var(--없는것)` 이 나가 색이 통째로 빠진다. 오류도 경고도 안 난다
//   2. ds.css 가 색을 **직접 적지 않았는가** (§1-b 3번 — 하드코딩 색은 토큰으로)
//   3. ds.css 의 간격이 **0.4rem 격자** 위에 있는가 (§7)
//   4. ds.css 의 글자 크기가 **여섯 단** 안에 있는가 (§7)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_SIZES, FONT_STEMS, TOKEN_GROUPS, TYPES } from '../ds/tokens';
import { TYPE_KO } from '../stories/typeNames';

// legalsync.test.ts 와 같은 방식 — jsdom 에서 import.meta.url 은 file: 스킴이 아니다
const read = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf-8');
const TOKENS_CSS = read('../frontend/styles/tokens.css');
const DS_CSS = read('src/styles/ds.css');

/** CSS 에서 **선언된** 변수만 거둔다 — `var(--x)` 로 읽기만 한 이름은 세지 않는다 */
function declared(css: string): Set<string> {
  const found = new Set<string>();
  for (const line of css.split('\n')) {
    // 주석 줄은 건너뛴다 — 주석 안의 예시(`--없는것`)까지 선언으로 세면 그물이 헐거워진다
    const body = line.replace(/\/\*.*?\*\//g, '');
    for (const hit of body.matchAll(/(^|[;{]|\s)(--[a-z0-9-]+)\s*:/g)) found.add(hit[2]!);
  }
  return found;
}

/** 속성 한 종류의 값만 뽑는다 (gap · padding · margin 처럼 **간격을 말하는** 속성) */
function valuesOf(css: string, props: string[]): string[] {
  const out: string[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const prop of props) {
    for (const hit of clean.matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, 'g'))) {
      out.push(hit[1]!.trim());
    }
  }
  return out;
}

describe('디자인 토큰 목록', () => {
  const inCss = declared(TOKENS_CSS);

  it('ds/tokens.ts 가 적은 이름은 tokens.css 에 다 있다', () => {
    const missing: string[] = [];
    for (const group of TOKEN_GROUPS) {
      for (const token of group.tokens) if (!inCss.has(token.name)) missing.push(`${group.id}: ${token.name}`);
    }
    expect(missing).toEqual([]);
  });

  it('쓰임새 설명이 빈 칸으로 남은 토큰이 없다', () => {
    for (const group of TOKEN_GROUPS) {
      for (const token of group.tokens) expect(token.use.trim(), token.name).not.toBe('');
    }
  });

  it('글꼴 줄기가 쓸 수 있는 크기는 여섯 단 안에 있다', () => {
    const ladder = new Set(FONT_SIZES.tokens.map((one) => one.name));
    for (const stem of Object.values(FONT_STEMS)) {
      for (const size of stem.sizes) expect(ladder, `${stem.label} ${size}`).toContain(`--fs-${size}`);
    }
  });

  it('Galmuri 줄기는 격자 밖 크기(12 · 16)를 못 가진다', () => {
    // 11·14px 의 정수배가 아니면 픽셀이 뭉개진다 — 작은 글자가 필요하면 색으로 누른다
    expect(FONT_STEMS.chrome.sizes as readonly string[]).not.toContain('sub');
    expect(FONT_STEMS.chrome.sizes as readonly string[]).not.toContain('lead');
  });
});

describe('ds.css', () => {
  it('색을 직접 적지 않는다 — 토큰만 쓴다', () => {
    const clean = DS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const raw = [...clean.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/g)].map((hit) => hit[0]);
    expect(raw).toEqual([]);
  });

  it('간격은 0.4rem 격자 위에만 있다', () => {
    const off: string[] = [];
    for (const value of valuesOf(DS_CSS, ['gap', 'padding', 'margin', 'padding-bottom', 'margin-bottom'])) {
      // var() · calc() 안의 값은 토큰이 이미 격자 위다 — 직접 적힌 rem 만 본다
      for (const hit of value.replace(/var\([^)]*\)/g, '').matchAll(/(-?[\d.]+)rem/g)) {
        const rem = Math.abs(Number(hit[1]));
        // 0.2rem 은 간격이 아니라 머리카락 선 한 줄 — CLAUDE.md §7 이 둔 단 하나의 예외다
        if (rem !== 0 && rem !== 0.2 && Math.round(rem * 10) % 4 !== 0) off.push(`${value} → ${hit[0]}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('글자 크기는 --fs-* 여섯 단으로만 적는다', () => {
    const ladder = new Set(FONT_SIZES.tokens.map((one) => one.name));
    for (const value of valuesOf(DS_CSS, ['font-size'])) {
      const token = /var\((--fs-[a-z]+)/.exec(value);
      expect(token, `font-size: ${value}`).not.toBeNull();
      expect(ladder, `font-size: ${value}`).toContain(token![1]!);
    }
  });

  it('누르는 것은 --tap 아래로 내려가지 않는다', () => {
    for (const value of valuesOf(DS_CSS, ['min-height'])) {
      expect(value, `min-height: ${value}`).toContain('var(--tap)');
    }
  });
});

describe('타입 한글 이름', () => {
  // **지어낸 이름이 섞이지 않게 원본과 견준다** (CLAUDE.md §3).
  // 스토리북은 빌드 데이터를 안 받으므로 도면용 한 벌(stories/typeNames.ts)을 따로 두는데,
  // 그 한 벌이 원본에서 갈라지면 도면이 없는 이름을 보여 주게 된다
  const SOURCE = read('../backend/build.py');

  it('backend/build.py 의 TYPE_KO 와 글자 하나까지 같다', () => {
    const line = /^TYPE_KO = (\{.*\})$/m.exec(SOURCE);
    expect(line, 'backend/build.py 에서 TYPE_KO 를 못 찾았다').not.toBeNull();
    const real: Record<string, string> = {};
    for (const hit of line![1]!.matchAll(/'(\w+)':'([^']+)'/g)) real[hit[1]!] = hit[2]!;
    expect(TYPE_KO).toEqual(real);
  });

  it('18개 타입이 하나도 빠지지 않는다', () => {
    for (const type of TYPES) expect(TYPE_KO[type], type).toBeTruthy();
  });
});
