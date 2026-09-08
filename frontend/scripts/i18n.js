// ─────────────────────────────────────────────────────────────────────────────
// i18n.js — 한국어 ↔ 영어 전환 엔진 (2026-09-08 v2.29.0)
//
// 왜 이런 모양인가
//   이 앱은 화면 문구를 코드 안에 한국어 그대로 적는다(35개 파일, 문자열 1,000개 남짓).
//   그 전부를 t('key') 로 바꾸면 파일마다 손이 가고, 한 곳이라도 빠지면 그 줄만 한국어로 남는다.
//   그래서 **원문(한국어)을 그대로 키로 쓰고, 그려진 뒤에 한 번 훑어 바꾸는** 방식을 택했다.
//   덕분에 화면을 그리는 코드는 지금까지와 똑같고, 번역은 사전 한 파일에서만 는다.
//
// 이름은 사전이 아니라 데이터가 맡는다
//   포켓몬·기술·폼·타입 이름은 1,000개가 넘고 새 종이 나올 때마다 늘어난다.
//   원본 표(PokeAPI)에 이미 영문이 있으므로 빌드가 구워 넣고(dex_build.py: en · moveKo · formKo,
//   build.py: TYPE_EN) 여기서는 그 표를 뒤집어 쓴다. 사람이 이름을 손으로 적지 않는다.
//
// 사전에 없으면 한국어를 그대로 둔다
//   없는 영어를 지어내지 않는다. 반쯤 번역된 화면이 틀린 번역보다 낫다.
//
// 제공하는 전역
//   LANG            현재 언어 'ko' | 'en'
//   setLang(lang)   언어를 바꾸고 화면 전체를 다시 훑는다 (localStorage 'pogo_lang' 에 기억)
//   t(text)         문자열 하나를 번역한다 (코드에서 직접 부를 때)
//   translateTree(root)  DOM 가지 하나를 훑어 텍스트·속성을 바꾼다
//   i18nKoOnlyNote(kind) "이 화면은 한국어로만 둡니다" 안내 노드 (영어일 때만 보인다). kind='kst' 는 일정표용
//   i18nWatch()     그려지는 것을 지켜보다 자동으로 번역한다 (app-shell.js 가 한 번 부른다)
//
// 의존하는 전역
//   I18N_EN (i18n-en.js) · DEX_DATA · TYPE_KO · TYPE_EN (data.js)
// ─────────────────────────────────────────────────────────────────────────────

const I18N_LANG_KEY = 'pogo_lang';
let LANG = 'ko';
try {
  LANG = localStorage.getItem(I18N_LANG_KEY) === 'en' ? 'en' : 'ko';
} catch { /* 저장 불가 환경 */ }

// 번역하지 않는 가지: 스크립트·스타일과, 값 자체가 언어가 아닌 곳(사용자가 입력한 글 등)
const I18N_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
// 번역할 속성 — 눈에 보이지 않아도 읽히는 글이다
const I18N_ATTRS = ['aria-label', 'placeholder', 'title', 'alt', 'aria-placeholder'];

// 이름표는 처음 쓸 때 한 번만 뒤집는다 (DEX_DATA 가 크다 — 매번 훑으면 전환이 눈에 띄게 느려진다)
let i18nNameMap = null;
function i18nNames() {
  if (i18nNameMap) return i18nNameMap;
  i18nNameMap = new Map();
  const dex = typeof DEX_DATA !== 'undefined' ? DEX_DATA : {};
  // 포켓몬 종 이름: 한글 → 영문 (같은 도감번호끼리 짝짓는다)
  for (const [dexKey, koreanName] of Object.entries(dex.names ?? {})) {
    const englishName = (dex.en ?? {})[dexKey];
    if (englishName && !i18nNameMap.has(koreanName)) i18nNameMap.set(koreanName, englishName);
  }
  // 기술 이름 · 폼 라벨: 빌드가 이미 한글 → 영문 모양으로 구워 준다
  for (const [koreanName, englishName] of Object.entries(dex.moveKo ?? {})) if (!i18nNameMap.has(koreanName)) i18nNameMap.set(koreanName, englishName);
  for (const [koreanName, englishName] of Object.entries(dex.formKo ?? {})) i18nNameMap.set(koreanName, englishName);
  // 타입 이름: TYPE_KO 와 TYPE_EN 은 키가 같다
  if (typeof TYPE_KO !== 'undefined' && typeof TYPE_EN !== 'undefined') {
    for (const [typeKey, koreanType] of Object.entries(TYPE_KO)) i18nNameMap.set(koreanType, TYPE_EN[typeKey]);
  }
  return i18nNameMap;
}

// 숫자를 뺀 뼈대. '더보기 (100/1025)' → '더보기 (#/#)'
// 숫자만 다른 문장을 사전에 수백 줄 적지 않기 위한 장치다 — 사전에는 뼈대만 적고 숫자는 되돌려 넣는다
function i18nSkeleton(text) {
  return text.replace(/\d+(?:[.,]\d+)?/g, '#');
}

// 뼈대 번역문의 '#' 을 원문의 숫자로 순서대로 되돌린다.
// 영어 어순이 달라 '#' 개수가 맞지 않으면 번역을 포기한다 (숫자가 뒤섞인 문장을 내보내지 않는다)
function i18nFillNumbers(template, numbers) {
  let index = 0;
  if ((template.match(/#/g) || []).length !== numbers.length) return null;
  return template.replace(/#/g, () => numbers[index++]);
}

// 문자열 하나를 번역한다. 사전 → 숫자 뼈대 → 이름표 → 조각(가운뎃점·슬래시로 이어 붙인 줄) 순으로 본다
function t(text) {
  if (LANG !== 'en' || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed || !/[가-힣]/.test(trimmed)) return text;   // 한글이 없으면 볼 것도 없다
  const [, lead, core, tail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const translated = i18nCore(core);
  return translated === null ? text : lead + translated + tail;
}

function i18nCore(text) {
  const dictionary = typeof I18N_EN !== 'undefined' ? I18N_EN : {};
  if (dictionary[text]) return dictionary[text];
  const names = i18nNames();
  if (names.has(text)) return names.get(text);

  // 숫자만 다른 문장
  const skeleton = i18nSkeleton(text);
  if (skeleton !== text && dictionary[skeleton]) {
    const filled = i18nFillNumbers(dictionary[skeleton], text.match(/\d+(?:[.,]\d+)?/g) ?? []);
    if (filled !== null) return filled;
  }

  // 이름 + 꼬리말 꼴 ('거다이맥스 고릴타 상세 보기' · '강철 타입'). 잡아낸 조각을 다시 번역해 끼운다 —
  // 이름이 1,000개가 넘어 조합을 사전에 적을 수 없다
  for (const [pattern, template] of (typeof I18N_PATTERNS !== 'undefined' ? I18N_PATTERNS : [])) {
    const matched = text.match(pattern);
    if (!matched) continue;
    let failed = false;
    const filled = template.replace(/\$(\d)/g, (_, digit) => {
      const captured = matched[Number(digit)] ?? '';
      if (!/[가-힣]/.test(captured)) return captured;
      const inner = i18nCore(captured);
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
      if (index % 2 === 1) return piece;                  // 구분자는 그대로
      if (!/[가-힣]/.test(piece)) return piece;
      const inner = i18nCore(piece.trim());
      return inner === null ? null : piece.replace(piece.trim(), inner);
    });
    if (pieces.every((piece) => piece !== null)) return pieces.join('');
  }

  // 마지막 수단: 띄어쓰기로 끊어 낱말마다 본다. '거다이맥스 고릴타' 처럼 라벨 + 이름으로 붙은 말이
  // 대부분이라 이 한 겹으로 조합 폭발을 피한다. 한 낱말이라도 모르면 줄 전체를 포기한다
  const words = text.split(' ');
  if (words.length > 1) {
    const translated = words.map((word) => {
      if (!/[가-힣]/.test(word)) return word;
      return i18nCore(word);
    });
    if (translated.every((word) => word !== null)) return translated.join(' ');
  }
  return null;
}

// DOM 가지 하나를 훑는다. 텍스트 노드의 원문(한국어)을 노드에 붙여 두어 되돌릴 수 있게 한다 —
// index.html 이 직접 적은 글(헤더·드로어·푸터)은 화면을 다시 그려도 새로 만들어지지 않기 때문이다
function translateTree(root) {
  if (!root || typeof I18N_EN === 'undefined') return;
  // 텍스트 노드가 통째로 새로 붙는 경우(예: node.textContent = '...' 로 갈아 끼운 제목).
  // TreeWalker 는 뿌리 자신을 돌려주지 않으므로 여기서 직접 처리한다 — 안 그러면 그 줄만 한국어로 남는다
  if (root.nodeType === Node.TEXT_NODE) {
    if (I18N_SKIP_TAGS.has(root.parentElement?.tagName) || root.parentElement?.closest('[data-i18n="off"]')) return;
    const source = root.__koText ?? root.data;
    if (!/[가-힣]/.test(source)) return;
    root.__koText = source;
    root.data = LANG === 'en' ? t(source) : source;
    return;
  }
  const start = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
  if (start) {
    for (const node of [start, ...start.querySelectorAll('*')]) {
      if (node.closest('[data-i18n="off"]')) continue;
      for (const attribute of I18N_ATTRS) {
        if (!node.hasAttribute(attribute)) continue;
        // 원문은 dataset 이 아니라 요소에 직접 붙인다 — data-* 이름에는 '-' 가 든 속성명을 넣을 수 없다
        node.__ko ??= {};
        const original = node.__ko[attribute] ?? node.getAttribute(attribute);
        node.__ko[attribute] = original;
        node.setAttribute(attribute, LANG === 'en' ? t(original) : original);
      }
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (I18N_SKIP_TAGS.has(node.parentElement?.tagName) || node.parentElement?.closest('[data-i18n="off"]'))
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const original = node.__koText ?? node.data;
    if (!/[가-힣]/.test(original)) continue;
    node.__koText = original;
    node.data = LANG === 'en' ? t(original) : original;
  }
}

// 그려지는 것을 지켜본다. 화면은 render() 말고도 여러 곳(도감 청크·상성 결과·검색 결과)에서
// 부분적으로 다시 그려지므로, 그때마다 부르는 대신 한 번 걸어 두고 새로 붙는 가지만 훑는다.
// 글자만 바꾸므로(childList 가 아니다) 이 관찰자가 자기 자신을 다시 깨우지 않는다
function i18nWatch() {
  translateTree(document.body);
  new MutationObserver((records) => {
    if (LANG !== 'en') return;
    for (const record of records) for (const node of record.addedNodes) translateTree(node);
  }).observe(document.body, { childList: true, subtree: true });
}

// 한국어로만 두는 화면(패치노트·일정표·개인정보처리방침·이용약관)에 다는 안내 한 줄.
// 영어일 때만 보인다 — CSS 가 :root[lang="en"] 로 가른다(base.css). 사전을 타지 않게 data-i18n="off"
//   kind 'kst' 는 일정표용 — 한국 서버 기준임을 함께 밝힌다 (지역마다 이벤트 날짜가 다르다)
function i18nKoOnlyNote(kind) {
  return el('p', { class: 'note i18n-note', 'data-i18n': 'off' }, kind === 'kst' ? I18N_KST_NOTE : I18N_KO_ONLY_NOTE);
}

// 언어 전환. 화면 전체를 원문으로 되돌린 뒤 새 언어로 다시 훑는다
function setLang(lang) {
  LANG = lang === 'en' ? 'en' : 'ko';
  try {
    localStorage.setItem(I18N_LANG_KEY, LANG);
  } catch { /* 저장 불가 환경 */ }
  document.documentElement.lang = LANG === 'en' ? 'en' : 'ko';
  translateTree(document.body);
  if (typeof track === 'function') track('lang_switch', { lang: LANG });
}
