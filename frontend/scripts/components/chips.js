// 속성 필터 칩 목록. items: [{ id, label, color? }]
function chips(items, current, onPick) {
  const wrap = el('div', { class: 'chips' });
  let selected;
  for (const { id, label, color } of items) {
    const chip = el('button', { class: 'chip', 'aria-pressed': String(current === id), onclick: () => onPick(id) });
    if (color) chip.append(el('span', { class: 'dot', style: `--c: var(--t-${color})` }));
    chip.append(label);
    wrap.append(chip);
    if (current === id) selected = chip;
  }
  // 재렌더링 시 가로 스크롤이 처음으로 리셋되므로, 선택한 칩이 보이게 가운데로 되돌린다
  if (selected) requestAnimationFrame(() => {
    wrap.scrollLeft = selected.offsetLeft - (wrap.clientWidth - selected.offsetWidth) / 2;
  });
  return wrap;
}
