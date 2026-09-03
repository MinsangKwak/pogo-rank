// 랭킹 리스트: 기본 SHOW개 + 더보기/접기
function list(key, items, toRow) {
  const ul = el('ul', { class: 'rows' });
  const open = expanded.has(key);
  const shown = open ? items : items.slice(0, SHOW);
  shown.forEach((p, i) => ul.append(toRow(p, i)));
  if (items.length > SHOW) {
    ul.append(el('button', { class: 'more', onclick: () => { open ? expanded.delete(key) : expanded.add(key); render(); } },
      open ? '접기' : `더보기 · ${items.length - SHOW}개`));
  }
  return ul;
}
