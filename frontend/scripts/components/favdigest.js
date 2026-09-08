// ─────────────────────────────────────────────────────────────────────────────
// components/favdigest.js — 로그인 전용: 내 즐겨찾기 목록 카드
//
// 2026-09-05 v1은 "순위가 움직인 즐겨찾기만" 보여줬는데, 실제로 써보니 평소엔 카드가
// 아예 안 뜨니까 "즐겨찾기 9마리"라고 적힌 걸 봐도 그 9마리가 뭔지 확인할 방법이 없었다
// (드로어의 "★ 즐겨찾기 N마리" 문구는 개수만 말할 뿐 목록이 아님). 그래서 v2는 로그인 +
// 즐겨찾기가 하나라도 있으면 항상 전체 목록을 보여주고, 최근(RANK_FRESH_DAYS 이내) 순위가
// 움직인 종에만 ▲▼ 뱃지를 덧붙이는 방식으로 바꿨다 — "목록 확인"이 기본, "변동 알림"은 덤.
//
// 이름·스프라이트는 종(도감번호) 자체가 곧 기본 폼 스프라이트 id이므로 순위표를 뒤질 필요
// 없이 DEX_DATA에서 바로 가져온다(랭킹에 없는 종도 항상 목록에 뜬다). 순위 변동 뱃지만
// 기존 시스템(스프라이트=폼 단위)을 그대로 재사용한다.
//
// 제공하는 전역
//   renderFavDigest() : #fav-digest 아코디언(<details>)의 제목·본문을 다시 그린다
//                        (로그인 상태가 바뀔 때, 즐겨찾기를 토글할 때 auth.js에서 호출)
//   2026-09-07 v2.14.0 (QA-52) 카드 → 접었다 펼 수 있는 아코디언. 펼침 여부는 localStorage(pogo_fav_acc)에 기억
//
// 의존하는 전역
//   AUTH · authEnabled() (auth.js) · dexOf() · openDetailByDex() (detail.js) · rankDeltaBadge() (changes.js)
//   el() (dom.js) · sprite() (components/sprite.js) · DEX_DATA (data.js)
//   PVP_DATA · PVE_DATA · PVE_EASY · DMAX_TIER · SHEET_DATA · VALUE_DATA (data.js, 뱃지 계산용)

// 한 번에 보여줄 즐겨찾기 개수. 그 이상은 "더보기"로 늘린다 (state는 모듈 스코프에 둔다 —
// 여러 탭처럼 인스턴스가 여럿일 필요가 없는 화면이라 굳이 el에 안 묶는다)
let favDigestShowCount = 12;

// 모든 순위표를 훑어 dex → 가장 크게 움직인 행 하나로 정리한다 (뱃지용 보조 정보).
// 같은 종의 폼 여러 개가 여러 표에 걸려도 종당 한 줄만 남긴다.
function favDigestDeltaByDex() {
  const tables = [];
  const pushAll = (bySection) => { if (bySection) for (const rows of Object.values(bySection)) if (Array.isArray(rows)) tables.push(rows); };
  pushAll(typeof PVP_DATA !== 'undefined' ? PVP_DATA : null);
  pushAll(typeof PVE_DATA !== 'undefined' ? PVE_DATA : null);
  pushAll(typeof PVE_EASY !== 'undefined' ? PVE_EASY : null);
  pushAll(typeof DMAX_TIER !== 'undefined' ? DMAX_TIER : null);
  pushAll(typeof SHEET_DATA !== 'undefined' ? SHEET_DATA?.pve : null);
  if (typeof VALUE_DATA !== 'undefined' && Array.isArray(VALUE_DATA?.usage)) tables.push(VALUE_DATA.usage);

  const best = new Map();  // dex → d (그 종에서 가장 크게 움직인 값)
  for (const rows of tables) {
    for (const row of rows) {
      if (!row?.d || row.sprite == null) continue;
      const dex = dexOf(row.sprite);
      if (dex == null || !AUTH.favs.has(dex)) continue;
      if (!best.has(dex) || Math.abs(row.d) > Math.abs(best.get(dex))) best.set(dex, row.d);
    }
  }
  return best;
}

// 2026-09-07 v2.14.0 (QA-52) 아코디언 펼침 여부 — 기본은 펼침, 접으면 다음에도 접힌 채로 (localStorage)
const FAV_ACC_KEY = 'pogo_fav_acc';
function favDigestOpen() {
  try { return localStorage.getItem(FAV_ACC_KEY) !== '0'; } catch { return true; }
}
function saveFavDigestOpen(isOpen) {
  try { localStorage.setItem(FAV_ACC_KEY, isOpen ? '1' : '0'); } catch {}
}

function renderFavDigest() {
  const box = document.getElementById('fav-digest');
  const titleEl = document.getElementById('fav-digest-title');
  const bodyEl = document.getElementById('fav-digest-body');
  if (!box || !titleEl || !bodyEl) return;
  box.hidden = true;
  titleEl.replaceChildren();
  bodyEl.replaceChildren();
  if (!authEnabled() || AUTH.status !== 'ok' || !AUTH.favs.size) return;

  const deltaByDex = favDigestDeltaByDex();
  const rows = [...AUTH.favs]
    .map((dex) => ({ dex, name: DEX_DATA.names?.[dex] ?? String(dex), badge: deltaByDex.has(dex) ? rankDeltaBadge(deltaByDex.get(dex)) : '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const movedCount = rows.filter((row) => row.badge).length;

  box.hidden = false;
  // 2026-09-07 v2.14.0 (QA-52) <details> 아코디언 — 제목 줄(summary)을 누르면 접히고 펼쳐진다. 펼침 여부는 기억.
  // 전용 페이지(#/favs) 링크는 summary 안에 두되 클릭이 접기/펼치기로 번지지 않게 막는다
  if (!box.dataset.accReady) {
    box.open = favDigestOpen();
    box.addEventListener('toggle', () => saveFavDigestOpen(box.open));
    box.dataset.accReady = '1';
  }
  titleEl.append(
    el('span', {}, `★ 내 즐겨찾기 (${rows.length})`),
    el('span', { class: 'schedule__today' }, movedCount ? `최근 순위가 움직인 포켓몬 ${movedCount}마리 ▲▼` : '누르면 접거나 펼칩니다'));
  const shown = rows.slice(0, favDigestShowCount);
  bodyEl.append(
    el('div', { class: 'boss__recs recs-wrap' }, ...shown.map(({ dex, name, badge }) =>
      el('button', { class: 'boss__rec', onclick: () => openDetailByDex(dex, false) }, sprite(dex), el('span', {}, name), badge))),
    // 2026-09-07 v2.15.1 "PvE · PvP 나눠 보기" 링크 제거 — 바로 아래 탭 줄의 ★ 와 같은 화면(#/favs). 카드는 요약과 더보기만
    el('div', { class: 'boss__foot' },
      rows.length > shown.length
        ? el('button', { class: 'boss__more', onclick: () => { favDigestShowCount += 12; renderFavDigest(); } }, `더보기 +${Math.min(12, rows.length - shown.length)} (${shown.length}/${rows.length})`)
        : el('span', { class: 'meta' }, `전체 ${rows.length}마리 표시됨`),
      el('span', { class: 'meta' }, 'PvE · PvP 갈래는 탭 줄 ★ 에서')));
}
