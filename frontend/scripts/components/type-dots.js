// 속성 점 표시 (이름 옆 작은 원)
function typeDots(types) {
  return el('span', { class: 'types' }, ...types.map((t) => el('i', { style: `--c: var(--t-${t})`, title: TYPE_KO[t] })));
}
