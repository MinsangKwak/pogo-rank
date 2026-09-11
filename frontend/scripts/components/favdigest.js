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
//   renderFavDigest() : 헤더 ★ 버튼을 상태에 맞춘다 (로그인·즐겨찾기가 바뀔 때 auth.js 가 호출)
//   openFavDigest()   : 즐겨찾기 목록을 팝업으로 연다
//   2026-09-12 v2.64.0 화면 맨 위 카드 → 헤더 버튼 + 팝업 (자리를 먹지 않게)
//
// 의존하는 전역
//   AUTH · authEnabled() (auth.js) · dexOf() · openDetailByDex() (detail.js) · rankDeltaBadge() (changes.js)
//   el() (dom.js) · sprite() (components/sprite.js) · DEX_DATA (data.js)
//   openModal · closeModal (components/modal.js) · navigateHash · routeHash (router.js) · track (track.js)
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

// 2026-09-12 v2.64.0 화면 맨 위 카드 → 헤더 ★ 버튼 + 팝업.
// 카드는 접어 둬도 한 뼘을 먹었고, 배틀 PvP 처럼 컨트롤이 많은 화면에서는 리그 세그먼트가
// 화면 밖으로 밀렸다. 즐겨찾기는 **어느 화면에서나** 보고 싶은 것이라 화면 안 자리가 아니라
// 헤더에 두는 것이 맞다 — 검색(🔍)과 같은 문법이다.
//   버튼은 로그인 + 즐겨찾기가 하나라도 있을 때만 보인다 (빈 팝업을 여는 버튼은 두지 않는다)

// 즐겨찾기 목록 한 벌 — 이름 가나다순 + 최근 움직인 종의 ▲▼ 뱃지
function favDigestRows() {
  const deltaByDex = favDigestDeltaByDex();
  return [...AUTH.favs]
    .map((dex) => ({ dex, name: DEX_DATA.names?.[dex] ?? String(dex), badge: deltaByDex.has(dex) ? rankDeltaBadge(deltaByDex.get(dex)) : '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

// 팝업 본문. 더보기를 누르면 이 함수가 다시 그린다
function favDigestBody() {
  const rows = favDigestRows();
  const movedCount = rows.filter((row) => row.badge).length;
  const shown = rows.slice(0, favDigestShowCount);
  const body = el('div', { class: 'fav-pop' },
    el('div', { class: 'fav-pop__head' },
      el('h2', { class: 'detail__name' }, `★ 내 즐겨찾기 ${rows.length}마리`),
      movedCount ? el('span', { class: 'meta' }, `최근 순위가 움직인 포켓몬 ${movedCount}마리 ▲▼`) : ''),
    el('div', { class: 'boss__recs recs-wrap fav-pop__list' }, ...shown.map(({ dex, name, badge }) =>
      // 상세를 열기 전에 팝업을 닫는다 — 팝업 위에 팝업이 쌓이면 뒤로가기가 두 번 필요해진다
      el('button', { class: 'boss__rec', onclick: () => { closeModal({ silent: true }); openDetailByDex(dex, false); } },
        sprite(dex), el('span', {}, name), badge))),
    el('div', { class: 'boss__foot' },
      rows.length > shown.length
        ? el('button', { class: 'boss__more', onclick: () => {
            favDigestShowCount += 12;
            document.querySelector('.fav-pop')?.replaceWith(favDigestBody());
          } }, `더보기 +${Math.min(12, rows.length - shown.length)} (${shown.length}/${rows.length})`)
        : el('span', { class: 'meta' }, `전체 ${rows.length}마리 표시됨`),
      el('button', { class: 'boss__more', onclick: () => { closeModal({ silent: true }); navigateHash(routeHash('favs')); } },
        'PvE · PvP 갈래로 보기 ▸')));
  return body;
}

function openFavDigest() {
  if (!authEnabled() || AUTH.status !== 'ok' || !AUTH.favs.size) return;
  favDigestShowCount = 12;   // 팝업을 열 때마다 처음부터 — 지난번에 펼친 만큼을 기억할 값이 아니다
  track('fav_digest_open', { n: AUTH.favs.size });
  openModal(favDigestBody());
}

// 헤더 ★ 버튼을 상태에 맞춘다 (로그인·즐겨찾기가 바뀔 때 auth.js 가 부른다)
function renderFavDigest() {
  const button = document.getElementById('fav-toggle');
  if (!button) return;
  const show = authEnabled() && AUTH.status === 'ok' && AUTH.favs.size > 0;
  button.hidden = !show;
  if (!show) return;
  button.setAttribute('aria-label', `내 즐겨찾기 ${AUTH.favs.size}마리`);
  if (!button.dataset.ready) {
    button.addEventListener('click', openFavDigest);
    button.dataset.ready = '1';
  }
}
