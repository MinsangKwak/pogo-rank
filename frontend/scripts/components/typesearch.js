// ─────────────────────────────────────────────────────────────────────────────
// components/typesearch.js — 🧭 상성 검색 페이지 (#/types) (2026-09-06 v2.10.0, QA-44)
//
// 무엇을 하나
//   "이 보스(타입 조합)는 뭘로 때리지?"를 한 화면에서 답한다.
//   타입 칩을 최대 2개 고르거나 포켓몬 이름으로 타입을 채우면
//     1) 이 상대를 때릴 때 기술 타입별 배율 — 이중약점(×2.56) / 약점 / 내성 / 이중내성·무효
//     2) 그 약점 타입 보스 기준 추천 딜러(레이드 PVE_DATA · 맥스 DMAX_DATA 상위 5) + 해당 탭 바로가기
//     3) 반대로 이 타입의 자속 기술이 잘 통하는 상대 타입
//   주소는 #/types?t=water,dark&mon=10070 처럼 남겨 공유·북마크가 된다 (replaceState — 히스토리는 안 쌓인다).
//
// 제공하는 전역
//   renderTypeSearchPage()                pages.js PAGES.types 가 부른다
//   openTypeSearch(types, spriteId, from) 상세 팝업 등에서 타입을 미리 채운 채 연다
//
// 의존하는 전역
//   el (dom.js) · sprite (sprite.js) · nameNode (name.js) · typeChipEl · typeMultAgainst · openDetail (detail.js)
//   buildSearchIndex · monSearch (search.js) · chips (chips.js) · track (track.js) · state · render (app.js)
//   TYPE_KO · DEX_DATA.chart · PVE_DATA · DMAX_DATA (data.js)
// ─────────────────────────────────────────────────────────────────────────────

// 현재 해시의 쿼리(t=타입,타입 · mon=스프라이트 id)를 읽는다. 모르는 타입은 버린다
function typeSearchParams() {
  const match = location.hash.match(/^#\/types\?(.*)$/);
  const params = new URLSearchParams(match ? match[1] : '');
  const types = (params.get('t') || '').split(',').filter((typeName) => TYPE_KO[typeName]).slice(0, 2);
  return { types, mon: params.get('mon') };
}

// 타입(과 포켓몬)을 미리 채운 채 상성 검색 페이지를 연다
function openTypeSearch(types, spriteId, from = 'link') {
  track('page_open', { page: 'types', from });
  const query = `t=${(types ?? []).slice(0, 2).join(',')}${spriteId ? `&mon=${spriteId}` : ''}`;
  // 2026-09-06 v2.11.0 navigateHash: 상세 팝업에서 열면 팝업을 닫고 그 히스토리 항목을 대체한다. 같은 주소면 다시 그린다
  navigateHash(`#/types?${query}`);
}

// 배율 → 묶음 키. 이중약점 ≥2.5 · 약점 ≥1.5 · 내성 ≤0.7 · 이중내성/무효 ≤0.4 (GO 는 무효도 0.39 = 0.625²)
// 2026-09-08 v2.28.0 (버그) 이 값은 drawResult 의 buckets 객체 키다 — CSS 클래스가 아니다.
// v2.24.0 BEM 리네이밍 때 'x2' → 'is-weak2', 'r2' → 'is-resist2' 로 바뀌면서 buckets['is-weak2'] 가
// undefined 가 됐고, .push 에서 예외가 나 결과 영역이 통째로 그려지지 않았다(타입을 눌러도 아무것도 안 나옴).
// 클래스 이름은 bucketRow 의 세 번째 인자로 따로 넘긴다 — 두 값을 하나로 쓰지 않는다
function matchupBucket(multiplier) {
  if (multiplier >= 2.5) return 'x2';
  if (multiplier >= 1.5) return 'weak';
  if (multiplier <= 0.4) return 'r2';
  if (multiplier <= 0.7) return 'resist';
  return 'neutral';
}

// 타입 조합에 해당하는 포켓몬 목록 섹션 (v2.11.1)
//   types  선택한 타입 1~2개. 2개면 타입 집합이 정확히 같은 폼만, 1개면 그 타입을 포함하는 폼 전부
// 출시 여부(DEX_DATA.rel)로 출시 → 미출시 순, 그 안에서 도감번호순. 처음 24마리만 보이고 더보기로 펼친다
function typeMonList(types) {
  const forms = DEX_DATA.forms ?? {};
  const names = DEX_DATA.names ?? {};
  const released = new Set(DEX_DATA.rel ?? []);
  const wanted = [...types].sort().join('|');
  const out = [];
  for (const [spriteKey, form] of Object.entries(forms)) {
    const formTypes = form.types ?? [];
    const match = types.length === 2 ? [...formTypes].sort().join('|') === wanted : formTypes.includes(types[0]);
    if (!match) continue;
    const spriteId = Number(spriteKey);
    const dex = dexOf(spriteId);
    const base = names[dex] ?? names[spriteId];
    if (!base) continue;
    out.push({ sprite: spriteId, dex, name: form.name ? `${form.name} ${base}` : base, en: '', types: formTypes, unrel: released.size > 0 && !released.has(dex) });
  }
  out.sort((a, b) => (a.unrel - b.unrel) || (a.dex - b.dex) || (a.sprite - b.sprite));
  return out;
}
function monListSection(types) {
  const label = types.map((typeName) => TYPE_KO[typeName]).join('·');
  const mons = typeMonList(types);
  const section = el('section', { class: 'types__sec' }, el('h3', {}, `${label} 타입 포켓몬 (${mons.length})`));
  if (!mons.length) {
    section.append(el('p', { class: 'detail__none-text' }, `${label} 타입 조합의 포켓몬은 없습니다.`));
    return section;
  }
  let shown = 24;
  const $grid = el('div', { class: 'boss__recs recs-wrap types__mons' });
  const $more = el('button', { class: 'boss__more', onclick: () => { shown += 48; draw(); } });
  const draw = () => {
    $grid.replaceChildren(...mons.slice(0, shown).map((mon) => el('button', {
      class: `boss__rec${mon.unrel ? ' is-unreleased' : ''}`, onclick: () => openDetail(mon, false, 'types'),
    }, sprite(mon.sprite), el('span', {}, nameNode(mon.name)), mon.unrel ? el('span', { class: 'tag dex__unrel' }, '미구현') : '')));
    $more.hidden = shown >= mons.length;
    $more.textContent = `더보기 (${Math.min(shown, mons.length)}/${mons.length})`;
  };
  draw();
  section.append($grid, $more,
    el('p', { class: 'detail__foot' }, types.length === 2 ? '두 타입을 정확히 이 조합으로 가진 폼(메가·리전 폼 포함). 누르면 상세' : '이 타입을 가진 폼 전부(복합 타입 포함). 두 번째 칩을 고르면 조합으로 좁혀집니다'));
  return section;
}

function renderTypeSearchPage() {
  const { types: initialTypes, mon } = typeSearchParams();
  let pokemon = mon && typeof buildSearchIndex === 'function'
    ? buildSearchIndex().find((entry) => Number(entry.sprite) === Number(mon)) ?? null : null;
  let selected = initialTypes.length ? [...initialTypes] : (pokemon?.types ?? []).slice(0, 2);

  const $head = el('div', {});
  const $chips = el('div', { class: 'types__pick' });
  const $result = el('div', {});
  const $input = el('input', { class: 'boss__search', placeholder: '이름으로 타입 채우기 (예: 가이오가)', autocomplete: 'off' });
  const $sugg = el('div', { class: 'boss__sugg' });

  // 주소에 현재 선택을 남긴다 (공유용). replaceState 라 뒤로가기에는 영향이 없다
  const syncHash = () => {
    const query = selected.length ? `?t=${selected.join(',')}${pokemon ? `&mon=${pokemon.sprite}` : ''}` : '';
    try { history.replaceState(null, '', `#/types${query}`); } catch {}
  };

  // 상단: 고른 포켓몬(있으면) 또는 고른 타입 조합
  const drawHead = () => {
    if (pokemon) {
      $head.replaceChildren(el('div', { class: 'types__head' },
        sprite(pokemon.sprite),
        el('div', {},
          el('h2', {}, nameNode(pokemon.name)),
          el('div', { class: 'tchips' }, ...selected.map((typeName) => typeChipEl(typeName)))),
        el('button', { class: 'types__clear', 'aria-label': '지우기', onclick: () => { pokemon = null; selected = []; update('clear'); } }, '✕')));
    } else if (selected.length) {
      $head.replaceChildren(el('div', { class: 'types__head' },
        el('div', {},
          el('h2', {}, `${selected.map((typeName) => TYPE_KO[typeName]).join(' · ')} 타입`),
          el('p', { class: 'types__hint' }, '타입 칩을 눌러 바꾸거나 위에서 포켓몬을 검색하세요')),
        el('button', { class: 'types__clear', 'aria-label': '지우기', onclick: () => { selected = []; update('clear'); } }, '✕')));
    } else {
      $head.replaceChildren(el('p', { class: 'types__hint' }, '상대 타입을 1~2개 고르거나 포켓몬 이름을 검색하면 약점·이중약점과 추천 딜러가 나옵니다.'));
    }
  };

  // 타입 칩 18개. 최대 2개 — 셋째를 누르면 먼저 고른 것이 빠진다. 손으로 바꾸면 포켓몬 선택은 푼다
  const drawChips = () => {
    $chips.replaceChildren(...Object.keys(TYPE_KO).map((typeName) => el('button', {
      class: 'chips__item', 'aria-pressed': String(selected.includes(typeName)),
      onclick: () => {
        if (selected.includes(typeName)) selected = selected.filter((entry) => entry !== typeName);
        else selected = [...selected, typeName].slice(-2);
        if (pokemon && (selected.length !== pokemon.types.length || !selected.every((entry) => pokemon.types.includes(entry)))) pokemon = null;
        update('chip');
      },
    }, el('span', { class: 'dot', style: `--c: var(--t-${typeName})` }), TYPE_KO[typeName])));
  };

  // 추천 딜러 5마리 (레이드 표 또는 맥스 표) — 누르면 상세 팝업
  // list: 'raid' | 'max' · bossType: 표의 보스 속성 — 어느 표의 몇 위를 눌렀는지 GA 에 남긴다 (v2.10.1 types_rec_click)
  const recRow = (label, rows, goto, list, bossType) => {
    if (!rows?.length) return '';
    return el('div', { class: 'types__recs' },
      el('p', { class: 'schedule__sec' }, label),
      el('div', { class: 'boss__recs recs-wrap' }, ...rows.slice(0, 5).map((entry, index) => el('button', {
        class: 'boss__rec', onclick: () => {
          track('types_rec_click', { list, boss: bossType, rank: index + 1, mon: entry.name });
          openDetail(entry, false, 'types');
        },
      }, sprite(entry.sprite), el('span', {}, `${index + 1} `, nameNode(entry.name))))),
      goto ? el('button', { class: 'boss__more', onclick: goto }, '전체 순위 보기 ▸') : '');
  };
  // 메인 화면의 특정 탭·칩으로 이동 (페이지를 닫고 해당 탭을 그 속성으로 맞춘다)
  const gotoTab = (tab, patch) => () => {
    Object.assign(state, patch, { tab });
    track('tab_' + tab, { tab, from: 'types' });
    location.hash = '';
    render();
  };

  const drawResult = () => {
    $result.replaceChildren();
    if (!selected.length) return;
    // 1) 이 상대를 때릴 때 — 공격 타입 18개의 배율을 묶음별로
    const buckets = { x2: [], weak: [], resist: [], r2: [] };
    for (const attackType of Object.keys(TYPE_KO)) {
      const multiplier = typeMultAgainst(attackType, selected);
      const bucket = matchupBucket(multiplier);
      if (bucket !== 'neutral') buckets[bucket].push([attackType, multiplier]);
    }
    buckets.x2.sort((a, b) => b[1] - a[1]); buckets.weak.sort((a, b) => b[1] - a[1]);
    buckets.resist.sort((a, b) => a[1] - b[1]); buckets.r2.sort((a, b) => a[1] - b[1]);
    const chipsOf = (entries, className) => el('div', { class: 'tchips' }, ...entries.map(([typeName, multiplier]) => {
      const chip = typeChipEl(typeName, `×${+multiplier.toFixed(2)}`);
      if (className) chip.classList.add(className);
      return chip;
    }));
    const bucketRow = (label, entries, className) => entries.length
      ? el('div', { class: 'types__row' }, el('em', { class: className ?? '' }, label), chipsOf(entries, className)) : '';
    const targetLabel = pokemon ? pokemon.name : `${selected.map((typeName) => TYPE_KO[typeName]).join('·')} 타입`;
    $result.append(el('section', { class: 'types__sec' },
      el('h3', {}, `⚔️ ${targetLabel}을(를) 때릴 때 — 기술 타입별 배율`),
      bucketRow('이중약점', buckets.x2, 'is-weak2'),
      bucketRow('약점', buckets.weak),
      buckets.x2.length + buckets.weak.length === 0 ? el('p', { class: 'detail__none-text' }, '효과가 굉장한 타입이 없습니다') : '',
      bucketRow('내성', buckets.resist),
      bucketRow('이중내성', buckets.r2, 'is-resist2'),
      el('p', { class: 'detail__foot' }, '이중약점 = 두 타입 모두에 약해 ×2.56 · 이중내성 = 두 타입 모두 반감(×0.39). 본가의 무효 타입도 GO 에서는 같은 ×0.39 로 피해가 들어갑니다')));

    // 1b) 2026-09-06 v2.11.1 이 타입 조합의 포켓몬 — "이 타입이 누구지?"에 답한다. 도감 폼 데이터(DEX_DATA.forms, 메가·리전 폼 포함)에서
    //     타입 2개면 정확히 그 조합, 1개면 그 타입을 가진 전부. 없으면 없다고 분명히 적는다
    $result.append(monListSection(selected));

    // 2) 추천 딜러 — 이 상대의 타입을 "보스 속성"으로 보고, 속성별 레이드/맥스 순위표 상위 5
    //    복합 타입은 두 표를 다 보여 준다 (표는 단일 속성 보스 기준이라 근사치 — 각주로 밝힌다)
    const recSection = el('section', { class: 'types__sec' }, el('h3', {}, `🎯 ${targetLabel} 상대 추천 딜러`));
    let hasRec = false;
    for (const typeName of selected) {
      const raid = typeof PVE_DATA !== 'undefined' ? PVE_DATA[typeName] : null;
      const max = typeof DMAX_DATA !== 'undefined' ? DMAX_DATA[typeName] : null;
      if (raid?.length) { hasRec = true; recSection.append(recRow(`레이드 — ${TYPE_KO[typeName]} 보스 기준 (DPS·TDO 자체 계산)`, raid, gotoTab('pve', { pveMode: 'all', boss: typeName }), 'raid', typeName)); }
      if (max?.length) { hasRec = true; recSection.append(recRow(`맥스 배틀 — ${TYPE_KO[typeName]} 보스 기준`, max, gotoTab('max', { maxBoss: typeName, maxAxis: 'dealer' }), 'max', typeName)); }  // v2.14.0 보스 상대 딜러 표는 [딜러] 축
    }
    if (hasRec) {
      recSection.append(el('p', { class: 'detail__foot' }, selected.length === 2
        ? '순위표는 단일 속성 보스 기준이라 복합 타입 상대에서는 위 배율표와 함께 보세요 (이중약점 타입 기술이 최우선).'
        : '순위표는 그 속성 보스를 상대할 때의 DPS·TDO 기준입니다.'));
      $result.append(recSection);
    }

    // 3) 반대로 — 이 타입의 자속 기술은 어디에 잘 통하나 (단일 방어 타입 기준)
    const chart = DEX_DATA.chart ?? {};
    const offenseSection = el('section', { class: 'types__sec' }, el('h3', {}, `🛡 반대로, ${selected.map((typeName) => TYPE_KO[typeName]).join('·')} 타입 기술이 잘 통하는 상대`));
    for (const attackType of selected) {
      const row = Object.keys(TYPE_KO).map((defType) => [defType, chart[attackType]?.[defType] ?? 1]);
      const strong = row.filter(([, multiplier]) => multiplier >= 1.5);
      const weakTo = row.filter(([, multiplier]) => multiplier <= 0.7 && multiplier > 0.4);
      const none = row.filter(([, multiplier]) => multiplier <= 0.4);
      offenseSection.append(el('div', { class: 'types__row' }, el('em', {}, `${TYPE_KO[attackType]} 기술`),
        el('div', {},
          strong.length ? el('div', { class: 'tchips' }, el('small', { class: 'row__sub' }, '굉장 '), ...strong.map(([defType]) => typeChipEl(defType, '×1.6'))) : '',
          weakTo.length ? el('div', { class: 'tchips', style: 'margin-top:4px' }, el('small', { class: 'row__sub' }, '별로 '), ...weakTo.map(([defType]) => typeChipEl(defType, '×0.63'))) : '',
          none.length ? el('div', { class: 'tchips', style: 'margin-top:4px' }, el('small', { class: 'row__sub' }, '거의 안 통함 '), ...none.map(([defType]) => typeChipEl(defType, '×0.39'))) : '')));
    }
    $result.append(offenseSection);
  };

  // how: 타입을 어떻게 골랐나 — 'chip'(칩 클릭) · 'search'(포켓몬 검색) · 'preset'(상세 팝업 링크·공유 주소로 미리 채워짐). v2.10.1
  const update = (how) => {
    drawHead(); drawChips(); drawResult(); syncHash();
    if (selected.length) track('type_search', { t: selected.join(','), mon: pokemon?.name ?? '', how });
  };

  // 포켓몬 검색 → 고르면 그 포켓몬의 타입으로 채운다
  $input.addEventListener('input', () => {
    $sugg.textContent = '';
    const query = $input.value.trim();
    if (!query) return;
    for (const hit of monSearch(buildSearchIndex(), query, 8)) {
      $sugg.append(el('button', { class: 'sugg__item', onclick: () => {
        pokemon = hit;
        selected = (hit.types ?? []).slice(0, 2);
        $input.value = '';
        $sugg.textContent = '';
        update('search');
      } }, sprite(hit.sprite), el('span', {}, nameNode(hit.name))));
    }
    if (!$sugg.childElementCount) $sugg.append(el('span', { class: 'sugg__none' }, '검색 결과가 없어요'));
  });

  drawHead(); drawChips(); drawResult();
  if (selected.length) track('type_search', { t: selected.join(','), mon: pokemon?.name ?? '', how: 'preset' });  // 링크·상세 팝업으로 미리 채워진 채 열림
  return el('div', { class: 'page__body' }, $input, $sugg, $chips, $head, $result,
    el('p', { class: 'detail__foot' }, '배율은 게임마스터 상성표 기준 (굉장 ×1.6 · 별로 ×0.625 · 무효 ×0.39). 상세 팝업의 타입 상성에서도 이 페이지로 올 수 있어요.'));
}
