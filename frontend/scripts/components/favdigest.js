// ─────────────────────────────────────────────────────────────────────────────
// components/favdigest.js — 로그인 전용: 내 즐겨찾기 순위 변동 요약 카드
//
// 새 데이터를 만들지 않고 기존 두 시스템을 엮는다.
//   즐겨찾기 AUTH.favs        : 도감번호(종) 단위 (components/auth.js)
//   순위 변동 rankDeltaBadge  : 스프라이트(폼) 단위, 빌드가 각 순위표 행에 심어 둔 d (components/changes.js)
// 이미 빌드된 순위표들(PVP_DATA·PVE_DATA·...)을 훑어 내 즐겨찾기 종이 최근
// (RANK_FRESH_DAYS 이내) 움직였으면 카드로 보여준다. 움직인 게 없으면 카드를 안 그린다
// — 항상 떠 있는 빈 카드는 "즐겨찾기 기능이 있다"는 신호가 아니라 그냥 소음이라고 판단.
//
// 제공하는 전역
//   renderFavDigest() : #fav-digest 컨테이너를 다시 그린다
//                        (로그인 상태가 바뀔 때, 즐겨찾기를 토글할 때 auth.js에서 호출)
//
// 의존하는 전역
//   AUTH · authEnabled() (auth.js) · dexOf() (detail.js) · rankDeltaBadge() (changes.js)
//   el() (dom.js) · sprite() (components/sprite.js) · openDetail() (components/detail.js)
//   PVP_DATA · PVE_DATA · PVE_EASY · DMAX_TIER · SHEET_DATA · VALUE_DATA (data.js)

// 모든 순위표를 훑어 dex → 가장 크게 움직인 행 하나로 정리한다.
// 같은 종(폼 여러 개)이 여러 표에 걸려도 종당 한 줄만 남긴다.
function favDigestRows() {
  const tables = [];
  const pushAll = (bySection) => { if (bySection) for (const rows of Object.values(bySection)) if (Array.isArray(rows)) tables.push(rows); };
  pushAll(typeof PVP_DATA !== 'undefined' ? PVP_DATA : null);
  pushAll(typeof PVE_DATA !== 'undefined' ? PVE_DATA : null);
  pushAll(typeof PVE_EASY !== 'undefined' ? PVE_EASY : null);
  pushAll(typeof DMAX_TIER !== 'undefined' ? DMAX_TIER : null);
  pushAll(typeof SHEET_DATA !== 'undefined' ? SHEET_DATA?.pve : null);
  if (typeof VALUE_DATA !== 'undefined' && Array.isArray(VALUE_DATA?.usage)) tables.push(VALUE_DATA.usage);

  const best = new Map();  // dex → row (그 종에서 가장 크게 움직인 행)
  for (const rows of tables) {
    for (const row of rows) {
      if (!row?.d || row.sprite == null) continue;
      const dex = dexOf(row.sprite);
      if (dex == null || !AUTH.favs.has(dex)) continue;
      const prev = best.get(dex);
      if (!prev || Math.abs(row.d) > Math.abs(prev.d)) best.set(dex, row);
    }
  }
  return [...best.values()].sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
}

function renderFavDigest() {
  const box = document.getElementById('fav-digest');
  if (!box) return;
  box.hidden = true;
  box.replaceChildren();
  if (!authEnabled() || AUTH.status !== 'ok' || !AUTH.favs.size) return;
  // rankDeltaBadge가 신선도(RANK_FRESH_DAYS)까지 판정하므로, 배지가 실제로 나오는 행만 남긴다
  const rows = favDigestRows()
    .map((row) => ({ row, badge: rankDeltaBadge(row.d) }))
    .filter((entry) => entry.badge)
    .slice(0, 5);
  if (!rows.length) return;
  box.hidden = false;
  box.append(
    el('p', { class: 'schedule-sec' }, '⭐ 내 즐겨찾기 순위 변동'),
    el('div', { class: 'boss-recs wrap-recs' }, ...rows.map(({ row, badge }) =>
      el('button', { class: 'boss-rec', onclick: () => openDetail(row) }, sprite(row.sprite), el('span', {}, row.name), badge))));
}
