// ─────────────────────────────────────────────────────────────────────────────
// components/finder.js — 🔎 검색식 만들기 (2026-09-11 v2.58.0, 백로그 QA-57)
//
// 무엇인가
//   포켓몬 GO 안의 검색창에 그대로 붙여 넣을 **검색식 한 줄**을 만들어 준다.
//   조건을 눌러 고르면 아래에 식이 자라고, [복사] 로 가져가 게임에 붙인다.
//
// 왜 필요한가
//   박스가 수천 마리가 되면 "뭘 정리할지" 를 눈으로 고를 수 없다. 게임의 검색식이 그 일을 하는데,
//   문법이 낯설고(`4*` · `!` · `&` · `,`) 외워 쓰기 어렵다 — 그래서 대부분 쓰지 않는다.
//   여기서는 **고르면 식이 되고**, 식을 보면서 문법을 배우게 된다.
//
// 무엇을 넣지 않았나 — 여기가 이 화면의 경계다
//   · 게임 버전마다 되고 안 되는 문법이 갈리는 것(`countcandyxl` 등)은 넣지 않았다.
//     틀린 식을 주면 사용자가 게임에서 빈 결과를 보고 "이 서비스가 틀렸다" 고 알게 된다.
//     여기 있는 것은 오래 안정적으로 통한 기본 문법뿐이다.
//   · 교환 상대 닉네임·리모트 전용 같은 **게임이 지원하지 않는 조건**은 아예 두지 않았다.
//     없는 것을 만들어 주는 것보다 없다고 말하지 않는 편이 낫다 — 대신 화면 아래에 적어 둔다.
//
// 제공하는 전역
//   FINDER_PRESETS · FINDER_GROUPS · finderQuery · renderFinderPage
//
// 의존하는 전역
//   el (dom.js) · TYPE_KO (data.js) · track (track.js) · state (app.js)
// ─────────────────────────────────────────────────────────────────────────────

// 고른 조건은 화면을 떠나도 남는다 — 검색식은 한 번 만들고 게임과 오가며 여러 번 쓴다
const FINDER_KEY = 'pogo_finder';

// 조건 한 칸: id 는 저장 키, q 는 그대로 식에 들어갈 조각, why 는 "이게 뭘 거르나"
const FINDER_GROUPS = [
  { id: 'basic', label: '기본', items: [
    { id: 'iv4', q: '4*', why: '개체값 100% (네 별)' },
    { id: 'iv3', q: '3*', why: '개체값 82~98% (세 별)' },
    { id: 'shiny', q: 'shiny', why: '색이 다른 모습' },
    { id: 'lucky', q: 'lucky', why: '행운' },
    { id: 'shadow', q: 'shadow', why: '그림자' },
    { id: 'purified', q: 'purified', why: '정화됨' },
    { id: 'fav', q: 'favorite', why: '즐겨찾기로 표시한 것' },
    { id: 'costume', q: 'costume', why: '의상 입은 개체' },
  ] },
  { id: 'kind', label: '분류', items: [
    { id: 'legendary', q: 'legendary', why: '전설' },
    { id: 'mythical', q: 'mythical', why: '환상' },
    { id: 'ultra', q: 'ultrabeast', why: '울트라비스트' },
    { id: 'mega', q: 'mega', why: '메가진화 가능' },
    { id: 'evolve', q: 'evolve', why: '지금 진화할 수 있는 것' },
    { id: 'item', q: 'item', why: '진화에 도구가 필요한 것' },
    { id: 'defender', q: 'defender', why: '체육관에 넣어 둔 것' },
  ] },
  { id: 'trade', label: '교환·정리', items: [
    { id: 'tradable', q: 'tradable', why: '교환할 수 있는 것' },
    { id: 'traded', q: 'traded', why: '교환으로 받은 것' },
    { id: 'hatched', q: 'hatched', why: '알에서 깬 것' },
    { id: 'raid', q: 'raid', why: '레이드에서 잡은 것' },
    { id: 'research', q: 'research', why: '리서치 보상' },
    { id: 'gbl', q: 'gbl', why: 'GO 배틀리그 보상' },
  ] },
];

// 자주 쓰는 묶음 — 처음 여는 사람이 "이런 걸 할 수 있구나" 를 한눈에 보게 한다.
// 조건을 직접 고르기 전에 눌러 보고, 거기서 빼고 더하면 된다
const FINDER_PRESETS = [
  { id: 'box', label: '🧹 박스 정리', why: '교환할 수 있고, 즐겨찾기·그림자·전설이 아닌 것',
    on: ['tradable'], off: ['fav', 'shadow', 'legendary', 'mythical'] },
  { id: 'raise', label: '🌱 육성 후보', why: '개체값이 높고 지금 진화할 수 있는 것',
    on: ['iv4', 'evolve'], off: [] },
  { id: 'trade', label: '🤝 교환용', why: '교환할 수 있고 아직 행운이 아닌 것',
    on: ['tradable'], off: ['lucky', 'fav'] },
];

// 고른 것들을 게임 문법으로 잇는다.
//   같은 줄의 조건은 `&`(그리고), 빼는 조건은 앞에 `!`.
//   타입은 여러 개면 `,`(또는)로 묶어 괄호 없이 이어 붙인다 — 게임이 쉼표를 '또는'으로 읽는다.
function finderQuery(picked) {
  const parts = [];
  for (const [id, sign] of Object.entries(picked.flags || {})) {
    const item = FINDER_GROUPS.flatMap((group) => group.items).find((entry) => entry.id === id);
    if (!item || !sign) continue;
    parts.push(sign === 'off' ? `!${item.q}` : item.q);
  }
  // 타입은 한 덩이로 — 여러 개를 `&` 로 이으면 "둘 다인 것" 이 되어 거의 안 걸린다
  const types = picked.types || [];
  if (types.length) parts.push(types.join(','));
  if (picked.cpMin || picked.cpMax) {
    const lo = picked.cpMin || '';
    const hi = picked.cpMax || '';
    parts.push(`cp${lo}-${hi}`);
  }
  if (picked.name) parts.push(picked.name.trim());
  return parts.join('&');
}

function finderLoad() {
  try {
    const saved = JSON.parse(localStorage.getItem(FINDER_KEY) || '{}');
    return { flags: saved.flags || {}, types: saved.types || [], cpMin: saved.cpMin || '', cpMax: saved.cpMax || '', name: saved.name || '' };
  } catch { return { flags: {}, types: [], cpMin: '', cpMax: '', name: '' }; }
}

function finderSave(picked) {
  try { localStorage.setItem(FINDER_KEY, JSON.stringify(picked)); } catch { /* 저장 불가 환경 */ }
}

function renderFinderPage() {
  const picked = finderLoad();
  const $out = el('code', { class: 'finder__out' });
  const $hint = el('p', { class: 'finder__hint note' });
  const $copy = el('button', { class: 'finder__copy uchip' }, '📋 복사');

  const paint = () => {
    const query = finderQuery(picked);
    $out.textContent = query || '(조건을 고르면 여기에 검색식이 만들어져요)';
    $out.classList.toggle('is-empty', !query);
    $copy.disabled = !query;
    const count = Object.values(picked.flags).filter(Boolean).length + (picked.types.length ? 1 : 0);
    $hint.textContent = query
      ? `조건 ${count}개 · 게임 검색창에 그대로 붙여 넣으세요.`
      : '아래에서 조건을 누르면 검색식이 만들어져요.';
    finderSave(picked);
  };

  // 한 번 누르면 '포함', 다시 누르면 '제외', 또 누르면 해제 — 세 상태를 한 칸으로 돌린다.
  // 버튼을 둘로 나누면(포함 칩 줄 + 제외 칩 줄) 같은 조건이 화면에 두 번 나와 어느 쪽이 켜졌는지 헷갈린다
  const cycle = (id) => {
    const now = picked.flags[id];
    picked.flags[id] = now === 'on' ? 'off' : now === 'off' ? null : 'on';
    if (!picked.flags[id]) delete picked.flags[id];
    render();
  };

  const flagChip = (item) => {
    const sign = picked.flags[item.id];
    const mark = sign === 'on' ? '＋' : sign === 'off' ? '－' : '';
    return el('button', {
      class: `uchip finder__flag${sign ? ` is-${sign}` : ''}`,
      title: item.why,
      'aria-pressed': sign ? 'true' : 'false',
      onclick: () => { track('finder_flag', { id: item.id }); cycle(item.id); },
    }, `${mark}${item.why}`);
  };

  const typeChip = (key) => {
    const on = picked.types.includes(key);
    return el('button', {
      class: `uchip finder__type${on ? ' is-on' : ''}`,
      'aria-pressed': on ? 'true' : 'false',
      onclick: () => {
        picked.types = on ? picked.types.filter((x) => x !== key) : [...picked.types, key];
        track('finder_type', { type: key });
        render();
      },
    }, TYPE_KO[key] || key);
  };

  const presetChip = (preset) => el('button', {
    class: 'uchip finder__preset', title: preset.why,
    onclick: () => {
      picked.flags = {};
      for (const id of preset.on) picked.flags[id] = 'on';
      for (const id of preset.off) picked.flags[id] = 'off';
      track('finder_preset', { id: preset.id });
      render();
    },
  }, preset.label);

  const numberBox = (key, label) => el('input', {
    class: 'finder__num', type: 'number', min: '0', inputmode: 'numeric',
    placeholder: label, value: picked[key] || '',
    oninput: (event) => { picked[key] = event.target.value.replace(/\D/g, ''); paint(); },
  });

  const body = el('div', { class: 'page__body finder' });

  const render = () => {
    body.replaceChildren(
      el('p', { class: 'note' }, '게임 검색창에 붙여 넣을 검색식을 만들어요. 조건을 한 번 누르면 ',
        el('b', {}, '＋포함'), ', 다시 누르면 ', el('b', {}, '－제외'), ', 또 누르면 해제돼요.'),

      // 만들어진 식을 **맨 위에** 둔다 — 조건을 고르는 내내 결과가 눈에 있어야 무엇이 달라지는지 보인다
      el('div', { class: 'finder__result' }, $out,
        el('div', { class: 'finder__actions' }, $copy,
          el('button', { class: 'uchip finder__clear', onclick: () => {
            picked.flags = {}; picked.types = []; picked.cpMin = ''; picked.cpMax = ''; picked.name = '';
            track('finder_clear'); render();
          } }, '↺ 비우기')),
        $hint),

      el('div', { class: 'row-head' }, el('h2', {}, '자주 쓰는 묶음')),
      el('div', { class: 'finder__chips' }, ...FINDER_PRESETS.map(presetChip)),

      ...FINDER_GROUPS.flatMap((group) => [
        el('div', { class: 'row-head' }, el('h2', {}, group.label)),
        el('div', { class: 'finder__chips' }, ...group.items.map(flagChip)),
      ]),

      el('div', { class: 'row-head' }, el('h2', {}, '타입'),
        el('span', { class: 'meta' }, '여러 개면 “또는”')),
      el('div', { class: 'finder__chips' }, ...Object.keys(TYPE_KO).map(typeChip)),

      el('div', { class: 'row-head' }, el('h2', {}, 'CP · 이름')),
      el('div', { class: 'finder__row' },
        numberBox('cpMin', 'CP 최소'), el('span', { class: 'finder__dash' }, '–'), numberBox('cpMax', 'CP 최대'),
        el('input', { class: 'finder__name', type: 'text', placeholder: '이름 (예: 파이리)',
          value: picked.name || '',
          oninput: (event) => { picked.name = event.target.value; paint(); } })),

      el('p', { class: 'detail__foot' },
        '게임이 지원하지 않아 넣지 않은 것: 교환 상대 닉네임, 리모트 레이드 전용. ',
        '버전에 따라 달라지는 문법(사탕 수 등)도 빼 뒀어요 — 틀린 식을 드리지 않기 위해서예요.'),
    );
    paint();
  };

  $copy.onclick = async () => {
    const query = finderQuery(picked);
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      $copy.textContent = '복사됨 ✓';
    } catch {
      // 클립보드가 막힌 환경(비보안 출처 등) — 고를 수 있게 띄워 주면 사용자가 직접 복사한다
      $out.focus?.();
      $copy.textContent = '길게 눌러 복사';
    }
    track('finder_copy', { len: query.length });
    setTimeout(() => { $copy.textContent = '📋 복사'; }, 1600);
  };

  render();
  return body;
}
