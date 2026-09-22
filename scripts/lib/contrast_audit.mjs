'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// lib/contrast_audit.mjs — **안 보이는 글자를 재는 자.** 배포 전 42장과 스토리북이 같이 쓴다.
//
// 왜 떼어 냈나 — 잣대가 두 벌이면 한쪽만 따라온다. 스토리북에도 같은 검문을 붙이면서
// 이 함수를 베끼면, 다음에 예외 하나를 더할 때 한쪽에만 들어간다.
// 재는 일은 브라우저 안에서 한다 (색 합성·투명도·겹침은 거기서만 정확하다).
//
// 기준 3.0 의 뜻은 CLAUDE.md §1-b 에 적혀 있다 — "읽기 불편함" 이 아니라 **"아예 안 보임"**.
// ─────────────────────────────────────────────────────────────────────────────

/** 배포를 세워야 할 사고만 건지는 선. WCAG 4.5 가 아닌 이유는 §1-b 참고 */
export const MIN = 3.0;

/** page.evaluate(AUDIT, MIN) 로 넘긴다 — 함수가 브라우저 안에서 돈다 */
export const AUDIT = (min) => {
  const lum = (rgb) => {
    const c = rgb.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  // 브라우저는 color-mix() 를 `color(srgb .94 .86 .83)` 로 돌려준다 — 0~1 이라 255 로 펴야 한다.
  // 이걸 rgb() 처럼 읽으면 어떤 색이든 거의 검정이 되어, 멀쩡한 글자가 전부 걸린다(실제로 그랬다).
  const parse = (value) => {
    const m = value.match(/[\d.]+/g);
    if (!m) return null;
    const unit = value.startsWith('color(') ? 255 : 1;
    return { rgb: [+m[0] * unit, +m[1] * unit, +m[2] * unit], a: m[3] === undefined ? 1 : +m[3] };
  };
  // 뒤에 깔린 바탕을 조상까지 거슬러 찾는다 — 투명한 부모는 제 부모의 색을 보여 준다
  const backdrop = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage !== 'none') return null;   // 그림이 깔리면 잴 수 없다 — 건너뛴다
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0.85) return bg.rgb;
    }
    // 끝까지 투명하면 body 의 바탕이 보이는 것이다 — 흰색이라고 치면 다크에서 전부 오검출된다
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body && body.a > 0.85 ? body.rgb : [255, 255, 255];
  };
  // **게임 원작 타입색(--t-*)이 원인이면 예외다.** CLAUDE.md §1-b 에 "바꾸지 않는다" 고 적어 둔 값이라
  // 고칠 수가 없는데, 그냥 두면 검문이 매번 빨개져서 아무도 안 보게 된다 — 울다 지친 경보는 경보가 아니다.
  // 색 값으로 대조하므로 구멍이 아니다: 타입색이 아닌 이유로 흐려지면 그대로 걸린다.
  const root = getComputedStyle(document.documentElement);
  const TYPE_COLORS = new Set();
  for (const name of ['normal','fire','water','grass','electric','ice','fighting','poison','ground',
                      'flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']) {
    const raw = root.getPropertyValue(`--t-${name}`).trim();
    if (raw) TYPE_COLORS.add(raw.toLowerCase());
  }
  // 화면에 그려진 값과 견주려면 같은 표기로 바꿔야 한다 — 브라우저에게 시킨다
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const asRgb = (value) => { probe.style.color = ''; probe.style.color = value; return getComputedStyle(probe).color; };
  const TYPE_RGB = new Set([...TYPE_COLORS].map(asRgb));
  probe.remove();
  const hexOf = (c) => 'rgb(' + c.map((x) => Math.round(x)).join(', ') + ')';

  const bad = [], known = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.1) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const fg = parse(cs.color);
    const bg = backdrop(el);
    if (!fg || !bg || fg.a < 0.5) continue;
    const [a, b] = [lum(fg.rgb), lum(bg)];
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < min) {
      const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
      const line = `${ratio.toFixed(2)} · ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} · 글자 ${hex(fg.rgb)} / 바탕 ${hex(bg)} · "${text.slice(0, 22)}"`;
      // 글자든 바탕이든 한쪽이 원작 타입색이면 알려진 한계다
      (TYPE_RGB.has(hexOf(fg.rgb)) || TYPE_RGB.has(hexOf(bg)) ? known : bad).push(line);
    }
  }
  return { bad: [...new Set(bad)], known: [...new Set(known)] };
};
