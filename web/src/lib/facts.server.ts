// ─────────────────────────────────────────────────────────────────────────────
// lib/facts.server.ts — 빌드 때 파일에서 바로 읽는 자리 (v5 Phase 6)
//
// **여기가 SEO 가 고쳐지는 지점이다.** 지금까지 데이터는 브라우저가 `fetch` 로 받았다.
// 크롤러가 받는 문서에는 빈 `<div id="root">` 밖에 없었고, 네이버는 JS 실행이 특히 약해
// 포켓몬 1,100종이 한 페이지로 잡혔다 (docs/ROADMAP.md §1).
//
// 같은 JSON 을 **빌드가 파일로 읽어** HTML 에 박으면 그 문제가 사라진다. 받는 쪽 코드는
// 그대로 둔다 — 화면은 여전히 `useDex()` 를 쓰고, 여기서 읽는 것은 **머리에 박을 사실**뿐이다.
//
// 묶음을 통째로 HTML 에 넣지 않는 이유: dex.json 하나가 수백 KB 다.
// 1,184장에 곱하면 문서가 수백 MB 가 된다 — 색인은커녕 배포도 못 한다.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'public/data');

interface Form {
  name: string;
  types: string[];
  atk: number;
  def: number;
  hp: number;
  fast: [string, number][];
  charged: [string, number][];
}

interface DexBundle {
  DEX_DATA: {
    names: Record<string, string>;
    en: Record<string, string>;
    dex: Record<string, number>;
    forms: Record<string, Form>;
    cls: Record<string, string>;
  };
  TYPE_KO: Record<string, string>;
  SPRITE_IDS: number[];
}

let cache: DexBundle | null = null;

function dex(): DexBundle {
  // 빌드 한 번에 1,184장을 그린다 — 매번 읽으면 그만큼 파일을 다시 연다
  cache ??= JSON.parse(readFileSync(resolve(DIR, 'dex.json'), 'utf8')) as DexBundle;
  return cache;
}

export interface MonFacts {
  sprite: number;
  dexNo: number;
  name: string;
  nameEn: string;
  types: string[];
  typesKo: string[];
  atk: number;
  def: number;
  hp: number;
  fast: string[];
  charged: string[];
}

/** 정적으로 구울 스프라이트 번호 전부 */
export function allSprites(): number[] {
  return dex().SPRITE_IDS;
}

/** 그 스프라이트의 사실. 모르는 번호면 null — 없는 주소는 굽지 않는다 */
export function monFacts(sprite: number): MonFacts | null {
  const { DEX_DATA, TYPE_KO } = dex();
  const form = DEX_DATA.forms[String(sprite)];
  if (!form) return null;

  // 폼 전용 번호(10000번대)는 dex 표가 원종을 알려 준다
  const dexNo = DEX_DATA.dex[String(sprite)] ?? sprite;
  const base = DEX_DATA.names[String(dexNo)] ?? `#${dexNo}`;
  // form.name 은 이미 한글이다 ('워시' · '거다이맥스')
  const name = form.name ? `${form.name} ${base}` : base;

  return {
    sprite,
    dexNo,
    name,
    nameEn: DEX_DATA.en[String(dexNo)] ?? '',
    types: form.types,
    typesKo: form.types.map((one) => TYPE_KO[one] ?? one),
    atk: form.atk,
    def: form.def,
    hp: form.hp,
    fast: form.fast.map(([label]) => label),
    charged: form.charged.map(([label]) => label),
  };
}
