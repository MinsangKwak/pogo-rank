'use strict';
// v2.27.0 보안·공유·검색 회귀
//
// 이 스위트가 지키려는 것
//   - CSP 가 실제로 걸려 있고, 외부 스크립트 주입이 막히는가 (선언만 있고 안 먹는 경우가 흔하다)
//   - 공유 카드가 뜨는 데 필요한 값이 다 있고, 그림이 실제로 받아지는가
//   - dev 미리보기가 실서비스 주소를 가리키지 않는가 (링크를 잘못 퍼뜨리는 사고)
//   - 검색·보안 부속 파일(sitemap · robots · security.txt · 404)이 나오는가
const { launch, newContext, waitSplash, ok, finish, suite } = require('./_lib');
const BASE = 'http://localhost:5503/';

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { viewport: { width: 1280, height: 800 } });
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
  await waitSplash(page);
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
  //   cdn.jsdelivr.net            웹폰트 (index.html) — v3.23.0 부터 Google Fonts 없음
  //   raw.githubusercontent.com   스프라이트·데이터 (scripts/sprite.js)
  const needed = [
    ['script-src', 'https://apis.google.com', 'Firebase 로그인 iframe 로더'],
    ['script-src', 'https://www.gstatic.com', 'Firebase SDK'],
    ['script-src', 'https://www.googletagmanager.com', 'GA4'],
    ['frame-src', 'https://apis.google.com', 'Firebase 로그인 iframe'],
    ['frame-src', 'https://*.firebaseapp.com', 'Firebase 인증 핸들러'],
    ['frame-src', 'https://accounts.google.com', 'Google 로그인'],
    ['connect-src', 'https://*.googleapis.com', 'Firestore·Identity Toolkit'],
    // 2026-09-13 v3.23.0 Google Fonts(Inter) 를 뗐다 — 웹폰트는 jsdelivr(Pretendard · Galmuri) 하나다
    ['style-src', 'https://cdn.jsdelivr.net', '웹폰트 CSS (Pretendard)'],
    ['font-src', 'https://cdn.jsdelivr.net', '웹폰트 파일 (Pretendard · Galmuri)'],
    ['img-src', 'https://raw.githubusercontent.com', '스프라이트'],
    ['img-src', 'https://*.googleusercontent.com', '계정 프로필 사진'],
  ];
  // 2026-09-13 v3.23.0 번들 CSS·JS 가 문서에 **한 번**만 들어갔는가. 자리표 '__STYLES__' 를 주석에 적어 둔 줄 때문에
  // build.py 의 str.replace 가 번들을 두 번 끼워 넣어 index.html 이 862KB 였다 (같은 CSS 두 번 파싱)
  // 2026-09-16 v3.46.0 JS 는 밖으로 나갔다(app.js) — 문서 안에서 세던 표식은 이제 CSS 쪽만 유효하다
  // 2026-09-17 v3.56.0 CSS 도 밖으로 나갔다(style.css) — 문서 안 표식 대신 <link> 를 센다.
  //   목적은 그대로다: **번들이 문서에 두 번 들어가지 않았는가**
  const dup = await page.evaluate(() => ({
    css: [...document.querySelectorAll('link[rel="stylesheet"]')].filter((n) => /(^|\/)style\.css(\?|$)/.test(n.getAttribute('href') || '')).length,
    styles: document.querySelectorAll('style').length,
    appSrc: [...document.querySelectorAll('script[src]')].map((n) => n.getAttribute('src')),
    inlineBig: [...document.querySelectorAll('script:not([src])')].filter((n) => n.textContent.length > 20000).length,
  }));
  ok('번들 CSS 를 한 번만 부른다 (style.css 링크 1개)', dup.css === 1, JSON.stringify(dup.css));
  // 번들 JS 는 **밖에서 한 번만** 불린다. 두 번 불리면 전역이 두 번 선언돼 조용히 깨진다
  const appTags = dup.appSrc.filter((src) => /(^|\/)app\.js(\?|$)/.test(src));
  ok('app.js 를 한 번만 부른다', appTags.length === 1, JSON.stringify(dup.appSrc));
  // 2026-09-17 v3.56.0 표식이 **판 번호에서 내용 해시로** 바뀌었다. 판을 안 올리고 코드만 고치는
  //   일이 실제로 있었고(codex 15판), 그때 주소가 그대로라 옛 캐시가 남았다. 해시는 내용이 바뀌면 바뀐다
  ok('app.js 주소에 내용 표식(?v=)이 붙는다', /\?v=[0-9a-f]{8,}$/.test(appTags[0] ?? ''), appTags[0]);
  // 페이지 소스가 다시 부풀지 않게 — 인라인 <script> 는 설정값 한 덩이뿐이어야 한다
  ok('큰 인라인 <script> 가 남지 않았다', dup.inlineBig === 0, String(dup.inlineBig));
  const htmlBytes = await page.evaluate(() => document.documentElement.outerHTML.length);
  ok('문서가 400KB 아래', htmlBytes < 400000, `${Math.round(htmlBytes / 1024)}KB`);
  // Google Fonts 링크가 없다 — 쓰지 않는 글꼴을 방문마다 받던 것을 뗐다
  ok('Google Fonts 링크 없음', (await page.locator('link[href*="fonts.googleapis.com"]').count()) === 0);
  // Pretendard CSS 는 렌더를 막지 않는 preload 로 받아 도착하면 stylesheet 로 승격된다 — 회귀는 바깥 요청을 끊고 돌므로
  // 승격 결과가 아니라 **구조**를 본다: preload + onload 승격 손잡이 + JS 없는 환경용 noscript 사본
  const fontLink = await page.evaluate(() => ({
    preload: document.querySelectorAll('link[rel="preload"][as="style"][href*="pretendard"][onload]').length,
    blocking: document.querySelectorAll('head > link[rel="stylesheet"][href^="http"]').length,
    noscript: /<noscript><link rel="stylesheet" href="[^"]*pretendard/.test(document.head.innerHTML),
  }));
  ok('Pretendard 는 preload + onload 승격 (렌더 차단 외부 CSS 0개)', fontLink.preload === 1 && fontLink.blocking === 0 && fontLink.noscript, JSON.stringify(fontLink));
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
  ok('og:title', meta.title.includes('moncamp'), meta.title);
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

  // 2026-09-14 v3.28.0 검색 색인을 열었다 (v3.6.0 에 뺐던 것). 로컬 빌드는 prod 채널이라 index 한 줄,
  // dev 빌드는 build.py 가 그 줄을 noindex 로 바꿔 끼운다 — 어느 쪽이든 robots 메타는 **정확히 한 줄**이다
  const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((n) => { try { return JSON.parse(n.textContent); } catch { return null; } }));
  ok('구조화 데이터 한 블록, JSON 으로 읽힘', ld.length === 1 && ld[0] !== null, String(ld.length));
  const ldTypes = (ld[0]?.['@graph'] ?? []).map((node) => node['@type']);
  ok('구조화 데이터에 WebSite · WebApplication', ldTypes.includes('WebSite') && ldTypes.includes('WebApplication'), ldTypes.join(','));
  // 2026-09-15 v3.43.0 무엇에 관한 사이트인지 기계가 알아보게 — about 이 빠지면 주제가 안 엮인다
  const app = (ld[0]?.['@graph'] ?? []).find((node) => node['@type'] === 'WebApplication');
  ok('구조화 데이터가 Pokémon GO 를 가리킨다', app?.about?.name === 'Pokémon GO', JSON.stringify(app?.about?.name));
  ok('기능 목록이 있다', Array.isArray(app?.featureList) && app.featureList.length >= 5, String(app?.featureList?.length));

  // ── 2026-09-15 v3.43.0 검색 유입 — 사람들이 실제로 치는 말이 제목·본문에 있는가
  //
  // ★ 가장 크게 놓쳤던 것 — 구글은 JS 를 돌린 **뒤**의 제목을 본다.
  //   index.html 에 검색어를 아무리 적어도 app-shell.js 가 'moncamp' 한 마디로 덮어쓰면 그만이다.
  //   해시 라우팅이라 색인되는 주소는 홈 하나뿐이니, 그 하나의 제목이 전부다.
  const titles = await page.evaluate(() => ({
    now: document.title,
    tag: document.querySelector('title')?.textContent ?? '',
  }));
  ok('홈 제목에 검색어가 있다', /포켓몬고/.test(titles.now) && /다이맥스 티어표/.test(titles.now), titles.now);
  ok('검색어가 브랜드보다 앞에 있다', titles.now.indexOf('포켓몬고') < titles.now.indexOf('moncamp'), titles.now);
  ok('JS 가 제목을 다른 문장으로 덮지 않는다', titles.now === titles.tag, `${titles.tag} / ${titles.now}`);

  // 네이버 Yeti 는 JS 를 돌리지 않는다 — <noscript> 가 크롤러가 읽는 **유일한 본문**이다.
  // 화면에 없는 말을 적으면 클로킹이므로, 실제 화면 이름이 그대로 있는지까지 본다
  // JS 가 켜져 있으면 <noscript> 안은 DOM 으로 파싱되지 않고 **글자 그대로** 남는다.
  // 그래서 textContent 로 읽는다. 머리의 글꼴 <noscript> 와 섞이지 않게 id 로 집는다
  const fallback = await page.evaluate(() => {
    const node = document.getElementById('noscript-intro');
    const text = (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { text, length: text.length };
  });
  ok('JS 없이 읽을 본문이 있다', fallback.length > 300, String(fallback.length));
  ok('본문이 실제 화면 이름을 쓴다',
    ['다이맥스', '맥스 배틀 덱', '레이드', 'PvP', '도감', '일정표'].every((word) => fallback.text.includes(word)),
    fallback.text.slice(0, 120));
  ok('본문에 비공식 고지가 있다', /비공식/.test(fallback.text));
  // JS 가 없으면 로딩 가림막을 안 그린다 — 안 그러면 '불러오는 중…' 이 영원히 남아 위 본문을 덮는다
  ok('JS 없을 때 로딩 가림막을 숨긴다', await page.evaluate(() =>
    [...document.head.querySelectorAll('noscript')].some((n) => n.textContent.includes('#splash'))));

  // 잘리는 길이 — 제목 35자·설명 160자 안팎에서 검색 결과가 자른다
  const desc = meta.description;
  ok('설명이 잘리지 않을 길이', desc.length <= 165, String(desc.length));
  ok('설명이 포켓몬고로 시작한다', desc.startsWith('포켓몬고'), desc.slice(0, 20));
  const kw = await page.evaluate(() => document.querySelector('meta[name="keywords"]')?.content ?? '');
  // 네이버는 토큰을 그대로 맞춰 본다 — '맥스배틀' 을 붙여 쓰는 사람이 더 많다
  ok('붙여 쓴 변형도 넣는다', kw.includes('맥스배틀') && kw.includes('포고'), String(kw.split(', ').length));
  ok('구조화 데이터 주소가 canonical 과 같음', (ld[0]?.['@graph'] ?? []).every((node) => node.url === meta.canonical), meta.canonical);
  const robotsMetas = await page.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((n) => n.content));
  ok('robots 메타 정확히 한 줄', robotsMetas.length === 1, robotsMetas.join(' / '));
  ok('robots 메타가 index 또는 noindex 한 가지', robotsMetas.length === 1 && (/^index, follow/.test(robotsMetas[0]) || /^noindex/.test(robotsMetas[0])), robotsMetas.join(' / '));

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
  // 2026-09-16 v3.47.0 검문(backend/guard.py)의 흔적 — 대체된 표 이름이 두 곳에 남는다. 평소에는 빈 목록이어야 한다
  const buildJson = JSON.parse((await grab('build.json')) || '{}');
  ok('build.json 에 stale 목록', Array.isArray(buildJson.stale), JSON.stringify(buildJson));
  ok('평소 빌드는 대체된 표가 없다', Array.isArray(buildJson.stale) && buildJson.stale.length === 0, JSON.stringify(buildJson.stale));
  const dataJs = (await grab('data.js')) || '';
  ok('data.js 에 DATA_STALE', /^const DATA_STALE = \[.*\];/m.test(dataJs));
  // 2026-09-16 v3.48.0 홈이 안 쓰는 여섯 표는 data-lazy.js 로 — 본체에는 없고 지연 파일에는 있어야 한다
  const dataLazy = (await grab('data-lazy.js')) || '';
  ok('data-lazy.js 있음', dataLazy.length > 1000);
  for (const name of ['PVE_EASY', 'SHEET_DATA', 'BOSS_LIST', 'GAMEDAY', 'MOVE_CHANGES', 'ROLES']) {
    ok(`${name} 은 지연 파일에만`, !new RegExp(`^const ${name} =`, 'm').test(dataJs) && new RegExp(`^const ${name} =`, 'm').test(dataLazy));
  }
  ok('data.js 에 DATA_FETCHED', /^const DATA_FETCHED = "/m.test(dataJs));
  const indexHtml = (await grab('index.html')) || '';
  ok('HTML 은 지연 데이터를 미리 부르지 않는다', indexHtml.length > 0 && !/<script[^>]*src="data-lazy\.js/.test(indexHtml));
  const notFound = await grab('404.html');
  ok('404.html 있음', !!notFound && notFound.includes('찾을 수 없'));
  ok('404 는 색인 금지', !!notFound && notFound.includes('noindex'));

  await finish(browser);
});
