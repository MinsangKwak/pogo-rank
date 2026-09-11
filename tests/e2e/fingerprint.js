'use strict';
// 계산된 스타일 지문 — 클래스 이름만 바꾸는 리팩토링이 렌더 결과를 바꾸지 않았는지 확인한다.
// 클래스 이름 자체는 지문에 넣지 않는다 (바뀌는 게 정상이므로). 대신 태그·순서·계산된 스타일만 본다.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const BASE = 'http://localhost:5503/';
const tag = process.argv[2] || 'a';
const OUT = `${__dirname}/fp-${tag}`;
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  ['home', '', null], ['max', '#/rank/max', null], ['pve', '#/rank/pve', null], ['pvp', '#/rank/pvp', null],
  ['dex', '#/dex', null], ['favs', '#/favs', null],
  ['plan', '#/plan', null], ['collection', '#/plan/collection', null],
  ['schedule', '#/schedule', null], ['release', '#/release', null],
  ['privacy', '#/privacy', null], ['terms', '#/terms', null], ['changes', '#/changes', null],
  ['detail', '#/dex', 'detail'], ['search', '#/rank/pve', 'search'], ['drawer', '#/rank/pvp', 'drawer'],
  ['solo', '#/rank/pve', 'solo'], ['deck', '#/rank/pvp', 'deck'], ['dealer', '#/rank/max', 'dealer'],
  ['tank', '#/rank/max', 'tank'], ['consent', '', 'consent'],
];

const PROPS = ['display','position','color','background-color','border-top-width','border-top-color','border-radius',
  'font-size','font-weight','font-family','line-height','padding-top','padding-left','padding-bottom','padding-right',
  'margin-top','margin-left','margin-bottom','margin-right','width','height','flex-direction','flex-grow','flex-basis',
  'grid-template-columns','align-items','justify-content','text-align','opacity','overflow-x','overflow-y','gap',
  'text-decoration-line','letter-spacing','white-space','z-index','top','left','right','bottom','box-shadow','visibility'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  // 2026-09-10 v2.54.0 두 화면 폭을 **동시에** 잰다. 전에는 좁은 폭 22화면을 다 돈 뒤에야
  // 넓은 폭을 시작해서, 이 스위트 하나가 회귀 전체에서 가장 오래 걸렸다 (실측 183초).
  // 둘은 서로의 결과를 쓰지 않는다 — 각자 제 컨텍스트에서 제 파일에 쓴다
  const sweep = async ([w, h, wname]) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    ctx.setDefaultTimeout(4000);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${wname}: ${e}`));
    for (const [name, hash, action] of SCREENS) {
      await page.goto(BASE + '?mock=1' + hash, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#splash', { state: 'detached', timeout: 12000 }).catch(() => {});
      if (action !== 'consent') {
        await page.evaluate(() => { try { localStorage.setItem('pogo_consent', 'denied'); } catch {} });
        await page.locator('#consent .uchip:last-child').click({ timeout: 1500 }).catch(() => {});
      }
      await page.waitForTimeout(150);
      try {
        if (action === 'detail') { await page.locator('#page button').nth(3).click(); await page.waitForTimeout(350); }
        // v2.66.0 넓은 화면은 🔍 버튼을 감추고 상단 검색바가 같은 패널을 연다 — 보이는 쪽을 누른다
        if (action === 'search') { await page.locator('#search-toggle:visible, .app-search:visible').first().click(); await page.waitForTimeout(350); }
        if (action === 'drawer') { await page.click('#menu-toggle'); await page.waitForTimeout(350); }
        if (action === 'solo') { await page.getByRole('button', { name: /솔플/ }).click(); await page.waitForTimeout(350); }
        if (action === 'deck') { await page.getByRole('button', { name: /덱 짜기/ }).click(); await page.waitForTimeout(350); }
        if (action === 'dealer') { await page.getByRole('button', { name: '딜러', exact: true }).click(); await page.waitForTimeout(350); }
        if (action === 'tank') { await page.getByRole('button', { name: '탱커', exact: true }).click(); await page.waitForTimeout(350); }
      } catch (e) { errors.push(`${wname}/${name}: ${e.message.slice(0, 60)}`); }
      const fp = await page.evaluate((props) => {
        const out = [];
        const walk = (node, depth) => {
          if (node.nodeType !== 1) return;
          const cs = getComputedStyle(node);
          out.push(depth + '|' + node.tagName + '|' + props.map((p) => cs.getPropertyValue(p)).join('|'));
          for (const child of node.children) walk(child, depth + 1);
        };
        walk(document.body, 0);
        return out;
      }, PROPS);
      fs.writeFileSync(`${OUT}/${wname}-${name}.txt`, fp.join('\n'));
    }
    await ctx.close();
  };
  await Promise.all([[390, 844, 'm'], [1440, 900, 'd']].map(sweep));
  console.log('errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
