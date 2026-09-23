'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// scripts/lib/visit.mjs — 검사가 화면을 **앱이 다 붙은 뒤에** 보게 한다 (v5 Phase 7)
//
// **왜 생겼나.** 화면·명암 검사는 `#/경로` 로 열고 0.6초 기다린 뒤 훑었다. v4 에서는 그걸로
// 충분했다 — 해시가 바뀌면 같은 문서 안에서 바로 그렸다. Next.js 에서는 두 가지가 다르다.
//   ① 주소가 경로다. `#/mon/149` 는 문서 머리의 스크립트가 `/mon/149` 로 **다시 이동**한다
//   ② 앱은 하이드레이션 뒤에 붙는다. 그전까지는 서버가 그린 '사실 블록'이 서 있다
// 그래서 검사가 이동 중의 빈 문서나 사실 블록을 훑고 **통과했다.** 실측: vercel 판에서
// /mon/149 의 비행 타입 알약(알려진 한계)이 안 잡혔다 — 화면에는 그대로 있었다.
//
// **조용히 통과하는 것이 가장 나쁜 실패다.** 그래서 앱이 끝내 안 붙으면 그 자체를 실패로 적는다.
//
// 두 검사(check_screens · check_contrast)가 이 한 벌을 쓴다 — 방문 방법이 두 벌이면 한쪽만 고쳐진다.
// ─────────────────────────────────────────────────────────────────────────────

/** Next.js 판인가 — App Router 는 문서에 `self.__next_f` 를 심는다. v4(Vite)에는 없다 */
export async function detectRouting(page, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const next = await page.evaluate(() => Array.isArray(self.__next_f)).catch(() => false);
  return next ? 'path' : 'hash';
}

/** 검사 목록의 경로('mon/149')를 판에 맞는 주소로 */
export function urlOf(base, routing, path) {
  return routing === 'path' ? `${base}${path}` : `${base}#/${path}`;
}

/** 보고에 적을 이름 — 판이 달라도 같은 화면은 같은 이름이어야 두 판의 보고를 견줄 수 있다 */
export function labelOf(path) {
  return `/${path}`;
}

/**
 * 연다 → 앱이 붙기를 기다린다 → 받을 것을 다 받기를 잠깐 기다린다.
 * 앱이 안 붙었으면 **던진다** — 부르는 쪽이 [열리지 않음] 으로 적는다.
 */
export async function visit(page, base, routing, path) {
  await page.goto(urlOf(base, routing, path), { waitUntil: 'domcontentloaded', timeout: 30000 });
  // 셸의 머리줄은 v4 와 Next 둘 다 같은 클래스다 — 이게 서야 앱이 붙은 것이다
  await page.waitForSelector('.app-bar', { timeout: 20000 });
  // 사실 블록은 앱이 붙으면 사라진다. 남아 있으면 화면이 데이터를 아직 기다린다
  await page.waitForFunction(() => !document.querySelector('.detail--facts'), null, { timeout: 20000 })
    .catch(() => { throw new Error('앱은 붙었는데 20초 안에 화면이 안 그려졌다 (사실 블록이 그대로다)'); });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
}
