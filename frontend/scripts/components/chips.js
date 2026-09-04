// ─────────────────────────────────────────────────────────────────────────────
// components/chips.js — 가로로 스크롤되는 필터 칩 줄
//
// 제공하는 전역
//   chips(items, current, onPick)   칩 줄 노드를 만든다 (속성·보스 필터에 쓴다)
//
// 의존하는 전역
//   el (dom.js)
// ─────────────────────────────────────────────────────────────────────────────

// 속성 필터 칩 목록. items: [{ id, label, color? }]
//   items    칩 정의 배열. color가 있으면 라벨 앞에 그 속성 색 점을 붙인다
//   current  지금 선택된 칩의 id
//   onPick   칩을 눌렀을 때 그 id로 부를 콜백 (보통 state를 고치고 render()를 부른다)
//   반환값   <div class="chips">
function chips(items, current, onPick) {
  const wrap = el('div', { class: 'chips' });
  // 아래에서 스크롤 위치를 맞추려면 "선택된 칩" 노드를 들고 있어야 한다
  let selected;
  for (const { id, label, color } of items) {
    // 선택 표시는 aria-pressed로 한다 (스타일과 스크린리더가 같은 값을 본다)
    const chip = el('button', { class: 'chip', 'aria-pressed': String(current === id), onclick: () => onPick(id) });
    if (color) chip.append(el('span', { class: 'dot', style: `--c: var(--t-${color})` }));
    chip.append(label);
    wrap.append(chip);
    if (current === id) selected = chip;
  }
  // 재렌더링 시 가로 스크롤이 처음으로 리셋되므로, 선택한 칩이 보이게 가운데로 되돌린다
  // (offsetLeft·clientWidth는 화면에 붙은 뒤에야 제 값이 나오므로 다음 프레임에 계산한다)
  if (selected) requestAnimationFrame(() => {
    wrap.scrollLeft = selected.offsetLeft - (wrap.clientWidth - selected.offsetWidth) / 2;
  });
  return wrap;
}
