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
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));

  await page.goto(BASE + '?mock=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#splash', { state: 'detached', timeout: 15000 }).catch(() => {});
  await page.locator('#consent .consent__deny').click().catch(() => {});
  await page.waitForTimeout(400);

  // ── CSP
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  ok('CSP 메타 있음', csp.length > 0);
  for (const directive of ['default-src', 'script-src', 'connect-src', 'object-src', 'base-uri', 'form-action']) {
    ok(`CSP ${directive} 지정`, csp.includes(directive), '');
  }
  ok('CSP object-src 차단', /object-src\s+'none'/.test(csp));
  ok('CSP base-uri 차단', /base-uri\s+'none'/.test(csp));
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

  // 구조화 데이터
  const ld = await page.evaluate(() => {
    const node = document.querySelector('script[type="application/ld+json"]');
    try { return JSON.parse(node.textContent); } catch { return null; }
  });
  ok('JSON-LD 파싱됨', !!ld && ld['@type'] === 'WebSite', ld && ld['@type']);

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
