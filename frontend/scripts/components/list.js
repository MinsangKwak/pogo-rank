// ─────────────────────────────────────────────────────────────────────────────
// components/list.js — 더보기/접기가 달린 목록(<ul class="rows">)
//
// 제공하는 전역
//   list(key, items, toRow)   목록 노드를 만든다. 모든 랭킹 목록이 이걸 쓴다
//
// 의존하는 전역
//   el (dom.js) · SHOW (data.js) · expanded · render (app.js)
// ─────────────────────────────────────────────────────────────────────────────

// 랭킹 리스트: 기본 SHOW개 + 더보기/접기
//   key      펼침 상태를 기억할 고유 키. render()가 화면을 매번 새로 그리기 때문에
//            "펼쳤다"는 사실은 DOM이 아니라 전역 expanded에 이 키로 남는다.
//            그래서 목록마다 서로 겹치지 않는 키를 넘겨야 한다 (예: `pvp-${리그}-${속성}`)
//   items    목록에 넣을 항목 배열
//   toRow    항목 하나를 <li>로 바꾸는 함수. (항목, 인덱스)를 받는다
//   반환값   <ul class="rows">. 항목이 SHOW개를 넘으면 마지막에 더보기/접기 버튼이 붙는다
function list(key, items, toRow) {
  const listNode = el('ul', { class: 'rows' });
  const isExpanded = expanded.has(key);
  const visibleItems = isExpanded ? items : items.slice(0, SHOW);
  visibleItems.forEach((item, index) => listNode.append(toRow(item, index)));
  if (items.length > SHOW) {
    // 버튼은 펼침 여부를 뒤집고 render()를 부른다 — 목록만 손보는 게 아니라 화면 전체가 다시 그려진다
    listNode.append(el('button', {
      class: 'more',
      onclick: () => {
        isExpanded ? expanded.delete(key) : expanded.add(key);
        render();
      },
    }, isExpanded ? '접기' : `더보기 · ${items.length - SHOW}개`));
  }
  return listNode;
}
