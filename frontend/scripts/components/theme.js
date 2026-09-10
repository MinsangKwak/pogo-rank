// ─────────────────────────────────────────────────────────────────────────────
// components/theme.js — 밝은 화면 / 어두운 화면 전환 (2026-09-10 v2.47.0)
//
// 상태는 셋이다. 둘이 아니다.
//   'system'  기기 설정을 따른다 (기본값). <html> 에 아무 표시도 붙이지 않는다
//   'light'   항상 밝게 — <html data-theme="light">
//   'dark'    항상 어둡게 — <html data-theme="dark">
// 기기 설정을 따르는 상태를 없애면 "기기를 밤에 어둡게 바꿔도 이 사이트만 밝은" 일이 생긴다.
// 그래서 버튼은 세 상태를 돌린다: 시스템 → 밝게 → 어둡게 → 시스템.
// 색 자체는 styles/tokens.css 가 이미 세 경우를 다 정의해 뒀다 —
// prefers-color-scheme(시스템) · [data-theme="dark"] · [data-theme="light"].
//
// 어디에 기억하나
//   (1) 이 브라우저 — localStorage THEME_KEY. 로그인하지 않아도 다음 방문에 유지된다
//   (2) 계정 — 로그인(승인)한 사용자는 Firestore users/{uid}.theme 에도 적는다.
//       다른 기기에서 로그인하면 그 값을 따라온다 (auth.js loadFavs 가 읽어 applyTheme 한다)
//   둘이 어긋나면 계정 값이 이긴다 — 사용자가 마지막으로 고른 값이 계정에 있기 때문이다.
//
// 첫 화면 깜빡임
//   저장한 값은 index.html 의 <head> 인라인 스크립트가 먼저 붙인다(번들보다 앞선다).
//   여기서는 그 뒤에 버튼을 만들고 상태를 맞추기만 한다.
//
// 제공하는 전역
//   THEME_KEY · THEME_ORDER · themeChoice() · applyTheme(choice, opts) · initTheme()
//
// 의존하는 전역
//   AUTH · authEmail (components/auth.js) · track (track.js)
// ─────────────────────────────────────────────────────────────────────────────

const THEME_KEY = 'pogo_theme';
const THEME_ORDER = ['system', 'light', 'dark'];
// [상태, 버튼 아이콘, 버튼이 말하는 것]
// 아이콘은 **지금 상태**를 가리킨다 — 언어 버튼(EN)은 "누르면 갈 곳"을 말하지만, 테마는
// 세 상태를 도는 버튼이라 "다음에 무엇이 되는지"를 한 글자로 못 적는다. 대신 aria-label 로 밝힌다
const THEME_FACE = {
  system: ['🌗', '화면 테마: 기기 설정 따름 — 누르면 밝게'],
  light: ['☀️', '화면 테마: 밝게 — 누르면 어둡게'],
  dark: ['🌙', '화면 테마: 어둡게 — 누르면 기기 설정 따름'],
};

// 이 브라우저에 저장된 선택. 모르는 값이면 기본(system)
function themeChoice() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEME_ORDER.includes(saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

// 선택을 실제로 적용한다.
//   opts.save   false 면 저장하지 않는다 (계정에서 읽어 온 값을 되돌려 쓰지 않으려고)
//   opts.sync   false 면 계정에 쓰지 않는다
function applyTheme(choice, opts = {}) {
  const next = THEME_ORDER.includes(choice) ? choice : 'system';
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);
  if (opts.save !== false) { try { localStorage.setItem(THEME_KEY, next); } catch {} }
  syncThemeButton(next);
  syncThemeColor(next);
  if (opts.sync !== false) saveThemeToAccount(next);
  return next;
}

// 지금 상태를 한 낱말로 — 드로어 줄에 붙는다 (아이콘만으로는 세 상태가 안 읽힌다)
const THEME_WORD = { system: '기기 설정', light: '밝게', dark: '어둡게' };

// 버튼 얼굴 맞추기 — 헤더 버튼과 드로어 줄 둘 다. 아직 없을 수 있다(초기화 순서)
function syncThemeButton(choice) {
  const [icon, label] = THEME_FACE[choice] ?? THEME_FACE.system;
  const button = document.getElementById('theme-toggle');
  if (button) {
    button.textContent = icon;
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  // 좁은 화면의 ☰ 메뉴 줄 — 헤더에 자리가 없어 이쪽이 대신한다
  const menuIcon = document.querySelector('#menu-theme .drawer__ico');
  const menuValue = document.getElementById('menu-theme-value');
  if (menuIcon) menuIcon.textContent = icon;
  if (menuValue) menuValue.textContent = THEME_WORD[choice] ?? THEME_WORD.system;
  document.getElementById('menu-theme')?.setAttribute('aria-label', label);
}

// 브라우저 상단 바 색(theme-color) — 고른 화면과 어긋나면 주소창만 다른 색으로 남는다.
// index.html 의 두 meta 는 기기 설정용이라, 직접 고른 경우에만 한 장을 덮어쓴다
function syncThemeColor(choice) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    if (choice === 'system') meta.removeAttribute('data-forced');
    else if (!meta.hasAttribute('media')) meta.setAttribute('data-forced', '1');
  }
  let forced = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!forced) {
    forced = document.createElement('meta');
    forced.name = 'theme-color';
    document.head.appendChild(forced);
  }
  forced.content = dark ? '#0b0f15' : '#ffffff';
}

// 계정에 적는다 — 승인된 로그인 사용자만. 실패해도 화면은 이미 바뀌었으므로 조용히 넘긴다
// (규칙상 본인 문서만 쓸 수 있고, firestore.rules 의 smallDoc 이 문서 크기를 막는다)
function saveThemeToAccount(choice) {
  if (!AUTH.db || !AUTH.user || AUTH.status !== 'ok') return;
  AUTH.db.collection('users').doc(AUTH.user.uid).set({
    email: authEmail(), theme: choice, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

// 버튼을 달고 저장된 값을 화면에 맞춘다. app.js 가 첫 렌더 뒤에 한 번 부른다
function initTheme() {
  // 저장된 값은 head 인라인 스크립트가 이미 붙였다 — 여기서 다시 쓰지 않는다(save: false)
  applyTheme(themeChoice(), { save: false, sync: false });
  const cycle = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(themeChoice()) + 1) % THEME_ORDER.length];
    applyTheme(next);
    track('theme_switch', { to: next });  // GA4: 기기 설정 말고 직접 고르는 사람이 얼마나 되나
  };
  // 헤더 버튼(넓은 화면)과 ☰ 메뉴 줄(좁은 화면) — 같은 일을 하는 두 자리다.
  // 한 화면에 둘이 같이 보이지는 않는다 (CSS 가 폭에 따라 하나만 켠다)
  document.getElementById('theme-toggle')?.addEventListener('click', cycle);
  document.getElementById('menu-theme')?.addEventListener('click', cycle);
  // 시스템 설정을 따르는 동안에는 기기가 바뀔 때 상단 바 색도 같이 바뀌어야 한다
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (themeChoice() === 'system') syncThemeColor('system');
  });
}
