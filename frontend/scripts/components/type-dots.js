// ─────────────────────────────────────────────────────────────────────────────
// components/type-dots.js — 속성(타입)을 작은 색 점으로 보여주는 조각
//
// 제공하는 전역
//   typeDots(types)   속성 점들을 담은 <span class="types">
//
// 의존하는 전역
//   el (dom.js) · TYPE_KO (빌드 주입 데이터 — 속성 영문 id → 한글 이름)
// ─────────────────────────────────────────────────────────────────────────────

// 속성 점 표시 (이름 옆 작은 원)
//   types    속성 영문 id 배열 (예: ['water', 'flying'])
//   반환값   점 하나당 <i>가 하나씩 들어간 <span>
// 점 색은 CSS 변수 --t-<속성>을 --c에 넘겨 스타일 쪽에서 칠하게 하고,
// 한글 속성명은 title로 달아 마우스를 올리면 보이게 한다
function typeDots(types) {
  return el('span', { class: 'types' }, ...types.map((typeName) => el('i', {
    style: `--c: var(--t-${typeName})`,
    title: TYPE_KO[typeName],
  })));
}
