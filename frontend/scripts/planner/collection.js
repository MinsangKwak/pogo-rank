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
//   planHundoGap(mon, level?) · planHundoLabel(mon)   2026-09-08 v2.25.0 유사백 판정
//   renderPlanCollection() · openPlanMonEditor(mon, prefill) · openPlanCompare(a, b) · planAddFromDetail(pokemon)
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · nameNode · splitFormName (components/name.js) · chips (components/chips.js)
//   openModal · closeModal (components/modal.js) · navigateHash (components/history.js) · track (track.js)
//   AUTH · authEnabled · authEmail · signIn (components/auth.js) · dexOf · maxPoolKind (components/detail.js)
//   calcCp (components/pages.js) · buildSearchIndex · monSearch (components/search.js) · DEX_DATA · TYPE_KO · LEAGUE_KO (data.js)
//   state · $content · $note · render (app.js)
// ─────────────────────────────────────────────────────────────────────────────

// 상태 뱃지 색 수식자 — PLAN_STATUSES 와 같은 순서 (a 육성 중 · b 완료 · c 교환 후보)
const PLAN_STATUS_MODS = ['a', 'b', 'c'];
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

// 유사백 판정 (2026-09-08 v2.25.0) — "이 개체가 백개체와 얼마나 차이 나나"를 CP 로 답한다.
//   개체값 퍼센트(15/15/15 대비 합)만으로는 실전 차이가 안 보인다. 공격 15 짜리 14/15/15 와
//   방어 15 짜리 15/14/15 는 같은 98% 지만 CP 도 쓰임새도 다르다. 그래서 같은 레벨에서
//   백개체 CP 와 내 CP 를 견줘 몇 % 인지, 몇 CP 모자란지를 함께 낸다.
//   레벨은 만렙(50)과 지금 레벨 둘 다 본다 — "지금 얼마나 아쉬운가"와 "다 키우면 어떤가"가 다른 질문이라서다.
//   반환값 { perfect, ratio, gap, level } · 폼 데이터가 없으면 null
function planHundoGap(mon, level) {
  const form = planMonForm(mon);
  if (!form) return null;
  const at = level ?? mon.level ?? 1;
  const [atk = 0, def = 0, hp = 0] = mon.ivs ?? [];
  const mine = calcCp(form, at, atk, def, hp);
  const perfect = calcCp(form, at, 15, 15, 15);
  if (!perfect) return null;
  return { perfect, mine, ratio: mine / perfect, gap: perfect - mine, level: at };
}

// 판정 문구 — 숫자만 주면 읽는 사람이 다시 계산해야 한다. 한 단어로 결론을 먼저 준다.
//   백개체(15/15/15) · 유사백(만렙 CP 가 백개체의 99% 이상) · 준수(97% 이상) · 그 밖
function planHundoLabel(mon) {
  const [atk = 0, def = 0, hp = 0] = mon.ivs ?? [];
  if (atk === 15 && def === 15 && hp === 15) return { kind: 'hundo', text: '백개체' };
  const top = planHundoGap(mon, 50);
  if (!top) return null;
  if (top.ratio >= 0.99) return { kind: 'near', text: '유사백' };
  if (top.ratio >= 0.97) return { kind: 'good', text: '준수' };
  return null;
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

  const body = el('div', { class: 'detail plan__editor' }, el('h2', {}, mon ? '✏️ 개체 수정' : '➕ 개체 추가'));
  const $pick = el('div', {});
  const $form = el('div', {});
  body.append($pick, $form);

  // 종 고르기: 기존 검색 색인 재사용. 다이맥스/거다이맥스 항목은 폼이 아니라 D-MAX 표의 줄이라 뺀다.
  // "섀도우 X" 를 고르면 섀도우 체크 + 기본 폼으로 저장한다
  const drawPick = () => {
    $pick.replaceChildren();
    if (draft.sprite != null) {
      const form = planMonForm(draft);
      $pick.append(el('div', { class: 'boss__selected' },
        sprite(draft.sprite),
        el('div', { class: 'boss__cp' }, el('b', {}, nameNode(planMonName(draft))),
          el('span', { class: 'meta' }, form ? `공격 ${form.atk} · 방어 ${form.def} · 체력 ${form.hp}${maxPoolKind(draft.sprite) ? ` · 맥스 배틀 ${maxPoolKind(draft.sprite) === 'G' ? '거다이맥스' : '다이맥스'} 가능` : ''}` : '폼 데이터 없음')),
        mon ? '' : el('button', { class: 'boss__clear', 'aria-label': '다른 종 고르기', onclick: () => { draft.sprite = null; drawPick(); drawForm(); } }, '✕')));
      return;
    }
    const $input = el('input', { class: 'boss__search', placeholder: '종 이름 검색 (예: 메가 리자몽, 섀도우 뮤츠)', autocomplete: 'off' });
    const $sugg = el('div', { class: 'boss__sugg' });
    $input.addEventListener('input', () => {
      $sugg.textContent = '';
      const query = $input.value.trim();
      if (!query) return;
      const candidates = buildSearchIndex().filter((entry) => !/^(다이맥스|거다이맥스) /.test(entry.name));
      for (const hit of monSearch(candidates, query, 8)) {
        // 2026-09-10 v2.47.0 헤더 검색 패널과 같은 줄(components/search.js monSuggestRow) —
        // 그림 · 이름 · 타입 알약 · 도감번호. 이름만 있던 줄은 물짱이 / 새도우 물짱이를 구분해 주지 못했다
        $sugg.append(monSuggestRow(hit, () => {
          draft.sprite = hit.sprite;
          draft.shadow = /^섀도우 /.test(hit.name);
          draft.fast = ''; draft.charged = '';
          drawPick(); drawForm();
        }));
      }
      if (!$sugg.childElementCount) $sugg.append(el('span', { class: 'sugg__none' }, '검색 결과가 없어요'));
    });
    $pick.append($input, $sugg);
    setTimeout(() => $input.focus(), 50);
  };

  const drawForm = () => {
    $form.replaceChildren();
    if (draft.sprite == null) return;
    const form = planMonForm(draft);
    if (!form) { $form.append(el('p', { class: 'detail__none-text' }, '이 폼은 능력치 데이터가 없어 저장할 수 없어요.')); return; }

    const $cpLine = el('p', { class: 'cp__inline' });
    const refreshCp = () => {
      const cp = planMonCp(draft);
      const maxCp = planMonCp(draft, 50);
      $cpLine.replaceChildren(el('b', {}, `CP ${cp.toLocaleString()}`),
        ` · 개체값 ${planIvPercent(draft.ivs)}% · 만렙 CP ${maxCp.toLocaleString()} (${Math.round(cp / maxCp * 100)}%)`);
    };
    const numberInput = (value, min, max, step, onChange) => {
      const input = el('input', { class: 'plan__num', type: 'number', inputmode: 'decimal', min: String(min), max: String(max), step: String(step), value: String(value) });
      input.addEventListener('input', () => {
        const parsed = Number(input.value);
        if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
        refreshCp();
      });
      return input;
    };
    const rowOf = (label, ...nodes) => el('div', { class: 'plan__row' }, el('em', {}, label), el('div', { class: 'plan__row-body' }, ...nodes));

    // 섀도우
    const $shadow = el('input', { type: 'checkbox' });
    $shadow.checked = draft.shadow;
    $shadow.addEventListener('change', () => { draft.shadow = $shadow.checked; });

    // 레벨 · 개체값
    const $level = numberInput(draft.level, 1, 50, 0.5, (value) => { draft.level = value; });
    const ivInputs = ['공격', '방어', '체력'].map((label, index) => el('label', { class: 'plan__iv' }, label,
      numberInput(draft.ivs[index], 0, 15, 1, (value) => { draft.ivs[index] = value; })));

    // CP 로 레벨 추정 — 게임 화면의 CP 를 그대로 넣으면 레벨을 맞춰 준다 (개체값을 먼저 맞춰야 정확)
    const $cpInput = el('input', { class: 'plan__num', type: 'number', inputmode: 'numeric', placeholder: 'CP' });
    const $cpHint = el('span', { class: 'meta' });
    const $cpButton = el('button', { class: 'uchip', onclick: () => {
      const cp = Number($cpInput.value);
      if (!cp) { $cpHint.textContent = '게임에 보이는 CP 를 넣으세요'; return; }
      const guess = planLevelFromCp(form, draft.ivs, cp);
      draft.level = guess.level;
      $level.value = String(guess.level);
      $cpHint.textContent = guess.diff === 0 ? `Lv ${guess.level} 로 맞췄어요` : `정확히 맞는 레벨이 없어요 — 가장 가까운 Lv ${guess.level} (CP 차이 ${guess.diff}). 개체값을 다시 봐 주세요`;
      refreshCp();
    } }, '레벨 추정');

    // 기술 — 이 폼이 배울 수 있는 목록에서 고른다. 모르면 비워 둔다
    const moveSelect = (moves, current, onChange) => {
      const select = el('select', { class: 'plan__select' }, el('option', { value: '' }, '모름 / 아직'));
      for (const [name, elite] of moves) select.append(el('option', { value: name }, name + (elite ? ' *' : '')));
      if (current && !moves.some(([name]) => name === current)) select.append(el('option', { value: current }, current));
      select.value = current || '';
      select.addEventListener('change', () => onChange(select.value));
      return select;
    };
    const $fast = moveSelect(form.fast ?? [], draft.fast, (value) => { draft.fast = value; });
    const $charged = moveSelect(form.charged ?? [], draft.charged, (value) => { draft.charged = value; });

    // 상태 · 메모
    const $status = el('select', { class: 'plan__select' }, ...PLAN_STATUSES.map((status) => el('option', { value: status }, status)));
    $status.value = draft.status;
    $status.addEventListener('change', () => { draft.status = $status.value; });
    const $memo = el('input', { class: 'boss__search plan__memo', placeholder: '메모 (예: 레이드용 2호기, 교환 받은 것)', value: draft.memo ?? '', maxlength: '80' });
    $memo.addEventListener('input', () => { draft.memo = $memo.value; });

    const $msg = el('p', { class: 'account__msg' });
    const save = () => {
      // 비로그인도 브라우저 체험 저장을 허용하고, 로그인 시 auth.js가 계정으로 이전한다.
      if (!planSaveMon({ ...draft, memo: (draft.memo ?? '').trim() })) { $msg.textContent = `개체는 ${PLAN_MAX_MONS}마리까지 저장할 수 있어요.`; return; }
      closeModal();
      if (state.appMode === 'plan') render();
      else navigateHash('#/plan/collection');
    };
    refreshCp();
    $form.append(
      rowOf('섀도우', el('label', { class: 'plan__check' }, $shadow, ' 섀도우 개체')),
      rowOf('레벨', $level, el('span', { class: 'meta' }, '1 ~ 50, 0.5 단위')),
      rowOf('개체값', el('div', { class: 'plan__ivs' }, ...ivInputs)),
      rowOf('CP 로 맞추기', $cpInput, $cpButton, $cpHint),
      $cpLine,
      rowOf('스피드', $fast),
      rowOf('차지', $charged),
      rowOf('상태', $status),
      rowOf('메모', $memo),
      $msg,
      el('div', { class: 'release__actions' },
        el('button', { class: 'release__mute', onclick: () => closeModal() }, '취소'),
        el('button', { class: 'release__ok', onclick: save }, mon ? '저장' : '내 포켓몬에 추가')),
      footNote('CP 는 저장하지 않고 종족값 × 레벨 × 개체값으로 계산해요. * 는 레거시 기술. 섀도우는 CP 가 같고 배틀에서만 공격 ×1.2 · 방어 ×0.83.'));
  };
  drawPick();
  drawForm();
  openModal(body);
}

// ── 비교 팝업 ─────────────────────────────────────────────────────────────────
// 같은 종 두 개체. 순위 평가가 아니라 "이 둘 중 어느 쪽을 키우나"의 숫자 근거만 나란히 둔다
// 2026-09-10 v2.47.0 표 아래 결론 한 줄. 숫자를 다 읽고 스스로 판단하라고 두는 대신 먼저 답한다.
//
// 무엇을 근거로 하나 — 순서대로 본다
//   (1) 섀도우가 한쪽만이면 **승자를 정하지 않는다**. 섀도우는 CP 에 안 잡히는 배틀 보정(공격 ↑ 방어 ↓)이
//       따로 있어서, 이 표의 숫자만으로 "더 강하다" 라고 말하면 틀린 말이 된다
//   (2) 만렙(Lv50) CP — 다 키웠을 때의 값. 육성 대상 고르기에는 이게 먼저다
//   (3) 지금 CP — 만렙이 같으면 지금 더 센 쪽이 즉시 전력이다
//   (4) 둘 다 같으면 같다고 말한다 (억지로 승자를 만들지 않는다)
function planCompareVerdict(first, second) {
  const name = (mon) => planMonName(mon);
  const line = (title, desc, kind = 'even') => el('div', { class: `plan__cmp-verdict plan__cmp-verdict--${kind}` },
    el('span', { class: 'plan__cmp-verdict-ico', 'aria-hidden': 'true' }, kind === 'even' ? '⚖️' : '🌱'),
    el('div', {}, el('b', {}, title), el('span', {}, desc)));
  if (!!first.shadow !== !!second.shadow) {
    return line('섀도우와 일반은 이 표만으로 못 골라요',
      '섀도우는 CP 에 안 잡히는 배틀 보정(공격 ↑ · 방어 ↓)이 따로 있어요. 레이드 딜러라면 섀도우가, 오래 버텨야 하면 일반이 유리한 편이에요.');
  }
  const topA = planMonCp(first, 50);
  const topB = planMonCp(second, 50);
  if (topA !== topB) {
    const win = topA > topB ? first : second;
    const side = topA > topB ? '왼쪽' : '오른쪽';
    return line(`${side}의 ${name(win)} 가 더 강한 개체예요!`,
      `다 키웠을 때(Lv 50) CP 가 ${Math.abs(topA - topB).toLocaleString()} 더 높아요. 육성 대상을 하나만 고른다면 이쪽이에요.`, 'win');
  }
  const nowA = planMonCp(first);
  const nowB = planMonCp(second);
  if (nowA !== nowB) {
    const side = nowA > nowB ? '왼쪽' : '오른쪽';
    const win = nowA > nowB ? first : second;
    return line(`${side}의 ${name(win)} 가 지금 더 강해요`,
      '다 키우면 같은 CP 가 되지만, 지금 CP 가 더 높아 바로 데려가 쓰기 좋아요. 강화 비용도 그만큼 덜 들어요.', 'win');
  }
  return line('두 개체가 같아요', '개체값도 도달 CP 도 같아요. 기술이나 메모처럼 표 밖의 기준으로 고르세요.');
}

function openPlanCompare(first, second) {
  track('plan_compare', { mon: planMonName(first) });
  const form = planMonForm(first);
  const reachA = planLeagueReach(form, first.ivs);
  const reachB = planLeagueReach(form, second.ivs);
  const cell = (text, hi) => el('b', { class: hi ? 'is-high' : '' }, text);
  const row = (label, a, b, higherIsBetter = true) => {
    const numA = typeof a === 'number' ? a : null;
    const numB = typeof b === 'number' ? b : null;
    const hiA = numA != null && numB != null && (higherIsBetter ? numA > numB : numA < numB);
    const hiB = numA != null && numB != null && (higherIsBetter ? numB > numA : numB < numA);
    const text = (value) => value == null ? '—' : typeof value === 'number' ? value.toLocaleString() : value;
    return el('div', { class: 'cmp__row' }, el('em', {}, label), cell(text(a), hiA), cell(text(b), hiB));
  };
  const reachText = (reach) => reach ? `${reach.cp.toLocaleString()} (Lv ${reach.level})` : null;
  const reachNum = (reach) => reach ? reach.cp : null;
  // 2026-09-10 v2.47.0 표 머리는 이름만 남긴다 — 바로 위 카드 두 장이 그림·상태·개체값을 이미 보여 준다.
  // 같은 것을 두 번 그리면 표가 시작되는 자리가 어디인지 흐려진다. 메모는 카드에 없으므로 여기 남긴다
  const head = (mon) => el('div', { class: 'plan__cmp-head' }, el('b', {}, nameNode(planMonName(mon))), mon.memo ? el('span', { class: 'meta' }, mon.memo) : '');
  // 2026-09-10 v2.47.0 표 위에 카드 두 장 — 목업의 개체 비교 창. 표는 숫자를 견주는 자리고,
  // 카드는 "지금 무엇과 무엇을 견주고 있나"를 한눈에 준다. 왼쪽/오른쪽 색을 다르게 해 표의 두 칸과 짝지운다
  const cmpCard = (mon, side) => {
    const statusMod = PLAN_STATUS_MODS[PLAN_STATUSES.indexOf(mon.status)] || 'a';
    const hundo = planHundoLabel(mon);
    return el('div', { class: `plan__cmp-card plan__cmp-card--${side}` },
      sprite(mon.sprite),
      el('span', { class: `tag plan__status plan__status--${statusMod}` }, mon.status),
      el('b', { class: 'plan__cmp-name' }, nameNode(planMonName(mon))),
      el('span', { class: 'plan__cmp-sub' }, `Lv ${mon.level} · CP ${planMonCp(mon).toLocaleString()}`),
      el('span', { class: `plan__cmp-iv${hundo ? ' plan__cmp-iv--' + hundo.kind : ''}` },
        `개체값 ${(mon.ivs ?? []).join('/')} (${planIvPercent(mon.ivs)}%)`));
  };
  const body = el('div', { class: 'detail plan__cmp-body' },
    el('div', { class: 'plan__cmp-title' },
      el('h2', {}, '⚖️ 같은 종 개체 비교'),
      el('p', { class: 'plan__cmp-lead' }, '같은 종을 나란히 놓고 어느 개체가 더 좋은지 봐요.')),
    el('div', { class: 'plan__cmp-cards' }, cmpCard(first, 'a'), cmpCard(second, 'b')),
    el('div', { class: 'cmp plan__cmp' },
      el('div', { class: 'cmp__row cmp__head' }, el('em', {}, ''), head(first), head(second)),
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
    planCompareVerdict(first, second),
    footNote('굵은 값이 더 큰 쪽이에요. 리그 도달 = CP 상한을 넘지 않는 가장 높은 레벨의 CP. 이 표는 같은 종 안에서의 숫자 비교일 뿐 순위표 평가가 아니며, PvP 에서는 개체값이 낮아도 상한에 딱 맞는 개체가 유리할 수 있어요.'));
  openModal(body);
}

// ── 목록 화면 ─────────────────────────────────────────────────────────────────
let _planFilter = 'all';        // 상태 칩
let _planCompare = [];          // 비교로 고른 개체 id (최대 2)
// 2026-09-10 v2.47.0 비교를 눌렀는데 아무 일도 안 일어난 것처럼 보이던 문제 —
// 안내문을 목록 **아래**(문서 3,000px 지점)에 그려 화면 밖이었다. 이제 목록 위에 띄우고,
// 다른 종을 골라 짝이 깨진 경우에는 그 이유를 말한다
let _planCompareMsg = '';

// 2026-09-10 v2.47.0 목업(내 포켓몬 목록)대로 한 줄을 **정보 묶음 네 덩이**로 다시 짰다.
//   [순번] [그림] [이름·상태·타입·레벨/개체값] [CP] [주요 기술] [동작]
// 예전에는 Lv · 개체값 · CP · 기술이 한 문장으로 이어져 있어, 찾으려는 값을 눈이 매번 훑어야 했다.
// index 는 지금 보이는 목록 안의 순번이다(전체 통산 순위가 아니다) — 목업의 왼쪽 번호 배지와 같은 뜻
// 지금 고른 개체가 있고, 그 개체와 종이 다르면 true (짝이 될 수 없는 줄)
function planCompareBlocked(mon) {
  if (_planCompare.length !== 1 || _planCompare.includes(mon.id)) return false;
  const other = planMons().find((entry) => entry.id === _planCompare[0]);
  return !!other && dexOf(other.sprite) !== dexOf(mon.sprite);
}

function planMonCard(mon, index = 0) {
  const form = planMonForm(mon);
  const picked = _planCompare.includes(mon.id);
  const cp = planMonCp(mon);
  const maxKind = maxPoolKind(mon.sprite);
  const hundo = planHundoLabel(mon);     // v2.25.0 백개체 · 유사백 · 준수
  const gap = hundo ? planHundoGap(mon, 50) : null;
  const ivPercent = planIvPercent(mon.ivs);
  const types = form?.types ?? [];
  return el('div', { class: `plan__mon${picked ? ' is-picked' : ''}` },
    el('span', { class: 'plan__mon-no' }, String(index + 1)),
    sprite(mon.sprite),
    el('div', { class: 'plan__mon-main' },
      el('div', { class: 'row__name' }, nameNode(planMonName(mon)),
        el('span', { class: `tag plan__status plan__status--${PLAN_STATUS_MODS[PLAN_STATUSES.indexOf(mon.status)] || 'a'}` }, mon.status),
        hundo ? el('span', { class: `tag plan__hundo plan__hundo--${hundo.kind}`, title: gap ? `만렙 기준 백개체 CP ${gap.perfect.toLocaleString()} 의 ${Math.round(gap.ratio * 100)}% (${gap.gap.toLocaleString()} 차이)` : '' }, hundo.text) : ''),
      // 타입과 맥스 여부 — 목업의 이름 아래 한 줄. 타입 알약은 도감에서 쓰는 조각 그대로다
      types.length || maxKind
        ? el('div', { class: 'plan__mon-types' },
            ...types.map((typeName) => el('span', { class: 'dex__type', style: `--c: var(--t-${typeName})` },
              el('i', { class: 'dot', 'aria-hidden': 'true' }),
              el('b', {}, TYPE_KO[typeName] ?? typeName))),
            maxKind ? el('span', { class: 'plan__mon-max' }, maxKind === 'G' ? '✨ 거다이맥스 가능' : '✨ 다이맥스 가능') : '')
        : '',
      // 레벨과 개체값 — 개체값은 막대로도 그린다. 숫자 세 개보다 길이 하나가 먼저 읽힌다
      el('div', { class: 'plan__mon-lv' },
        el('b', {}, `Lv ${mon.level}`),
        el('span', { class: 'plan__mon-iv' }, `${(mon.ivs ?? []).join(' / ')} (${ivPercent}%)`)),
      el('div', { class: 'plan__mon-bar', role: 'img', 'aria-label': `개체값 ${ivPercent}%` },
        el('span', { style: `width: ${ivPercent}%` })),
      mon.memo ? el('div', { class: 'plan__memo-line' }, mon.memo) : '',
      form ? '' : el('div', { class: 'account__msg' }, '폼 데이터가 없어 CP 를 계산할 수 없어요')),
    el('div', { class: 'plan__mon-cp' }, el('em', {}, 'CP'), el('b', {}, cp.toLocaleString())),
    el('div', { class: 'plan__mon-moves' },
      el('em', {}, '주요 기술'),
      el('div', { class: 'plan__mon-move-list' },
        el('span', { class: 'plan__move' }, el('b', {}, mon.fast || '스피드 모름'), el('i', {}, '노말')),
        el('span', { class: 'plan__move' }, el('b', {}, mon.charged || '차지 모름'), el('i', {}, '스페셜')))),
    el('div', { class: 'plan__mon-actions' },
      // 한 마리를 고른 상태에서 다른 종의 [비교] 는 짝이 될 수 없다 — 눌러도 되지만(새로 시작한다)
      // 지금 짝이 되는 줄이 어느 것인지 보이도록 흐리게 둔다
      uchip(picked ? '☑ 비교' : '☐ 비교', () => togglePlanCompare(mon), {
        on: picked,
        class: planCompareBlocked(mon) ? 'is-offpair' : '',
        title: planCompareBlocked(mon) ? '다른 종이라 지금 고른 개체와는 비교할 수 없어요' : '같은 종 두 마리를 골라 나란히 비교',
      }),
      uchip('수정', () => openPlanMonEditor(mon)),
      el('button', { class: 'uchip admin__act is-danger', onclick: () => {
        if (!confirm(`${planMonName(mon)} (Lv ${mon.level}) 를 지울까요?`)) return;
        planDeleteMon(mon.id);
        _planCompare = _planCompare.filter((id) => id !== mon.id);
        render();
      } }, '삭제')));
}

// 비교 선택: 같은 종(도감번호)끼리만 두 개까지. 둘이 모이면 바로 비교 팝업
function togglePlanCompare(mon) {
  _planCompareMsg = '';
  if (_planCompare.includes(mon.id)) _planCompare = _planCompare.filter((id) => id !== mon.id);
  else {
    const other = planMons().find((entry) => entry.id === _planCompare[0]);
    if (other && dexOf(other.sprite) !== dexOf(mon.sprite)) {
      // 비교표는 앞 개체의 종족값으로 두 칸을 다 계산한다(openPlanCompare 의 form) — 다른 종을 나란히 놓으면
      // 숫자가 통째로 틀린다. 그래서 새로 시작하되, **왜 짝이 풀렸는지**를 말한다.
      // 예전에는 조용히 새로 시작해서, 누른 사람에게는 "눌렀는데 아무 일도 안 일어난" 화면이었다
      const [nameA, nameB] = [planMonName(other), planMonName(mon)];
      _planCompareMsg = `${nameA}${koParticle(nameA, 'wa')} ${nameB}${koParticle(nameB, 'eun')} 다른 종이라 나란히 비교할 수 없어요. ${nameB}${koParticle(nameB, 'ro')} 다시 시작해요.`;
      _planCompare = [mon.id];
    } else {
      _planCompare = [..._planCompare.slice(-1), mon.id];
    }
  }
  render();
  // 다시 그린 뒤 안내 바를 화면 안으로 — 목록을 스크롤해 내려간 상태에서 눌렀다면 바는 위쪽에 있다.
  // 이 스크롤이 없으면 "눌렀는데 아무 반응이 없다" 로 보인다 (v2.47.0 이전의 실제 증상)
  requestAnimationFrame(() => document.querySelector('.plan__cmp-bar')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
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

  const addButton = el('button', { class: 'drawer__item plan__add', onclick: () => openPlanMonEditor(null) }, '➕ 개체 추가');
  if (!loggedIn) {
    $content.append(
      el('p', { class: 'dex__hint' },
        !authEnabled() ? 'CP 계산만 해 볼 수 있어요. 이 빌드는 로그인 기능이 꺼져 있어 저장이 안 돼요.'
          : AUTH.status === 'pending' ? '⏳ 승인 대기 중 — 계산은 지금도 돼요. 승인되면 개체를 계정에 저장할 수 있어요.'
          : '계산은 로그인 없이도 돼요. ☰ 메뉴 맨 위 "👤 마이페이지" 에서 로그인하면 개체를 계정에 저장해 어느 기기에서든 같은 목록을 봐요.'),  // v2.29.0 로그인 진입점은 ☰ 메뉴 계정 카드 하나 (헤더 👤 제거)
      addButton);
  } else {
    $controls.append(chips([{ id: 'all', label: `전체 ${mons.length}` }, ...PLAN_STATUSES.map((status) => ({ id: status, label: `${status} ${counts[status]}` }))], _planFilter, (id) => {
      _planFilter = id;
      render();
    }));
    $content.append(addButton);
    // 2026-09-10 v2.47.0 비교 안내는 **목록 위**에 둔다. 목록 아래에 있던 예전 자리는
    // 개체가 몇 마리만 넘어도 화면 밖이라, 누른 사람에게는 아무 반응이 없는 것과 같았다
    if (_planCompareMsg || _planCompare.length === 1) {
      const picked = mons.find((mon) => mon.id === _planCompare[0]);
      const bar = el('div', { class: `plan__cmp-bar${_planCompareMsg ? ' is-warn' : ''}` },
        el('span', { class: 'plan__cmp-bar-ico', 'aria-hidden': 'true' }, _planCompareMsg ? '⚠' : '⚖️'),
        el('span', { class: 'plan__cmp-bar-text' }, _planCompareMsg
          ? _planCompareMsg
          : picked ? `${planMonName(picked)}${koParticle(planMonName(picked), 'wa')} 비교할 **같은 종** 개체의 [☐ 비교] 를 누르세요.` : ''),
        uchip('선택 해제', () => { _planCompare = []; _planCompareMsg = ''; render(); }));
      // 별표 두 개는 강조 표시라 그대로 두면 글자로 보인다 — 노드로 바꿔 굵게 만든다
      const $text = bar.querySelector('.plan__cmp-bar-text');
      if ($text.textContent.includes('**')) {
        const [before, strong, after] = $text.textContent.split('**');
        $text.replaceChildren(before, el('b', {}, strong), after);
      }
      $content.append(bar);
    }
    if (!mons.length) {
      $content.append(hintNote('아직 저장한 개체가 없어요. 도감 상세 팝업의 "➕ 내 개체로 저장"을 누르거나 위 버튼으로 종을 검색해 추가하세요.'));
    } else if (!shown.length) {
      $content.append(hintNote('이 상태의 개체가 없어요.'));
    } else {
      $content.append(el('div', { class: 'plan__mons' }, ...shown.map((mon, index) => planMonCard(mon, index))));
    }
  }
  $content.append(footNote('개체 = 실제로 가진 한 마리. 같은 종을 여러 마리 저장할 수 있고, [☐ 비교] 를 같은 종 두 마리에 누르면 CP·개체값·리그 도달을 나란히 봐요. ★ 즐겨찾기(종 단위)와는 별개로 저장돼요.'));
  $note.textContent = '내 포켓몬은 개체 단위(레벨 · 개체값 · 기술 · 상태)로 계정(Firestore users/{uid}.mons)에 저장돼요. CP 는 종족값 × 레벨 × 개체값으로 계산하고, 리그 도달은 CP 상한을 넘지 않는 가장 높은 레벨이에요.';
}

// 상세 팝업의 "➕ 내 개체로 저장" — 이 폼(과 섀도우 여부)을 채운 채 내 포켓몬 추가 팝업으로
function planAddFromDetail(pokemon) {
  track('plan_add_from_detail', { mon: pokemon.name });
  const shadow = /^섀도우 /.test(pokemon.name);
  navigateHash(`#/plan/collection?add=${pokemon.sprite}${shadow ? '&shadow=1' : ''}`);
}
