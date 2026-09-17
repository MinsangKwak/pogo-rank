'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// components/favnews.js — ★ 담아 둔 포켓몬의 소식 배지 (2026-09-17 v3.60.0)
//
// 왜 만들었나
//   v3.4.0 에 ★ 즐겨찾기를 통째로 걷어냈다. 이유가 그때 코드에 남아 있다 —
//   "담을 수는 있는데, 담은 뒤에 할 수 있는 일이 없었다."
//   이 파일이 그 빈자리다. 담아 두면 **그 포켓몬이 일정에 뜰 때 상세에서 알려 준다.**
//
// 무엇을 맞추나
//   FAV_EVENTS(core data.js)는 포켓몬이 걸린 일정만 추려 둔 표다 —
//   커뮤니티 데이 · 스포트라이트 아워 · 레이드 보스가 여기 든다.
//   맞추는 단위는 **종(도감번호)** 이다. 폼은 보지 않는다 — 담는 단위가 종이라서다.
//   아직 포켓몬이 발표되지 않은 일정은 표에 dex 가 없어 애초에 걸리지 않는다
//   (11월 커뮤니티 데이처럼). "없다" 로 볼 뿐 오류가 아니다.
//
// 어디에 붙나
//   1) 🎒 내 포켓몬 화면의 **맨 위 덩이** — 이 화면의 주인공이다 (planner/home.js)
//   2) 포켓몬 상세 팝업의 작은 배지 — 담은 자리에서 바로 보이라고
//
// 누가 보나
//   2026-09-17 v3.61.0 실험 기능 문을 열었다. v3.60.0 에는 AUTH.beta 뒤에 뒀는데, 소식이
//   🎒 내 포켓몬 화면의 **주 내용**이 되면서 참가자가 아닌 사람에게는 빈 화면이 뜨게 됐다.
//   로그인 + 승인이 이미 충분한 문턱이다. 승인 대기(pending)도 본다 — 담는 것이 허용돼 있고
//   (firestore.rules favsOnly), 기다리는 동안 볼 것이 있어야 기다릴 이유도 생긴다.
//
// 알림 방식
//   앱 안 배지다. 푸시가 아니다. 커뮤니티 데이는 한 달 전에 발표되고 스포트라이트는 매주라,
//   들어왔을 때 보이면 늦지 않는다. 푸시(FCM·권한·토큰·발송)는 그 다음 단계다.
//
// 제공하는 전역
//   favNewsEnabled()  지금 이 사람에게 소식을 보여 주는가
//   favNewsFor(dex)   그 종의 소식 [{ event, dex, start, days }] — 이른 순
//   favNewsList()     담아 둔 전부의 소식 (홈·메뉴 배지용)
//   favNewsCount()    그 개수
//   favNewsNode(dex)  상세에 붙이는 배지 조각 — 담지 않았거나 소식이 없으면 빈 문자열
//   favNewsMonName(dex)   담아 둔 종의 한글 이름 (없으면 #번호)
//   favNewsCardNode(row)  🎒 화면의 소식 카드 한 장
//
// 의존하는 전역
//   FAV_EVENTS · DEX_DATA (data.js) · AUTH · favEnabled · isFav (components/auth.js)
//   el (dom.js) · sprite (components/sprite.js) · closeModal (components/modal.js)
// ─────────────────────────────────────────────────────────────────────────────

// 일정 종류 이름. ScrapedDuck 의 type 값 그대로가 열쇠다 (backend/gameday_build.py)
const FAV_NEWS_LABEL = {
  'community-day': '커뮤니티 데이',
  'pokemon-spotlight-hour': '스포트라이트 아워',
  'raid-battles': '레이드 보스',
};

// 이보다 먼 일정은 아직 챙길 일이 아니다 — 지금 할 수 있는 일만 배지에 남긴다
const FAV_NEWS_WINDOW_DAYS = 45;
const FAV_NEWS_DAY_MS = 24 * 60 * 60 * 1000;

// 담을 수 있는 사람이면 소식도 본다 — 두 조건이 갈리면 "담았는데 아무 일도 안 일어나는" 자리가 생긴다
function favNewsEnabled() {
  return typeof favEnabled === 'function' && favEnabled()
    && typeof FAV_EVENTS !== 'undefined' && Array.isArray(FAV_EVENTS);
}

// 남은 날. 오늘 0시 기준이라 "오늘 저녁 스포트라이트" 가 D-0 으로 잡힌다
function favNewsDays(start) {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return Math.round((new Date(start).setHours(0, 0, 0, 0) - midnight.getTime()) / FAV_NEWS_DAY_MS);
}

// 끝난 것은 뺀다. 진행 중이면(시작은 지났고 끝은 안 남) 그대로 챙긴다
function favNewsRows(match) {
  if (!favNewsEnabled()) return [];
  const now = Date.now();
  const until = now + FAV_NEWS_WINDOW_DAYS * FAV_NEWS_DAY_MS;
  const rows = [];
  for (const event of FAV_EVENTS) {
    const mine = (event.dex || []).filter(match);
    if (!mine.length) continue;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end || event.start);
    if (Number.isFinite(end) && end < now) continue;
    if (Number.isFinite(start) && start > until) continue;
    const at = Number.isFinite(start) ? start : now;
    rows.push({ event, dex: mine, start: at, days: favNewsDays(at) });
  }
  return rows.sort((left, right) => left.start - right.start);
}

function favNewsFor(dex) {
  const number = Number(dex);
  if (!Number.isFinite(number)) return [];
  return favNewsRows((one) => Number(one) === number);
}

// 담아 둔 전부. 홈·메뉴 합계 배지가 볼 자리다
function favNewsList() {
  if (!(typeof AUTH !== 'undefined' && AUTH.favs instanceof Set && AUTH.favs.size)) return [];
  return favNewsRows((one) => AUTH.favs.has(Number(one)));
}

function favNewsCount() {
  return favNewsList().length;
}

// 사람이 읽는 한 줄 — "커뮤니티 데이 D-23" · "스포트라이트 아워 오늘" · "레이드 보스 진행 중"
function favNewsWhen(row) {
  if (row.days <= 0) return row.start <= Date.now() ? '진행 중' : '오늘';
  if (row.days === 1) return '내일';
  return `D-${row.days}`;
}

function favNewsText(row) {
  return `${FAV_NEWS_LABEL[row.event.type] || '일정'} ${favNewsWhen(row)}`;
}

// 담아 둔 종의 한글 이름 — 이름표에 없으면 번호를 그대로 쓴다 (이름을 지어내지 않는다)
function favNewsMonName(dex) {
  const names = typeof DEX_DATA !== 'undefined' ? DEX_DATA.names : null;
  return (names && names[dex]) || `#${dex}`;
}

// 🎒 내 포켓몬 화면의 소식 카드 한 장 — 누구의, 무슨 일정이, 언제.
// 상세의 배지와 달리 여기서는 **누구인지**가 먼저다 (여러 마리가 한 줄씩 서므로)
function favNewsCardNode(row) {
  const when = favNewsWhen(row);
  return el('a', { class: `favnews__card${row.days <= 0 ? ' is-now' : ''}`, href: '#/schedule' },
    el('span', { class: 'favnews__mons' }, ...row.dex.map((dex) => sprite(dex))),
    el('span', { class: 'favnews__main' },
      el('b', { class: 'favnews__who' }, row.dex.map(favNewsMonName).join(' · ')),
      el('span', { class: 'favnews__kind' }, FAV_NEWS_LABEL[row.event.type] || '일정')),
    el('span', { class: `favnews__when${row.days <= 0 ? ' is-now' : ''}` }, when));
}

// 상세 팝업의 배지. **담아 둔 포켓몬에만 선다** — ★ 를 누를 이유가 여기서 생긴다.
// 가장 가까운 한 건만 쓰고 나머지는 개수로 접는다 — 머리줄은 자리가 좁고,
// 자세한 것은 눌러서 여는 이벤트 일정이 맡는다
function favNewsNode(dex) {
  if (!(typeof isFav === 'function' && isFav(dex))) return '';
  const rows = favNewsFor(dex);
  if (!rows.length) return '';
  const first = rows[0];
  const more = rows.length - 1;
  const node = el('button', {
    class: 'detail__favnews',
    title: rows.map((row) => `${favNewsText(row)} — ${row.event.title}`).join('\n'),
    onclick: (event) => {
      event.stopPropagation();
      if (typeof track === 'function') track('fav_news_open', { mon: String(dex), count: rows.length });
      if (typeof closeModal === 'function') closeModal();
      location.hash = '#/schedule';
    },
  }, el('span', { class: 'detail__favnews-dot', 'aria-hidden': 'true' }, '📣'),
    el('b', { class: 'detail__favnews-kind' }, FAV_NEWS_LABEL[first.event.type] || '일정'),
    el('span', { class: 'detail__favnews-when' }, favNewsWhen(first)),
    more > 0 ? el('span', { class: 'detail__favnews-more' }, `외 ${more}`) : '');
  return node;
}
