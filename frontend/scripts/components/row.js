// 공통 행: rank·sprite·이름·보조줄·점수 (lineParts는 보조줄 문자열 배열, tagNode는 이름 위 뱃지)
function row(p, rankText, scoreNode, subNode, lineParts, tagNode) {
  const stats = el('div', { class: 'stats' }, scoreNode);
  if (subNode) stats.append(subNode);
  const name = el('div', { class: 'name' }, el('b', { title: p.en }, p.name), typeDots(p.types));
  const line = lineParts instanceof Node ? lineParts
    : el('div', { class: 'moves' }, ...(lineParts ?? [p.fast, p.charged]).filter(Boolean).map((s) => el('span', {}, s)));
  const main = el('div', { class: 'main' });
  if (tagNode) main.append(el('div', { class: 'badges' }, tagNode));
  main.append(name, line);
  return el('li', { class: 'row', onclick: () => openDetail(p) },
    el('span', { class: 'rank' }, rankText),
    sprite(p.sprite),
    main,
    stats,
  );  // 2026-09-03 v2.2.0 보유 ☆ 제거 — 즐겨찾기는 로그인 후 도감·상세 팝업에서
}
