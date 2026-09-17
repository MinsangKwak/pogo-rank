'use strict';
// v3.58.0 솔플 레이드 계산 — 복합 타입 보정은 **때리는 타입**으로 잰다 (WBS-74 / QA-21)
//
// 무엇이 틀렸었나. 복합 타입 보스의 "나머지 타입" 보정을 어태커의 **첫 자속 타입**으로 쟀다.
// 포켓몬의 타입과 실제로 때리는 타입이 같다는 가정인데, 570마리 중 70마리(12%)는
// 자속이 아닌 주력기를 든다. 실측 예:
//
//   섀도우 샹델라 — 타입 고스트/불꽃, 기술은 회오리불꽃·오버히트로 **둘 다 불꽃**
//   강철·에스퍼 보스 상대: 옛 코드가 '고스트 → 에스퍼 ×1.6' 을 얹어 DPS 25.8 → 41.3 (+60%)
//   받지도 못하는 보정이라 1위 카운터로 잘못 추천됐다
//
// 이 스위트가 지키려는 것
//   - PVE_DATA 각 행이 때리는 타입(ftype·ctype)과 차지기 피해 비중(cshare)을 들고 있다
//   - 보정은 자기 타입이 아니라 때리는 타입으로 계산된다 (샹델라가 ×1.6 을 못 받는다)
//   - 스피드기와 차지기 타입이 다르면 피해량으로 가중된다 (한쪽으로 쏠리지 않는다)
//   - 옛 data.js 가 캐시에 남아 ftype/ctype 이 없어도 죽지 않고 예전 값으로 되돌아간다
//   - 단일 타입 보스는 보정이 없다 (×1)
//   - 계산기 화면이 그대로 뜬다 (회귀 없음)
const { launch, newContext, waitSplash, go, ok, finish, suite, SERVER } = require('./_lib');

suite(async () => {
  const browser = await launch();
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await go(page, `${SERVER}?mock=1#/pve/solo`);
  await page.waitForTimeout(900);

  // ── 데이터 계약 ────────────────────────────────────────────────────────────
  // 때리는 타입은 **자기 타입과 다를 때만** 실린다 — 대부분은 자속이라 전부 실으면 27KB 가 는다.
  // 빠진 값은 화면이 자기 타입으로 되돌리므로 뜻이 같다 (아래 되돌림 단언이 그걸 지킨다)
  const data = await page.evaluate(() => {
    const rows = Object.values(PVE_DATA).flat();
    const withType = rows.filter((r) => typeof r.ctype === 'string');
    return {
      total: rows.length,
      withType: withType.length,
      // 실린 값은 반드시 자기 첫 타입과 달라야 한다 — 같은데 실렸으면 낭비다
      redundant: withType.filter((r) => r.ctype === (r.types || [])[0]).length,
      // 비중은 두 기술 타입이 갈릴 때만
      shareOutOfRange: rows.filter((r) => 'cshare' in r && !(r.cshare >= 0 && r.cshare <= 1)).length,
      shareWhenSame: rows.filter((r) => 'cshare' in r && (r.ftype ?? (r.types || [])[0]) === r.ctype).length,
      // 자속이 아예 아닌 주력기 — 가장 크게 틀리던 쪽
      offStab: withType.filter((r) => !(r.types || []).includes(r.ctype)).length,
    };
  });
  ok('때리는 타입이 자기 타입과 다른 행이 있다', data.withType > 0, `${data.withType}/${data.total}`);
  ok('자기 타입과 같은데 실린 행은 없다 (군더더기 없음)', data.redundant === 0, String(data.redundant));
  ok('차지기 피해 비중이 0~1 범위다', data.shareOutOfRange === 0, String(data.shareOutOfRange));
  ok('두 기술 타입이 같으면 비중을 싣지 않는다', data.shareWhenSame === 0, String(data.shareWhenSame));
  ok('자속이 아닌 주력기를 든 어태커가 실제로 있다', data.offStab > 0, `${data.offStab}마리`);

  // ── 보정은 때리는 타입으로 ─────────────────────────────────────────────────
  // 강철·에스퍼 보스를 상대하는 섀도우 샹델라: 고스트 타입이지만 불꽃으로만 때린다
  const chandelure = await page.evaluate(() => {
    const row = (PVE_DATA.steel || []).find((r) => r.name === '섀도우 샹델라');
    if (!row) return null;
    return {
      types: row.types,
      ctype: row.ctype,
      ftype: row.ftype,
      byOwnType: DEX_DATA.chart[row.types[0]]?.psychic ?? 1,   // 옛 방식
      byAttackType: attackTypeMult(row, 'psychic'),            // 새 방식
    };
  });
  if (chandelure) {
    ok('샹델라는 고스트 타입인데 기술은 불꽃이다',
      chandelure.types.includes('ghost') && chandelure.ctype === 'fire' && chandelure.ftype === 'fire',
      JSON.stringify(chandelure));
    ok('옛 방식은 고스트 보정(×1.6)을 얹었다', chandelure.byOwnType > 1.5, String(chandelure.byOwnType));
    ok('새 방식은 받지도 못할 보정을 안 준다 (×1)', Math.abs(chandelure.byAttackType - 1) < 0.01,
      String(chandelure.byAttackType));
  } else {
    ok('샹델라 행을 찾았다', false, 'PVE_DATA.steel 에 없음');
  }

  // ── 스피드기·차지기 타입이 다르면 피해량으로 가중 ──────────────────────────
  const blended = await page.evaluate(() => {
    const chart = DEX_DATA.chart;
    // 두 기술 타입이 다르고, 어떤 타입에 대해 배율이 갈리는 행을 하나 찾는다
    for (const row of Object.values(PVE_DATA).flat()) {
      if (!row.ftype || !row.ctype || row.ftype === row.ctype) continue;
      if (row.cshare <= 0 || row.cshare >= 1) continue;
      for (const against of Object.keys(chart)) {
        const f = chart[row.ftype]?.[against] ?? 1;
        const c = chart[row.ctype]?.[against] ?? 1;
        if (f === c) continue;
        return { name: row.name, f, c, share: row.cshare, got: attackTypeMult(row, against) };
      }
    }
    return null;
  });
  if (blended) {
    const { f, c, share, got } = blended;
    const expected = f * (1 - share) + c * share;
    ok('두 기술 타입을 피해량으로 가중한다', Math.abs(got - expected) < 0.001,
      `${blended.name} ${f}·${c} 비중 ${share} → ${got}`);
    // 한쪽 값으로 쏠리지 않았다 — 섞였다는 뜻
    ok('한쪽 타입으로 쏠리지 않는다', got !== f && got !== c, String(got));
  } else {
    ok('두 기술 타입이 갈리는 행을 찾았다', false, '없음');
  }

  // ── 옛 data.js 가 남아 있어도 죽지 않는다 ──────────────────────────────────
  const fallback = await page.evaluate(() => {
    const legacy = { types: ['ghost'], dps: 10 };   // ftype·ctype·cshare 가 없던 시절의 행
    return { got: attackTypeMult(legacy, 'psychic'), want: DEX_DATA.chart.ghost?.psychic ?? 1 };
  });
  ok('때리는 타입이 없으면 예전처럼 자속 타입으로 잰다', fallback.got === fallback.want,
    `${fallback.got} vs ${fallback.want}`);

  // ── 단일 타입 보스는 보정 없음 ─────────────────────────────────────────────
  const single = await page.evaluate(() => {
    const one = counterPool(['fire']);
    const src = PVE_DATA.fire || [];
    const first = src[0] && one.find((r) => r.name === src[0].name);
    return first ? { got: first.dps, want: src[0].dps } : null;
  });
  ok('단일 타입 보스는 DPS 를 건드리지 않는다', single && Math.abs(single.got - single.want) < 0.001,
    JSON.stringify(single));

  // ── 화면은 그대로 뜬다 ─────────────────────────────────────────────────────
  // 솔플은 shell 라우트라 본문이 #content 에 그려진다 (#page 는 page 라우트용)
  ok('솔플 계산기 화면이 뜬다', await page.evaluate(() => document.body.dataset.route) === 'pve-solo',
    await page.evaluate(() => document.body.dataset.route));
  const note = await page.locator('#note').textContent();
  ok('각주가 때리는 타입 기준이라고 밝힌다', /실제로 쓰는 기술 타입/.test(note || ''),
    (note || '').slice(-60));

  await browser.close();
  finish();
});
