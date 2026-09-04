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
  // 뱃지는 이름보다 위에 와야 하므로 name·line보다 먼저 붙인다
  if (tagNode) main.append(el('div', { class: 'badges' }, tagNode));
  main.append(name, line);
  // 줄 전체가 상세 팝업 버튼이다 (안쪽에 따로 버튼을 두지 않아 클릭 영역이 넓다)
  return el('li', { class: 'row', onclick: () => openDetail(pokemon) },
    el('span', { class: 'rank' }, rankText),
    sprite(pokemon.sprite),
    main,
    stats,
  );  // 2026-09-03 v2.2.0 보유 ☆ 제거 — 즐겨찾기는 로그인 후 도감·상세 팝업에서
}
