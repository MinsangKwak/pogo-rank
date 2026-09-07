// ─────────────────────────────────────────────────────────────────────────────
// planner/collection.js — 🎒 내 포켓몬: 개체 단위 저장·수정·삭제 + 같은 종 2개체 비교 (2026-09-07 v2.15.0, QA-54)
//
// 즐겨찾기(★)와 다르다
//   ★ 는 "이 종을 가졌다/키운다"는 종 단위 표시(도감번호)다. 여기서는 실제 개체 하나하나를 적는다 —
//   같은 종을 여러 마리 저장할 수 있고, 레벨·개체값·기술이 다르면 다른 개체다. 저장 필드도 별개(mons)라 ★ 의 의미는 그대로다.
//
// 데이터 모델 — Firestore users/{uid}.mons (배열, 문서 전체를 merge 로 덮어쓴다)
//   { id, sprite, shadow, level, ivs: [atk, def, hp], fast, charged, status, memo, at }
//   sprite  폼 식별자(스프라이트 id). 메가·리전 폼은 10000번대, 기본 폼은 도감번호
//   shadow  섀도우 여부 (스프라이트 id 가 같아 따로 적는다)
//   level   1 ~ 50 (0.5 단위). CP 는 저장하지 않고 종족값 × 레벨 × 개체값으로 계산한다 (pages.js calcCp)
//   status  '육성 중' | '완료' | '교환 후보'
//   at      마지막 수정 시각 (ms) — 홈의 "최근" 정렬용
//
// 제공하는 전역
//   planMons() · planMonName(mon) · planMonForm(mon) · planMonCp(mon, level?) · planLeagueReach(form, ivs)
//   renderPlanCollection() · openPlanMonEditor(mon, prefill) · openPlanCompare(a, b) · planAddFromDetail(pokemon)
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode · splitFormName (components/name.js) · chips (components/chips.js)
//   openModal · closeModal (components/modal.js) · navigateHash (components/history.js) · track (track.js)
//   AUTH · authEnabled · authEmail · signIn (components/auth.js) · dexOf · maxPoolKind (components/detail.js)
//   calcCp (components/pages.js) · buildSearchIndex · monSearch (components/search.js) · DEX_DATA · TYPE_KO · LEAGUE_KO (data.js)
//   state · $content · $note · render (app.js)
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_STATUSES = ['육성 중', '완료', '교환 후보'];
const PLAN_MAX_MONS = 300;  // 문서 1MB 한도 안에서 넉넉한 상한 — 친구 규모에서는 닿을 일이 없다
// 리그 CP 상한 (마스터는 상한 없음 = 만렙)
const PLAN_LEAGUES = [['little', 500], ['great', 1500], ['ultra', 2500], ['master', null]];

function planMons() {
  if (Array.isArray(AUTH.mons) && AUTH.mons.length) return AUTH.mons;
  try { const raw = localStorage.getItem('plan_guest_mons'); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

// 개체가 가리키는 폼 데이터 — 폼 id 로 먼저, 없으면 원종 도감번호로
function planMonForm(mon) {
  const dex = dexOf(mon.sprite);
  return DEX_DATA.forms?.[mon.sprite] ?? (dex != null ? DEX_DATA.forms?.[dex] : null) ?? null;
}

// 화면에 쓸 이름: (섀도우) (폼 라벨) 종 이름 — nameNode 가 라벨을 뱃지로 뗀다
function planMonName(mon) {
  const dex = dexOf(mon.sprite);
  const base = DEX_DATA.names?.[dex ?? mon.sprite] ?? String(mon.sprite);
  const label = DEX_DATA.forms?.[mon.sprite]?.name ?? '';
  return `${mon.shadow ? '섀도우 ' : ''}${label ? label + ' ' : ''}${base}`;
}

// 개체 CP. level 을 주면 그 레벨로(만렙·리그 도달 계산용). 섀도우는 CP 에 영향이 없다(공격·방어 보정은 배틀 중에만)
function planMonCp(mon, level) {
  const form = planMonForm(mon);
  if (!form) return 0;
  const [atk = 15, def = 15, hp = 15] = mon.ivs ?? [];
  return calcCp(form, level ?? mon.level ?? 1, atk, def, hp);
}

function planIvPercent(ivs) {
  const [atk = 0, def = 0, hp = 0] = ivs ?? [];
  return Math.round((atk + def + hp) / 45 * 100);
}

// 리그별 도달 — CP 상한을 넘지 않는 가장 높은 레벨과 그때 CP. 상한이 없으면(마스터) 만렙 Lv50
//   반환값 { little: { level, cp }, great: …, ultra: …, master: … }. 상한이 Lv1 CP 보다 낮으면(리틀리그의 전설) null
function planLeagueReach(form, ivs) {
  const [atk = 15, def = 15, hp = 15] = ivs ?? [];
  const out = {};
  for (const [league, cap] of PLAN_LEAGUES) {
    if (cap == null) { out[league] = { level: 50, cp: calcCp(form, 50, atk, def, hp) }; continue; }
    let best = null;
    for (let level = 1; level <= 50; level += 0.5) {
      const cp = calcCp(form, level, atk, def, hp);
      if (cp > cap) break;
      best = { level, cp };
    }
    out[league] = best;
  }
  return out;
}

// CP 로 레벨 추정 — 같은 개체값에서 그 CP 가 나오는 레벨. 정확히 맞는 레벨이 없으면 가장 가까운 레벨과 차이를 함께 돌려준다
function planLevelFromCp(form, ivs, cp) {
  const [atk = 15, def = 15, hp = 15] = ivs ?? [];
  let best = { level: 1, diff: Infinity };
  for (let level = 1; level <= 50; level += 0.5) {
    const diff = Math.abs(calcCp(form, level, atk, def, hp) - cp);
    if (diff < best.diff) best = { level, diff };
    if (diff === 0) break;
  }
  return best;
}

// ── 저장 ──────────────────────────────────────────────────────────────────────
// 낙관적 갱신: AUTH.mons 를 먼저 바꾸고 화면을 그린 뒤 Firestore 에 쓴다. 실패는 조용히(규칙이 막는 경우 등)
async function planPersist() {
  if (!authEnabled() || AUTH.status !== 'ok' || !AUTH.db || !AUTH.user) { try { localStorage.setItem('plan_guest_mons', JSON.stringify(planMons())); } catch {} return; }
  const fieldValue = firebase.firestore.FieldValue;
  await AUTH.db.collection('users').doc(AUTH.user.uid).set({
    email: authEmail(), mons: planMons(), updatedAt: fieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

function planNewId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function planSaveMon(mon) {
  const list = planMons();
  const index = list.findIndex((entry) => entry.id === mon.id);
  mon.at = Date.now();
  if (index >= 0) list[index] = mon;
  else {
    if (list.length >= PLAN_MAX_MONS) return false;
    list.push(mon);
  }
  AUTH.mons = list;
  track('plan_mon_save', { kind: index >= 0 ? 'edit' : 'add', mon: planMonName(mon) });
  planPersist();
  return true;
}

function planDeleteMon(id) {
  AUTH.mons = planMons().filter((entry) => entry.id !== id);
  track('plan_mon_delete');
  planPersist();
}

// ── 편집 팝업 ─────────────────────────────────────────────────────────────────
// mon 을 주면 수정, null 이면 새 개체. prefill = { sprite, shadow } 로 종을 미리 채운다(상세 팝업 → 저장 동선).
// 종을 고르기 전에는 검색만 보이고, 고르면 아래에 입력 폼이 펼쳐진다. 비로그인도 계산은 되고 저장 버튼만 로그인 유도.
function openPlanMonEditor(mon = null, prefill = null) {
  const canSave = authEnabled() && AUTH.status === 'ok';
  const draft = mon
    ? { ...mon, ivs: [...(mon.ivs ?? [15, 15, 15])] }
    : { id: planNewId(), sprite: prefill?.sprite ?? null, shadow: !!prefill?.shadow, level: 20, ivs: [15, 15, 15], fast: '', charged: '', status: '육성 중', memo: '' };

  const body = el('div', { class: 'detail plan-editor' }, el('h2', {}, mon ? '✏️ 개체 수정' : '➕ 개체 추가'));
  const $pick = el('div', {});
  const $form = el('div', {});
  body.append($pick, $form);

  // 종 고르기: 기존 검색 색인 재사용. 다이맥스/거다이맥스 항목은 폼이 아니라 D-MAX 표의 줄이라 뺀다.
  // "섀도우 X" 를 고르면 섀도우 체크 + 기본 폼으로 저장한다
  const drawPick = () => {
    $pick.replaceChildren();
    if (draft.sprite != null) {
      const form = planMonForm(draft);
      $pick.append(el('div', { class: 'boss-selected' },
        sprite(draft.sprite),
        el('div', { class: 'boss-cp' }, el('b', {}, nameNode(planMonName(draft))),
          el('span', { class: 'meta' }, form ? `공격 ${form.atk} · 방어 ${form.def} · 체력 ${form.hp}${maxPoolKind(draft.sprite) ? ` · 맥스 배틀 ${maxPoolKind(draft.sprite) === 'G' ? '거다이맥스' : '다이맥스'} 가능` : ''}` : '폼 데이터 없음')),
        mon ? '' : el('button', { class: 'boss-clear', 'aria-label': '다른 종 고르기', onclick: () => { draft.sprite = null; drawPick(); drawForm(); } }, '✕')));
      return;
    }
    const $input = el('input', { class: 'boss-search', placeholder: '종 이름 검색 (예: 메가 리자몽, 섀도우 뮤츠)', autocomplete: 'off' });
    const $sugg = el('div', { class: 'boss-sugg' });
    $input.addEventListener('input', () => {
      $sugg.textContent = '';
      const query = $input.value.trim();
      if (!query) return;
      const candidates = buildSearchIndex().filter((entry) => !/^(다이맥스|거다이맥스) /.test(entry.name));
      for (const hit of monSearch(candidates, query, 8)) {
        $sugg.append(el('button', { class: 'sugg-item', onclick: () => {
          draft.sprite = hit.sprite;
          draft.shadow = /^섀도우 /.test(hit.name);
          draft.fast = ''; draft.charged = '';
          drawPick(); drawForm();
        } }, sprite(hit.sprite), el('span', {}, nameNode(hit.name))));
      }
      if (!$sugg.childElementCount) $sugg.append(el('span', { class: 'sugg-none' }, '검색 결과가 없어요'));
    });
    $pick.append($input, $sugg);
    setTimeout(() => $input.focus(), 50);
  };

  const drawForm = () => {
    $form.replaceChildren();
    if (draft.sprite == null) return;
    const form = planMonForm(draft);
    if (!form) { $form.append(el('p', { class: 'd-none-text' }, '이 폼은 능력치 데이터가 없어 저장할 수 없어요.')); return; }

    const $cpLine = el('p', { class: 'cp-inline-result' });
    const refreshCp = () => {
      const cp = planMonCp(draft);
      const maxCp = planMonCp(draft, 50);
      $cpLine.replaceChildren(el('b', {}, `CP ${cp.toLocaleString()}`),
        ` · 개체값 ${planIvPercent(draft.ivs)}% · 만렙 CP ${maxCp.toLocaleString()} (${Math.round(cp / maxCp * 100)}%)`);
    };
    const numberInput = (value, min, max, step, onChange) => {
      const input = el('input', { class: 'plan-num', type: 'number', inputmode: 'decimal', min: String(min), max: String(max), step: String(step), value: String(value) });
      input.addEventListener('input', () => {
        const parsed = Number(input.value);
        if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
        refreshCp();
      });
      return input;
    };
    const rowOf = (label, ...nodes) => el('div', { class: 'plan-row' }, el('em', {}, label), el('div', { class: 'plan-row-body' }, ...nodes));

    // 섀도우
    const $shadow = el('input', { type: 'checkbox' });
    $shadow.checked = draft.shadow;
    $shadow.addEventListener('change', () => { draft.shadow = $shadow.checked; });

    // 레벨 · 개체값
    const $level = numberInput(draft.level, 1, 50, 0.5, (value) => { draft.level = value; });
    const ivInputs = ['공격', '방어', '체력'].map((label, index) => el('label', { class: 'plan-iv' }, label,
      numberInput(draft.ivs[index], 0, 15, 1, (value) => { draft.ivs[index] = value; })));

    // CP 로 레벨 추정 — 게임 화면의 CP 를 그대로 넣으면 레벨을 맞춰 준다 (개체값을 먼저 맞춰야 정확)
    const $cpInput = el('input', { class: 'plan-num', type: 'number', inputmode: 'numeric', placeholder: 'CP' });
    const $cpHint = el('span', { class: 'meta' });
    const $cpButton = el('button', { class: 'uchip', onclick: () => {
      const cp = Number($cpInput.value);
      if (!cp) { $cpHint.textContent = '게임에 보이는 CP 를 넣으세요'; return; }
      const guess = planLevelFromCp(form, draft.ivs, cp);
      draft.level = guess.level;
      $level.value = String(guess.level);
      $cpHint.textContent = guess.diff === 0 ? `Lv ${guess.level} 로 맞췄어요` : `정확히 맞는 레벨이 없어요 — 가장 가까운 Lv ${guess.level} (CP 차이 ${guess.diff}). 개체값을 확인하세요`;
      refreshCp();
    } }, '레벨 추정');

    // 기술 — 이 폼이 배울 수 있는 목록에서 고른다. 모르면 비워 둔다
    const moveSelect = (moves, current, onChange) => {
      const select = el('select', { class: 'plan-select' }, el('option', { value: '' }, '모름 / 아직'));
      for (const [name, elite] of moves) select.append(el('option', { value: name }, name + (elite ? ' *' : '')));
      if (current && !moves.some(([name]) => name === current)) select.append(el('option', { value: current }, current));
      select.value = current || '';
      select.addEventListener('change', () => onChange(select.value));
      return select;
    };
    const $fast = moveSelect(form.fast ?? [], draft.fast, (value) => { draft.fast = value; });
    const $charged = moveSelect(form.charged ?? [], draft.charged, (value) => { draft.charged = value; });

    // 상태 · 메모
    const $status = el('select', { class: 'plan-select' }, ...PLAN_STATUSES.map((status) => el('option', { value: status }, status)));
    $status.value = draft.status;
    $status.addEventListener('change', () => { draft.status = $status.value; });
    const $memo = el('input', { class: 'boss-search plan-memo', placeholder: '메모 (예: 레이드용 2호기, 교환 받은 것)', value: draft.memo ?? '', maxlength: '80' });
    $memo.addEventListener('input', () => { draft.memo = $memo.value; });

    const $msg = el('p', { class: 'acct-msg' });
    const save = () => {
      // 비로그인도 브라우저 체험 저장을 허용하고, 로그인 시 auth.js가 계정으로 이전한다.
      if (!planSaveMon({ ...draft, memo: (draft.memo ?? '').trim() })) { $msg.textContent = `개체는 ${PLAN_MAX_MONS}마리까지 저장할 수 있어요.`; return; }
      closeModal();
      if (state.appMode === 'plan') render();
      else navigateHash('#/plan/collection');
    };
    refreshCp();
    $form.append(
      rowOf('섀도우', el('label', { class: 'plan-check' }, $shadow, ' 섀도우 개체')),
      rowOf('레벨', $level, el('span', { class: 'meta' }, '1 ~ 50, 0.5 단위')),
      rowOf('개체값', el('div', { class: 'plan-ivs' }, ...ivInputs)),
      rowOf('CP 로 맞추기', $cpInput, $cpButton, $cpHint),
      $cpLine,
      rowOf('스피드', $fast),
      rowOf('차지', $charged),
      rowOf('상태', $status),
      rowOf('메모', $memo),
      $msg,
      el('div', { class: 'release-actions' },
        el('button', { class: 'release-mute', onclick: () => closeModal() }, '취소'),
        el('button', { class: 'release-ok', onclick: save }, mon ? '저장' : '내 포켓몬에 추가')),
      el('p', { class: 'd-foot' }, 'CP 는 저장하지 않고 종족값 × 레벨 × 개체값으로 계산합니다. * 는 레거시 기술. 섀도우는 CP 가 같고 배틀에서만 공격 ×1.2 · 방어 ×0.83.'));
  };
  drawPick();
  drawForm();
  openModal(body);
}

// ── 비교 팝업 ─────────────────────────────────────────────────────────────────
// 같은 종 두 개체. 순위 평가가 아니라 "이 둘 중 어느 쪽을 키우나"의 숫자 근거만 나란히 둔다
function openPlanCompare(first, second) {
  track('plan_compare', { mon: planMonName(first) });
  const form = planMonForm(first);
  const reachA = planLeagueReach(form, first.ivs);
  const reachB = planLeagueReach(form, second.ivs);
  const cell = (text, hi) => el('b', { class: hi ? 'hi' : '' }, text);
  const row = (label, a, b, higherIsBetter = true) => {
    const numA = typeof a === 'number' ? a : null;
    const numB = typeof b === 'number' ? b : null;
    const hiA = numA != null && numB != null && (higherIsBetter ? numA > numB : numA < numB);
    const hiB = numA != null && numB != null && (higherIsBetter ? numB > numA : numB < numA);
    const text = (value) => value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : value;
    return el('div', { class: 'mega-cmp-row' }, el('em', {}, label), cell(text(a), hiA), cell(text(b), hiB));
  };
  const reachText = (reach) => reach ? `${reach.cp.toLocaleString()} (Lv ${reach.level})` : null;
  const reachNum = (reach) => reach ? reach.cp : null;
  const head = (mon) => el('div', { class: 'plan-cmp-head' }, sprite(mon.sprite), el('b', {}, nameNode(planMonName(mon))), el('span', { class: 'meta' }, mon.memo || mon.status));
  const body = el('div', { class: 'detail' },
    el('h2', {}, '⚖️ 같은 종 개체 비교'),
    el('div', { class: 'mega-cmp plan-cmp' },
      el('div', { class: 'mega-cmp-row mega-cmp-head' }, el('em', {}, ''), head(first), head(second)),
      row('지금 레벨', first.level, second.level),
      row('지금 CP', planMonCp(first), planMonCp(second)),
      row('개체값 공/방/체', first.ivs.join('/'), second.ivs.join('/')),
      row('개체값 %', planIvPercent(first.ivs), planIvPercent(second.ivs)),
      row('만렙 CP (Lv50)', planMonCp(first, 50), planMonCp(second, 50)),
      ...PLAN_LEAGUES.filter(([league]) => league !== 'master').map(([league, cap]) => {
        const a = reachA[league];
        const b = reachB[league];
        // 리그 도달은 "상한 아래 최대 CP" 라 클수록 좋다. 같은 CP 면 레벨이 낮은 쪽(강화 비용 적음)이 유리하지만 표에는 CP 만 강조한다
        const rowNode = row(`${LEAGUE_KO?.[league] ?? league} (≤${cap})`, reachNum(a), reachNum(b));
        rowNode.children[1].textContent = reachText(a) ?? '불가';
        rowNode.children[2].textContent = reachText(b) ?? '불가';
        return rowNode;
      }),
      row('스피드 기술', first.fast || '—', second.fast || '—'),
      row('차지 기술', first.charged || '—', second.charged || '—'),
      row('섀도우', first.shadow ? '섀도우' : '일반', second.shadow ? '섀도우' : '일반')),
    el('p', { class: 'd-foot' }, '굵은 값이 더 큰 쪽입니다. 리그 도달 = CP 상한을 넘지 않는 가장 높은 레벨의 CP. 이 표는 같은 종 안에서의 숫자 비교일 뿐 순위표 평가가 아니며, PvP 에서는 개체값이 낮아도 상한에 딱 맞는 개체가 유리할 수 있습니다.'));
  openModal(body);
}

// ── 목록 화면 ─────────────────────────────────────────────────────────────────
let _planFilter = 'all';        // 상태 칩
let _planCompare = [];          // 비교로 고른 개체 id (최대 2)

function planMonCard(mon) {
  const form = planMonForm(mon);
  const picked = _planCompare.includes(mon.id);
  const cp = planMonCp(mon);
  const maxKind = maxPoolKind(mon.sprite);
  return el('div', { class: `plan-mon${picked ? ' picked' : ''}` },
    sprite(mon.sprite),
    el('div', { class: 'plan-mon-main' },
      el('div', { class: 'name' }, nameNode(planMonName(mon)), el('span', { class: `tag plan-status s-${PLAN_STATUSES.indexOf(mon.status)}` }, mon.status)),
      el('div', { class: 'moves' }, el('span', {}, `Lv ${mon.level}`), el('span', {}, `개체값 ${(mon.ivs ?? []).join('/')} (${planIvPercent(mon.ivs)}%)`), el('span', {}, `CP ${cp.toLocaleString()}`)),
      el('div', { class: 'moves' }, el('span', {}, mon.fast || '스피드 모름'), el('span', {}, mon.charged || '차지 모름'),
        maxKind ? el('span', {}, maxKind === 'G' ? '거다이맥스 가능' : '다이맥스 가능') : ''),
      mon.memo ? el('div', { class: 'plan-memo-line' }, mon.memo) : '',
      form ? '' : el('div', { class: 'acct-msg' }, '폼 데이터가 없어 CP 를 계산할 수 없어요')),
    el('div', { class: 'plan-mon-actions' },
      el('button', { class: `uchip${picked ? ' on' : ''}`, onclick: () => togglePlanCompare(mon) }, picked ? '☑ 비교' : '☐ 비교'),
      el('button', { class: 'uchip', onclick: () => openPlanMonEditor(mon) }, '수정'),
      el('button', { class: 'uchip admin-act danger', onclick: () => {
        if (!confirm(`${planMonName(mon)} (Lv ${mon.level}) 를 지울까요?`)) return;
        planDeleteMon(mon.id);
        _planCompare = _planCompare.filter((id) => id !== mon.id);
        render();
      } }, '삭제')));
}

// 비교 선택: 같은 종(도감번호)끼리만 두 개까지. 둘이 모이면 바로 비교 팝업
function togglePlanCompare(mon) {
  if (_planCompare.includes(mon.id)) _planCompare = _planCompare.filter((id) => id !== mon.id);
  else {
    const other = planMons().find((entry) => entry.id === _planCompare[0]);
    if (other && dexOf(other.sprite) !== dexOf(mon.sprite)) _planCompare = [mon.id];  // 다른 종을 고르면 새로 시작
    else _planCompare = [..._planCompare.slice(-1), mon.id];
  }
  render();
  if (_planCompare.length === 2) {
    const [a, b] = _planCompare.map((id) => planMons().find((entry) => entry.id === id));
    if (a && b) openPlanCompare(a, b);
  }
}

function renderPlanCollection() {
  const loggedIn = authEnabled() && AUTH.status === 'ok';
  // 상세 팝업에서 넘어온 프리필 (#/plan/collection?add=<sprite>&shadow=1) — 한 번 열고 주소에서 지운다
  const params = state.planParams;
  if (params?.get('add')) {
    const prefill = { sprite: Number(params.get('add')), shadow: params.get('shadow') === '1' };
    state.planParams = null;
    try { history.replaceState(null, '', '#/plan/collection'); } catch {}
    setTimeout(() => openPlanMonEditor(null, prefill), 0);
  }

  const mons = planMons();
  const counts = Object.fromEntries(PLAN_STATUSES.map((status) => [status, mons.filter((mon) => mon.status === status).length]));
  const shown = (_planFilter === 'all' ? mons : mons.filter((mon) => mon.status === _planFilter))
    .slice().sort((a, b) => planMonName(a).localeCompare(planMonName(b), 'ko') || planMonCp(b) - planMonCp(a));

  const addButton = el('button', { class: 'drawer-item plan-add', onclick: () => openPlanMonEditor(null) }, '➕ 개체 추가');
  if (!loggedIn) {
    $content.append(
      el('p', { class: 'dex-hint' },
        !authEnabled() ? '이 빌드는 로그인 기능이 꺼져 있어 저장이 안 됩니다. 개체 추가를 눌러 CP 계산만 해 볼 수 있어요.'
          : AUTH.status === 'pending' ? '⏳ 승인 대기 중 — 승인되면 개체를 계정에 저장할 수 있어요. 계산은 지금도 됩니다.'
          : '헤더의 👤 로 로그인하면 개체를 계정에 저장하고 어느 기기에서든 같은 목록을 봅니다. 계산은 로그인 없이도 됩니다.'),  // v2.15.1 로그인 버튼은 헤더 👤 하나
      addButton);
  } else {
    $controls.append(chips([{ id: 'all', label: `전체 ${mons.length}` }, ...PLAN_STATUSES.map((status) => ({ id: status, label: `${status} ${counts[status]}` }))], _planFilter, (id) => {
      _planFilter = id;
      render();
    }));
    $content.append(addButton);
    if (!mons.length) {
      $content.append(el('p', { class: 'dex-hint' }, '아직 저장한 개체가 없어요. 도감 상세 팝업의 "➕ 내 개체로 저장"을 누르거나 위 버튼으로 종을 검색해 추가하세요.'));
    } else if (!shown.length) {
      $content.append(el('p', { class: 'dex-hint' }, '이 상태의 개체가 없어요.'));
    } else {
      $content.append(el('div', { class: 'plan-mons' }, ...shown.map(planMonCard)));
    }
    if (_planCompare.length === 1) {
      const picked = mons.find((mon) => mon.id === _planCompare[0]);
      if (picked) $content.append(el('p', { class: 'dex-hint' }, `⚖️ ${planMonName(picked)} 와 비교할 같은 종 개체의 [☐ 비교] 를 누르세요. `,
        el('button', { class: 'uchip', onclick: () => { _planCompare = []; render(); } }, '선택 해제')));
    }
  }
  $content.append(el('p', { class: 'd-foot' }, '개체 = 실제로 가진 한 마리. 같은 종을 여러 마리 저장할 수 있고, [☐ 비교] 를 같은 종 두 마리에 누르면 CP·개체값·리그 도달을 나란히 봅니다. ★ 즐겨찾기(종 단위)와는 별개로 저장됩니다.'));
  $note.textContent = '내 포켓몬은 개체 단위(레벨 · 개체값 · 기술 · 상태)로 계정(Firestore users/{uid}.mons)에 저장됩니다. CP 는 종족값 × 레벨 × 개체값으로 계산하고, 리그 도달은 CP 상한을 넘지 않는 가장 높은 레벨입니다.';
}

// 상세 팝업의 "➕ 내 개체로 저장" — 이 폼(과 섀도우 여부)을 채운 채 내 포켓몬 추가 팝업으로
function planAddFromDetail(pokemon) {
  track('plan_add_from_detail', { mon: pokemon.name });
  const shadow = /^섀도우 /.test(pokemon.name);
  navigateHash(`#/plan/collection?add=${pokemon.sprite}${shadow ? '&shadow=1' : ''}`);
}
