// 다이맥스 탭: 위에는 그 속성 다이맥스 포켓몬 티어표, 아래에 보스 상대 맥스 어태커
function maxRow(p, rankText) {
  return row(
    p, rankText, el('span', { class: 'score' }, String(p.dmg)),
    el('span', { class: 'sub' }, `맥스 피해 · 내구 ${p.bulk}`),
    [p.fast, `${TYPE_KO[p.charged]} 타입`],
    el('span', { class: `tag${p.gmax ? ' gmax' : ''}` }, p.gmax ? 'G-MAX' : 'D-MAX'  /* 2026-09-02 영문 라벨 */),
  );
}

// 2026-09-02 티어 근거 인라인 펼침 행 (1B) — pogomate 기준 공식으로 갱신
function whyText(p) {
  const top = (DMAX_TIER[p.charged] ?? [])[0];
  const pct = top ? Math.round(p.score / top.score * 100) : null;
  const formula = `점수 ${p.score.toLocaleString()} = 공격 ${p.atk} × 위력 ${p.power}${p.stab ? ' × 자속 1.2' : ''}`;
  const vs = pct == null ? '' : top.name === p.name && top.gmax === p.gmax ? ` · ${TYPE_KO[p.charged]} 1위` : ` · ${TYPE_KO[p.charged]} 1위 ${top.name} 대비 ${pct}%`;
  return `${p.tier} 근거 — ${formula}${vs}`;
}

// 2026-09-02 티어표 행: pogomate 기준 % 표시 (내구 미반영)
function tierRowNode(p, rankText, topScore) {
  return row(p, rankText,
    el('span', { class: 'score' }, `${Math.round(p.score / topScore * 100)}%`),
    el('span', { class: 'sub' }, `공격 ${p.atk} · 위력 ${p.power}${p.stab ? ' · 자속' : ''}`),
    [p.fast, `${TYPE_KO[p.charged]} 타입`],
    el('span', { class: `tag${p.gmax ? ' gmax' : ''}` }, p.gmax ? 'G-MAX' : 'D-MAX'));
}

function expandableRow(p, rankText, topScore) {
  const li = tierRowNode(p, rankText, topScore).cloneNode(true);  // cloneNode로 팝업 클릭 리스너 제거
  // 2026-09-02 가안 B: 근거 아래 "얘가 보스면?" 카운터 한 줄
  const ct = p.types?.[0];
  const counters = ct ? (DMAX_DATA[ct] ?? []).slice(0, 5) : [];
  const why = el('li', { class: 'row-why' },
    el('p', { class: 'why-line' }, whyText(p) + '  ',
      el('button', { class: 'row-why-more', onclick: (e) => { e.stopPropagation(); openDetail(p); } }, '포켓몬 상세 ▸')),
    counters.length ? el('p', { class: 'why-line' }, '🛡 얘가 보스면 → ',
      ...counters.flatMap((c, i) => [
        el('button', { class: 'row-why-more', onclick: (e) => { e.stopPropagation(); openDetail(c); } }, c.name),
        i < counters.length - 1 ? ' · ' : ''])) : '');
  li.addEventListener('click', () => why.classList.toggle('open'));
  const frag = document.createDocumentFragment();
  frag.append(li, why);
  return frag;
}

// 2026-09-02 이번 주 보스 아코디언: 탭 위로 이동, 추천 딜러 딜량순 5개씩 더보기
function bossRecNodes(t, count) {
  return (DMAX_DATA[t] ?? []).slice(0, count).map((p, i) =>
    el('button', { class: 'boss-rec', onclick: (e) => { e.stopPropagation(); openDetail(p); } },
      sprite(p.sprite), el('span', {}, `${i + 1} ${p.name}`)));
}

function renderBossAcc() {
  const acc = document.getElementById('boss-acc');
  const title = document.getElementById('boss-acc-title');
  const body = document.getElementById('boss-acc-body');
  const d = new Date();
  const inMonth = d.getFullYear() === SCHEDULE_YM.y && d.getMonth() + 1 === SCHEDULE_YM.m;
  const day = inMonth ? d.getDate() : 0;
  let it = SCHEDULE_ITEMS.find(x => x.cat === 'dmax' && x.t && day >= x.s && day <= x.e);
  let prefix = '⚔️ 이번 주 보스 · ';
  if (!it) {
    it = SCHEDULE_ITEMS.filter(x => x.cat === 'dmax' && x.t && x.s > day).sort((a, b) => a.s - b.s)[0];
    prefix = '⚔️ 이번 주 맥스 먼데이 휴식 · 다음 보스 ';
  }
  if (!it) { acc.style.display = 'none'; return; }
  acc.style.display = '';
  const name = it.label.split(' (')[0].replace('D-MAX ', '');
  title.textContent = `${prefix}${name} (${TYPE_KO[it.t]}) · 9/${it.s}–${it.e}`;
  const total = (DMAX_DATA[it.t] ?? []).length;
  const grid = el('div', { class: 'boss-recs wrap-recs' }, ...bossRecNodes(it.t, state.bossShow));
  body.replaceChildren(
    el('p', { class: 'schedule-sec' }, `${TYPE_KO[it.t]} 보스 추천 딜러 (딜량순)`),
    grid,
    el('div', { class: 'boss-foot' },
      state.bossShow < total ? el('button', { class: 'boss-more', onclick: () => { state.bossShow += 5; renderBossAcc(); acc.open = true; } }, `더보기 +5 (${Math.min(state.bossShow, total)}/${total})`) : el('span', { class: 'meta' }, `전체 ${total}종 표시됨`),
      el('button', { class: 'boss-more', onclick: () => { state.maxBoss = it.t; render(); } }, `${TYPE_KO[it.t]} 칩으로 이동 ▸`)));
}

function renderMax() {
  const bossItems = [{ id: 'overall', label: '전체' }, ...Object.keys(TYPE_KO).map((t) => ({ id: t, label: TYPE_KO[t], color: t }))];
  renderBossAcc();  // 2026-09-02 탭 위 보스 아코디언
  const bossChips = chips(bossItems, state.maxBoss, (id) => { state.maxBoss = id; render(); });
  $controls.append(bossChips);
  const t = state.maxBoss;

  // 티어별 포켓몬 (속성 탭 = 그 속성 다이맥스 포켓몬만)
  const tierItems = DMAX_TIER[t] ?? [];
  const tierTitle = t === 'overall' ? 'D-MAX 티어표 (전체)' : `${TYPE_KO[t]} 타입 D-MAX 티어표`;
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, tierTitle), el('span', { class: 'meta' }, `${tierItems.length}종`)));
  if (tierItems.length) renderTierList(tierItems, (p, i) => expandableRow(p, String(i + 1), tierItems[0].score));  // 2026-09-02 1B·pogomate %

  // 하단: 보스 속성 상대 맥스 어태커
  if (t !== 'overall') {
    const items = DMAX_DATA[t] ?? [];
    $content.append(
      el('div', { class: 'list-head' }, el('h2', {}, `${TYPE_KO[t]} 보스 상대 맥스 어태커`), el('span', { class: 'meta' }, `상위 ${items.length}`)),
      list(`max-${t}`, items, (p, i) => maxRow(p, String(i + 1))),
    );
  }
  $note.textContent = '티어표 행을 누르면 선정 근거가 펼쳐집니다. 티어표는 pogomate와 같은 기준: 공격 종족값 × 맥스무브 위력(거다이 450 · 다이 350) × 자속 1.2, 내구 미반영, 다이맥스·거다이맥스는 별도 항목이며 %는 그 목록 1위 대비입니다. 위는 그 속성 다이맥스 포켓몬의 티어표(중립 기준, 목록 안 상대 등급), 아래는 그 속성 보스를 상대할 때 강한 맥스 어태커 순위입니다. 맥스어택 3레벨(위력 350) 또는 거다이맥스 3레벨(위력 450) 1회 피해 × √내구 기준. 출시된 다이맥스 138종 · 거다이맥스 17종만 포함. 포켓몬을 누르면 상세 정보가 열립니다.';
}
