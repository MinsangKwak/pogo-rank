// 포켓몬 상세 팝업: 도트 스프라이트 · 진화 단계 · 기술 · 약점/내성 · 종족값 · 활용처

// 스프라이트 id → 도감번호 (기본 폼은 id가 곧 도감번호)
function dexOf(spriteId) {
  const s = parseInt(spriteId, 10);
  if (!Number.isFinite(s)) return null;
  return DEX_DATA.dex[s] ?? (s < 10000 ? s : null);
}

function detailSection(title, node) {
  return el('section', { class: 'd-sec' }, el('h3', {}, title), node);
}

function typeChipEl(t, extraText) {
  const chip = el('span', { class: 'tchip' }, el('span', { class: 'dot', style: `--c: var(--t-${t})` }), TYPE_KO[t] ?? t);
  if (extraText) chip.append(el('small', {}, extraText));
  return chip;
}

// 이 포켓몬(방어 측)에 대한 공격 타입 배율
function typeMultAgainst(atkType, defTypes) {
  let m = 1;
  for (const d of defTypes) m *= (DEX_DATA.chart[atkType]?.[d] ?? 1);
  return m;
}

// 2026-09-02 진화형을 누르면 그 포켓몬의 상세로 이동
// 2026-09-03 isDex: 도감에서 열면 능력치 육각형 포함, 일반(순위표·검색)에서는 기술만
function openDetailByDex(d, isDex) {
  openDetail({ sprite: d, name: DEX_DATA.names[d] ?? String(d), en: '', types: DEX_DATA.forms[d]?.types ?? [] }, isDex);
}

// 2026-09-04 메가/원시 진화 가능 종만 해당 — DEX_DATA.megas[dex] = [{sprite, label}, ...]
function megaMonNode(dex, entry, curSprite, isDex) {
  const sid = entry.sprite;
  const name = `${entry.label} ${DEX_DATA.names[dex] ?? dex}`;
  return el('button', { class: `evo-mon mega${sid === curSprite ? ' now' : ''}`,
    onclick: () => openDetail({ sprite: sid, name, en: '', types: DEX_DATA.forms[sid]?.types ?? [] }, isDex) },
    sprite(sid), el('span', {}, entry.label));
}

function evoNode(dex, isDex, curSprite) {
  const family = DEX_DATA.evo[dex];
  const megas = DEX_DATA.megas?.[dex];
  const hasFamily = family && family.length >= 2;
  if (!hasFamily && !megas?.length) return el('p', { class: 'd-none-text' }, '진화가 없는 포켓몬입니다.');
  const wrap = el('div', { class: 'evo' });
  if (hasFamily) family.forEach((stage, i) => {
    if (i > 0) wrap.append(el('span', { class: 'evo-arrow' }, '→'));
    wrap.append(el('div', { class: 'evo-stage' }, ...stage.map((d) => el('button', { class: `evo-mon${d === dex && d === curSprite ? ' now' : ''}`, onclick: () => openDetailByDex(d, isDex) },
      sprite(d), el('span', {}, DEX_DATA.names[d] ?? d)))));
  });
  if (megas?.length) {
    if (hasFamily) wrap.append(el('span', { class: 'evo-arrow' }, '⚡'));
    wrap.append(el('div', { class: 'evo-stage' }, ...megas.map((e) => megaMonNode(dex, e, curSprite, isDex))));
  }
  const foot = [hasFamily && '진화형을 누르면 그 포켓몬의 정보를 볼 수 있습니다', megas?.length && '⚡ 메가 진화 가능 — 누르면 메가 진화 스탯을 볼 수 있습니다'].filter(Boolean);
  wrap.append(el('p', { class: 'd-foot' }, foot.join(' · ')));
  return wrap;
}

function movesNode(form) {
  const mv = ([name, elite]) => el('span', { class: 'mv' }, name + (elite ? ' *' : ''));
  return el('div', {},
    el('div', { class: 'mv-row' }, el('em', {}, '스피드'), el('div', { class: 'mv-list' }, ...form.fast.map(mv))),
    el('div', { class: 'mv-row' }, el('em', {}, '차지'), el('div', { class: 'mv-list' }, ...form.charged.map(mv))),
    (form.fast.some((m) => m[1]) || form.charged.some((m) => m[1]))
      ? el('p', { class: 'd-foot' }, '* 레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득') : '',
  );
}

function matchupNode(types) {
  const rows = Object.keys(TYPE_KO).map((t) => [t, typeMultAgainst(t, types)]);
  const weak = rows.filter(([, m]) => m >= 1.5).sort((a, b) => b[1] - a[1]);
  const resist = rows.filter(([, m]) => m <= 0.7).sort((a, b) => a[1] - b[1]);
  const list = (arr) => el('div', { class: 'tchips' }, ...arr.map(([t, m]) => typeChipEl(t, `×${m.toFixed(2).replace(/0$/, '')}`)));
  return el('div', {},
    el('div', { class: 'mv-row' }, el('em', {}, '약점'), weak.length ? list(weak) : el('span', { class: 'd-none-text' }, '없음')),
    el('div', { class: 'mv-row' }, el('em', {}, '내성'), resist.length ? list(resist) : el('span', { class: 'd-none-text' }, '없음')),
  );
}



function statsNode(form) {
  const MAX = 320;
  const bar = (label, v) => el('div', { class: 'statbar' },
    el('em', {}, label), el('span', { class: 'bar' }, el('i', { style: `width:${Math.min(100, v / MAX * 100)}%` })), el('b', {}, String(v)));
  return el('div', {}, bar('공격', form.atk), bar('방어', form.def), bar('체력', form.hp));
}

// 2026-09-04 최대 CP: 만렙(Lv50) · 레이드 보상(Lv20/날씨부스트 Lv25) · 야생 최대(Lv30/날씨부스트 Lv35), 개체값 100% 기준
// 실제 게임 레벨 캡: 레이드 보상은 평시 20·부스트 25, 야생 스폰은 평시 30·부스트 35 (backend/dex_build.py cpm 참고)
function cpOf(form, mult) {
  const a = form.atk + 15, d = form.def + 15, h = form.hp + 15;
  return Math.max(10, Math.floor(a * Math.sqrt(d) * Math.sqrt(h) * mult * mult / 10));
}
function cpNode(form) {
  const c = DEX_DATA.cpm;
  if (!c) return null;
  const chip = (label, m) => el('span', { class: 'uchip' }, label, el('b', {}, `CP ${cpOf(form, m).toLocaleString()}`));
  return el('div', {},
    el('div', { class: 'tchips' }, chip('만렙 Lv50', c.l50)),
    el('div', { class: 'cp-ctx' },
      el('em', {}, '레이드 보상'),
      el('div', { class: 'tchips' }, chip('평시 Lv20', c.l20), chip('날씨부스트 Lv25', c.l25))),
    el('div', { class: 'cp-ctx' },
      el('em', {}, '야생 스폰'),
      el('div', { class: 'tchips' }, chip('평시 Lv30', c.l30), chip('날씨부스트 Lv35', c.l35))),
    el('p', { class: 'd-foot' }, '개체값 100% 기준. 레이드 보상은 잡을 때 CP(평시 Lv20 · 날씨부스트 Lv25), 야생 스폰은 필드에서 나오는 만렙(평시 Lv30 · 날씨부스트 Lv35)'));
}

// 2026-09-04 메가X/메가Y가 둘 다 있는 종(현재 뮤츠·리자몽 등)만 — 좌우 비교 + 차이 자동 요약
function megaCompareNode(dex) {
  const megas = DEX_DATA.megas?.[dex];
  const x = megas?.find((e) => e.label === '메가X'), y = megas?.find((e) => e.label === '메가Y');
  if (!x || !y) return null;
  const fx = DEX_DATA.forms[x.sprite], fy = DEX_DATA.forms[y.sprite];
  if (!fx || !fy) return null;
  const c = DEX_DATA.cpm;
  const row = (label, a, b, fmt = String) => el('div', { class: 'mega-cmp-row' },
    el('em', {}, label),
    el('b', { class: a > b ? 'hi' : '' }, fmt(a)), el('b', { class: b > a ? 'hi' : '' }, fmt(b)));
  const typeChips = (types) => el('div', { class: 'tchips' }, ...types.map((t) => typeChipEl(t)));

  const diffs = [];
  const onlyX = fx.types.filter((t) => !fy.types.includes(t)), onlyY = fy.types.filter((t) => !fx.types.includes(t));
  if (onlyX.length || onlyY.length) diffs.push(`타입: 메가X ${fx.types.map((t) => TYPE_KO[t]).join('/')} ↔ 메가Y ${fy.types.map((t) => TYPE_KO[t]).join('/')}`);
  for (const [label, key] of [['공격', 'atk'], ['방어', 'def'], ['체력', 'hp']]) {
    if (fx[key] !== fy[key]) diffs.push(`${label} 종족값 ${fx[key] > fy[key] ? '메가X' : '메가Y'}가 ${Math.abs(fx[key] - fy[key])} 더 높음`);
  }

  return el('div', { class: 'mega-cmp' },
    el('div', { class: 'mega-cmp-row mega-cmp-head' }, el('em', {}), el('b', {}, '메가X'), el('b', {}, '메가Y')),
    el('div', { class: 'mega-cmp-row' }, el('em', {}, '타입'), typeChips(fx.types), typeChips(fy.types)),
    row('공격', fx.atk, fy.atk), row('방어', fx.def, fy.def), row('체력', fx.hp, fy.hp),
    c ? row('CP 만렙', cpOf(fx, c.l50), cpOf(fy, c.l50), (n) => n.toLocaleString()) : '',
    diffs.length ? el('p', { class: 'd-foot' }, diffs.join(' · ')) : '');
}

// 활용처를 PvP · 레이드 · 맥스 그룹으로 나눠 순위 칩으로 표시
function usageNode(name) {
  const u = (VALUE_DATA.usage ?? []).find((x) => x.name === name);
  if (!u) return null;
  const groups = { pvp: [], pve: [], max: [] };
  for (const pl of u.places) groups[pl.place.split(':')[0]]?.push(pl);
  const GROUP_KO = { pvp: 'PvP', pve: '레이드', max: '맥스' };
  const chip = ({ place, rank }) => {
    const key = place.split(':')[1];
    const where = place.startsWith('pvp') ? LEAGUE_KO[key] : (key === 'overall' ? '전체' : TYPE_KO[key]);
    return el('span', { class: `uchip${rank <= 3 ? ' top' : ''}` }, where, el('b', {}, `${rank}위`));
  };
  const wrap = el('div', {});
  for (const k of ['pvp', 'pve', 'max']) {
    if (!groups[k].length) continue;
    groups[k].sort((a, b) => a.rank - b.rank);
    wrap.append(el('div', { class: 'mv-row' }, el('em', {}, GROUP_KO[k]),
      el('div', { class: 'tchips' }, ...groups[k].map(chip))));
  }
  wrap.append(el('p', { class: 'd-foot' }, '각 순위표 상위 30위 기준 · 3위 안은 강조 표시'));
  return wrap;
}

// 2026-09-02 가안 A: 이 포켓몬이 보스로 나올 때 추천 카운터
function counterNode(types) {
  const recs = (typeof DMAX_DATA !== 'undefined' ? DMAX_DATA[types[0]] : null)?.slice(0, 5);
  if (!recs?.length) return null;
  return el('div', { class: 'boss-recs' }, ...recs.map((c, i) =>
    el('button', { class: 'boss-rec', onclick: (e) => { e.stopPropagation(); openDetail(c); } },
      sprite(c.sprite), el('span', {}, `${i + 1} ${c.name}`))));
}


// 2026-09-03 타입 상성: 약점 위 · 내성 아래, 뱃지 중첩 없이 평평한 칩(점+타입+배율)
function matchupCols(types) {
  const rows = Object.keys(TYPE_KO).map((t) => [t, typeMultAgainst(t, types)]);
  const chipList = (list) => list.length
    ? el('div', { class: 'tchips' }, ...list.map(([t, m]) => typeChipEl(t, `×${+m.toFixed(2)}`)))
    : el('p', { class: 'd-none-text' }, '없음');
  const weak = rows.filter(([, m]) => m >= 1.5).sort((a, b) => b[1] - a[1]);
  const resist = rows.filter(([, m]) => m <= 0.7).sort((a, b) => a[1] - b[1]);
  return el('div', { class: 'd-matchrows' },
    el('div', {}, el('h3', {}, '약점'), chipList(weak)),
    el('div', {}, el('h3', {}, '내성'), chipList(resist)));
}

// 2026-09-03 능력치 육각형 대신 내 개체 CP 계산기: 이 포켓몬 고정, 레벨·IV만 조절
function detailCpCalc(form) {
  const v = { lv: 30, a: 15, d: 15, h: 15 };
  const $result = el('p', { class: 'cp-inline-result' });
  const update = () => {
    const cp = calcCp(form, v.lv, v.a, v.d, v.h);
    const max = calcCp(form, 50, v.a, v.d, v.h);
    $result.replaceChildren(el('b', {}, `CP ${cp.toLocaleString()}`),
      ` · 개체값 ${Math.round((v.a + v.d + v.h) / 45 * 100)}% · 이 개체 만렙 CP ${max.toLocaleString()} (${Math.round(cp / max * 100)}%)`);
  };
  const sliderRow = (label, key, min, max, step) => {
    const $val = el('b', {}, String(v[key]));
    const $s = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(v[key]) });
    $s.addEventListener('input', () => { v[key] = +$s.value; $val.textContent = $s.value; update(); });
    return el('div', { class: 'cp-slider' }, el('em', {}, label), $s, $val);
  };
  update();
  return el('div', {},
    sliderRow('레벨', 'lv', 1, 50, 0.5), sliderRow('공격 IV', 'a', 0, 15, 1),
    sliderRow('방어 IV', 'd', 0, 15, 1), sliderRow('체력 IV', 'h', 0, 15, 1),
    $result,
    el('p', { class: 'd-foot' }, '내 개체의 레벨·개체값을 맞추면 지금 CP와 만렙까지의 여지가 보입니다'));
}


// 2026-09-03 능력치 육각형 복원(도감 요청): 종족값 3축 + CP·레이드·PvP 3축, 대표 타입 색
function svgEl(tag, attrs = {}, ...children) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of children) n.append(c);
  return n;
}
function hexNode(form, name, types) {
  const u = (VALUE_DATA.usage ?? []).find((x) => x.name === name);
  const bestRank = (pfx) => {
    const r = (u?.places ?? []).filter((pl) => pl.place.startsWith(pfx)).map((pl) => pl.rank);
    return r.length ? Math.min(...r) : null;
  };
  const rankScore = (r) => (r == null ? 0.08 : Math.max(0.15, 1 - (r - 1) / 32));
  const raid = bestRank('pve') != null || bestRank('max') != null
    ? Math.min(bestRank('pve') ?? 99, bestRank('max') ?? 99) : null;
  const pvp = bestRank('pvp');
  const cp = DEX_DATA.cpm ? cpOf(form, DEX_DATA.cpm.l50) : null;
  const axes = [
    ['공격', String(form.atk), Math.min(1, form.atk / 320)],
    ['방어', String(form.def), Math.min(1, form.def / 320)],
    ['레이드', raid ? `${raid}위` : '-', rankScore(raid)],
    ['체력', String(form.hp), Math.min(1, form.hp / 320)],
    ['CP', cp ? cp.toLocaleString() : '-', cp ? Math.min(1, cp / 5500) : 0.08],
    ['PvP', pvp ? `${pvp}위` : '-', rankScore(pvp)],
  ];
  const CX = 150, CY = 118, R = 76;
  const pt = (i, f) => {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    return [CX + Math.cos(a) * R * f, CY + Math.sin(a) * R * f];
  };
  const ring = (f) => svgEl('polygon', {
    points: axes.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(',')).join(' '),
    fill: 'none', stroke: 'var(--line)', 'stroke-width': f === 1 ? 1.2 : 0.7 });
  const color = `var(--t-${types[0] ?? 'normal'})`;
  const svg = svgEl('svg', { viewBox: '0 0 300 236', class: 'hex-svg', role: 'img', 'aria-label': '능력치 육각형' },
    ring(1 / 3), ring(2 / 3), ring(1),
    ...axes.map((_, i) => svgEl('line', { x1: CX, y1: CY, x2: pt(i, 1)[0], y2: pt(i, 1)[1], stroke: 'var(--line)', 'stroke-width': 0.7 })),
    svgEl('polygon', { points: axes.map((a, i) => pt(i, a[2]).map((v) => v.toFixed(1)).join(',')).join(' '),
      fill: color, 'fill-opacity': 0.22, stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    ...axes.map((a, i) => { const [x, y] = pt(i, a[2]); return svgEl('circle', { cx: x, cy: y, r: 3, fill: color }); }),
    ...axes.map((a, i) => {
      const [x, y] = pt(i, 1.24);
      const anchor = Math.abs(x - CX) < 8 ? 'middle' : x > CX ? 'start' : 'end';
      return svgEl('text', { x, y: y - 2, 'text-anchor': anchor, class: 'hex-label' },
        svgEl('tspan', { class: 'hex-name' }, a[0]),
        svgEl('tspan', { x, dy: 13, class: 'hex-val' }, a[1]));
    }));
  svg.append(svgEl('title', {}, '종족값 320 · CP 5,500 기준 비율. 레이드/PvP는 도감 순위표 최고 순위'));
  return el('div', { class: 'hex-wrap' }, svg);
}

function openDetail(p, isDex = false) {
  track('detail_open', { mon: p.name, from: isDex ? 'dex' : 'list' });  // 2026-09-03 GA4: 상세 팝업 사용량
  const dex = dexOf(p.sprite);
  const form = DEX_DATA.forms[p.sprite] ?? (dex != null ? DEX_DATA.forms[dex] : null);
  const types = (p.types?.length ? p.types : form?.types) ?? [];

  // 2026-09-03 최대 CP를 헤더로 — 제일 먼저 보이는 정보
  const c = DEX_DATA.cpm;
  const cpLine = form && c
    ? el('p', { class: 'd-cpline' },
        `CP 만렙 `, el('b', {}, cpOf(form, c.l50).toLocaleString()),
        ` | 레이드 보상 ${cpOf(form, c.l20).toLocaleString()}, 부스트 ${cpOf(form, c.l25).toLocaleString()}`,
        ` | 야생 ${cpOf(form, c.l30).toLocaleString()}, 부스트 ${cpOf(form, c.l35).toLocaleString()}`)
    : '';
  // 2026-09-03 v3 헤더: 타입 → 팬텀(Gengar) → CP 만렙 | 야생, 부스트 (유저 지정 순서)
  const head = el('div', { class: 'd-head' },
    el('div', { class: 'd-sprite' }, sprite(p.sprite)),
    el('div', {},
      el('div', { class: 'tchips' }, ...types.map((t) => typeChipEl(t))),
      el('h2', {}, p.name, p.en ? el('span', { class: 'd-en-inline' }, ` (${p.en})`) : ''),
      cpLine),
    // 2026-09-03 v2.2.0 즐겨찾기 ★ (로그인 기능이 켜진 빌드에서만, 종 단위 = 도감번호)
    authEnabled() && dex != null ? favBtn(dex, 'd-fav') : '');

  const body = el('div', { class: 'detail' }, head);
  // 2026-09-03 v4: 내 개체 CP 계산기를 상성 위로, 접이식 아코디언으로
  // 2026-09-03 도감형 재배치: 계산기 아코디언 → [능력치 육각형 | 배울 수 있는 기술] → 상성 → 활용처 → 진화, "보스로 나오면"은 맨 아래
  if (form) body.append(el('details', { class: 'd-acc' },
    el('summary', {}, '🧮 내 개체 CP 계산기'),
    el('div', { class: 'd-acc-body' }, detailCpCalc(form))));
  // 2026-09-03 일반 팝업: 능력치 없이 기술만 전체 폭 / 도감 팝업: [능력치 육각형 | 기술] 2열
  if (form) {
    body.append(isDex
      ? el('div', { class: 'd-hexmoves' },
          el('div', {}, el('h3', {}, '능력치'), hexNode(form, p.name, types)),
          el('div', { class: 'd-moves' }, el('h3', {}, '배울 수 있는 기술'), movesNode(form)))
      : detailSection('배울 수 있는 기술', el('div', { class: 'd-moves' }, movesNode(form))));
  }
  if (types.length) body.append(detailSection('타입 상성', matchupCols(types)));
  const usage = usageNode(p.name);
  if (usage) body.append(detailSection('이 도감에서의 활용처 (상위 30위 내)', usage));
  const megaCmp = dex != null ? megaCompareNode(dex) : null;
  if (megaCmp) body.append(detailSection('⚡ 메가X vs 메가Y 비교', megaCmp));
  if (dex != null) body.append(detailSection('진화 단계', evoNode(dex, isDex, p.sprite)));
  const counter = types.length ? counterNode(types) : null;
  if (counter) body.append(detailSection(`${p.name}가 보스로 나오면? (${TYPE_KO[types[0]]} 보스 공략 딜러)`, counter));
  openModal(body);
}
