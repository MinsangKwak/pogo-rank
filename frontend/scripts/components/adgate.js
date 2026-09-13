'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// components/adgate.js — 광고 보고 열기 (2026-09-13 v3.25.0)
//
// 2026-09-12 v3.16.0~v3.17.1 '잠시 써보기'(로그인 없이 세 번, 한 번에 2시간)의 후신이다.
// 2026-09-12 v3.18.0 부터 잠금을 통째로 열어 두었던 것을 v3.25.0 에 닫고, 문을 둘로 정했다:
//   [📺 광고 보고 다 훑어보기]      15초 광고를 끝까지 보면 잠긴 화면 전부가 2시간 열린다 — 하루 세 번까지
//   [🔐 광고 안 보고 회원가입 후 보기] Google 로그인(승인제) — 가입하면 광고 없이 늘 열린다
//
// 왜 이렇게
//   잠금 안내까지는 보는데 승인제 로그인까지 가는 사람이 없었다. 열어 두면 가입할 이유가 없고, 잠그면 돌아선다.
//   광고는 "가입 대신 치르는 값" 이다 — 보는 사람은 서비스를 쓰고, 운영자는 광고로 비용을 대고, 가입은 광고를 없애는 길이 된다.
//
// 어떻게 도나
//   routeLocked(router.js) 가 잠금을 정하는 유일한 자리다. 거기서 adUnlockActive() 가 참이면 잠그지 않는다 —
//   화면·메뉴·홈 타일이 전부 같은 규칙으로 열리고 닫힌다. 남은 시간은 오른쪽 위 고정 배지(#ad-timer)가 센다.
//   광고 자리(adSlotNode)는 운영 설정 ADSENSE_CLIENT · ADSENSE_SLOT 이 있으면 AdSense <ins>, 없으면 "광고 준비 중" 상자다 —
//   상자여도 15초는 똑같이 센다 (연결 전에도 흐름이 같아야 연결한 날 아무것도 안 바뀐다).
//
// 저장 (localStorage)
//   pogo_trial_until  열림이 끝나는 시각(ms) — 옛 이름 그대로, 뜻이 같다(새로고침해도 이어진다)
//   pogo_ad_views     'YYYY-MM-DD|n' — 오늘 본 광고 수 (날이 바뀌면 0 부터)
//
// 제공하는 전역
//   adUnlockActive()           지금 광고로 열려 있는가
//   adViewsLeft()              오늘 더 볼 수 있는 광고 수
//   startAdView(screenName)    광고 시트를 연다 — 다 보면 열린다. 오늘 횟수가 없으면 false
//   adGateButtons(screenName)  잠금 카드·로그인 유도 팝업에 붙는 버튼 둘 [광고 · 회원가입]
//   adSlotNode()               광고 자리 (AdSense 또는 준비 중 상자)
// ─────────────────────────────────────────────────────────────────────────────
const AD_UNTIL_KEY = 'pogo_trial_until';
const AD_VIEWS_KEY = 'pogo_ad_views';
const AD_MAX_PER_DAY = 3;
let AD_SECONDS = 15;                  // let — 회귀(tests/e2e/ad-gate.js)가 줄여 쓴다
let AD_UNLOCK_SECONDS = 2 * 60 * 60;  // 광고 한 번에 열리는 시간
let adTick = null;

// 오늘 — 기기의 지역 날짜. 자정이 지나면 횟수가 돌아온다
function adDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function adViewsToday() {
  try {
    const [day, count] = (localStorage.getItem(AD_VIEWS_KEY) || '').split('|');
    return day === adDayKey() ? Math.max(0, Number(count) || 0) : 0;
  } catch { return 0; }
}
function adViewsLeft() {
  return Math.max(0, AD_MAX_PER_DAY - adViewsToday());
}
function adUnlockUntil() {
  try { return Number(localStorage.getItem(AD_UNTIL_KEY)) || 0; } catch { return 0; }
}
function adUnlockActive() {
  return Date.now() < adUnlockUntil();
}
// 로그인 기능이 없는 빌드거나 이미 로그인한 사람에겐 광고 문이 없다
function adGateOff() {
  if (typeof authEnabled === 'function' && !authEnabled()) return true;
  return typeof AUTH !== 'undefined' && AUTH.status !== 'anon';
}

// 기간·남은 시간을 사람 말로 — 2시간 · 1시간 59분 · 59분 30초 · 30초
function adSpanLabel(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return sec > 0 ? `${m}분 ${sec}초` : `${m}분`;
  return `${sec}초`;
}

// 잠금이 바뀐 뒤 화면을 맞춘다 — 메뉴 자물쇠(syncLockedNav)와 지금 보고 있는 화면(auth.js onAuthChange 와 같은 규칙)
function adRerender() {
  if (typeof syncLockedNav === 'function') syncLockedNav();
  const nowRoute = typeof routeOf === 'function' ? routeOf()?.route : null;
  if (!nowRoute?.locked) return;
  if (nowRoute.kind === 'page') renderPage();
  else if (typeof render === 'function' && typeof _planShellReady !== 'undefined' && _planShellReady) render();
}

// 광고 자리 — 운영 설정이 있으면 AdSense, 없으면 준비 중 상자. 둘 다 같은 크기라 시트 높이가 안 흔들린다
function adSlotNode() {
  const client = typeof ADSENSE_CLIENT !== 'undefined' ? ADSENSE_CLIENT : '';
  const slot = typeof ADSENSE_SLOT !== 'undefined' ? ADSENSE_SLOT : '';
  if (client && slot) {
    const ins = el('ins', { class: 'adsbygoogle ad-gate__slot', style: 'display:block', 'data-ad-client': client, 'data-ad-slot': slot, 'data-ad-format': 'auto', 'data-full-width-responsive': 'true' });
    // 스크립트(index.html 의 adsbygoogle.js)가 아직이면 큐에 쌓였다가 도착하면 채운다
    queueMicrotask(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} });
    return ins;
  }
  return el('div', { class: 'ad-gate__slot ad-gate__slot--empty' },
    el('b', {}, '광고 준비 중'),
    el('span', {}, '곧 이 자리에 광고가 나와요. 지금은 시간만 셉니다'));
}

// 광고 시트 — 화면 아래에 붙어 15초를 센다. 끝까지 보면 열린다. 중간에 닫으면 열리지 않고 횟수도 안 센다
function startAdView(screenName) {
  if (adGateOff()) return false;
  if (adUnlockActive()) return true;
  if (adViewsLeft() <= 0) return false;
  closeModal({ silent: true });
  document.getElementById('ad-gate')?.remove();
  track('ad_start', { screen: screenName || '', n: adViewsToday() + 1 });   // GA4: 오늘 몇 번째 광고인가
  let left = AD_SECONDS;
  const $left = el('b', { class: 'ad-gate__left' }, `${left}초`);
  const $bar = el('i', { class: 'ad-gate__bar' });
  const $cancel = el('button', { class: 'ad-gate__cancel', onclick: () => { clearInterval(adTick); adTick = null; sheet.remove(); track('ad_cancel', { screen: screenName || '', left }); } }, '그만 볼래요');
  const sheet = el('aside', { id: 'ad-gate', class: 'ad-gate', role: 'dialog', 'aria-label': '광고 보는 중', 'aria-live': 'polite' },
    el('div', { class: 'ad-gate__head' },
      el('span', { class: 'ad-gate__title' }, '📺 광고 보는 중'),
      el('span', { class: 'ad-gate__count' }, '끝까지 보면 ', el('b', {}, adSpanLabel(AD_UNLOCK_SECONDS)), ' 동안 전부 열려요 · '),
      $left, $cancel),
    adSlotNode(),
    el('div', { class: 'ad-gate__track' }, $bar));
  document.body.append(sheet);
  const started = Date.now();
  clearInterval(adTick);
  adTick = setInterval(() => {
    const elapsed = (Date.now() - started) / 1000;
    left = Math.max(0, Math.ceil(AD_SECONDS - elapsed));
    $left.textContent = `${left}초`;
    $bar.style.width = `${Math.min(100, elapsed / AD_SECONDS * 100)}%`;
    if (left > 0) return;
    clearInterval(adTick); adTick = null;
    adViewDone(screenName, sheet);
  }, 250);
  return true;
}

function adViewDone(screenName, sheet) {
  const count = adViewsToday() + 1;
  try {
    localStorage.setItem(AD_VIEWS_KEY, `${adDayKey()}|${count}`);
    localStorage.setItem(AD_UNTIL_KEY, String(Date.now() + AD_UNLOCK_SECONDS * 1000));
  } catch { sheet.remove(); return; }   // 저장이 안 되면 횟수를 셀 수 없다 — 열어 주지 않는다
  track('ad_done', { screen: screenName || '', n: count });
  sheet.classList.add('is-done');
  setTimeout(() => sheet.remove(), 400);
  adRerender();
  adTimerStart(screenName);
}

// ── 오른쪽 위 고정 배지 — 광고로 열린 시간이 얼마나 남았나 ─────────────────────
function adTimerNode() {
  let badge = document.getElementById('ad-timer');
  if (badge) return badge;
  badge = el('div', { id: 'ad-timer', class: 'ad-timer', role: 'status', 'aria-live': 'polite' },
    el('span', { class: 'ad-timer__label' }, '광고로 열림'),
    el('b', { class: 'ad-timer__left' }, ''));
  document.body.append(badge);
  return badge;
}
function adTimerStart(screenName) {
  clearInterval(adTick);
  const badge = adTimerNode();
  const paint = () => {
    const left = Math.max(0, Math.ceil((adUnlockUntil() - Date.now()) / 1000));
    badge.querySelector('.ad-timer__left').textContent = adSpanLabel(left);
    // 마지막 5분(짧게 줄인 회귀에서는 몇 초)부터 빨갛게 — 끝나는 것을 미리 알린다
    badge.classList.toggle('is-ending', left <= Math.min(300, Math.max(2, AD_UNLOCK_SECONDS / 4)));
    if (left > 0) return;
    clearInterval(adTick); adTick = null;
    adUnlockEnd(screenName);
  };
  paint();
  adTick = setInterval(paint, AD_UNLOCK_SECONDS >= 60 ? 1000 : 250);
}
function adUnlockEnd(screenName) {
  document.getElementById('ad-timer')?.remove();
  track('ad_unlock_end', { screen: screenName || '', left: adViewsLeft() });
  adRerender();
  // 끝나자마자 문 둘을 다시 보여 준다 — 방금 본 것이 무엇이었는지 기억이 있을 때가 가입을 말할 자리다
  if (typeof openLoginInvite === 'function' && !adGateOff() && !document.querySelector('dialog[open]')) openLoginInvite(screenName);
}
// 새로고침해도 진행 중이던 열림은 이어진다 — 배지를 다시 세운다
function adUnlockResume() {
  if (!adGateOff() && adUnlockActive()) adTimerStart('');
}

// 잠금 카드·로그인 유도 팝업에 붙는 버튼 둘. 이미 로그인했거나 승인 대기면 빈 배열 — 부르는 쪽이 제 문구를 쓴다
function adGateButtons(screenName) {
  if (adGateOff()) return [];
  const left = adViewsLeft();
  const adButton = left > 0
    ? el('button', { class: 'drawer__item ad-gate__go', onclick: () => startAdView(screenName) },
        el('b', {}, `📺 광고 보고 다 훑어보기 (${adSpanLabel(AD_SECONDS)} 광고)`),
        el('span', { class: 'ad-gate__sub' }, `오늘 ${left}번 남음 · 한 번에 ${adSpanLabel(AD_UNLOCK_SECONDS)}`))
    : el('button', { class: 'drawer__item ad-gate__go is-spent', disabled: '' },
        el('b', {}, `📺 오늘 광고 ${AD_MAX_PER_DAY}번을 다 봤어요`),
        el('span', { class: 'ad-gate__sub' }, '내일 다시 볼 수 있어요 — 회원가입하면 광고 없이 늘 열려요'));
  const signupButton = el('button', { class: 'drawer__item account__login login-invite__go', onclick: () => {
    closeModal({ silent: true });
    signIn();
  } }, '🔐 광고 안 보고 회원가입 후 보기');
  return [adButton, signupButton];
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', adUnlockResume);
else adUnlockResume();
