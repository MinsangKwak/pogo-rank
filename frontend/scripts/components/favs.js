// ─────────────────────────────────────────────────────────────────────────────
// components/favs.js — ★ 즐겨찾기 페이지 (PvE / PvP 나눠 보기)
//
// 설계 요지 — 별은 하나, 축은 둘
//   ★(즐겨찾기)는 지금까지처럼 "내가 가진 종" 하나만 뜻한다. 도감 채우기 기준이 흔들리지 않도록
//   별을 PvE용·PvP용으로 쪼개지 않았다.
//   대신 "역할"이라는 별개 축을 두고, 그 값을 사람에게 묻는 대신 이미 계산해 둔 순위표에서 끌어낸다
//   (backend/roles_build.py → 전역 ROLES). 자동 분류가 틀렸을 때만 상세 팝업에서 손으로 고치고,
//   그 예외만 계정에 저장된다(AUTH.roles).
//
//   즉 이 화면은 "보유 목록을 두 갈래로 나눠 보는 뷰"이지, 새로운 저장 상태가 아니다.
//
// 역할 판정 순서
//   1) 사용자가 손으로 고친 값(AUTH.roles)이 있으면 그것이 최종
//   2) 없으면 ROLES.dexPve / ROLES.dexPvp 의 자동 분류
//   3) 둘 다 없으면 '기타'
//
// 제공하는 전역
//   roleWhereLabel(kind, whereKey)  : 표·리그 키를 한국어로 ('great' → 슈퍼리그, 'fire' → 불꽃 보스)
//   autoRoleOf(dex)                 : 종 단위 자동 분류 { pve, pvp } (각각 [키, 순위, 폼라벨] 또는 null)
//   roleOverrideKey(sprite)         : 상세 팝업이 쓸 '도감번호|폼라벨' 키
//   effectiveRoles(dex, formKey)    : 보정까지 반영한 최종 역할 Set ('pve' / 'pvp')
//   renderFavsPage()                : ★ 즐겨찾기 전체 페이지
//   roleToggleNode(sprite)          : 상세 팝업에 붙는 역할 보정 토글
//   initFavsMenu()                  : 로그인 상태에 따라 메뉴 항목 노출
//
// 의존하는 전역
//   el (dom.js) · sprite (components/sprite.js) · openDetailByDex · dexOf (components/detail.js)
//   AUTH · isFav · favBtn · setRole · signIn (components/auth.js)
//   ROLES (data.js, 빌드 주입) · DEX_DATA · TYPE_KO · LEAGUE_KO
// ─────────────────────────────────────────────────────────────────────────────

// 표·리그 키를 화면에 쓸 한국어로. PvE 표 키는 'overall' 또는 타입, PvP는 리그 키다
function roleWhereLabel(kind, whereKey) {
  if (kind === 'pvp') return `${LEAGUE_KO[whereKey] ?? whereKey}리그`;
  if (whereKey === 'overall') return '레이드 전체';
  return `${TYPE_KO[whereKey] ?? whereKey} 보스`;
}

// 종 단위 자동 분류. 값은 [표·리그 키, 순위, 폼라벨] 또는 null
function autoRoleOf(dex) {
  const roles = typeof ROLES === 'undefined' ? null : ROLES;
  const key = String(dex);
  return { pve: roles?.dexPve?.[key] ?? null, pvp: roles?.dexPvp?.[key] ?? null };
}

// 상세 팝업이 쓸 보정 키 — '도감번호|폼라벨'.
// 폼 라벨은 도감 폼 표(DEX_DATA.forms)의 name 이 그대로 라벨이다(기본 폼은 빈 문자열).
function roleOverrideKey(spriteId) {
  const dex = dexOf(spriteId);
  if (dex == null) return null;
  const label = DEX_DATA.forms?.[spriteId]?.name ?? '';
  return `${dex}|${label}`;
}

// 최종 역할. 보정이 있으면 보정이 이긴다(빈 배열이면 "둘 다 아님"으로 명시한 것)
function effectiveRoles(dex, formKey) {
  const override = formKey ? AUTH.roles?.[formKey] : null;
  if (Array.isArray(override)) return new Set(override);
  const auto = autoRoleOf(dex);
  const set = new Set();
  if (auto.pve) set.add('pve');
  if (auto.pvp) set.add('pvp');
  return set;
}

// 즐겨찾기 한 줄에 붙는 근거 요약: "레이드 전체 1위 (메가Y) · 마스터리그 35위"
function roleSummaryNode(dex) {
  const auto = autoRoleOf(dex);
  const parts = [];
  for (const [kind, entry] of [['pve', auto.pve], ['pvp', auto.pvp]]) {
    if (!entry) continue;
    const [whereKey, rank, formLabel] = entry;
    parts.push(el('span', { class: `fav-where ${kind}` },
      `${roleWhereLabel(kind, whereKey)} `, el('b', {}, `${rank}위`),
      formLabel ? el('em', {}, ` ${formLabel}`) : ''));
  }
  return parts.length ? el('div', { class: 'fav-wheres' }, ...parts) : el('div', { class: 'fav-wheres none' }, '순위권 밖');
}

// 정렬용 점수: 더 앞선 순위를 위로. 아무 데도 없으면 맨 뒤
function bestRankOf(dex) {
  const auto = autoRoleOf(dex);
  return Math.min(auto.pve ? auto.pve[1] : 9999, auto.pvp ? auto.pvp[1] : 9999);
}

// ★ 즐겨찾기 페이지
function renderFavsPage() {
  if (!authEnabled() || AUTH.status !== 'ok') {
    return el('div', { class: 'page-body' },
      el('p', { class: 'dex-hint' },
        AUTH.status === 'pending'
          ? '⏳ 승인 대기 중 — 승인되면 ★로 담은 포켓몬이 여기 모입니다.'
          : '로그인하면 ★로 담은 포켓몬을 PvE·PvP로 나눠 볼 수 있어요. ',
        AUTH.status === 'anon' ? el('button', { class: 'uchip', onclick: signIn }, 'Google로 로그인') : ''));
  }
  // 즐겨찾기한 도감번호를 화면에 쓸 항목으로 바꾼다 (이름이 없는 번호는 건너뛴다)
  const items = [...AUTH.favs]
    .map((dex) => ({ dex, name: DEX_DATA.names?.[dex], types: DEX_DATA.forms?.[dex]?.types ?? [] }))
    .filter((entry) => entry.name)
    .sort((first, second) => bestRankOf(first.dex) - bestRankOf(second.dex));

  const bucketOf = (dex) => effectiveRoles(dex, `${dex}|`);
  const groups = {
    all: items,
    pve: items.filter((entry) => bucketOf(entry.dex).has('pve')),
    pvp: items.filter((entry) => bucketOf(entry.dex).has('pvp')),
    etc: items.filter((entry) => bucketOf(entry.dex).size === 0),
  };
  // 세그먼트 선택 상태는 화면 전체 재렌더 없이 이 페이지 안에서만 바꾼다
  let current = 'all';
  const $list = el('div', { class: 'dex-list' });
  const draw = () => {
    const rows = groups[current];
    $list.replaceChildren(...(rows.length
      ? rows.map((entry) => el('button', { class: 'dex-row fav-row', onclick: () => openDetailByDex(entry.dex, true) },
          el('span', { class: 'dex-no' }, `#${String(entry.dex).padStart(4, '0')}`),
          sprite(entry.dex),
          el('div', { class: 'fav-main' },
            el('b', {}, entry.name),
            roleSummaryNode(entry.dex)),
          favBtn(entry.dex, 'dex-fav')))
      : [el('p', { class: 'dex-hint' }, current === 'etc' ? '순위권 밖인 즐겨찾기가 없어요.' : '이 분류에 해당하는 즐겨찾기가 아직 없어요.')]));
  };
  const $seg = seg([
    { id: 'all', label: `전체 ${groups.all.length}` },
    { id: 'pve', label: `PvE ${groups.pve.length}` },
    { id: 'pvp', label: `PvP ${groups.pvp.length}` },
    { id: 'etc', label: `기타 ${groups.etc.length}` },
  ], current, (id) => {
    current = id;
    track('sub_favs_' + id);   // 어떤 갈래를 많이 보는지 (탭 재배치 판단용)
    // seg()는 aria-pressed로 선택을 표시한다 — 화면 전체를 다시 그리지 않고 이 줄만 갱신한다
    const order = ['all', 'pve', 'pvp', 'etc'];
    [...$seg.children].forEach((button, index) => button.setAttribute('aria-pressed', String(order[index] === id)));
    draw();
  });
  draw();
  const cut = (typeof ROLES !== 'undefined' && ROLES?.cut) || { pve: 60, pvp: 100 };
  return el('div', { class: 'page-body' }, $seg, $list,
    el('p', { class: 'd-foot' },
      `분류는 순위표에서 자동으로 정합니다 — PvE는 19개 표 상위 ${cut.pve}위, PvP는 4리그 상위 ${cut.pvp}위 안에 들면 해당 갈래로 봅니다. `
      + '메가·섀도우 같은 폼 중 하나라도 들면 그 종이 포함되고, 괄호 없이 붙은 이름이 그 순위를 낸 폼입니다. '
      + '분류가 안 맞으면 포켓몬을 눌러 상세에서 직접 바꿀 수 있어요.'));
}

// 상세 팝업의 역할 보정 토글.
// 지금 값이 자동인지 손으로 고친 것인지 보이게 하고, [자동으로] 로 되돌릴 수 있게 한다.
function roleToggleNode(spriteId) {
  if (!authEnabled() || AUTH.status !== 'ok') return null;
  const dex = dexOf(spriteId);
  if (dex == null) return null;
  const formKey = roleOverrideKey(spriteId);
  const isOverridden = Array.isArray(AUTH.roles?.[formKey]);
  const active = effectiveRoles(dex, formKey);
  const toggle = (kind) => {
    const next = new Set(active);
    next.has(kind) ? next.delete(kind) : next.add(kind);
    setRole(formKey, [...next]);
    openDetailByDex(dex, true);   // 팝업을 다시 그려 버튼 상태를 반영
  };
  const button = (kind, label) => el('button', {
    class: `uchip role-chip${active.has(kind) ? ' on' : ''}`,
    onclick: (event) => {
      event.stopPropagation();
      toggle(kind);
    },
  }, label);
  return el('div', {},
    el('div', { class: 'tchips' }, button('pve', 'PvE'), button('pvp', 'PvP'),
      isOverridden
        ? el('button', { class: 'uchip', onclick: (event) => {
            event.stopPropagation();
            setRole(formKey, null);
            openDetailByDex(dex, true);
          } }, '자동으로 되돌리기')
        : ''),
    el('p', { class: 'd-foot' }, isOverridden
      ? '직접 지정한 값입니다. ★ 즐겨찾기 목록에서 이 분류로 묶입니다.'
      : '순위표에서 자동으로 정한 값입니다. 눌러서 바꾸면 이 포켓몬만 예외로 저장됩니다.'));
}

// 로그인·승인된 사용자에게만 메뉴에 ★ 즐겨찾기를 띄운다
function initFavsMenu() {
  const $item = document.getElementById('menu-favs');
  if (!$item) return;
  $item.hidden = !(authEnabled() && AUTH.status === 'ok');
  if (!$item.hidden) $item.textContent = `★ 즐겨찾기 ${AUTH.favs.size}`;
}
