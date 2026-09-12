'use strict';
// 회귀 스위트 공통 조각 (2026-09-12 v3.14.0)
//
// 스위트 22개가 같은 머리말을 각자 들고 있었다 — 브라우저 경로 · PASS/FAIL 집계 · 가입 권유 팝업 끄기 ·
// 바깥 요청 차단 · 스플래시 기다리기 · 종료 코드. 한 줄을 고치려면 스무 파일을 열어야 했고,
// 스위트마다 조금씩 달라져 있었다(대기 시간 12초/15초, ' :: ' 구분자). 여기 한 벌만 둔다.
//
// 파일 이름이 _ 로 시작하는 것은 스위트가 아니다 — scripts/test.sh 가 건너뛴다.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const CHROMIUM = '/opt/pw-browsers/chromium';
const SERVER = 'http://localhost:5503/';

// PASS/FAIL 한 줄씩 찍고 센다. 스위트 끝의 finish() 가 합계를 낸다
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + ' ' + extra); cond ? pass++ : fail++; };

const launch = () => chromium.launch({ executablePath: CHROMIUM });

// 새 컨텍스트 — 스위트가 늘 같은 세 가지를 먼저 한다
//   1. 가입 권유 팝업을 '본 적 있음' 으로 — 안 그러면 3초 뒤 모달이 떠서 그 뒤의 클릭을 전부 가로챈다
//      (팝업 자체는 signup-invite.js 가 따로 검사한다)
//   2. 통계 동의 배너를 '거부' 로 — 스위트마다 화면을 옮길 때 `.consent__deny` 를 눌러 끄고 있었는데,
//      배너는 첫 화면에만 뜨므로 두 번째부터는 **없는 버튼을 1.5초씩 기다리다** 포기하는 줄이었다.
//      화면 이동 30번이면 45초다 — shell.js 가 100초 걸리던 절반이 이것이었다.
//      배너 자체를 검사하는 스위트(legal.js)는 { banner: true } 로 그대로 띄운다
//   3. localhost 바깥 요청 차단 — 폰트·스프라이트 CDN 을 기다리느라 느려지지 않게
async function newContext(browser, { banner = false, ...options } = {}) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript((keepBanner) => {
    try {
      localStorage.setItem('pogo_signup_invite_seen', '1');
      if (!keepBanner) localStorage.setItem('pogo_consent', 'denied');
    } catch {}
  }, banner);
  await ctx.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  return ctx;
}

// 화면 이동 — 스플래시가 걷힐 때까지 기다린다 (첫 화면 그림이 다 들어올 때까지 최대 2.5초 머문다)
async function go(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
}

// 스위트 끝 — 합계를 찍고 종료 코드로 알린다 (test.sh 는 마지막 줄과 종료 코드만 본다)
async function finish(browser) {
  if (browser) await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}

// 스위트 본문을 감싼다 — 예외로 죽으면 CRASH 한 줄과 종료 코드 1
const suite = (body) => body().catch((e) => { console.error('CRASH', e.message); process.exit(1); });

module.exports = { chromium, CHROMIUM, SERVER, ok, launch, newContext, go, finish, suite };
