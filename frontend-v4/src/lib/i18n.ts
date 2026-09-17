// ─────────────────────────────────────────────────────────────────────────────
// lib/i18n.ts — 한국어 ↔ 영어 (v3 scripts/i18n.js 이식)
//
// **원문(한국어)을 그대로 키로 쓰고, 그려진 뒤에 한 번 훑어 바꾼다.**
// v3 가 이 모양을 고른 이유가 v4 에서도 그대로 산다 — 화면 문구가 코드 안에 한국어로 적혀 있고,
// 그 전부를 t('key') 로 바꾸면 파일마다 손이 가며 한 곳이라도 빠지면 그 줄만 한국어로 남는다.
// React 로 옮겼다고 달라지는 것이 없다: 엔진은 DOM 만 보고, 다시 그려진 가지는 관찰자가 잡는다.
//
// 이름은 사전이 아니라 데이터가 맡는다 — 포켓몬·기술·폼·타입 이름 1,000여 개는 빌드가 구운
// 표(DEX_DATA.en · moveKo · formKo · TYPE_EN)를 뒤집어 쓴다. 사람이 손으로 적지 않는다.
//
// 사전에 없으면 한국어를 그대로 둔다 — 없는 영어를 지어내지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import type { DexBundle } from '../types/data';

const LANG_KEY = 'pogo_lang';   // v3 와 같은 키
export type Lang = 'ko' | 'en';

let LANG: Lang = (() => {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ko'; } catch { return 'ko'; }
})();

export function lang(): Lang { return LANG; }

// 번역하지 않는 가지: 스크립트·스타일과, 값 자체가 언어가 아닌 곳(사용자가 입력한 글 등)
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
// 번역할 속성 — 눈에 보이지 않아도 읽히는 글이다
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'aria-placeholder'];

export const KO_ONLY_NOTE = 'This section is kept in Korean. The Korean text is the authoritative version.';
export const KST_NOTE = 'Dates and times follow the Korean server schedule (KST, UTC+9) and may differ in your region. This section is kept in Korean.';

let DICT: Record<string, string> = {};
let PATTERNS: [RegExp, string][] = [];
// **두 가지를 한 깃발로 묶지 않는다.** 사전이 왔는가(dictReady)와 지금 훑어도 되는가(canWalk)는 다르다 —
// 한국어로 되돌리는 데는 사전이 필요 없고(원문이 노드에 붙어 있다), 영어로 가는 데는 반드시 필요하다.
// 처음에 하나로 묶었더니 한국어로 시작한 사람이 EN 을 눌러도 사전을 받지 않아 화면이 그대로 있었다
let dictReady = false;

// 이름표는 처음 쓸 때 한 번만 뒤집는다 (표가 커서 매번 훑으면 전환이 눈에 띄게 느려진다)
let nameMap: Map<string, string> | null = null;

/** 빌드 데이터가 도착하면 이름표를 세운다 (App 이 한 번 부른다) */
export function setNameSource(dex: DexBundle) {
  const map = new Map<string, string>();
  const data = dex.DEX_DATA;
  // 포켓몬 종 이름: 한글 → 영문 (같은 도감번호끼리 짝짓는다)
  for (const [key, ko] of Object.entries(data.names ?? {})) {
    const en = data.en?.[key];
    if (en && !map.has(ko)) map.set(ko, en);
  }
  // 기술 이름 · 폼 라벨: 빌드가 이미 한글 → 영문 모양으로 구워 준다
  for (const [ko, en] of Object.entries(data.moveKo ?? {})) if (!map.has(ko)) map.set(ko, en);
  for (const [ko, en] of Object.entries(data.formKo ?? {})) map.set(ko, en);
  // 타입 이름: TYPE_KO 와 TYPE_EN 은 키가 같다
  for (const [key, ko] of Object.entries(dex.TYPE_KO)) {
    const en = dex.TYPE_EN[key];
    if (en) map.set(ko, en);
  }
  nameMap = map;
}

/** 숫자를 뺀 뼈대. '더보기 (100/1025)' → '더보기 (#/#)' */
function skeleton(text: string): string {
  return text.replace(/\d+(?:[.,]\d+)?/g, '#');
}

/** 뼈대 번역문의 '#' 을 원문의 숫자로 되돌린다. 개수가 안 맞으면 포기한다 (숫자가 뒤섞이지 않게) */
function fillNumbers(template: string, numbers: string[]): string | null {
  let index = 0;
  if ((template.match(/#/g) || []).length !== numbers.length) return null;
  return template.replace(/#/g, () => numbers[index++] ?? '#');
}

/** 사전 → 숫자 뼈대 → 이름표 → 규칙 → 조각 → 낱말 순으로 본다 (v3 i18nCore 와 같은 차례) */
function core(text: string): string | null {
  if (DICT[text]) return DICT[text];
  if (nameMap?.has(text)) return nameMap.get(text) ?? null;

  const bone = skeleton(text);
  if (bone !== text && DICT[bone]) {
    const filled = fillNumbers(DICT[bone], text.match(/\d+(?:[.,]\d+)?/g) ?? []);
    if (filled !== null) return filled;
  }

  // 이름 + 꼬리말 꼴 ('거다이맥스 고릴타 상세 보기'). 잡아낸 조각을 다시 번역해 끼운다 —
  // 이름이 1,000개가 넘어 조합을 사전에 적을 수 없다
  for (const [pattern, template] of PATTERNS) {
    const matched = text.match(pattern);
    if (!matched) continue;
    let failed = false;
    const filled = template.replace(/\$(\d)/g, (_, digit: string) => {
      const captured = matched[Number(digit)] ?? '';
      if (!/[가-힣]/.test(captured)) return captured;
      const inner = core(captured);
      if (inner === null) failed = true;
      return inner ?? captured;
    });
    if (!failed) return filled;
  }

  // '오물폭탄 · 솔라빔' 처럼 이름을 이어 붙인 줄 — 구분자를 지키며 조각마다 다시 본다.
  // 조각 하나라도 못 바꾸면 줄 전체를 포기한다 (반쯤 영어인 줄이 제일 읽기 나쁘다)
  const parts = text.split(/(\s·\s|\s\/\s|\s—\s|·)/);
  if (parts.length > 1) {
    const pieces = parts.map((piece, index) => {
      if (index % 2 === 1) return piece;              // 구분자는 그대로
      if (!/[가-힣]/.test(piece)) return piece;
      const inner = core(piece.trim());
      return inner === null ? null : piece.replace(piece.trim(), inner);
    });
    if (pieces.every((piece) => piece !== null)) return pieces.join('');
  }

  // 마지막 수단: 띄어쓰기로 끊어 낱말마다. '거다이맥스 고릴타' 처럼 라벨 + 이름으로 붙은 말이
  // 대부분이라 이 한 겹으로 조합 폭발을 피한다. 한 낱말이라도 모르면 줄 전체를 포기한다
  const words = text.split(' ');
  if (words.length > 1) {
    const out = words.map((word) => (/[가-힣]/.test(word) ? core(word) : word));
    if (out.every((word) => word !== null)) return out.join(' ');
  }
  return null;
}

/** 문자열 하나를 번역한다 */
export function t(text: string): string {
  if (LANG !== 'en' || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed || !/[가-힣]/.test(trimmed)) return text;   // 한글이 없으면 볼 것도 없다
  const matched = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!matched) return text;
  const [, lead = '', body = '', tail = ''] = matched;
  const out = core(body);
  return out === null ? text : lead + out + tail;
}

// 원문은 노드에 붙여 둔다 — 되돌릴 때 쓴다 (한 번 영어로 바꾼 노드에서는 한국어를 되찾을 길이 없다)
interface KoText extends Text { __koText?: string }
interface KoEl extends HTMLElement { __ko?: Record<string, string> }

const skip = (node: Node | null) => {
  const parent = node instanceof Element ? node : node?.parentElement ?? null;
  return !parent || SKIP_TAGS.has(parent.tagName) || !!parent.closest('[data-i18n="off"], [data-i18n="alt"]');
};

/** DOM 가지 하나를 훑어 텍스트·속성을 바꾼다 */
export function translateTree(root: Node | null) {
  if (!root) return;
  if (LANG === 'en' && !dictReady) return;   // 사전 없이 영어로 가면 반쯤 한국어인 화면이 된다
  // 텍스트 노드가 통째로 새로 붙는 경우. TreeWalker 는 뿌리 자신을 돌려주지 않아 여기서 직접 처리한다
  if (root.nodeType === Node.TEXT_NODE) {
    const node = root as KoText;
    if (skip(node.parentElement)) return;
    const source = node.__koText ?? node.data;
    if (!/[가-힣]/.test(source)) return;
    node.__koText = source;
    node.data = LANG === 'en' ? t(source) : source;
    return;
  }
  const start = root.nodeType === Node.ELEMENT_NODE ? (root as HTMLElement) : root.parentElement;
  if (start) {
    for (const node of [start, ...Array.from(start.querySelectorAll<HTMLElement>('*'))]) {
      if (node.closest('[data-i18n="off"]')) continue;
      // data-i18n="alt" — 사전이 아니라 **반대 언어의 이름**을 보이는 칸 (상세의 영문명 줄)
      if (node.dataset['i18n'] === 'alt') {
        node.textContent = (LANG === 'en' ? node.dataset['altEn'] : node.dataset['altKo']) ?? '';
        continue;
      }
      const keep = node as KoEl;
      for (const attribute of ATTRS) {
        if (!node.hasAttribute(attribute)) continue;
        // 원문은 dataset 이 아니라 요소에 직접 붙인다 — data-* 이름에 '-' 가 든 속성명을 넣을 수 없다
        keep.__ko ??= {};
        const original = keep.__ko[attribute] ?? node.getAttribute(attribute) ?? '';
        keep.__ko[attribute] = original;
        node.setAttribute(attribute, LANG === 'en' ? t(original) : original);
      }
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (skip(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as KoText;
    const original = text.__koText ?? text.data;
    if (!/[가-힣]/.test(original)) continue;
    text.__koText = original;
    text.data = LANG === 'en' ? t(original) : original;
  }
}

/**
 * 그려지는 것을 지켜본다. React 는 화면을 조각조각 다시 그리므로 그때마다 부르는 대신
 * 한 번 걸어 두고 새로 붙는 가지만 훑는다. 옮긴 값에는 한글이 없어 다시 울려도 곧 돌아온다 —
 * 스스로를 깨우는 고리는 생기지 않는다.
 */
let watcher: MutationObserver | null = null;
function watch() {
  // **한국어일 때는 아예 걸지 않는다.** 콜백에서 되돌아 나오는 것으로는 모자란다 —
  // 거는 순간 브라우저가 바뀐 가지마다 기록을 만들어 넘기고, 도감 한 화면이 1,000줄이라
  // 그 기록이 통째로 헛돈다. 옮길 일이 없으면 지켜볼 일도 없다
  if (LANG !== 'en') { watcher?.disconnect(); watcher = null; return; }
  if (watcher) return;
  watcher = new MutationObserver((records) => {
    if (LANG !== 'en' || !dictReady) return;
    for (const record of records) {
      if (record.type === 'childList') { record.addedNodes.forEach((node) => translateTree(node)); continue; }
      if (record.type === 'characterData') {
        const target = record.target as KoText;
        if (!/[가-힣]/.test(target.data) || skip(target.parentElement)) continue;
        const out = t(target.data);
        if (out === target.data) continue;
        target.__koText = target.data;
        target.data = out;
        continue;
      }
      const target = record.target as KoEl;
      const attribute = record.attributeName;
      if (!attribute) continue;
      const value = target.getAttribute(attribute);
      if (value == null || !/[가-힣]/.test(value) || target.closest('[data-i18n="off"]')) continue;
      const out = t(value);
      if (out === value) continue;
      target.__ko ??= {};
      target.__ko[attribute] = value;
      target.setAttribute(attribute, out);
    }
  });
  watcher.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// 사전은 EN 을 켠 사람만 받는다 (78KB). 한 번 받으면 그대로 둔다
let loading: Promise<void> | null = null;
async function loadDict(): Promise<void> {
  if (dictReady) return;
  loading ??= (async () => {
    const base = `${import.meta.env.BASE_URL}data/`;
    const manifest = await fetch(`${base}manifest.json`).then((res) => res.json());
    const hash = manifest?.files?.['i18n']?.hash ?? 'dev';
    const data = await fetch(`${base}i18n.json?v=${hash}`).then((res) => res.json());
    DICT = data.I18N_EN ?? {};
    PATTERNS = (data.I18N_PATTERNS ?? []).map(([source, flags, template]: [string, string, string]) => [new RegExp(source, flags), template]);
    dictReady = true;
  })();
  await loading;
}

// 언어가 바뀌면 알려 준다 — 사전이 못 옮기는 곳(패치노트 영문판)이 다시 그려져야 한다
const listeners = new Set<() => void>();
export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 언어 전환. 화면 전체를 원문으로 되돌린 뒤 새 언어로 다시 훑는다 */
export async function setLang(next: Lang) {
  if (next === 'en') await loadDict();   // 사전이 온 뒤에 언어를 바꾼다 — 순서가 뒤집히면 한 번 헛돈다
  LANG = next === 'en' ? 'en' : 'ko';
  try { localStorage.setItem(LANG_KEY, LANG); } catch { /* 저장 불가 환경 */ }
  document.documentElement.lang = LANG;
  translateTree(document.body);
  watch();
  listeners.forEach((fn) => fn());
}

/** 첫 그림 뒤 한 번 — 저장된 언어가 영어면 사전을 받아 화면을 옮긴다 */
export function initLang() {
  document.documentElement.lang = LANG;
  if (LANG === 'en') void setLang('en');
  else watch();
}
