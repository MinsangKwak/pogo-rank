// ─────────────────────────────────────────────────────────────────────────────
// dom.js — DOM 요소 생성 헬퍼
//
// 제공하는 전역
//   el(tag, attrs, ...children)   프론트의 모든 화면은 이 함수 하나로 그려진다
//
// 의존하는 전역
//   없음 (document 말고는 아무것도 쓰지 않는다 — 그래서 build.py의 SCRIPTS에서 앞줄에 놓인다)
// ─────────────────────────────────────────────────────────────────────────────

// DOM 생성 헬퍼: el('div', { class: 'x', onclick: fn }, ...children)
//   tag       만들 태그 이름 ('div' · 'button' · 'img' …)
//   attrs     속성 맵. 키 모양에 따라 처리 방식이 갈린다
//             (class → className, style → cssText, on* → addEventListener, 나머지 → setAttribute)
//   children  자식 노드 또는 문자열. append가 문자열을 텍스트 노드로 바꿔주므로 섞어서 넘겨도 된다
//   반환값    속성과 자식이 모두 붙은 DOM 요소
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    // class·style은 속성이 아니라 프로퍼티에 통째로 대입한다 (문자열 하나로 덮어쓰는 방식)
    if (key === 'class') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    // 'onclick' → 'click'. 인라인 onclick 속성이 아니라 addEventListener라서
    // 같은 이벤트에 핸들러를 여러 번 달아도 서로 덮어쓰지 않는다
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    // aria-*·role·data-* 같은 나머지 속성은 이름 그대로 붙인다
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}
