'use strict';
// v2.27.0 보안·공유·검색 회귀
//
// 이 스위트가 지키려는 것
//   - CSP 가 실제로 걸려 있고, 외부 스크립트 주입이 막히는가 (선언만 있고 안 먹는 경우가 흔하다)
//   - 공유 카드가 뜨는 데 필요한 값이 다 있고, 그림이 실제로 받아지는가
//   - dev 미리보기가 실서비스 주소를 가리키지 않는가 (링크를 잘못 퍼뜨리는 사고)
//   - 검색·보안 부속 파일(sitemap · robots · security.txt · 404)이 나오는가
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = 'http://localhost:5503/';
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + ' ' + x); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // 폰트·스프라이트 CDN 만 막는다. CSP 위반 여부를 보려면 페이지 자체는 정상으로 굴려야 한다
  // 2026-09-12 v3.11.0 첫 방문 가입 권유 팝업은 '본 적 있음' 으로 표시해 두고 시작한다 —
  // 안 그러면 3초 뒤 모달이 떠서 그 뒤의 클릭을 전부 가로챈다 (동의 배너를 끄는 것과 같은 처방).
  // 팝업 자체는 tests/e2e/signup-invite.js 가 따로 검사한다
  await ctx.addInitScript(() => { try { localStorage.setItem('pogo_signup_invite_seen', '1'); } catch {} });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  // 2026-09-10 v2.44.0 Firebase 로그인이 받는 파일은 막지 않고 **가짜 응답**으로 바꿔 둔다 —
  // 이 검사는 네트워크가 아니라 CSP 를 보는 것이라, 밖으로 못 나가는 환경에서도 답이 같아야 한다.
  // 위 전면 차단보다 **뒤에** 등록해야 한다 — Playwright 는 나중에 건 route 가 이긴다
  await ctx.route('https://apis.google.com/js/api.js*', (r) =>
    r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__gapiProbe = true;' }));
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.locator('#consent .consent__deny').click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);

  // ── CSP
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  ok('CSP 메타 있음', csp.length > 0);
  for (const directive of ['default-src', 'script-src', 'connect-src', 'object-src', 'base-uri', 'form-action']) {
    ok(`CSP ${directive} 지정`, csp.includes(directive), '');
  }
  ok('CSP object-src 차단', /object-src\s+'none'/.test(csp));
  ok('CSP base-uri 차단', /base-uri\s+'none'/.test(csp));
  // 2026-09-10 v2.44.0 조이기만 세던 검사에 **우리가 쓰는 출처**를 더한다.
  // v2.27.0 에서 apis.google.com 을 빠뜨려 Google 로그인이 통째로 막혔는데(auth/internal-error),
  // 위 단언들은 전부 통과했다 — "빡빡한가" 만 묻고 "우리 것이 지나가는가" 는 안 물었기 때문이다.
  // 출처는 실제로 그 파일을 받는 코드에서 따온다:
  //   apis.google.com/js/api.js   firebase-auth-compat 가 인증 iframe 을 띄우기 전에 받는다
  //   www.gstatic.com/firebasejs  SDK 본체 (components/auth.js loadScript)
  //   googletagmanager.com        GA4 (scripts/track.js)
  //   fonts.*·cdn.jsdelivr.net    웹폰트 (index.html)
  //   raw.githubusercontent.com   스프라이트·데이터 (scripts/sprite.js)
  const needed = [
    ['script-src', 'https://apis.google.com', 'Firebase 로그인 iframe 로더'],
    ['script-src', 'https://www.gstatic.com', 'Firebase SDK'],
    ['script-src', 'https://www.googletagmanager.com', 'GA4'],
    ['frame-src', 'https://apis.google.com', 'Firebase 로그인 iframe'],
    ['frame-src', 'https://*.firebaseapp.com', 'Firebase 인증 핸들러'],
    ['frame-src', 'https://accounts.google.com', 'Google 로그인'],
    ['connect-src', 'https://*.googleapis.com', 'Firestore·Identity Toolkit'],
    ['style-src', 'https://fonts.googleapis.com', '웹폰트'],
    ['font-src', 'https://fonts.gstatic.com', '웹폰트'],
    ['img-src', 'https://raw.githubusercontent.com', '스프라이트'],
    ['img-src', 'https://*.googleusercontent.com', '계정 프로필 사진'],
  ];
  for (const [directive, origin, why] of needed) {
    // 해당 지시어의 값 구간만 잘라서 본다 — 다른 지시어에 있는 걸 있다고 세면 안 된다
    const section = (csp.split(';').find((part) => part.trim().startsWith(directive + ' ')) || '');
    ok(`CSP ${directive} 에 ${origin} (${why})`, section.includes(origin), section.trim());
  }
  // 실제로 막히는가 — 허용 목록에 없는 출처의 스크립트를 심어 본다
  const injected = await page.evaluate(() => new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://example.com/evil.js';
    s.onload = () => resolve('loaded');
    s.onerror = () => resolve('blocked');
    document.head.appendChild(s);
    setTimeout(() => resolve('blocked'), 1500);
  }));
  ok('허용하지 않은 출처의 스크립트 차단', injected === 'blocked', injected);

  // ── 2026-09-10 v2.49.1 버그 제보 링크가 그 주소인가
  // 노션 정리 중에 관리용 WBS 문서가 따로 생겼다. 둘은 쓰는 사람이 다르다 —
  // 제보자는 외부 사용자고 WBS 는 내부용이라 권한도 내용도 다르다.
  // 바뀌면 제보가 엉뚱한 곳으로 가거나 아예 못 쓰게 되는데, 주소만 봐서는 티가 안 난다.
  // 그래서 "맞는 주소인가" 가 아니라 **정확히 이 주소인가** 를 못 박는다
  const BUG_REPORT_URL = 'https://www.notion.so/a0472984122d4f25b9b445b57465568f';
  const reportHref = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a.drawer__item')]
      .find((a) => (a.textContent || '').includes('버그 제보'));
    return link ? link.getAttribute('href') : null;
  });
  ok('버그 제보 링크가 사용자 트래커 주소', reportHref === BUG_REPORT_URL, String(reportHref));
  ok('버그 제보 링크가 새 창으로 (rel=noopener)', await page.evaluate(() => {
    const link = [...document.querySelectorAll('a.drawer__item')].find((a) => (a.textContent || '').includes('버그 제보'));
    return link?.target === '_blank' && /noopener/.test(link?.rel || '');
  }));
  // 2026-09-10 v2.44.0 문자열 검사만으로는 부족해 실제로 받아 본다.
  // firebase-auth-compat 는 로그인할 때 이 파일을 받고, 실패하면 그 onerror 를 auth/internal-error 로
  // 바꿔 던진다 — v2.27.0~v2.43.0 동안 Google 로그인이 막혀 있던 경로가 정확히 여기다
  const gapi = await page.evaluate(() => new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js?onload=probe';
    s.onload = () => resolve('loaded');
    s.onerror = () => resolve('blocked');
    document.head.appendChild(s);
    setTimeout(() => resolve('timeout'), 4000);
  }));
  ok('Firebase 로그인용 api.js 가 CSP 를 통과', gapi === 'loaded', gapi);
  // loadScript 자체도 출처를 본다 (CSP 가 없는 환경에서도 한 겹 더)
  const guarded = await page.evaluate(() => loadScript('https://example.com/evil.js').then(() => 'allowed', (e) => String(e.message).includes('허용하지 않은') ? 'rejected' : 'other'));
  ok('loadScript 가 출처를 검사', guarded === 'rejected', guarded);

  ok('referrer 정책 지정', (await page.evaluate(() => document.querySelector('meta[name="referrer"]')?.content)) === 'strict-origin-when-cross-origin');

  // ── 공유 카드(OG)
  const meta = await page.evaluate(() => {
    const get = (sel) => document.querySelector(sel)?.content || '';
    return {
      title: get('meta[property="og:title"]'), desc: get('meta[property="og:description"]'),
      image: get('meta[property="og:image"]'), url: get('meta[property="og:url"]'),
      w: get('meta[property="og:image:width"]'), h: get('meta[property="og:image:height"]'),
      alt: get('meta[property="og:image:alt"]'), type: get('meta[property="og:type"]'),
      twitter: get('meta[name="twitter:card"]'), description: get('meta[name="description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    };
  });
  ok('og:title', meta.title.includes('POGO PLAN'), meta.title);
  ok('og:description 있음', meta.desc.length > 20);
  ok('og:image 절대주소', /^https:\/\//.test(meta.image), meta.image);
  ok('og:image 크기 1200×630', meta.w === '1200' && meta.h === '630');
  ok('og:image:alt 있음', meta.alt.length > 0);
  ok('og:type=website', meta.type === 'website');
  ok('twitter 큰 카드', meta.twitter === 'summary_large_image');
  ok('meta description 있음', meta.description.length > 40);
  ok('canonical 과 og:url 일치', meta.canonical === meta.url, `${meta.canonical} / ${meta.url}`);

  // 그림이 실제로 받아지고 크기가 맞는가 — 메타만 있고 파일이 없는 사고가 가장 흔하다
  const og = await page.evaluate(() => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = 'og.png';
  }));
  ok('og.png 실제로 받아짐', !!og && og.w === 1200 && og.h === 630, JSON.stringify(og));

  // 2026-09-12 v3.6.0 검색 색인용 표시를 뺐다 — 아직 검색엔진에 올릴 단계가 아니다.
  // 구조화 데이터(JSON-LD)와 실서비스 robots 줄이 **없음**을 지킨다. 되살릴 때 이 검사 둘을 뒤집으면 된다
  const ldCount = await page.evaluate(() => document.querySelectorAll('script[type="application/ld+json"]').length);
  ok('구조화 데이터 없음', ldCount === 0, String(ldCount));
  const robotsMetas = await page.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((n) => n.content));
  // dev 미리보기만 noindex 한 줄을 넣는다. 실서비스는 아예 없다
  ok('robots 메타는 dev 의 noindex 한 줄뿐', robotsMetas.length === 0 || (robotsMetas.length === 1 && /noindex/.test(robotsMetas[0])), robotsMetas.join(' / '));

  // ── 2026-09-10 v2.50.0 최신 여부 확인 (components/freshness.js)
  // 설치형 앱은 한 번 띄우면 그대로 살아 있어, 며칠이 지나도 처음 받은 data.js 를 보여 준다.
  // 서버는 매일 새로 빌드하는데 사용자는 옛 알 부화 풀을 보고 "반영이 안 된다" 고 겪는다.
  // 그걸 알아채는 장치가 실제로 도는지 본다
  const buildMark = await page.evaluate(async () => {
    const res = await fetch('build.json?t=' + Date.now(), { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  });
  ok('build.json 이 나온다', !!buildMark, JSON.stringify(buildMark));
  ok('build.json 에 버전과 데이터 날짜', !!(buildMark?.version && buildMark?.fetched), JSON.stringify(buildMark));
  ok('build.json 은 작다 (확인 비용)', JSON.stringify(buildMark).length < 200, `${JSON.stringify(buildMark).length}B`);
  ok('띄워 둔 버전과 표식이 일치', await page.evaluate((v) => currentBuildMark().version === v, buildMark.version), buildMark.version);
  ok('같은 빌드면 알림이 안 뜬다', (await page.evaluate(() => checkFreshness(true))) === null);
  ok('같은 빌드면 알림 줄도 없다', (await page.locator('.fresh-bar').count()) === 0);
  // 서버가 새 빌드를 낸 척 — 알림이 떠야 한다
  await page.route('**/build.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ version: 'v9.99.0', fetched: '2099-01-01', timestamp: 'x' }) }));
  await page.evaluate(() => checkFreshness(true));
  await page.waitForTimeout(300);
  ok('새 빌드면 알림 줄이 뜬다', await page.locator('.fresh-bar').isVisible());
  ok('알림에 데이터 날짜를 적는다', /2099-01-01/.test(await page.locator('.fresh-bar__text').textContent()));
  // 자동으로 새로고침하지 않는다 — 보던 화면이 통째로 날아가면 안 된다
  ok('자동 새로고침은 하지 않는다', await page.locator('.fresh-bar__go').isVisible());
  await page.locator('.fresh-bar__close').click();
  await page.waitForTimeout(200);
  ok('닫으면 사라진다', (await page.locator('.fresh-bar').count()) === 0);
  await page.unroute('**/build.json*');

  ok('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();

  // ── 부속 파일 (브라우저 없이 직접 받아 본다)
  const grab = async (path) => {
    const res = await fetch(BASE + path).catch(() => null);
    return res && res.ok ? res.text() : null;
  };
  const robots = await grab('robots.txt');
  ok('robots.txt 있음', !!robots);
  ok('robots 에 sitemap 위치', !!robots && robots.includes('Sitemap:'));
  ok('robots 가 무거운 산출물 제외', !!robots && robots.includes('Disallow: /data.js') && robots.includes('Disallow: /sprites/'));
  const sitemap = await grab('sitemap.xml');
  ok('sitemap.xml 있음', !!sitemap && sitemap.includes('<urlset'));
  const security = await grab('.well-known/security.txt');
  ok('security.txt 있음', !!security && security.includes('Contact:'));
  ok('security.txt 만료일 있음', !!security && /Expires:\s*\d{4}-/.test(security));
  const notFound = await grab('404.html');
  ok('404.html 있음', !!notFound && notFound.includes('찾을 수 없'));
  ok('404 는 색인 금지', !!notFound && notFound.includes('noindex'));

  await browser.close();
  console.log(`${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
