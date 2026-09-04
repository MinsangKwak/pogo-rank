// ─────────────────────────────────────────────────────────────────────────────
// components/seg.js — 세그먼트 컨트롤 (붙어 있는 버튼 몇 개로 하나를 고르는 토글)
//
// 제공하는 전역
//   seg(items, current, onPick)   리그 토글·서브탭 토글 등에 쓰는 토글 줄
//
// 의존하는 전역
//   el (dom.js)
// ─────────────────────────────────────────────────────────────────────────────

// 세그먼트 컨트롤. items: [{ id, label }]
//   items    버튼 정의 배열. 배열 순서가 곧 화면에 보이는 순서다
//   current  지금 선택된 버튼의 id
//   onPick   버튼을 눌렀을 때 그 id로 부를 콜백 (보통 state를 고치고 render()를 부른다)
//   반환값   <div class="seg">
function seg(items, current, onPick) {
  const wrap = el('div', { class: 'seg' });
  for (const { id, label } of items) {
    // 선택 표시는 클래스가 아니라 aria-pressed다 — 스타일도 이 속성을 보고 칠한다
    wrap.append(el('button', { 'aria-pressed': String(current === id), onclick: () => onPick(id) }, label));
  }
  return wrap;
}
