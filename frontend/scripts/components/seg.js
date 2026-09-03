// 세그먼트 컨트롤. items: [{ id, label }]
function seg(items, current, onPick) {
  const wrap = el('div', { class: 'seg' });
  for (const { id, label } of items) {
    wrap.append(el('button', { 'aria-pressed': String(current === id), onclick: () => onPick(id) }, label));
  }
  return wrap;
}
