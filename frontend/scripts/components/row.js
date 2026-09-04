// ─────────────────────────────────────────────────────────────────────────────
// components/row.js — 목록 한 줄(<li class="row">)을 만드는 공통 조각
//
// 제공하는 전역
//   row(pokemon, rankText, scoreNode, subNode, lineParts, tagNode)
//     PvP·PvE·D-MAX·활용처 등 거의 모든 목록이 이 한 함수로 줄을 만든다
//
// 의존하는 전역
//   el (dom.js) · typeDots (components/type-dots.js) · sprite (components/sprite.js)
//   openDetail (components/detail.js — 줄을 누르면 열리는 상세 팝업)
// ─────────────────────────────────────────────────────────────────────────────

// 공통 행: rank·sprite·이름·보조줄·점수 (lineParts는 보조줄 문자열 배열, tagNode는 이름 위 뱃지)
//   pokemon    한 줄에 담을 포켓몬. name·en·types·sprite를 쓰고, 기술은 fast·charged를 기본값으로 쓴다
//   rankText   왼쪽 순위 칸에 그대로 넣는 문자열 ('1' · 'S' 등 뷰마다 다르다)
//   scoreNode  오른쪽 점수 칸에 넣을 노드
//   subNode    점수 아래 보조 표시 (없으면 생략)
//   lineParts  이름 아래 보조줄. 문자열 배열이면 각 조각을 <span>으로 감싸고,
//              이미 만들어 둔 노드를 넘기면 그 노드를 그대로 쓴다. 생략하면 기술 두 개를 쓴다
//   tagNode    이름 위에 붙는 뱃지 노드 (없으면 생략)
//   반환값     누르면 상세 팝업이 열리는 <li class="row">
//
// 2026-09-04 변동 ▲▼ · 기술 변경 예고 뱃지는 뷰가 넘기지 않아도 여기서 자동으로 붙인다.
//   - 변동 폭은 빌드가 행에 심어 둔 pokemon.d (backend/rank_diff.py)
//   - 기술 변경 여부는 스프라이트 id 로 조회 (components/changes.js)
//   모든 순위표가 이 함수를 거치므로, 뷰를 하나도 고치지 않고 전 표에 같은 표시가 붙는다.
function row(pokemon, rankText, scoreNode, subNode, lineParts, tagNode) {
  const stats = el('div', { class: 'stats' }, scoreNode);
  if (subNode) stats.append(subNode);
  // 영문 이름은 title로만 달아 둔다 (좁은 화면에서 줄이 길어지지 않게)
  const name = el('div', { class: 'name' }, el('b', { title: pokemon.en }, pokemon.name), typeDots(pokemon.types));
  // 뷰가 직접 만든 노드를 넘겼는지, 문자열 조각들을 넘겼는지에 따라 갈린다.
  // 문자열일 때는 빈 값(기술이 없는 종 등)을 걸러낸 뒤 <span>으로 감싼다
  const line = lineParts instanceof Node ? lineParts
    : el('div', { class: 'moves' }, ...(lineParts ?? [pokemon.fast, pokemon.charged])
      .filter(Boolean)
      .map((text) => el('span', {}, text)));
  const main = el('div', { class: 'main' });
  // 뱃지는 이름보다 위에 와야 하므로 name·line보다 먼저 붙인다.
  // 뷰가 넘긴 뱃지(tagNode)와 기술 변경 예고 뱃지를 한 줄에 모은다 — 둘 다 없으면 줄 자체를 만들지 않는다
  const moveBadge = changeBadge(pokemon.sprite);
  if (tagNode || moveBadge) main.append(el('div', { class: 'badges' }, tagNode ?? '', moveBadge));
  main.append(name, line);
  // 줄 전체가 상세 팝업 버튼이다 (안쪽에 따로 버튼을 두지 않아 클릭 영역이 넓다)
  return el('li', { class: 'row', onclick: () => openDetail(pokemon) },
    // 순위 칸: 숫자 아래에 최근 변동 ▲▼ (변동이 없거나 오래됐으면 아무것도 안 붙는다)
    el('span', { class: 'rank' }, rankText, rankDeltaBadge(pokemon.d)),
    sprite(pokemon.sprite),
    main,
    stats,
  );  // 2026-09-03 v2.2.0 보유 ☆ 제거 — 즐겨찾기는 로그인 후 도감·상세 팝업에서
}
