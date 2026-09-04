// ─────────────────────────────────────────────────────────────────────────────
// components/changes.js — 시즌 기술 변경 안내 + 순위 변동(▲▼) 표시
//
// 이 파일이 다루는 두 가지는 성격이 다르다
//   1) 기술 변경 예고  : 아직 게임에 적용되지 않은 변경을 미리 알린다.
//                       계산으로 알 수 없으므로 사람이 적은 목록(backend/config/move_changes.txt)을 그대로 보여 준다.
//                       적용일이 지나면 "예고"의 의미가 없어지므로 뱃지는 저절로 사라진다.
//   2) 순위 변동 ▲▼   : 이미 적용된 변경의 결과다.
//                       빌드가 직전 순위와 비교해 심어 둔 값(행의 d)을 그대로 그린다. 예측이 아니라 사실이다.
// 그래서 "상향 예정" 같은 예측 표시는 만들지 않는다 — 적용 전에는 사실(기술 위력 변경)만,
// 적용 후에는 실제 변동만 보여 준다.
//
// 제공하는 전역
//   moveChangeData()          : 변경 데이터(없으면 null)
//   moveChangeDaysLeft()      : 적용일까지 남은 일수 (지났으면 음수, 데이터 없으면 null)
//   moveChangeUpcoming()      : 아직 적용 전인가
//   moveChangeFor(spriteId)   : 그 포켓몬에 걸린 변경 요약 (없으면 null)
//   changeBadge(spriteId)     : 목록 줄에 붙일 "기술 변경 예고" 뱃지 (없으면 빈 문자열)
//   rankDeltaBadge(delta)     : 목록 줄에 붙일 ▲▼ 변동 뱃지 (없거나 오래됐으면 빈 문자열)
//   renderMoveChangesPage()   : ⚔️ 기술 변경 전체 페이지
//   initMoveChangesMenu()     : 변경 데이터가 있을 때만 메뉴 항목을 보이게 한다
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · openDetail (components/detail.js) · track (track.js)
//   MOVE_CHANGES · RANK_DELTA_DATE · RANK_FRESH_DAYS (data.js, 빌드가 주입)
// ─────────────────────────────────────────────────────────────────────────────

// 변경 데이터. 시즌 사이에는 backend/config/move_changes.txt 를 지워 두면 빈 객체가 들어와
// 아래 함수들이 전부 "없음"으로 동작하고 화면에서도 흔적 없이 사라진다.
function moveChangeData() {
  if (typeof MOVE_CHANGES === 'undefined' || !MOVE_CHANGES?.date) return null;
  return MOVE_CHANGES;
}

// 오늘 0시 기준으로 두 날짜의 간격을 일 단위로 센다.
// 시각까지 비교하면 "오늘 적용"인 날에 남은 일수가 0.4일처럼 나와 판정이 흔들리므로 날짜만 쓴다.
function daysBetweenDates(fromDate, toDate) {
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfDay(toDate) - startOfDay(fromDate)) / 86400000);
}

// 적용일까지 남은 일수. 0이면 오늘 적용, 음수면 이미 지난 것
function moveChangeDaysLeft() {
  const data = moveChangeData();
  if (!data) return null;
  // 'YYYY-MM-DD' 를 로컬 시간대의 날짜로 읽는다 (new Date('2026-09-08')은 UTC로 해석돼 하루 밀릴 수 있다)
  const [year, month, day] = data.date.split('-').map(Number);
  return daysBetweenDates(new Date(), new Date(year, month - 1, day));
}

function moveChangeUpcoming() {
  const daysLeft = moveChangeDaysLeft();
  return daysLeft != null && daysLeft > 0;
}

// 이 포켓몬에 걸린 변경. { up: [기술명], down: [], energy: [], new: [], legacy: [] }
function moveChangeFor(spriteId) {
  const data = moveChangeData();
  return data?.affected?.[String(spriteId)] ?? null;
}

// 목록 줄의 "기술 변경 예고" 뱃지.
// 적용 전에만 붙인다 — 적용된 뒤에는 아래 rankDeltaBadge 가 실제 결과를 보여 주기 때문이다.
// 화살표는 방향을 요약할 뿐이고, 정확히 무슨 기술이 어떻게 바뀌는지는 title 과 상세 페이지에 있다.
function changeBadge(spriteId) {
  if (!moveChangeUpcoming()) return '';
  const change = moveChangeFor(spriteId);
  if (!change) return '';
  const hasUp = (change.up?.length ?? 0) + (change.new?.length ?? 0) > 0;
  const hasDown = (change.down?.length ?? 0) > 0;
  // 위력이 오른 기술과 내린 기술이 함께 걸리면 방향을 단정하지 않는다
  const arrow = hasUp && hasDown ? '↕' : hasUp ? '↑' : hasDown ? '↓' : '';
  const climate = hasUp && hasDown ? 'mix' : hasUp ? 'up' : hasDown ? 'down' : 'flat';
  // 위력은 그대로고 에너지만 바뀐 경우는 화살표로 방향을 말할 수 없으므로 문구를 따로 쓴다
  const what = arrow ? `기술${arrow}` : '에너지';
  const data = moveChangeData();
  const [, month, day] = data.date.split('-');
  // 마우스를 올리거나 길게 누르면 무엇이 바뀌는지 그대로 보이게 한다
  const detail = [
    change.up?.length ? `위력↑ ${change.up.join(' · ')}` : '',
    change.down?.length ? `위력↓ ${change.down.join(' · ')}` : '',
    change.energy?.length ? `에너지 ${change.energy.join(' · ')}` : '',
    change.new?.length ? `신규 ${change.new.join(' · ')}` : '',
  ].filter(Boolean).join('\n');
  return el('span', { class: `tag chg ${climate}`, title: detail }, `${Number(month)}/${Number(day)} ${what}`);
}

// 순위 변동 ▲▼. 값은 빌드가 행에 심어 둔 d (양수 = 상승).
// 기록한 지 RANK_FRESH_DAYS 가 지난 변동은 그리지 않는다 — 오래 붙어 있으면 "최근 변동"이라는 뜻이 흐려진다.
function rankDeltaBadge(delta) {
  if (!delta) return '';
  if (typeof RANK_DELTA_DATE === 'undefined' || !RANK_DELTA_DATE) return '';
  const [year, month, day] = RANK_DELTA_DATE.split('-').map(Number);
  const daysSince = -daysBetweenDates(new Date(), new Date(year, month - 1, day));
  const freshDays = typeof RANK_FRESH_DAYS === 'undefined' ? 14 : RANK_FRESH_DAYS;
  if (daysSince < 0 || daysSince > freshDays) return '';
  const isUp = delta > 0;
  return el('span', {
    class: `rank-delta ${isUp ? 'up' : 'down'}`,
    title: `${RANK_DELTA_DATE} 갱신에서 ${Math.abs(delta)}계단 ${isUp ? '상승' : '하락'}`,
  }, `${isUp ? '▲' : '▼'}${Math.abs(delta)}`);
}

// 변경 데이터가 있을 때만 메뉴에 항목을 띄운다 (index.html 에서는 hidden 으로 두고 여기서 연다)
function initMoveChangesMenu() {
  const data = moveChangeData();
  const $item = document.getElementById('menu-changes');
  if (!$item) return;
  if (!data) {
    $item.hidden = true;
    return;
  }
  const daysLeft = moveChangeDaysLeft();
  const [, month, day] = data.date.split('-');
  $item.hidden = false;
  $item.textContent = daysLeft > 0
    ? `⚔️ 기술 변경 예고 (${Number(month)}/${Number(day)} · D-${daysLeft})`
    : `⚔️ ${Number(month)}/${Number(day)} 기술 변경`;
}

// 변경 기술 한 줄: "아이언헤드  위력 70 → 85"
function moveChangeRow(move) {
  const arrow = move.kind === 'up' ? '▲' : move.kind === 'down' ? '▼' : '·';
  const amount = move.kind === 'energy'
    ? '에너지만 변경'
    : `위력 ${move.from} → ${move.to}`;
  return el('li', { class: `chg-row ${move.kind}` },
    el('span', { class: 'chg-mark' }, arrow),
    el('div', {},
      el('b', {}, move.ko),
      el('div', { class: 'chg-sub' }, amount, move.note ? el('em', {}, ` · ${move.note}`) : '')));
}

// ⚔️ 기술 변경 페이지: 위력이 오른 기술 → 내린 기술 → 에너지만 → 새로 배우는 기술
function renderMoveChangesPage() {
  const data = moveChangeData();
  if (!data) return el('p', { class: 'page-body' }, '지금은 예정된 기술 변경이 없습니다.');
  const daysLeft = moveChangeDaysLeft();
  const upMoves = data.moves.filter((move) => move.kind === 'up');
  const downMoves = data.moves.filter((move) => move.kind === 'down');
  const energyMoves = data.moves.filter((move) => move.kind === 'energy');
  const section = (title, note, node) => el('section', { class: 'chg-sec' },
    el('h3', {}, title), note ? el('p', { class: 'd-foot' }, note) : '', node);
  return el('div', { class: 'page-body' },
    el('div', { class: `chg-head ${daysLeft > 0 ? 'soon' : 'done'}` },
      el('b', {}, data.season),
      el('span', {}, daysLeft > 0 ? `${data.date} 적용 · D-${daysLeft}` : `${data.date} 적용됨`)),
    el('p', { class: 'd-foot' },
      daysLeft > 0
        ? '적용 전이라 순위표에는 아직 반영돼 있지 않습니다. 적용 다음 날 자동 갱신되면 순위가 움직인 포켓몬에 ▲▼ 표시가 붙습니다.'
        : '순위표는 이미 이 값으로 계산돼 있습니다. 최근 움직인 포켓몬에는 ▲▼ 표시가 붙어 있어요.'),
    upMoves.length ? section('위력이 오른 기술', '', el('ul', { class: 'chg-list' }, ...upMoves.map(moveChangeRow))) : '',
    downMoves.length ? section('위력이 내린 기술', '', el('ul', { class: 'chg-list' }, ...downMoves.map(moveChangeRow))) : '',
    energyMoves.length ? section('에너지만 바뀐 기술', '위력은 그대로라 레이드 DPS는 거의 그대로지만, PvP에서는 기술을 쓰는 빈도가 달라집니다.', el('ul', { class: 'chg-list' }, ...energyMoves.map(moveChangeRow))) : '',
    data.newMoves.length
      ? section(`새로 배우는 기술 · ${data.newMoves.length}건`, '누르면 그 포켓몬의 상세 정보가 열립니다.',
          el('ul', { class: 'chg-new' }, ...data.newMoves.map((item) => el('li', {
            onclick: () => openDetail({ sprite: item.sprite, name: item.name, en: '', types: DEX_DATA.forms[item.sprite]?.types ?? [] }),
          }, sprite(item.sprite), el('div', {}, el('b', {}, item.name), el('div', { class: 'chg-sub' }, item.move))))))
      : '',
    el('p', { class: 'd-foot' }, '출처: 포켓몬 GO 공식 GO 배틀리그 시즌 공지. 위력·에너지 값은 공지 표기를 그대로 옮겼고, 한글 기술명은 게임 내 표기로 자동 변환했습니다.'));
}
