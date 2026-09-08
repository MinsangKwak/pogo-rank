// ─────────────────────────────────────────────────────────────────────────────
// components/gameday.js — ⚔️ 레이드 보스(#/raids) · 🥚 알 부화(#/eggs) (2026-09-08 v2.25.0)
//
// 무엇을 하나
//   빌드가 구운 GAMEDAY(backend/gameday_build.py)를 티어·거리로 묶어 보여 준다.
//   목록만 옮겨 놓으면 다른 사이트를 보는 것과 같으므로, 두 화면 모두 **내 것과 교차**한다.
//     줄을 누르면 상세가 열려 약점·추천 딜러·종족값으로 이어지고,
//     즐겨찾기에 든 종에는 ★ 를 붙여 "지금 도는 풀에 내가 노리던 게 있나"를 한눈에 본다.
//
// 왜 dex__row 를 쓰나
//   도감 목록과 같은 성격의 줄(그림 + 이름 + 뱃지 + ★)이라 같은 모양이어야 한다.
//   새 블록을 파면 같은 서비스 안에 비슷한 줄이 두 벌 생긴다 (docs/DEVELOPMENT.md 2.18).
//
// 제공하는 전역
//   renderRaidsPage() · renderEggsPage() · gamedayHas(kind)
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode (components/name.js)
//   openDetailByDex (components/detail.js) · authEnabled · favBtn (components/auth.js)
//   GAMEDAY · TYPE_KO (data.js)
// ─────────────────────────────────────────────────────────────────────────────

// 데이터가 아예 없을 수 있다 — 수집이 실패해도 배포는 계속되므로(fetch_data.sh) 화면 쪽에서 막는다
function gamedayHas(kind) {
  const data = typeof GAMEDAY !== 'undefined' && GAMEDAY ? GAMEDAY[kind] : null;
  return !!data && Object.keys(data).length > 0;
}

// 수집일 각주 — 원본이 언제 기준인지 밝힌다. 게임 안 실제 로테이션과 어긋날 수 있다
function gamedayFoot(lead) {
  const fetched = (typeof GAMEDAY !== 'undefined' && GAMEDAY && GAMEDAY.fetched) || '';
  return el('p', { class: 'detail__foot' },
    `${lead} 출처 LeekDuck(ScrapedDuck)${fetched ? ` · ${fetched} 수집` : ''} · 지역과 이벤트에 따라 실제와 다를 수 있습니다`);
}

// 한 줄: 그림 + 이름 + 조건 뱃지 + ★. 누르면 상세가 열린다
function gamedayRow(entry, notes) {
  return el('button', { class: 'dex__row', onclick: () => openDetailByDex(entry.sprite, true) },
    sprite(entry.sprite),
    el('b', {}, typeof nameNode === 'function' ? nameNode(entry.name) : entry.name),
    el('span', { class: 'meta gameday__note' }, notes.join(' · ')),
    authEnabled() ? favBtn(entry.sprite, 'dex__fav') : '');
}

// 티어·거리 묶음 하나 = 소제목 + 줄 목록
function gamedaySection(heading, list, toNotes) {
  return el('section', { class: 'gameday__sec' },
    el('h2', { class: 'page__sec' }, heading, el('span', { class: 'meta' }, ` ${list.length}종`)),
    el('div', { class: 'dex__list' }, ...list.map((entry) => gamedayRow(entry, toNotes(entry)))));
}

function gamedayEmpty(what) {
  return el('div', { class: 'page__body' },
    el('p', { class: 'empty' }, `${what} 정보를 아직 받지 못했습니다. 다음 빌드에서 채워집니다.`));
}

// ── ⚔️ 레이드 보스 ────────────────────────────────────────────────────────────
// 티어별로 묶는다. 줄마다 타입 · CP 범위 · 부스트 날씨 · 색이 다른 모습 가능 여부를 적는다.
function renderRaidsPage() {
  if (!gamedayHas('raids')) return gamedayEmpty('레이드 보스');
  const notes = (boss) => {
    const parts = [];
    if (boss.types && boss.types.length) parts.push(boss.types.map((typeName) => TYPE_KO[typeName] || typeName).join('·'));
    if (boss.cp && boss.cp.min) parts.push(`CP ${boss.cp.min}–${boss.cp.max}`);
    if (boss.weather && boss.weather.length) parts.push(`${boss.weather.join('·')} 부스트`);
    if (boss.shiny) parts.push('✨');
    return parts;
  };
  return el('div', { class: 'page__body' },
    el('p', { class: 'note' }, '보스를 누르면 약점과 추천 딜러가 열려요. 혼자 잡을 수 있는지는 ⚔️ 레이드 · PvE 의 🧮 솔플 계산기에서 확인하세요.'),
    ...Object.entries(GAMEDAY.raids).map(([tier, list]) => gamedaySection(`${tier} 레이드`, list, notes)),
    gamedayFoot('지금 도는 레이드 로테이션.'));
}

// ── 🥚 알 부화 ────────────────────────────────────────────────────────────────
// 거리별로 묶는다. 지역한정·어드벤처 싱크·선물 알은 조건이 붙는 종이라 따로 표시한다.
function renderEggsPage() {
  if (!gamedayHas('eggs')) return gamedayEmpty('알 부화');
  const notes = (egg) => {
    const parts = [];
    if (egg.cp && egg.cp.min) parts.push(egg.cp.min === egg.cp.max ? `CP ${egg.cp.min}` : `CP ${egg.cp.min}–${egg.cp.max}`);
    if (egg.shiny) parts.push('✨');
    if (egg.regional) parts.push('지역한정');
    if (egg.sync) parts.push('어드벤처 싱크');
    if (egg.gift) parts.push('선물 알');
    return parts;
  };
  return el('div', { class: 'page__body' },
    el('p', { class: 'note' }, '★ 를 누르면 즐겨찾기에 담깁니다. 이름을 누르면 종족값과 상성을 볼 수 있어요.'),
    ...Object.entries(GAMEDAY.eggs).map(([distance, list]) => gamedaySection(`${distance} 알`, list, notes)),
    gamedayFoot('지금 도는 알 부화 풀.'));
}
