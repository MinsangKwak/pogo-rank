// 2026-09-03 업데이트 소식: 자동 팝업 대신 패치노트 페이지(#/release) + 새 소식 뱃지로 전환
// RELEASE_VER가 바뀌면 ☰ 버튼과 메뉴 항목에 빨간 점이 뜨고, 패치노트를 열면 사라진다
//
// ── 뱃지가 뜨는 구조 ────────────────────────────────────────────────────────
// "본 버전"을 localStorage(RELEASE_SEEN_KEY)에 문자열 하나로 저장해 두고,
// 그 값이 현재 RELEASE_VER와 다르면 새 소식이 있다고 판단한다.
// 즉 새 패치노트를 알리는 방법은 아래 RELEASE_VER 문자열을 바꾸는 것 하나뿐이고,
// 날짜나 항목 개수를 비교하지 않으므로 문구만 손볼 때는 뱃지가 뜨지 않는다.
// 패치노트 페이지를 열면 markReleaseSeen()이 현재 버전을 기록해 빨간 점이 사라진다.
const RELEASE_VER = '2026-09-20-459';  // v4.4.2 성능
const RELEASE_HIDE_KEY = 'pogo_release_hide';
// 2026-09-16 v3.46.0 **패치노트 본문은 밖으로 뺐다** (scripts/release-notes.js → dist/app-lazy.js).
// 160판 × 여러 줄이라 이 파일의 94%(gzip 30KB)를 차지했는데, 첫 화면은 그중 한 글자도 안 쓴다.
// 여기 남는 것은 뱃지 판정(RELEASE_VER)과 그리는 코드뿐이다 — 부팅에 필요한 건 그것뿐이라서다.
// 아직 안 왔을 때를 대비해 읽는 곳마다 releaseNotes() 를 거친다 (빈 배열이면 화면이 '불러오는 중' 을 띄운다)
function releaseNotes() {
  return typeof RELEASE_NOTES === 'undefined' ? [] : RELEASE_NOTES;
}
function releaseNotesReady() {
  return typeof RELEASE_NOTES !== 'undefined';
}

// 패치노트 데이터: 최신 날짜가 위로 오도록 직접 정렬해서 적는다(코드에서 다시 정렬하지 않는다).
// 사용자가 그대로 읽는 문구이므로 표현을 임의로 다듬지 않고, 지난 항목도 기록으로 남겨 둔다
// 2026-09-09 v2.37.0 의 봇 트래픽 집계 제외는 사용자에게 보일 변화가 없어(집계만 영향) 여기 적지 않는다
// 2026-09-12 v3.11.0 한 항목을 노드로 — `**굵게**` 를 실제 <b> 로 바꾼다.
// 지금까지 문자열을 그대로 붙여 화면에 별표가 그대로 찍히고 있었다. 강조하려고 적어 둔 표시가
// 오히려 문장을 지저분하게 만들고 있었던 셈이다. 문법은 하나뿐이라 파서도 한 줄이면 된다
function releaseItemNode(text) {
  return el('li', {}, ...String(text).split('**').map((part, index) => (index % 2 ? el('b', {}, part) : part)));
}

// 2026-09-12 v3.11.0 이 묶음을 어느 언어로 보여 줄까 — 영어판이 있으면 영어로, 없으면 한국어 그대로.
// 없는 날짜를 지어내지 않는다 (i18n-release-en.js 머리말)
function releaseItems(group) {
  const en = typeof LANG !== 'undefined' && LANG === 'en'
    && typeof RELEASE_NOTES_EN !== 'undefined' && RELEASE_NOTES_EN[releaseKey(group)];
  return en || group.items;
}

// 영문판을 찾는 열쇠. 대개 date 그대로지만, 버전 없이 날짜만 적힌 초기 묶음은 같은 날짜가 둘이라
// 그것만으로는 갈리지 않는다 — 같은 날짜의 두 번째부터 ' (2)' · ' (3)' 을 붙인다.
// 위에서부터 세므로 묶음을 새로 끼워 넣어도 옛 묶음의 열쇠는 안 흔들린다 (새 항목은 늘 맨 위다)
function releaseKey(group) {
  const same = RELEASE_NOTES.filter((other) => other.date === group.date);
  const index = same.indexOf(group);
  return index > 0 ? `${group.date} (${index + 1})` : group.date;
}

// 영어로 볼 때 아직 한국어로 남는 묶음이 하나라도 있는지 — 있으면 그 안내 한 줄을 띄운다
function releaseHasKoreanLeft() {
  if (typeof LANG === 'undefined' || LANG !== 'en') return false;
  return RELEASE_NOTES.some((group) => !(typeof RELEASE_NOTES_EN !== 'undefined' && RELEASE_NOTES_EN[releaseKey(group)]));
}

// 사용자가 마지막으로 읽은 패치노트 버전을 담아 두는 localStorage 키
const RELEASE_SEEN_KEY = 'pogo_release_seen';

// 현재 버전의 패치노트를 이미 읽었는지.
// 시크릿 모드·저장 차단 환경에서는 읽기 자체가 예외를 던지는데, 이때는 "이미 봤다"로 처리한다
// — 기록을 남길 수 없는 브라우저에서 빨간 점이 매번 다시 뜨는 것이 더 거슬리기 때문
function releaseSeen() {
  try {
    return localStorage.getItem(RELEASE_SEEN_KEY) === RELEASE_VER;
  } catch {
    return true;
  }
}

// 패치노트를 열었을 때 호출 — 현재 버전을 읽은 것으로 기록하고 뱃지를 즉시 지운다
function markReleaseSeen() {
  try {
    localStorage.setItem(RELEASE_SEEN_KEY, RELEASE_VER);
  } catch {
    /* 저장 불가 환경 */
  }
  updateReleaseBadge();
}

// 빨간 점(dot-badge)을 ☰ 버튼과 메뉴의 패치노트 항목 두 곳에 함께 붙이거나 뗀다.
// 메뉴를 열지 않아도 새 소식을 알 수 있어야 해서 헤더 버튼에도 같은 표시를 준다
function updateReleaseBadge() {
  const hasNew = !releaseSeen();
  for (const elementId of ['menu-toggle', 'menu-release']) {
    document.getElementById(elementId)?.classList.toggle('dot-badge', hasNew);
  }
}

// 첫 렌더 뒤 한 번 호출되는 진입점(초기화 순서를 다른 컴포넌트와 맞추기 위해 따로 둔다)
function initReleaseBadge() {
  updateReleaseBadge();
}
