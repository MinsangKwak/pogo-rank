'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-12 v3.16.0 잠시 써보기 — 잠긴 화면을 로그인 없이 20초 동안 열어 준다
//
// 왜 만들었나
//   잠긴 화면 안내(로그인하면 열려요)까지는 보는데, 그 자리에서 로그인·가입 신청까지 가는 사람이 없었다.
//   무엇이 열리는지 모르는 채로 승인제 로그인을 누르라는 건 순서가 거꾸로다 — 먼저 잠깐 보여 주고,
//   세 번을 다 쓰면 "이젠 가입하셔야죠" 로 권한다.
//
// 어떻게 도나
//   routeLocked(router.js) 가 잠금을 정하는 유일한 자리다. 거기서 trialActive() 가 참이면 잠그지 않는다 —
//   그래서 화면·메뉴·홈 타일이 전부 같은 규칙으로 열리고 닫힌다. 남은 시간은 오른쪽 위 고정 배지(#trial-timer)가 센다.
//
// 저장 (localStorage, 새 키는 pogo_ 접두사)
//   pogo_trial_used   지금까지 쓴 횟수 (최대 TRIAL_MAX)
//   pogo_trial_until  진행 중인 잠시 써보기가 끝나는 시각 (ms) — 새로고침해도 시간은 이어진다
//
// 제공하는 전역
//   trialActive()            지금 잠시 써보기 중인가
//   trialLeft()              남은 횟수
//   startTrial(screenName)   시작 — 횟수가 남아 있으면 true
//   trialButtonNode(name)    잠금 카드·로그인 유도 팝업에 붙이는 [잠시 써보기] 버튼 (다 썼으면 권유 문구)
// ─────────────────────────────────────────────────────────────────────────────
const TRIAL_USED_KEY = 'pogo_trial_used';
const TRIAL_UNTIL_KEY = 'pogo_trial_until';
const TRIAL_MAX = 3;
let TRIAL_SECONDS = 20;   // let — 회귀(tests/e2e/trial.js)가 20초를 기다리지 않도록 줄여 쓴다
let trialTick = null;

function trialUsed() {
  try { return Math.max(0, Number(localStorage.getItem(TRIAL_USED_KEY)) || 0); } catch { return 0; }
}
function trialUntil() {
  try { return Number(localStorage.getItem(TRIAL_UNTIL_KEY)) || 0; } catch { return 0; }
}
function trialLeft() {
  return Math.max(0, TRIAL_MAX - trialUsed());
}
function trialActive() {
  return Date.now() < trialUntil();
}

// 잠금이 바뀐 뒤 화면을 맞춘다 — 메뉴 자물쇠(syncLockedNav)와 지금 보고 있는 화면(auth.js onAuthChange 와 같은 규칙)
function trialRerender() {
  if (typeof syncLockedNav === 'function') syncLockedNav();
  const nowRoute = typeof routeOf === 'function' ? routeOf()?.route : null;
  if (!nowRoute?.locked) return;
  if (nowRoute.kind === 'page') renderPage();
  else if (typeof render === 'function' && typeof _planShellReady !== 'undefined' && _planShellReady) render();
}

function startTrial(screenName) {
  if (trialActive()) return true;
  if (trialLeft() <= 0) return false;
  const used = trialUsed() + 1;
  try {
    localStorage.setItem(TRIAL_USED_KEY, String(used));
    localStorage.setItem(TRIAL_UNTIL_KEY, String(Date.now() + TRIAL_SECONDS * 1000));
  } catch { return false; }   // 저장이 안 되면 횟수를 셀 수 없다 — 열어 주지 않는다
  track('trial_start', { screen: screenName || '', n: used });   // GA4: 몇 번째 잠시 써보기인가
  closeModal({ silent: true });
  trialRerender();
  trialTimerStart(screenName);
  return true;
}

// ── 오른쪽 위 고정 배지 ────────────────────────────────────────────────────────
function trialTimerNode() {
  let badge = document.getElementById('trial-timer');
  if (badge) return badge;
  badge = el('div', { id: 'trial-timer', class: 'trial-timer', role: 'status', 'aria-live': 'polite' },
    el('span', { class: 'trial-timer__label' }, '잠시 써보기'),
    el('b', { class: 'trial-timer__left' }, ''));
  document.body.append(badge);
  return badge;
}

function trialTimerStart(screenName) {
  clearInterval(trialTick);
  const badge = trialTimerNode();
  const paint = () => {
    const left = Math.max(0, Math.ceil((trialUntil() - Date.now()) / 1000));
    badge.querySelector('.trial-timer__left').textContent = `${left}초`;
    badge.classList.toggle('is-ending', left <= 5);
    if (left > 0) return;
    clearInterval(trialTick); trialTick = null;
    trialEnd(screenName);
  };
  paint();
  trialTick = setInterval(paint, 250);
}

function trialEnd(screenName) {
  document.getElementById('trial-timer')?.remove();
  track('trial_end', { screen: screenName || '', left: trialLeft() });
  trialRerender();
  // 끝나자마자 권한다 — 방금 본 것이 무엇이었는지 기억이 있을 때가 가입을 말할 자리다
  if (typeof openLoginInvite === 'function' && AUTH.status === 'anon' && !document.querySelector('dialog[open]')) openLoginInvite(screenName);
}

// 새로고침해도 진행 중이던 잠시 써보기는 이어진다 — 배지를 다시 세운다
function trialResume() {
  if (trialActive()) trialTimerStart('');
}

// 잠금 카드·로그인 유도 팝업에 붙는 조각 — 남았으면 버튼, 다 썼으면 권유 문구
function trialButtonNode(screenName) {
  if (typeof authEnabled === 'function' && !authEnabled()) return '';
  if (AUTH.status !== 'anon') return '';
  const left = trialLeft();
  if (left <= 0) {
    return el('p', { class: 'trial-exhausted' }, `잠시 써보기 ${TRIAL_MAX}번을 다 쓰셨어요. 이젠 가입하셔야죠 🙂`);
  }
  return el('button', { class: 'drawer__item trial-go', onclick: () => startTrial(screenName) },
    el('b', {}, `⏱ 잠시 써보기 (${TRIAL_SECONDS}초)`),
    el('span', { class: 'trial-go__left' }, `남은 횟수 ${left}번`));
}

// 진행 중이던 잠시 써보기가 있으면 배지를 다시 세운다 (첫 화면이 그려진 뒤)
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trialResume);
else trialResume();
