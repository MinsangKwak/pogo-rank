'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// lib/veil.ts — 화면 덮개 (2026-09-28 제보)
//
// 서버 HTML 은 검색엔진용 본문뿐이고 앱은 붙은 뒤에 그 위에 선다 (AppClient.tsx). 그 사이 글자만 있는 판이
// 먼저 보였다가 앱으로 바뀌어 '깨졌다가 다시 그려지는' 것처럼 보였다. 화면을 옮길 때도 새 화면이 서기까지의
// 그리는 시간이 그대로 보였다. 그래서 문서에 덮개(app/layout.tsx 의 #veil)를 정적으로 두고 여기서 걷는다.
//
// **덮개는 서버가 그리고, 여기는 걷기만 한다.** React 로 그리면 붙기 전(하이드레이션 전)에는 없다 — 그 구간이
// 바로 가려야 할 구간이다. 걷을 때는 최소 300ms 는 보이고(순간 번쩍임 방지), 8초가 지나면 무조건 걷는다
// (무엇이 잘못돼도 사람을 덮개 뒤에 가두지 않는다). JS 가 아예 없으면 <noscript> 가 지운다.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SHOWN = 300;     // 이보다 짧게 보이면 번쩍임이다
const MAX_SHOWN = 8000;    // 이보다 오래 서 있으면 덮개가 고장이다
const FADE = 200;          // shell.css 의 transition 과 같은 값

let shownAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let fontsWaited = false;

function el(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById('veil');
}

function hideNow(): void {
  const veil = el();
  if (!veil) return;
  clearTimeout(timer);
  veil.classList.add('is-out');
  veil.classList.remove('veil--boot');
  veil.setAttribute('aria-busy', 'false');
  timer = setTimeout(() => { veil.hidden = true; }, FADE);
}

/** 화면을 옮기기 시작할 때 — 새 화면이 설 때까지 덮는다 */
export function showVeil(): void {
  const veil = el();
  if (!veil) return;
  clearTimeout(timer);
  shownAt = performance.now();
  veil.hidden = false;
  veil.classList.remove('is-out');
  veil.setAttribute('aria-busy', 'true');
  timer = setTimeout(hideNow, MAX_SHOWN);
}

/** 화면이 섰을 때 — 최소 노출 시간을 채우고 걷는다. 이미 걷혔으면 아무 일도 없다 */
export function settleVeil(): void {
  const veil = el();
  if (!veil || veil.hidden || veil.classList.contains('is-out')) return;
  const wait = Math.max(0, MIN_SHOWN - (performance.now() - shownAt));
  clearTimeout(timer);
  timer = setTimeout(hideNow, wait);
}

/**
 * 첫 화면 — 글꼴까지 기다린 뒤 걷는다. 글꼴이 늦게 와서 글자가 한 번 더 바뀌는 것도 덮개 뒤에서 끝낸다.
 * 글꼴이 안 오면 1.5초만 기다린다 (덮개가 글꼴 때문에 서 있으면 안 된다)
 */
export function settleVeilAfterFonts(): void {
  if (fontsWaited) { settleVeil(); return; }
  fontsWaited = true;
  const fonts = typeof document !== 'undefined' ? document.fonts?.ready : undefined;
  const cap = new Promise<void>((resolve) => setTimeout(resolve, 1500));
  Promise.race([fonts ?? cap, cap]).then(settleVeil, settleVeil);
}

/** 검사에서 판을 새로 깔 때만 쓴다 */
export function resetVeil(): void {
  clearTimeout(timer);
  shownAt = 0;
  fontsWaited = false;
}
