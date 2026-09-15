// ─────────────────────────────────────────────────────────────────────────────
// D-MAX 덱 짜기 (#/dmax/deck) — 2026-09-15 v3.32.0
//
// 맥스 배틀에 데려갈 세 마리를 보스별로 고른다. PvP 덱 짜기(#/pvp/deck)와 같은 문법이다:
// 부모 화면(D-MAX)의 버튼 하나로만 들어오고, 주소가 도구를 정한다(router.js tool).
//
// 왜 따로 만드나
//   D-MAX 화면 맨 위 보스 아코디언에도 추천 파티 카드(딜러 2 + 탱커 1)가 있다. 그런데 그것은
//   **이번 주 보스 하나**에만 붙어 있고 세 칸이 고정이라 바꿀 수가 없다. 친구들이 실제로 묻는 것은
//   "다음 주 ○○ 나오는데 뭐 키워둬야 해" · "1위가 없는데 그럼 누구 넣어" · "내 덱 이거 괜찮아" 셋이다.
//
// 어떤 데이터를 읽나 — **새로 만드는 데이터가 없다.** 이미 있는 두 표를 읽기만 한다
//   - DMAX_DATA[보스타입] : 딜러 순위 (맥스 피해 dmg · 내구 bulk · 점수 score)
//   - DMAX_TANK[보스타입] : 탱커 순위 (EHP · 받는 배율 mult)
//   - SCHEDULE_ITEMS / SCHEDULE_YM : 이번 주 보스를 기본값으로 삼는 데 쓴다
//
// 지어내지 않는 것
//   맥스가드·맥스스피릿(방어·회복 역할)은 우리 파이프라인에 데이터가 없다. 그래서 세 번째 칸을
//   '탱커' 라고만 부르고 '힐러' 라고 쓰지 않는다. 4인 협동·클리어 가능 인원도 계산할 근거가 없어 적지 않는다.
//
// 제공하는 전역: MAX_DECK_SIZE · maxDeckBossType · maxDeckCandidates · maxDeckAutoFill · renderMaxDeck
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const MAX_DECK_SIZE = 3;
// 칸마다 무엇을 고르는 자리인지 — 앞 둘은 딜러, 마지막은 탱커.
// 이 순서는 화면에 보이는 순서일 뿐이고, 실제 배틀에서 누굴 먼저 내보내는지를 뜻하지 않는다
const MAX_DECK_SLOTS = [
  { role: 'dealer', label: '딜러' },
  { role: 'dealer', label: '딜러' },
  { role: 'tank', label: '탱커' },
];

// 이번 주(또는 다음) D-MAX 보스 속성. 일정이 없으면 null —
// renderBossAcc 와 같은 규칙으로 고른다(오늘이 걸쳐 있는 dmax 일정 → 없으면 앞으로 올 것 중 가장 빠른 것)
function maxDeckWeekBoss() {
  if (typeof SCHEDULE_ITEMS === 'undefined' || typeof SCHEDULE_YM === 'undefined') return null;
  const now = new Date();
  if (now.getFullYear() !== SCHEDULE_YM.y || now.getMonth() + 1 !== SCHEDULE_YM.m) return null;
  const day = now.getDate();
  const items = SCHEDULE_ITEMS.filter((item) => item.cat === 'dmax' && item.t);
  const current = items.find((item) => day >= item.s && day <= item.e);
  if (current) return { type: current.t, label: current.label.split(' (')[0].replace('D-MAX ', ''), now: true };
  const next = items.filter((item) => item.s > day).sort((first, second) => first.s - second.s)[0];
  return next ? { type: next.t, label: next.label.split(' (')[0].replace('D-MAX ', ''), now: false } : null;
}

// 지금 덱을 짜는 보스 속성. 주소(?b=)가 가장 세고, 없으면 state, 그다음 이번 주 보스, 끝으로 '전체'
function maxDeckBossType() {
  if (state.maxDeckBoss) return state.maxDeckBoss;
  const fromUrl = typeof routeOf === 'function' ? routeOf()?.params?.get('b') : null;
  if (fromUrl && (fromUrl === 'overall' || TYPE_KO[fromUrl])) return fromUrl;
  return maxDeckWeekBoss()?.type ?? 'overall';
}

// 그 칸에 넣을 수 있는 후보 목록. 이미 다른 칸에 들어간 종은 뺀다 —
// 같은 종을 두 칸에 넣는 덱은 맥스 배틀에서 뜻이 없다(partyCardNode 가 쓰는 규칙과 같다)
function maxDeckCandidates(slotIndex, bossType, deck) {
  const slot = MAX_DECK_SLOTS[slotIndex];
  const table = slot.role === 'tank'
    ? (typeof DMAX_TANK !== 'undefined' ? (DMAX_TANK?.[bossType] ?? []) : [])
    : (DMAX_DATA?.[bossType] ?? []);
  const taken = new Set(deck.filter((sprite, index) => sprite != null && index !== slotIndex).map(Number));
  return table.filter((pokemon) => {
    if (taken.has(Number(pokemon.sprite))) return false;
    if (state.maxDeckDynaOnly && pokemon.gmax) return false;
    // 2026-09-15 v3.36.0 미구현(데이터만 있고 게임에 없는 개체)은 후보가 아니다 —
    // 순위표는 "있으면 이쯤" 을 보여 주는 자리지만, 덱은 **지금 데려갈 수 있는** 것만 담아야 한다
    if (pokemon.unrel) return false;
    return true;
  });
}

// 세 칸을 자동으로 채운다 — 각 칸의 후보 1위. 앞 칸부터 채우며 뒤 칸은 앞이 가져간 종을 피한다
function maxDeckAutoFill(bossType) {
  const deck = [null, null, null];
  for (let index = 0; index < MAX_DECK_SIZE; index += 1) {
    deck[index] = maxDeckCandidates(index, bossType, deck)[0]?.sprite ?? null;
  }
  return deck;
}

// 스프라이트 id 로 그 칸의 표에서 행을 찾는다 (후보에서 빠진 뒤에도 찾을 수 있게 표 전체를 본다)
function maxDeckRowOf(slotIndex, bossType, spriteId) {
  if (spriteId == null) return null;
  const slot = MAX_DECK_SLOTS[slotIndex];
  const table = slot.role === 'tank'
    ? (typeof DMAX_TANK !== 'undefined' ? (DMAX_TANK?.[bossType] ?? []) : [])
    : (DMAX_DATA?.[bossType] ?? []);
  return table.find((pokemon) => Number(pokemon.sprite) === Number(spriteId)) ?? null;
}

// 그 칸의 근거 한 줄 — 지어낸 등급이 아니라 표에 있는 숫자 그대로다
function maxDeckWhy(slotIndex, pokemon, bossType) {
  if (!pokemon) return '';
  if (MAX_DECK_SLOTS[slotIndex].role === 'tank') {
    return bossType === 'overall'
      ? `EHP ${pokemon.ehp} · 체력 ${pokemon.hp} · 방어 ${pokemon.def}`
      : `EHP ${pokemon.ehp} · 보스 기술을 ×${pokemon.mult} 로 받음`;
  }
  return `맥스 피해 ${pokemon.dmg} · 내구 ${pokemon.bulk}`;
}

// 주소를 지금 덱에 맞춘다 — 그대로 보내면 상대도 같은 덱을 연다.
// 화면을 다시 그리지 않으려고 replaceState 만 쓴다(도감 검색과 같은 방식)
function maxDeckSyncHash(bossType, deck) {
  const next = new URLSearchParams();
  next.set('b', bossType);
  const picked = deck.filter((sprite) => sprite != null);
  if (picked.length) next.set('p', picked.join(','));
  try { history.replaceState(history.state, '', `#/dmax/deck?${next.toString()}`); } catch { /* 주소 못 바꾸는 환경 */ }
}

// 주소에 실린 덱(?p=)을 읽는다. 칸 수가 안 맞거나 그 표에 없는 id 면 그 칸만 비운다
function maxDeckFromHash(bossType) {
  const raw = typeof routeOf === 'function' ? routeOf()?.params?.get('p') : null;
  if (!raw) return null;
  const ids = raw.split(',').map((piece) => Number(piece.trim())).filter((value) => Number.isFinite(value));
  if (!ids.length) return null;
  const deck = [null, null, null];
  ids.slice(0, MAX_DECK_SIZE).forEach((id, index) => {
    if (maxDeckRowOf(index, bossType, id)) deck[index] = id;
  });
  return deck;
}

function renderMaxDeck() {
  const bossType = maxDeckBossType();
  // 아직 안 채웠으면 채운다. 주소에 실려 온 덱은 **이 화면에 처음 들어올 때 한 번만** 읽는다 —
  // 남이 보낸 링크를 자동 추천이 덮어쓰면 안 되지만, 그 뒤 보스 칩을 바꿀 때마다 옛 덱을
  // 되읽으면 새 보스의 표에 없는 칸이 조용히 비어 버린다 (2026-09-15 첫 구현에서 잡은 버그)
  if (!state.maxDeck) {
    const fromHash = state.maxDeckRead ? null : maxDeckFromHash(bossType);
    state.maxDeckRead = true;
    state.maxDeck = fromHash ?? maxDeckAutoFill(bossType);
    state.maxDeckBoss = bossType;
    state.maxDeckSwap = null;
  }
  const deck = state.maxDeck;
  const week = maxDeckWeekBoss();
  const typeLabel = bossType === 'overall' ? '전체' : (TYPE_KO[bossType] ?? bossType);

  $content.append(el('div', { class: 'row-head' },
    el('div', { class: 'row-head__title' }, el('h2', {}, `${typeLabel} 보스에 데려갈 셋`)),
    el('span', { class: 'meta' }, week && week.type === bossType ? (week.now ? `이번 주 ${week.label}` : `다음 보스 ${week.label}`) : '')));

  // ── 보스 칩 ────────────────────────────────────────────────────────────────
  const bossItems = [{ id: 'overall', label: '전체' }, ...Object.keys(TYPE_KO).map((typeKey) => ({ id: typeKey, label: TYPE_KO[typeKey], color: typeKey }))];
  const bossChips = chips(bossItems, bossType, (id) => {
    state.maxDeckBoss = id;
    state.maxDeck = null;      // 보스가 바뀌면 세 칸을 다시 채운다
    state.maxDeckSwap = null;
    render();
  });
  $content.append(el('div', { class: 'submenu' }, el('span', { class: 'submenu__label' }, '보스 속성'), bossChips));

  // ── [다이맥스만] ───────────────────────────────────────────────────────────
  // 거다이맥스는 위력 450, 다이맥스는 350 이라 둘을 섞어 두면 상위가 거의 거다이맥스로 채워진다.
  // 그게 틀린 것은 아니지만, 가진 사람과 안 가진 사람의 답이 달라야 한다
  const dynaChip = uchip('다이맥스만', () => {
    state.maxDeckDynaOnly = !state.maxDeckDynaOnly;
    state.maxDeck = null;
    state.maxDeckSwap = null;
    render();
  }, { on: state.maxDeckDynaOnly, title: '거다이맥스 폼을 후보에서 빼요 — 아직 못 잡았다면' });
  $content.append(el('div', { class: 'controls__row controls__row--tools' }, dynaChip));

  // ── 세 칸 ─────────────────────────────────────────────────────────────────
  const slots = el('ul', { class: 'row-list deck-slots' });
  MAX_DECK_SLOTS.forEach((slot, index) => {
    const pokemon = maxDeckRowOf(index, bossType, deck[index]);
    const swapOpen = state.maxDeckSwap === index;
    const head = el('li', { class: `row deck-slot${pokemon ? '' : ' is-empty'}` },
      el('span', { class: 'row__rank' }, String(index + 1)),
      pokemon ? sprite(pokemon.sprite) : el('span', { class: 'deck-slot__blank' }, '—'),
      el('span', { class: 'row__name' },
        // nameNode 가 폼 뱃지 + <b>종 이름</b> 을 돌려준다 — 여기서 <b> 를 한 겹 더 씌우지 않는다
        pokemon ? nameNode(pokemon.name) : el('b', {}, '비어 있어요'),
        el('span', { class: 'row__sub' }, `${slot.label} · ${maxDeckWhy(index, pokemon, bossType)}`)),
      el('button', { class: 'boss__more deck-slot__swap', 'aria-expanded': String(swapOpen), onclick: () => {
        state.maxDeckSwap = swapOpen ? null : index;
        render();
      } }, swapOpen ? '닫기' : '바꾸기'));
    if (pokemon) head.addEventListener('click', (event) => {
      if (event.target.closest('.deck-slot__swap')) return;
      openDetail(pokemon);
    });
    slots.append(head);
    if (!swapOpen) return;
    // 후보 목록 — 그 칸의 역할에 맞는 표에서, 다른 칸이 가져간 종을 뺀 것
    const candidates = maxDeckCandidates(index, bossType, deck).slice(0, 12);
    const picker = el('li', { class: 'row__why is-open deck-slot__picker' },
      el('div', { class: 'row__why-col' },
        el('b', { class: 'row__why-title' }, `${slot.label} 후보 — ${typeLabel} 보스 상대 ${slot.role === 'tank' ? 'EHP' : '맥스 피해'}순`),
        el('div', { class: 'row__why-chips' }, ...candidates.map((candidate) => el('button', {
          class: `row__why-chip${Number(candidate.sprite) === Number(deck[index]) ? ' is-on' : ''}`,
          onclick: () => {
            state.maxDeck = deck.map((value, at) => (at === index ? candidate.sprite : value));
            state.maxDeckSwap = null;
            render();
          },
        }, nameNode(candidate.name))))));
    slots.append(picker);
  });
  $content.append(slots);

  // ── 한 줄 요약 ────────────────────────────────────────────────────────────
  // 지어낸 등급이 아니라 표에 있는 숫자를 그대로 더한 값이다
  const dealerRows = [0, 1].map((index) => maxDeckRowOf(index, bossType, deck[index])).filter(Boolean);
  const tankRow2 = maxDeckRowOf(2, bossType, deck[2]);
  const dmgSum = dealerRows.reduce((sum, pokemon) => sum + (pokemon.dmg ?? 0), 0);
  const summary = !dealerRows.length && !tankRow2 ? '세 칸이 모두 비었어요.'
    : `딜러 ${dealerRows.length}마리 맥스 피해 합 ${dmgSum.toLocaleString()}${tankRow2 ? ` · 탱커 EHP ${tankRow2.ehp}` : ''}`;
  $content.append(el('p', { class: 'deck__reason' }, `💬 ${summary}`));

  $content.append(footNote('딜러는 맥스 피해 × √내구 순위, 탱커는 체력 × 방어 ÷ 받는 배율(EHP) 순위에서 골라요. 맥스가드·맥스스피릿 같은 방어·회복 역할은 아직 데이터가 없어 다루지 않아요. 주소를 그대로 보내면 상대도 같은 덱을 봅니다.'));
  maxDeckSyncHash(bossType, deck);
}
