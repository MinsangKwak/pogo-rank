// 포켓몬 상세 팝업: 요약 · 배틀 정보 · 진화 세 탭 + CP 계산기 화면 + 하단 고정 버튼
//
// [역할]
// 순위표·검색·도감 어디서든 포켓몬 하나를 눌렀을 때 뜨는 상세의 내용을 조립한다.
// 2026-09-16 v3.50.0 재설계 — 한 줄로 길게 쌓던 섹션을 "필요한 정보로 바로 가는" 구조로 바꿨다.
//   요약      큰 그림 · CP · 포획 CP · 배울 수 있는 기술
//   배틀 정보  약점·내성 · 활용 순위 · 보스로 만났을 때 추천 후보
//   진화      진화 계열 — 누르면 **같은 창에서** 그 포켓몬으로 바뀐다 (← 로 돌아오면 보던 탭·스크롤 그대로)
//   하단 고정  [포켓몬 도감](팝업을 닫고 도감으로) · [CP 계산기](팝업 안 계산기 화면 — 숫자 입력 · ± · 레벨 프리셋)
// PC(≥1100px)는 왼쪽에 포켓몬 정보를 고정하고 오른쪽 내용만 바뀌는 두 열 팝업이다.
// v2.36.0 의 오른쪽 고정 패널은 쓰지 않는다 (components/modal.js useDetailPanel 참고).
//
// [이 파일이 제공하는 전역]
// - openDetail(pokemon, isDex, from)  : 상세 팝업을 새로 연다 (row.js · search.js · views/max.js 에서 호출)
// - openDetailByDex(dexNumber, isDex) : 도감번호만으로 상세 팝업을 연다 (pages.js 도감 목록에서 호출)
// - openDetailBySprite(spriteId, from): 스프라이트 id 만으로 연다 (#/mon/<id> 딥링크)
// - detailSwitch(pokemon, isDex, from): 열린 팝업 **안에서** 다른 포켓몬으로 바꾼다 (진화 · 추천 후보)
// - detailBack()                      : 바꾸기 전 포켓몬으로 돌아간다 (탭 · 스크롤 · 계산기 입력값 복원)
// - dexOf(spriteId)             : 스프라이트 id → 도감번호
// - typeChipEl(typeName, extraText) : 타입 칩(색 점 + 한글 타입명 + 부가 텍스트)
// - typeMultAgainst(atkType, defTypes) : 방어 타입 조합에 대한 공격 타입 배율 (views/ifsolo.js 도 사용)
// - detailSection(title, node)  : 제목 있는 섹션 래퍼
// - cpOf / cpNode / statsNode / matchupNode / matchupCols / movesNode /
//   usageNode / counterNode / evoNode / megaMonNode / megaCompareNode /
//   hexNode / svgEl / detailCpCalc : 팝업 각 블록을 만드는 조립 함수들
//
// [의존하는 전역 · 데이터]
// - el() (dom.js) · sprite() (components/sprite.js) · track() (track.js) · openModal() (components/modal.js)
// - navigateHash() (components/history.js) · routeIdOf() · routeHash() (router.js) — 하단 [포켓몬 도감]
// - authEnabled() (components/auth.js) — 로그인한 빌드에서만 [＋ 내 포켓몬]
// - calcCp() (components/pages.js) — CP 계산기
// - koParticle() (components/name.js) — "○○로 돌아가기" 조사
// - DEX_DATA (data.js): names / forms / evo / megas / chart / dex / cpm
// - VALUE_DATA.usage_places · usage · meter (data.js): 이름별 등재 내역 · 활용처 상위 80 · PvE/PvP 점수
// - TYPE_KO · LEAGUE_KO (data.js): 타입·리그 한글 이름
// - DMAX_DATA (data.js, 선택): 맥스 보스별 추천 카운터 (없는 빌드도 있어 typeof 로 방어)
// - SHEET_DATA.pve · PVE_DATA (data.js): 레이드 보스 카운터 — 공격 타입별 레이드 성능표
// - MAX_POOL (data.js, 선택): 맥스 배틀에서 잡을 수 있는 종 (스프라이트 id → 'G' 거다이맥스 · 'D' 다이맥스)

// 스프라이트 id → 도감번호 (기본 폼은 id가 곧 도감번호)
// 메가·리전 폼 등은 10000 이상의 별도 id를 쓰므로 DEX_DATA.dex 매핑으로 원종 번호를 찾는다.
function dexOf(spriteId) {
  const parsedId = parseInt(spriteId, 10);
  if (!Number.isFinite(parsedId)) return null;
  return DEX_DATA.dex[parsedId] ?? (parsedId < 10000 ? parsedId : null);
}

// 팝업 안의 한 블록: <section class="detail__sec"><h3>제목</h3>내용</section>
function detailSection(title, node) {
  return el('section', { class: 'detail__sec' }, el('h3', {}, title), node);
}

// 타입 칩: 타입 색 점 + 한글 타입명 (+ 배율 같은 부가 텍스트는 <small> 로 뒤에 붙인다)
function typeChipEl(typeName, extraText) {
  const chip = el('span', { class: 'tchips__item' }, el('span', { class: 'dot', style: `--c: var(--t-${typeName})` }), TYPE_KO[typeName] ?? typeName);
  if (extraText) chip.append(el('small', {}, extraText));
  return chip;
}

// 이 포켓몬(방어 측)에 대한 공격 타입 배율
// 복합 타입은 각 타입의 배율을 곱한다 (예: 1.6 × 1.6 = 2.56 / 1.6 × 0.625 = 1)
function typeMultAgainst(atkType, defTypes) {
  let multiplier = 1;
  for (const defType of defTypes) multiplier *= (DEX_DATA.chart[atkType]?.[defType] ?? 1);
  return multiplier;
}

// 2026-09-06 v2.9.0 공유 링크 — 이 포켓몬 상세로 바로 열리는 주소 (#/mon/<스프라이트 id>)
function monShareUrl(spriteId) {
  return `${location.origin}${location.pathname}#/mon/${spriteId}`;
}

// 🔗 공유 버튼: Web Share가 되는 기기(대부분의 폰)는 공유 시트, 아니면 클립보드 복사 후 "복사됨 ✓" 표시
// 2026-09-16 v3.50.0 넓은 화면에서는 아이콘 옆에 '링크 복사' 글자가 붙는다 (좁은 화면은 CSS 가 글자를 감춘다)
function shareBtn(pokemon) {
  const $icon = el('span', { class: 'detail__share-icon' }, '🔗');
  const $label = el('span', { class: 'detail__share-text' }, '링크 복사');
  const button = el('button', { class: 'detail__share', 'aria-label': '링크 공유', title: '이 포켓몬 링크 공유' }, $icon, $label);
  const copied = () => {
    button.classList.add('is-copied'); $icon.textContent = '✓'; $label.textContent = '복사됨 ✓';
    setTimeout(() => { button.classList.remove('is-copied'); $icon.textContent = '🔗'; $label.textContent = '링크 복사'; }, 1500);
  };
  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    const url = monShareUrl(pokemon.sprite);
    track('share', { mon: pokemon.name });  // GA4: 공유 시도 — 링크로 들어온 detail_open(from=link)과 짝을 이룬다
    try {
      if (navigator.share) await navigator.share({ title: `${pokemon.name} — moncamp`, url });
      else { await navigator.clipboard.writeText(url); copied(); }
    } catch (error) {
      // 공유 시트를 취소한 경우는 조용히, 그 외(권한 등)는 클립보드로 한 번 더
      if (error?.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(url); copied(); } catch {}
    }
  });
  return button;
}

// 2026-09-06 v2.9.0 스프라이트 id만으로 상세를 연다 (딥링크 #/mon/<id> 진입용).
// 검색 색인에 있으면 그 항목(폼 포함 이름·타입)을 쓰고, 없으면 도감 이름표로 만든다
function openDetailBySprite(spriteId, from) {
  // 2026-09-06 v2.10.0 섀도우·다이맥스는 일반 폼과 스프라이트 id 가 같다 — 색인에서 먼저 만난 항목(섀도우 갸라도스)이 아니라
  // 그 접두어가 없는 항목을 우선한다. 없으면(섀도우만 등재된 종) 첫 항목을 쓴다
  const candidates = typeof buildSearchIndex === 'function' ? buildSearchIndex().filter((pokemon) => Number(pokemon.sprite) === Number(spriteId)) : [];
  const found = candidates.find((pokemon) => !/^(섀도우|다이맥스|거다이맥스) /.test(pokemon.name)) ?? candidates[0] ?? null;
  if (found) return openDetail(found, false, from);
  const dex = dexOf(spriteId);
  const baseName = DEX_DATA.names?.[dex ?? spriteId];
  if (!baseName) return;  // 모르는 번호면 조용히 무시 (메인 화면만 보인다)
  const label = DEX_DATA.forms?.[spriteId]?.name ?? '';
  openDetail({ sprite: spriteId, name: label ? `${label} ${baseName}` : baseName, en: '', types: DEX_DATA.forms?.[spriteId]?.types ?? [] }, false, from);
}

// 2026-09-02 진화형을 누르면 그 포켓몬의 상세로 이동
// 2026-09-03 isDex: 도감에서 열면 능력치 육각형 포함, 일반(순위표·검색)에서는 기술만
function openDetailByDex(dexNumber, isDex) {
  openDetail({ sprite: dexNumber, name: DEX_DATA.names[dexNumber] ?? String(dexNumber), en: '', types: DEX_DATA.forms[dexNumber]?.types ?? [] }, isDex);
}

// 2026-09-04 메가/원시 진화 가능 종만 해당 — DEX_DATA.megas[dex] = [{sprite, label}, ...]
// 진화 줄 맨 끝에 붙는 메가 폼 버튼. 지금 보고 있는 폼이면 'now' 클래스로 강조한다.
function megaMonNode(dex, entry, curSprite, isDex) {
  const spriteId = entry.sprite;
  const name = `${entry.label} ${DEX_DATA.names[dex] ?? dex}`;
  // 2026-09-14 v3.31.0 미출시 폼은 '미구현' 을 달아 밝힌다 — 지우지는 않는다(게임마스터에 종족값이 있어 볼 수는 있다)
  const unreleased = entry.rel === false;
  // 2026-09-16 v3.50.0 새 팝업이 아니라 열린 창 안에서 바뀐다 — ← 로 돌아올 수 있다
  return el('button', { class: `evo__mon form-tag--mega${spriteId === curSprite ? ' is-now' : ''}${unreleased ? ' is-unreleased' : ''}`,
    onclick: () => detailSwitch({ sprite: spriteId, name, en: '', types: DEX_DATA.forms[spriteId]?.types ?? [] }, isDex, 'evo') },
    sprite(spriteId), el('span', {}, entry.label), unreleased ? el('span', { class: 'tag dex__unrel' }, '미구현') : '');
}

// 진화 단계 블록: [1단계] → [2단계] → [3단계] (분기 진화는 한 단계에 여러 마리) → ⚡[메가 폼들]
// 진화 계열도 없고 메가도 없으면 안내 문구만 돌려준다.
function evoNode(dex, isDex, curSprite) {
  const family = DEX_DATA.evo[dex];
  const megas = DEX_DATA.megas?.[dex];
  const hasFamily = family && family.length >= 2;
  if (!hasFamily && !megas?.length) return el('p', { class: 'detail__none-text' }, '진화가 없는 포켓몬이에요.');
  const wrap = el('div', { class: 'evo' });
  if (hasFamily) family.forEach((stage, stageIndex) => {
    // 첫 단계 앞에는 화살표를 넣지 않는다
    if (stageIndex > 0) wrap.append(el('span', { class: 'evo__arrow' }, '→'));
    wrap.append(el('div', { class: 'evo__stage' }, ...stage.map((stageDex) => el('button', { class: `evo__mon${stageDex === dex && stageDex === curSprite ? ' is-now' : ''}`,
      onclick: () => detailSwitch({ sprite: stageDex, name: DEX_DATA.names[stageDex] ?? String(stageDex), en: '', types: DEX_DATA.forms[stageDex]?.types ?? [] }, isDex, 'evo') },
      sprite(stageDex), el('span', {}, DEX_DATA.names[stageDex] ?? stageDex)))));
  });
  if (megas?.length) {
    if (hasFamily) wrap.append(el('span', { class: 'evo__arrow' }, '⚡'));
    wrap.append(el('div', { class: 'evo__stage' }, ...megas.map((megaEntry) => megaMonNode(dex, megaEntry, curSprite, isDex))));
  }
  // 아래 안내 문구는 실제로 있는 것만 ' · ' 로 이어 붙인다
  // 2026-09-14 v3.31.0 원시회귀(그란돈·가이오가)를 '메가 진화' 라고 적고 있었다 — 게임에서 다른 것이다.
  // 라벨이 '원시' 인 폼만 있으면 원시회귀로, 섞여 있으면 둘 다 적는다
  const megaLabels = (megas ?? []).filter((entry) => entry.rel !== false).map((entry) => entry.label);
  const megaFoot = !megaLabels.length ? '' : megaLabels.every((label) => label === '원시')
    ? '⚡ 원시회귀 가능 — 누르면 원시회귀 스탯을 볼 수 있어요'
    : megaLabels.includes('원시') ? '⚡ 메가진화 · 원시회귀 가능 — 누르면 그 폼의 스탯을 볼 수 있어요'
      : '⚡ 메가진화 가능 — 누르면 메가진화 스탯을 볼 수 있어요';
  const foot = [hasFamily && '진화형을 누르면 이 창에서 그 포켓몬으로 바뀌어요', megaFoot].filter(Boolean);
  wrap.append(footNote(foot.join(' · ')));
  return wrap;
}

// 배울 수 있는 기술: 일반 기술(빠른 기술) / 스페셜 기술(차지 기술) 두 줄
// form.fast · form.charged 는 [기술명, 레거시여부] 쌍의 배열이라 레거시면 이름 뒤에 ' ★' 를 붙인다.
// 2026-09-16 v3.50.0 '스피드 · 차지' 를 게임 안 표기인 '일반 기술 · 스페셜 기술' 로, 레거시 표시는 '*' 에서 '★' 로
function movesNode(form) {
  const moveChip = ([name, elite]) => el('span', { class: `move-chip${elite ? ' is-legacy' : ''}` }, name + (elite ? ' ★' : ''));
  return el('div', {},
    el('div', { class: 'move-list__row' }, el('em', {}, '일반 기술'), el('div', { class: 'move-list' }, ...form.fast.map(moveChip))),
    el('div', { class: 'move-list__row' }, el('em', {}, '스페셜 기술'), el('div', { class: 'move-list' }, ...form.charged.map(moveChip))),
    // 레거시 기술이 하나라도 있을 때만 각주를 붙인다
    (form.fast.some((move) => move[1]) || form.charged.some((move) => move[1]))
      ? footNote('★ 레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득') : '',
  );
}

// 약점/내성 한 줄 버전 (구버전 레이아웃용 — 현재 팝업은 아래 matchupCols 를 쓴다)
// 표시 기준: 배율 1.5 이상이면 약점, 0.7 이하면 내성. 약점은 큰 순, 내성은 작은 순.
function matchupNode(types) {
  const rows = Object.keys(TYPE_KO).map((typeName) => [typeName, typeMultAgainst(typeName, types)]);
  const weak = rows.filter(([, multiplier]) => multiplier >= 1.5).sort((a, b) => b[1] - a[1]);
  const resist = rows.filter(([, multiplier]) => multiplier <= 0.7).sort((a, b) => a[1] - b[1]);
  // ×2.56 / ×1.6 처럼 보이도록 소수 둘째 자리까지 쓰되 끝의 0 은 지운다
  const chipList = (entries) => el('div', { class: 'tchips' }, ...entries.map(([typeName, multiplier]) => typeChipEl(typeName, `×${multiplier.toFixed(2).replace(/0$/, '')}`)));
  return el('div', {},
    el('div', { class: 'move-list__row' }, el('em', {}, '약점'), weak.length ? chipList(weak) : el('span', { class: 'detail__none-text' }, '없음')),
    el('div', { class: 'move-list__row' }, el('em', {}, '내성'), resist.length ? chipList(resist) : el('span', { class: 'detail__none-text' }, '없음')),
  );
}



// 종족값 막대 3개(공격·방어·체력). 320 을 100% 로 보고 막대 길이를 정한다.
function statsNode(form) {
  const MAX_STAT = 320;
  const bar = (label, value) => el('div', { class: 'stat-bar' },
    el('em', {}, label), el('span', { class: 'score-bar' }, el('i', { style: `width:${Math.min(100, value / MAX_STAT * 100)}%` })), el('b', {}, String(value)));
  return el('div', {}, bar('공격', form.atk), bar('방어', form.def), bar('체력', form.hp));
}

// 2026-09-04 포획 CP: "지금 잡은 개체가 최고인가"를 바로 확인할 수 있게 만든 블록
//
// 게임의 포획 개체 규칙 (레벨과 개체값 하한이 잡는 경로마다 정해져 있다)
//   레이드 보상   Lv20, 날씨부스트를 받으면 Lv25. 개체값 하한 10/10/10
//   맥스 배틀     Lv20 고정. 개체값 하한 10/10/10.
//                 다이맥스·거다이맥스 포획에는 날씨부스트가 없다 = Lv25가 존재하지 않는다
//   야생 스폰     Lv1~30, 날씨부스트 Lv6~35. 개체값 하한 0/0/0이라 "최저 CP"가 의미 없다
//   만렙          Lv50 (사탕·모래로 강화한 뒤의 상한)
// 그래서 레이드·맥스 배틀만 "최저(10/10/10) ~ 최고(15/15/15)" 구간을 함께 보여준다.
// 잡은 개체 CP가 굵은 숫자와 같으면 100%, 최저보다 낮을 수 없다.
// 실제 게임 레벨 캡의 CP 배율은 backend/dex_build.py 의 cpm 참고
// 2026-09-04 개체값을 지정해 CP 계산: floor(공격 × √방어 × √체력 × CPM² / 10), 최소 10
function cpAtIv(form, cpMultiplier, iv) {
  const attack = form.atk + iv;
  const defense = form.def + iv;
  const hp = form.hp + iv;
  return Math.max(10, Math.floor(attack * Math.sqrt(defense) * Math.sqrt(hp) * cpMultiplier * cpMultiplier / 10));
}
// 개체값 100%(15/15/15) CP — 기존 호출부가 그대로 쓰는 이름이라 유지한다
function cpOf(form, cpMultiplier) {
  return cpAtIv(form, cpMultiplier, 15);
}

// 이 종을 맥스 배틀에서 잡을 수 있는지 → 'G'(거다이맥스) · 'D'(다이맥스) · null
// MAX_POOL 이 없는 빌드(구버전 data.js)에서도 죽지 않도록 typeof 로 막는다
function maxPoolKind(spriteId) {
  if (typeof MAX_POOL === 'undefined' || !MAX_POOL) return null;
  return MAX_POOL[String(spriteId)] ?? null;
}

// 포획 CP 카드: [맥스 배틀 | 레이드 | 야생] 세그먼트로 경로를 고르면 그 경로의 "100% CP(굵게) + 최저 CP" 가 보인다
// 2026-09-16 v3.50.0 칩 네 줄을 한꺼번에 늘어놓던 표를 세그먼트로 — 한 번에 한 경로만 보면 숫자가 크게 들어간다.
//   state.catchSeg 에 고른 경로를 남겨 두어 진화 탐색에서 돌아와도 같은 경로가 열린다
function cpNode(form, spriteId, state = {}) {
  const cpm = DEX_DATA.cpm;
  if (!cpm) return '';
  const maxKind = maxPoolKind(spriteId);
  const segs = [maxKind ? ['max', '맥스 배틀'] : null, ['raid', '레이드'], ['wild', '야생']].filter(Boolean);
  if (!segs.some(([id]) => id === state.catchSeg)) state.catchSeg = segs[0][0];
  // 한 줄 = 조건(레벨 · 부스트) + 100% CP + 최저 CP(개체값 하한이 있는 경로만)
  const row = (label, sub, multiplier, floorIv) => el('div', { class: 'detail__catch-row' },
    el('div', { class: 'detail__catch-cond' }, el('em', {}, label), sub ? metaText(sub) : ''),
    el('div', { class: 'detail__catch-val' }, metaText('100% 기준'), el('b', {}, cpOf(form, multiplier).toLocaleString()),
      floorIv != null ? el('span', { class: 'detail__catch-floor' }, `최저 ${cpAtIv(form, multiplier, floorIv).toLocaleString()}`) : metaText('개체값 하한 없음')));
  const maxLabel = maxKind === 'G' ? '거다이맥스·다이맥스' : '다이맥스';
  const panes = {
    max: () => [row('Lv.20', `날씨 부스트 없음 · ${maxLabel}`, cpm.l20, 10)],
    raid: () => [row('평시 Lv.20', '개체값 10 이상', cpm.l20, 10), row('날씨 부스트 Lv.25', '개체값 10 이상', cpm.l25, 10)],
    wild: () => [row('평시 Lv.30', '', cpm.l30, null), row('날씨 부스트 Lv.35', '', cpm.l35, null)],
  };
  const $body = el('div', { class: 'detail__catch-body' });
  const $seg = el('div', { class: 'seg detail__catch-seg', role: 'tablist' });
  const show = (id) => {
    state.catchSeg = id;
    [...$seg.children].forEach((button, index) => button.setAttribute('aria-pressed', String(segs[index][0] === id)));
    $body.replaceChildren(...panes[id]());
  };
  for (const [id, label] of segs) $seg.append(el('button', { 'aria-pressed': 'false', onclick: () => show(id) }, label));
  show(state.catchSeg);
  return el('div', { class: 'detail__card detail__catch' },
    el('h3', {}, '포획 CP'),
    $seg, $body,
    el('details', { class: 'detail__acc detail__acc--catch' },
      el('summary', {}, '조건과 계산 기준 보기'),
      el('div', { class: 'detail__acc-body' },
        footNote('굵은 숫자가 개체값 100%(15/15/15) CP예요. 잡은 개체가 이 값이면 100%.'),
        footNote('레이드 보상은 개체값 10 이상이 확정이라 "최저" 가 있고, 야생은 하한이 없어 최저 CP를 적지 않아요.'),
        maxKind ? footNote('맥스 배틀은 날씨 부스트가 없어 항상 Lv20이라 레이드 평시와 같은 CP가 나와요.') : '')));
}

// 2026-09-04 메가X/메가Y가 둘 다 있는 종(현재 뮤츠·리자몽 등)만 — 좌우 비교 + 차이 자동 요약
// 왼쪽 열이 메가X, 오른쪽 열이 메가Y. 각 줄에서 더 높은 쪽에 'hi' 클래스를 붙여 강조한다.
// 둘 중 하나라도 없거나 폼 데이터가 없으면 null (호출부에서 섹션 자체를 생략)
function megaCompareNode(dex) {
  const megas = DEX_DATA.megas?.[dex];
  const megaX = megas?.find((entry) => entry.label === '메가X');
  const megaY = megas?.find((entry) => entry.label === '메가Y');
  if (!megaX || !megaY) return null;
  const formX = DEX_DATA.forms[megaX.sprite];
  const formY = DEX_DATA.forms[megaY.sprite];
  if (!formX || !formY) return null;
  const cpm = DEX_DATA.cpm;
  const row = (label, valueX, valueY, format = String) => el('div', { class: 'cmp__row' },
    el('em', {}, label),
    el('b', { class: valueX > valueY ? 'is-high' : '' }, format(valueX)), el('b', { class: valueY > valueX ? 'is-high' : '' }, format(valueY)));
  const typeChips = (types) => el('div', { class: 'tchips' }, ...types.map((typeName) => typeChipEl(typeName)));

  // 차이 자동 요약: 타입이 다르면 한 줄, 종족값은 항목별로 어느 쪽이 얼마나 높은지
  const diffs = [];
  const typesOnlyInX = formX.types.filter((typeName) => !formY.types.includes(typeName));
  const typesOnlyInY = formY.types.filter((typeName) => !formX.types.includes(typeName));
  if (typesOnlyInX.length || typesOnlyInY.length) diffs.push(`타입: 메가X ${formX.types.map((typeName) => TYPE_KO[typeName]).join('/')} ↔ 메가Y ${formY.types.map((typeName) => TYPE_KO[typeName]).join('/')}`);
  for (const [label, key] of [['공격', 'atk'], ['방어', 'def'], ['체력', 'hp']]) {
    if (formX[key] !== formY[key]) diffs.push(`${label} 종족값 ${formX[key] > formY[key] ? '메가X' : '메가Y'}가 ${Math.abs(formX[key] - formY[key])} 더 높음`);
  }

  return el('div', { class: 'cmp' },
    el('div', { class: 'cmp__row cmp__head' }, el('em', {}), el('b', {}, '메가X'), el('b', {}, '메가Y')),
    el('div', { class: 'cmp__row' }, el('em', {}, '타입'), typeChips(formX.types), typeChips(formY.types)),
    row('공격', formX.atk, formY.atk), row('방어', formX.def, formY.def), row('체력', formX.hp, formY.hp),
    cpm ? row('CP 만렙', cpOf(formX, cpm.l50), cpOf(formY, cpm.l50), (cp) => cp.toLocaleString()) : '',
    diffs.length ? footNote(diffs.join(' · ')) : '');
}

// 활용처를 PvP · 레이드 · 맥스 그룹으로 나눠 순위 칩으로 표시
// VALUE_DATA.usage[].places 의 place 는 'pvp:great' / 'pve:fire' / 'max:overall' 처럼
// '그룹:세부항목' 형식이라 ':' 앞을 그룹 키로, 뒤를 리그명·타입명으로 읽는다.
// 2026-09-06 v2.10.0 (QA-44) 활용처는 이름 단위로 합산되는데, 맥스 배틀 행의 이름이 '다이맥스 X'·'거다이맥스 X'로 갈리면서
// 일반 X 의 활용처에서 맥스 순위가 빠지게 됐다. 그래서 같은 종의 세 이름(X · 다이맥스 X · 거다이맥스 X)을 한꺼번에 모아
// 보여 주되, 맥스 칩에는 어느 쪽 순위인지 D/G 표시를 남긴다. 반대로 '거다이맥스 X' 로 열었을 때도 일반 X 의 PvP·레이드가 함께 보인다
// 2026-09-07 v2.13.0 (QA-42) 등재 내역은 빌드가 전 항목을 압축해 실은 VALUE_DATA.usage_places(이름 → [[곳, 순위]])에서 읽는다.
// usage(상위 80)만 보던 예전에는 81위 밖 포켓몬의 활용처가 팝업에서 통째로 빠졌다. 옛 빌드(usage_places 없음)에서는 usage 로 되돌아간다
function usagePlacesOf(name) {
  const compact = VALUE_DATA.usage_places;
  if (compact) return (compact[name] ?? []).map(([place, rank]) => ({ place, rank }));
  return (VALUE_DATA.usage ?? []).find((usageEntry) => usageEntry.name === name)?.places ?? [];
}
function usagePlacesFor(name) {
  const base = name.replace(/^(거다이맥스|다이맥스)\s+/, '');
  const variants = [[base, ''], [`다이맥스 ${base}`, 'D'], [`거다이맥스 ${base}`, 'G']];
  const places = [];
  for (const [variantName, mark] of variants) places.push(...usagePlacesOf(variantName).map((placement) => ({ ...placement, mark })));
  return places;
}
// 2026-09-07 v2.13.0 (QA-42) 순위표 행 "활용 N곳" 배지용 등장 횟수 — 상세 팝업 활용처 칩과 같은 목록의 길이라 숫자가 항상 일치한다
function usageCountFor(name) {
  return usagePlacesFor(name).length;
}
// 2026-09-13 v3.24.0 전 종 PvE·PvP 점수 — VALUE_DATA.meter[이름] = [PvE, PvP] (0~100, backend/value_build.py).
// 가성비 화면과 같은 산식이라 "PvP 89" 가 거기서도 여기서도 같은 뜻이다. 없으면(옛 빌드·미등재) null
function usageMeterOf(name) {
  const meter = typeof VALUE_DATA !== 'undefined' ? VALUE_DATA.meter?.[name] : null;
  if (!meter) return null;
  const [pve, pvp] = meter;
  return pve || pvp ? { pve, pvp } : null;
}
// 활용 순위: 순위가 좋은 순으로 한 줄씩 — 3위 안은 👑. 처음엔 3줄, [전체 순위 펼치기] 로 나머지
// 2026-09-16 v3.50.0 칩 무더기에서 줄 목록으로 — "어디서 몇 위" 가 한 줄에 하나씩 읽힌다
function usageNode(name) {
  const places = usagePlacesFor(name);
  if (!places.length) return null;
  const GROUP_KO = { pvp: 'PvP', pve: '레이드', max: '맥스' };
  const rows = places.map(({ place, rank, mark }) => {
    const [group, key] = place.split(':');
    // PvP 는 리그 이름, 레이드·맥스는 타입 이름 (overall 은 '전체'). 맥스는 D(다이맥스)/G(거다이맥스) 표시
    const where = group === 'pvp' ? `${LEAGUE_KO[key] ?? key}리그` : key === 'overall' ? '전체' : (TYPE_KO[key] ?? key);
    return { group, where, rank, mark };
  }).sort((a, b) => a.rank - b.rank);
  const rowNode = (row) => el('div', { class: `detail__rank-row${row.rank <= 3 ? ' is-top' : ''}` },
    el('span', { class: 'detail__rank-crown', 'aria-hidden': 'true' }, row.rank <= 3 ? '👑' : ''),
    // 갈래 · 자리를 따로 떨어진 글자 노드로 — 사전(i18n)이 '레이드' · '불꽃' · '하이퍼리그' 를 각각 찾는다
    el('span', { class: 'detail__rank-where' }, GROUP_KO[row.group] ?? row.group, ' · ', row.where,
      row.mark ? el('span', { class: 'tag' }, row.mark === 'G' ? '거다이맥스' : '다이맥스') : ''),
    el('b', { class: 'detail__rank-no' }, `${row.rank}위`));
  const SHOWN = 3;
  const $rest = el('div', { class: 'detail__rank-rest' }, ...rows.slice(SHOWN).map(rowNode));
  $rest.hidden = true;
  const $more = rows.length > SHOWN
    ? el('button', { class: 'detail__rank-more', 'aria-expanded': 'false' }, `전체 순위 펼치기 (${rows.length})`)
    : '';
  if ($more) $more.addEventListener('click', () => {
    $rest.hidden = !$rest.hidden;
    $more.setAttribute('aria-expanded', String(!$rest.hidden));
    $more.textContent = $rest.hidden ? `전체 순위 펼치기 (${rows.length})` : '접기';
  });
  return el('div', { class: 'detail__ranks' }, ...rows.slice(0, SHOWN).map(rowNode), $rest, $more,
    footNote('각 순위표 상위 30위 기준 · 3위 안은 👑'));
}

// 2026-09-02 가안 A: 이 포켓몬이 보스로 나올 때 추천 카운터
// 2026-09-07 v2.13.0 (QA-49) 배틀 유형별 참전 풀 구분.
//   맥스 배틀(다이맥스·거다이맥스 보스)에는 다이맥스·거다이맥스 가능 포켓몬만 들어갈 수 있고,
//   일반·전설·메가 레이드에는 전체 포켓몬(메가·섀도우 포함)이 들어간다.
//   예전에는 보스 종류와 무관하게 맥스 배틀 딜러(DMAX_DATA)만 보여줘 원시 가이오가 같은 레이드 보스에도
//   "맥스 배틀 수치" 기반 추천이 나왔다. 이제 보스 이름이 다이맥스/거다이맥스로 시작할 때만 맥스 딜러를 보여 주고,
//   그 밖의 보스는 레이드 성능표(시트, 없으면 자체 계산)에서 효과가 굉장한 공격 타입의 딜러를 고른다.
function bossBattleKind(name) {
  return /^(거다이맥스|다이맥스)\s/.test(name ?? '') ? 'max' : 'raid';
}
// 이 보스 타입 조합에 효과가 굉장한(×1.6 이상) 공격 타입을 배율 내림차순으로 최대 count개
function raidCounterTypes(bossTypes, count = 2) {
  return Object.keys(TYPE_KO)
    .map((typeName) => [typeName, typeMultAgainst(typeName, bossTypes)])
    .filter(([, multiplier]) => multiplier >= 1.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([typeName]) => typeName);
}
// 공격 타입별 레이드 성능표 상위 행을 모아 점수순으로 합치고 종(도감번호) 중복을 없앤다
//   시트(SHEET_DATA.pve)는 그 속성 최강 대비 %(score)라 타입이 달라도 견줄 수 있고,
//   자체 계산(PVE_DATA)은 같은 보스 가정의 절대 점수라 역시 타입 사이 비교가 된다. 둘을 섞지는 않는다
function raidDealerRows(attackTypes, count = 5) {
  const sheet = typeof SHEET_DATA !== 'undefined' ? SHEET_DATA?.pve : null;
  const useSheet = attackTypes.every((typeName) => Array.isArray(sheet?.[typeName]) && sheet[typeName].length);
  const source = useSheet ? sheet : (typeof PVE_DATA !== 'undefined' ? PVE_DATA : null);
  if (!source) return [];
  const merged = attackTypes.flatMap((typeName) => (source[typeName] ?? []).slice(0, 15).map((pokemon) => ({ ...pokemon, viaType: typeName })));
  merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const seen = new Set();
  const picked = [];
  for (const pokemon of merged) {
    const speciesKey = dexOf(pokemon.sprite) ?? pokemon.name;
    if (seen.has(speciesKey)) continue;
    seen.add(speciesKey);
    picked.push(pokemon);
    if (picked.length >= count) break;
  }
  return picked;
}
// 추천 후보 줄 목록 — 누르면 같은 창에서 그 포켓몬으로 바뀐다 (← 로 돌아올 수 있다)
function counterRecsNode(recs) {
  return el('div', { class: 'detail__recs' }, ...recs.map((counter) =>
    el('button', { class: 'detail__rec', onclick: (event) => { event.stopPropagation(); detailSwitch(counter, undefined, 'boss'); } },
      sprite(counter.sprite), el('span', { class: 'detail__rec-name' }, nameNode(counter.name)), el('span', { class: 'detail__rec-go', 'aria-hidden': 'true' }, '›'))));
}
// 반환값: { sub, node } — 부제(어느 배틀의 후보인지)까지 보스 종류에 따라 달라지므로 함께 돌려준다. 추천이 없으면 null
function counterNode(types, name) {
  if (bossBattleKind(name) === 'max') {
    // 맥스 배틀: 대표 타입(types[0]) 의 맥스 배틀 딜러 상위 5마리. DMAX_DATA 가 없는 빌드면 null
    const recs = (typeof DMAX_DATA !== 'undefined' ? DMAX_DATA[types[0]] : null)?.filter((pokemon) => !pokemon.unrel).slice(0, 5);   // 미구현은 추천하지 않는다 — 지금 데려갈 수 있는 것만
    if (!recs?.length) return null;
    return {
      sub: '맥스 배틀 추천 후보 — 다이맥스·거다이맥스만 참전',
      node: el('div', {}, counterRecsNode(recs),
        footNote(`${TYPE_KO[types[0]]} 속성 맥스 배틀 보스 기준 · 메가·원시·섀도우는 맥스 배틀에 참전할 수 없어 제외`)),
    };
  }
  const attackTypes = raidCounterTypes(types);
  if (!attackTypes.length) return null;
  const recs = raidDealerRows(attackTypes);
  if (!recs.length) return null;
  const typeLabel = attackTypes.map((typeName) => TYPE_KO[typeName]).join('·');
  return {
    sub: `레이드 추천 후보 — ${typeLabel} 딜러`,
    node: el('div', {}, counterRecsNode(recs),
      footNote(`일반·전설·메가 레이드는 전체 포켓몬 참전 · ${typeLabel} 타입 레이드 성능표 상위 (종 중복 제거)`)),
  };
}

// 2026-09-03 타입 상성: 약점 위 · 내성 아래, 뱃지 중첩 없이 평평한 칩(점+타입+배율)
// 표시 기준: 배율 1.5 이상이면 약점(큰 순 정렬), 0.7 이하면 내성(작은 순 정렬).
// 1.6 / 0.625 같은 값만 나오므로 그 사이(≈1)는 어느 쪽에도 넣지 않는다.
// 2026-09-06 v2.10.0 (QA-44) 이중약점(×2.56 — 두 타입 모두에 약함)은 '이중' 표시와 빨간 테두리로 구분하고,
// 이중내성·무효(×0.39)도 같은 방식으로 표시한다. 복합 타입 포켓몬에서 "뭘 들고 가야 하나"의 답이 바로 보이게.
function matchupChip(typeName, multiplier) {
  const double = multiplier >= 2.5 ? '이중' : multiplier <= 0.4 ? '이중' : '';
  const chip = typeChipEl(typeName, `×${+multiplier.toFixed(2)}${double ? ' ' + double : ''}`);
  if (multiplier >= 2.5) chip.classList.add('is-weak2');
  if (multiplier <= 0.4) chip.classList.add('is-resist2');
  return chip;
}
function matchupCols(types, spriteId) {
  const rows = Object.keys(TYPE_KO).map((typeName) => [typeName, typeMultAgainst(typeName, types)]);
  const chipList = (entries) => entries.length
    ? el('div', { class: 'tchips' }, ...entries.map(([typeName, multiplier]) => matchupChip(typeName, multiplier)))
    : el('p', { class: 'detail__none-text' }, '없음');
  const weak = rows.filter(([, multiplier]) => multiplier >= 1.5).sort((a, b) => b[1] - a[1]);
  const resist = rows.filter(([, multiplier]) => multiplier <= 0.7).sort((a, b) => a[1] - b[1]);
  const hasDouble = weak.some(([, multiplier]) => multiplier >= 2.5) || resist.some(([, multiplier]) => multiplier <= 0.4);
  const wrap = el('div', {},
    // 2026-09-10 v2.42.0 약점·내성을 각각 카드 한 장으로 — 칩만 두 줄로 늘어놓으면 어디까지가 약점이고
    // 어디부터 내성인지 훑을 때 섞였다. 카드에 옅은 색(경고/브랜드)을 깔아 덩이가 먼저 읽히게 한다
    el('div', { class: 'detail__matchrows' },
      el('div', { class: 'detail__match detail__match--weak' }, el('h3', {}, '약점 (더 큰 데미지)'), chipList(weak)),
      el('div', { class: 'detail__match detail__match--resist' }, el('h3', {}, '내성 (덜 받는 데미지)'), chipList(resist))),
    // 2026-09-12 v2.63.0 '🧭 상성 검색에서 딜러까지 보기' 버튼을 뗐다 — 그 화면을 접었다.
    // 위의 약점·내성 표가 곧 그 화면이 보여 주던 것이라, 여기서 더 갈 곳이 없다
    el('p', { class: 'detail__foot' },
      hasDouble ? '이중 = 두 타입 모두에 걸려 ×2.56(약점) / ×0.39(내성·무효)' : ''));
  return wrap;
}

// CP 계산기 화면: 이 포켓몬 고정, 레벨·개체값만 조절
// 2026-09-16 v3.50.0 슬라이더 넷에서 "숫자 직접 입력 · ± 버튼 · 레벨 프리셋" 으로.
//   inputs 는 호출부(팝업 상태)가 들고 있어 진화 탐색에서 돌아와도 입력값이 그대로다
function detailCpCalc(form, inputs) {
  const LEVEL_PRESETS = [20, 25, 30, 40, 50];
  const clamp = (value, min, max, step) => Math.min(max, Math.max(min, Math.round(value / step) * step));
  const $cp = el('b', { class: 'detail__calc-cp' });
  const $cpMeta = metaText('');
  const $cp50 = el('b', {});
  const $ivFoot = el('p', { class: 'detail__calc-iv-sum' });
  const fields = {};
  const update = () => {
    const cp = calcCp(form, inputs.level, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
    // 같은 개체값으로 Lv50 까지 올렸을 때의 CP — 지금 CP가 그 몇 %인지 보여준다
    const maxCp = calcCp(form, 50, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
    $cp.textContent = cp.toLocaleString();
    $cpMeta.textContent = `입력값 기준 · Lv.${inputs.level}`;
    $cp50.textContent = `${maxCp.toLocaleString()} (${Math.round(cp / maxCp * 100)}%)`;
    const ivPct = Math.round((inputs.attackIv + inputs.defenseIv + inputs.hpIv) / 45 * 100);
    $ivFoot.replaceChildren(el('b', {}, `개체값 ${ivPct}%`), ` · ${inputs.attackIv} / ${inputs.defenseIv} / ${inputs.hpIv}`);
    for (const [key, field] of Object.entries(fields)) field.sync();
  };
  // − [숫자] + 한 벌. 숫자 칸에 바로 적어도 되고, 범위를 벗어나면 가장 가까운 값으로 되돌린다
  const stepper = (key, min, max, step) => {
    const $input = el('input', { type: 'number', class: 'detail__calc-num', inputmode: 'decimal', min: String(min), max: String(max), step: String(step), 'aria-label': key });
    const set = (value) => { inputs[key] = clamp(Number.isFinite(value) ? value : inputs[key], min, max, step); update(); };
    $input.addEventListener('change', () => set(parseFloat($input.value)));
    $input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); $input.blur(); } });
    const $minus = el('button', { class: 'detail__calc-step', 'aria-label': '−', onclick: () => set(inputs[key] - step) }, '−');
    const $plus = el('button', { class: 'detail__calc-step', 'aria-label': '+', onclick: () => set(inputs[key] + step) }, '+');
    fields[key] = { sync: () => { $input.value = String(inputs[key]); $minus.disabled = inputs[key] <= min; $plus.disabled = inputs[key] >= max; } };
    return { node: el('div', { class: 'detail__calc-stepper' }, $minus, $input, $plus), set };
  };
  const level = stepper('level', 1, 50, 0.5);
  const $slider = el('input', { type: 'range', class: 'detail__calc-range', min: '1', max: '50', step: '0.5', 'aria-label': '레벨' });
  $slider.addEventListener('input', () => level.set(parseFloat($slider.value)));
  const $presets = el('div', { class: 'detail__calc-presets' }, ...LEVEL_PRESETS.map((preset) =>
    el('button', { class: 'detail__calc-preset', 'data-level': String(preset), onclick: () => level.set(preset) }, String(preset))));
  fields.levelExtra = { sync: () => {
    $slider.value = String(inputs.level);
    [...$presets.children].forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.level) === inputs.level)));
  } };
  const ivRow = (label, key) => {
    const field = stepper(key, 0, 15, 1);
    return el('div', { class: 'detail__calc-row' }, el('em', {}, label), field.node);
  };
  // 조작부를 전부 만든 뒤에 한 번 맞춘다 — 숫자 칸의 값·± 활성은 update() 가 채운다
  const node = el('div', { class: 'detail__calc-body' },
    el('div', { class: 'detail__card detail__calc-result' },
      el('h3', {}, '예상 CP'),
      el('div', { class: 'detail__calc-big' }, el('span', { class: 'detail__calc-cp-label' }, 'CP'), $cp, $cpMeta),
      el('div', { class: 'detail__calc-row detail__calc-row--max' }, el('em', {}, 'Lv.50 예상 CP'), $cp50)),
    el('div', { class: 'detail__card' },
      el('div', { class: 'detail__calc-row' }, el('h3', {}, '포켓몬 레벨'), level.node),
      $slider, $presets),
    el('div', { class: 'detail__card' },
      el('div', { class: 'detail__card-head' }, el('h3', {}, '개체값 (IV)'), metaText('각 0 – 15')),
      ivRow('공격 IV', 'attackIv'), ivRow('방어 IV', 'defenseIv'), ivRow('체력 IV', 'hpIv'),
      $ivFoot),
    footNote('내 개체의 레벨·개체값을 맞추면 지금 CP와 만렙까지의 여지가 보여요'));
  update();
  return node;
}


// 2026-09-03 능력치 육각형 복원(도감 요청): 종족값 3축 + CP·레이드·PvP 3축, 대표 타입 색
// SVG 는 createElement 가 아니라 createElementNS 로 만들어야 하므로 el() 대신 이 헬퍼를 쓴다.
function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [attrName, attrValue] of Object.entries(attrs)) node.setAttribute(attrName, attrValue);
  for (const child of children) node.append(child);
  return node;
}
// 능력치 육각형(레이더 차트).
// 6축 순서는 시계방향으로 공격 → 방어 → 레이드 → 체력 → CP → PvP.
// 각 축의 0~1 비율 기준: 종족값은 320, CP 는 5,500 을 만점으로 보고,
// 레이드·PvP 는 순위표 최고 순위를 rankScore() 로 점수화한다(1위=1.0, 33위 이하≈0.15, 미등재=0.08).
function hexNode(form, name, types) {
  const places = usagePlacesFor(name);  // 2026-09-06 v2.10.0 다이맥스·거다이맥스 이름 변형까지 합산
  // 'pvp' / 'pve' / 'max' 로 시작하는 등재 항목 중 가장 높은(숫자가 작은) 순위
  const bestRank = (prefix) => {
    const ranks = places.filter((placement) => placement.place.startsWith(prefix)).map((placement) => placement.rank);
    return ranks.length ? Math.min(...ranks) : null;
  };
  const rankScore = (rank) => (rank == null ? 0.08 : Math.max(0.15, 1 - (rank - 1) / 32));
  // 레이드 축은 레이드(pve)와 맥스(max) 중 더 높은 순위를 쓴다
  const raid = bestRank('pve') != null || bestRank('max') != null
    ? Math.min(bestRank('pve') ?? 99, bestRank('max') ?? 99) : null;
  const pvp = bestRank('pvp');
  const cp = DEX_DATA.cpm ? cpOf(form, DEX_DATA.cpm.l50) : null;
  // 2026-09-13 v3.24.0 레이드·PvP 축은 순위가 아니라 **점수**(0~100)로 그린다 (usageMeterOf · 가성비와 같은 산식).
  // 순위 기준은 "어느 순위표 30위 안에 드는가" 라, 대짱이처럼 메가·섀도우만 등재된 원종은 레이드 축이 미등재(0.08)로
  // 누웠다 — 실제로는 땅·물 보스에서 A 티어인데. 점수는 전 종에 있어 어디서나 같은 자로 잰다. 옛 빌드(점수표 없음)는 순위로
  const meter = usageMeterOf(name);
  const meterScore = (value) => (value ? Math.max(0.08, value / 100) : 0.08);
  const raidAxis = meter ? [meter.pve ? `${meter.pve}점` : '-', meterScore(meter.pve)] : [raid ? `${raid}위` : '-', rankScore(raid)];
  const pvpAxis = meter ? [meter.pvp ? `${meter.pvp}점` : '-', meterScore(meter.pvp)] : [pvp ? `${pvp}위` : '-', rankScore(pvp)];
  // [축 이름, 라벨에 쓸 값 문자열, 0~1 비율]
  const axes = [
    ['공격', String(form.atk), Math.min(1, form.atk / 320)],
    ['방어', String(form.def), Math.min(1, form.def / 320)],
    ['레이드', ...raidAxis],
    ['체력', String(form.hp), Math.min(1, form.hp / 320)],
    ['CP', cp ? cp.toLocaleString() : '-', cp ? Math.min(1, cp / 5500) : 0.08],
    ['PvP', ...pvpAxis],
  ];
  // 육각형 중심 좌표와 최대 반지름 (viewBox 300×236 기준)
  const CENTER_X = 150, CENTER_Y = 118, RADIUS = 76;
  // 축 번호(0~5)와 비율(0~1) → SVG 좌표.
  // 12시 방향(-90°)에서 시작해 축마다 60°(π/3)씩 시계방향으로 돈다.
  const pointAt = (axisIndex, ratio) => {
    const angle = -Math.PI / 2 + axisIndex * Math.PI / 3;
    return [CENTER_X + Math.cos(angle) * RADIUS * ratio, CENTER_Y + Math.sin(angle) * RADIUS * ratio];
  };
  // 눈금용 배경 육각형 — 바깥 테두리(ratio 1)만 조금 굵게
  const ring = (ratio) => svgEl('polygon', {
    points: axes.map((_, axisIndex) => pointAt(axisIndex, ratio).map((coord) => coord.toFixed(1)).join(',')).join(' '),
    fill: 'none', stroke: 'var(--line)', 'stroke-width': ratio === 1 ? 1.2 : 0.7 });
  // 채우기 색은 대표 타입(첫 번째 타입) 색
  const color = `var(--t-${types[0] ?? 'normal'})`;
  const svg = svgEl('svg', { viewBox: '0 0 300 236', class: 'hex__svg', role: 'img', 'aria-label': '능력치 육각형' },
    // 1/3 · 2/3 · 1 눈금 육각형
    ring(1 / 3), ring(2 / 3), ring(1),
    // 중심에서 각 꼭짓점으로 뻗는 축선
    ...axes.map((_, axisIndex) => svgEl('line', { x1: CENTER_X, y1: CENTER_Y, x2: pointAt(axisIndex, 1)[0], y2: pointAt(axisIndex, 1)[1], stroke: 'var(--line)', 'stroke-width': 0.7 })),
    // 실제 능력치 다각형
    svgEl('polygon', { points: axes.map((axis, axisIndex) => pointAt(axisIndex, axis[2]).map((coord) => coord.toFixed(1)).join(',')).join(' '),
      fill: color, 'fill-opacity': 0.22, stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    // 각 꼭짓점 점
    ...axes.map((axis, axisIndex) => {
      const [x, y] = pointAt(axisIndex, axis[2]);
      return svgEl('circle', { cx: x, cy: y, r: 3, fill: color });
    }),
    // 축 라벨(이름 + 값) — 반지름 1.24 위치에 두고, 좌우 위치에 따라 정렬 기준을 바꿔 글자가 잘리지 않게 한다
    ...axes.map((axis, axisIndex) => {
      const [x, y] = pointAt(axisIndex, 1.24);
      const anchor = Math.abs(x - CENTER_X) < 8 ? 'middle' : x > CENTER_X ? 'start' : 'end';
      return svgEl('text', { x, y: y - 2, 'text-anchor': anchor, class: 'hex__label' },
        svgEl('tspan', { class: 'hex__name' }, axis[0]),
        svgEl('tspan', { x, dy: 13, class: 'hex__val' }, axis[1]));
    }));
  svg.append(svgEl('title', {}, meter ? '종족값 320 · CP 5,500 기준 비율. 레이드/PvP 는 가성비와 같은 0~100 점수 (레이드 = 가장 잘 통하는 보스 3종 평균, PvP = 리그 상위 2개 평균)' : '종족값 320 · CP 5,500 기준 비율. 레이드/PvP는 도감 순위표 최고 순위'));
  return el('div', { class: 'hex' }, svg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-16 v3.50.0 팝업 안 화면 전환
//
// 팝업은 한 번에 한 포켓몬을 보여 주지만, 진화 계열·추천 후보를 누르면 **같은 창에서** 그 포켓몬으로 바뀐다.
// 떠난 화면은 DETAIL_NAV.stack 에 쌓아 두고, ← 로 돌아오면 보던 탭 · 스크롤 · 계산기 입력값 · 포획 CP 경로를
// 그대로 되살린다. 한 화면의 상태는 아래 detailState() 모양이다.
//   pokemon · isDex   무엇을 보는지
//   tab               'summary' | 'battle' | 'evo'
//   screen            'detail' | 'calc' (CP 계산기 화면)
//   scrolls           탭별 스크롤 위치 · calcScroll 계산기 스크롤 위치
//   calc              계산기 입력값 { level, attackIv, defenseIv, hpIv }
//   catchSeg          포획 CP 카드에서 고른 경로
// ─────────────────────────────────────────────────────────────────────────────
const DETAIL_NAV = { stack: [], current: null };
const DETAIL_TABS = [['summary', '요약'], ['battle', '배틀 정보'], ['evo', '진화']];

function detailState(pokemon, isDex) {
  return {
    pokemon, isDex, tab: 'summary', screen: 'detail',
    scrolls: { summary: 0, battle: 0, evo: 0 }, calcScroll: 0,
    calc: { level: 30, attackIv: 15, defenseIv: 15, hpIv: 15 },
    catchSeg: null,
  };
}
// 지금 팝업에 떠 있는 상세 본체 (없으면 null)
function detailMounted() {
  return document.querySelector('dialog.modal[open] .detail--mon');
}
// 떠나기 전에 화면에서 읽어야 하는 값(스크롤)만 상태에 옮겨 적는다 — 나머지는 조작할 때마다 이미 상태에 적혀 있다
function detailSnapshot() {
  const body = detailMounted();
  const state = DETAIL_NAV.current;
  if (!body || !state) return;
  state.scrolls[state.tab] = body.querySelector('.detail__scroll')?.scrollTop ?? 0;
  state.calcScroll = body.querySelector('.detail__calc')?.scrollTop ?? 0;
}
// 본체를 팝업에 얹는다. replace 면 열려 있는 팝업 안의 본체만 바꿔 끼운다 (히스토리 항목 · 스크롤 잠금은 그대로)
function detailMount(body, state, replace) {
  const old = replace ? detailMounted() : null;
  if (old) {
    old.replaceWith(body);
    const overlay = body.closest('dialog.modal');
    if (overlay) {
      overlay.dataset.mon = body.dataset.mon; overlay.dataset.sprite = body.dataset.sprite;
      overlay.setAttribute('aria-label', body.querySelector('h2')?.textContent || '상세 정보');
    }
  } else openModal(body);
  // 스크롤은 DOM 에 붙은 뒤에야 먹는다
  requestAnimationFrame(() => {
    const $scroll = body.querySelector('.detail__scroll');
    if ($scroll) $scroll.scrollTop = state.scrolls[state.tab] ?? 0;
    const $calc = body.querySelector('.detail__calc');
    if ($calc) $calc.scrollTop = state.calcScroll ?? 0;
  });
}
// 2026-09-06 v2.9.0 메인 화면에서 열었을 때만 주소를 #/mon/<id>로 바꿔 둔다 — 그대로 복사하면 공유 링크가 된다.
// openModal이 먼저 closeModal을 불러 기존 #/mon 해시를 지우므로, 반드시 그 뒤에 넣는다.
// 페이지(#/dex 등) 위에서 열 때는 그 페이지 주소를 지우지 않도록 건드리지 않는다. replaceState라 히스토리는 안 쌓인다
function detailSyncHash(pokemon) {
  const onShell = routeIdOf() === 'home' || routeIdOf() === 'mon';
  if (!onShell) return;
  try { history.replaceState(history.state, '', routeHash('mon', String(pokemon.sprite))); } catch {}
}

// 상세 팝업을 새로 연다 (목록·검색·도감·딥링크). 안에 쌓인 탐색 기록은 비운다
// pokemon 은 { sprite, name, en, types } 형태 (순위표 행·검색 결과·도감 항목이 모두 이 모양으로 넘긴다).
// isDex 는 어디서 열었는지(도감 true) — GA 의 from 과 본체 data-view 에만 남는다 (v3.50.0 부터 구성은 같다)
function openDetail(pokemon, isDex = false, from = null) {
  track('detail_open', { mon: pokemon.name, from: from ?? (isDex ? 'dex' : 'list') });  // 2026-09-03 GA4: 상세 팝업 사용량 · 2026-09-06 from: list/dex/link(공유 링크)
  DETAIL_NAV.stack = [];
  DETAIL_NAV.current = detailState(pokemon, isDex);
  detailMount(detailBuild(DETAIL_NAV.current), DETAIL_NAV.current, false);
  detailSyncHash(pokemon);
}
// 열린 팝업 안에서 다른 포켓몬으로 바꾼다 (진화 계열 · 추천 후보). 팝업이 없으면 그냥 새로 연다
function detailSwitch(pokemon, isDex, from = 'evo') {
  if (!detailMounted() || !DETAIL_NAV.current) return openDetail(pokemon, isDex ?? false, from);
  track('detail_open', { mon: pokemon.name, from });
  detailSnapshot();
  DETAIL_NAV.stack.push(DETAIL_NAV.current);
  DETAIL_NAV.current = detailState(pokemon, isDex ?? DETAIL_NAV.stack.at(-1).isDex);
  detailMount(detailBuild(DETAIL_NAV.current), DETAIL_NAV.current, true);
  detailSyncHash(pokemon);
}
// 바꾸기 전 포켓몬으로 — 떠날 때의 탭 · 스크롤 · 입력값 그대로
function detailBack() {
  const previous = DETAIL_NAV.stack.pop();
  if (!previous) return;
  DETAIL_NAV.current = previous;
  detailMount(detailBuild(previous), previous, true);
  detailSyncHash(previous.pokemon);
}
// 하단 [포켓몬 도감] — 팝업을 닫고 도감으로. 이미 도감 위라면 닫기만 한다
function detailGoDex() {
  if (routeIdOf() === 'dex') { closeModal(); return; }
  navigateHash(routeHash('dex'));
}

// 탭 전환 — 떠나는 탭의 스크롤을 적어 두고, 가는 탭의 스크롤을 되살린다
function detailShowTab(body, state, tab) {
  const $scroll = body.querySelector('.detail__scroll');
  if ($scroll) state.scrolls[state.tab] = $scroll.scrollTop;
  state.tab = tab;
  body.dataset.tab = tab;
  body.querySelectorAll('.detail__tab').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
  body.querySelectorAll('.detail__pane').forEach((pane) => { pane.hidden = pane.dataset.pane !== tab; });
  if ($scroll) $scroll.scrollTop = state.scrolls[tab] ?? 0;
}
// 화면 전환 — 'detail'(탭 셋) ↔ 'calc'(CP 계산기). 머리줄 제목과 하단 버튼이 함께 바뀐다 (CSS 가 data-screen 을 본다)
function detailShowScreen(body, state, screen) {
  const $scroll = body.querySelector('.detail__scroll');
  const $calc = body.querySelector('.detail__calc');
  if (state.screen === 'detail' && $scroll) state.scrolls[state.tab] = $scroll.scrollTop;
  if (state.screen === 'calc' && $calc) state.calcScroll = $calc.scrollTop;
  state.screen = screen;
  body.dataset.screen = screen;
  const $title = body.querySelector('.detail__bar-title');
  if ($title) $title.textContent = screen === 'calc' ? 'CP 계산기' : '포켓몬 상세';
  requestAnimationFrame(() => {
    if (screen === 'detail' && $scroll) $scroll.scrollTop = state.scrolls[state.tab] ?? 0;
    if (screen === 'calc' && $calc) $calc.scrollTop = state.calcScroll ?? 0;
  });
}

// 제목 있는 카드 — 팝업 안 블록의 기본 단위
function detailCard(title, node, extraClass = '') {
  return el('section', { class: `detail__card${extraClass ? ' ' + extraClass : ''}` }, title ? el('h3', {}, title) : '', node);
}

// 상세 본체를 만든다 — state 대로 탭 · 화면 · 입력값을 되살린 채로
// 구성: 머리줄(제목 · 링크 복사) → [왼쪽] 그림 · 이름 · 타입 · ＋ 내 포켓몬 → [오른쪽] ← 돌아가기 · 탭 · 내용 → 하단 고정 버튼
function detailBuild(state) {
  const { pokemon, isDex } = state;
  const dex = dexOf(pokemon.sprite);
  // 폼 데이터는 스프라이트 id 로 먼저 찾고(메가·리전 폼), 없으면 원종 도감번호로 되돌아간다
  const form = DEX_DATA.forms[pokemon.sprite] ?? (dex != null ? DEX_DATA.forms[dex] : null);
  const types = (pokemon.types?.length ? pokemon.types : form?.types) ?? [];
  const cpm = DEX_DATA.cpm;
  const { labels: formLabels, base: baseName } = typeof splitFormName === 'function' ? splitFormName(pokemon.name) : { labels: [], base: pokemon.name };
  // 2026-09-06 v2.11.0 그림 테두리를 폼 색으로 — 메가·다이맥스/거다이맥스·섀도우 (components/name.js formLabelKind, 색은 tokens.css)
  const formKind = formLabels.map(formLabelKind)[0] ?? '';

  const body = el('div', { class: 'detail detail--mon' });
  // 2026-09-08 v2.30.0 상세는 주소가 #/mon/<스프라이트 id> 하나뿐이라, DOM 만 보고는 "무엇의 상세인지" 를
  // 알 수 없었다 (GA·히트맵에서 상세 화면이 전부 한 덩어리로 뭉쳤다). 식별자를 종·폼 단위까지 쪼개 붙인다
  body.id = `detail-${pokemon.sprite}`;
  Object.assign(body.dataset, {
    route: 'mon', sprite: String(pokemon.sprite), dex: dex != null ? String(dex) : '', mon: pokemon.name,
    form: formKind || 'base', view: isDex ? 'dex' : 'list', tab: state.tab, screen: state.screen,
  });

  // ── 머리줄: 제목 · 링크 복사. ✕ 는 팝업 껍데기(modal.js)의 것이 이 줄 오른쪽 끝에 겹쳐 앉는다 — 스크롤과 무관하게 늘 위에 있다
  const bar = el('div', { class: 'detail__bar' },
    el('button', { class: 'detail__bar-back', 'aria-label': '상세로 돌아가기', onclick: () => detailShowScreen(body, state, 'detail') }, '‹ ', '상세로'),
    el('p', { class: 'detail__bar-title' }, state.screen === 'calc' ? 'CP 계산기' : '포켓몬 상세'),
    el('div', { class: 'detail__top-actions' }, shareBtn(pokemon)));

  // ── 왼쪽(모바일은 위): 그림 · 번호 · 폼 · 이름 · 영문명 · 타입 · ＋ 내 포켓몬
  const side = el('div', { class: 'detail__side' },
    el('div', { class: `sprite-box${formKind ? ' sprite-box--' + formKind : ''}` }, sprite(pokemon.sprite)),
    el('div', { class: 'detail__info' },
      el('div', { class: 'detail__tags' },
        dex != null ? el('span', { class: 'tag detail__dexno' }, `#${String(dex).padStart(4, '0')}`) : '',
        ...formLabels.map((label) => el('span', { class: `form-tag${formLabelKind(label) ? ' form-tag--' + formLabelKind(label) : ''}` }, label))),
      el('h2', {}, baseName),
      pokemon.en ? el('div', { class: 'detail__en-inline' }, pokemon.en) : '',
      types.length ? el('div', { class: 'detail__types' }, ...types.map((typeName) => el('span', { class: 'detail__type-pill', style: `--c: var(--t-${typeName})` }, TYPE_KO[typeName] ?? typeName))) : '',
      // 2026-09-07 v2.15.0 (QA-54) ➕ 내 개체로 저장 — 로그인한 계정만
      authEnabled() && AUTH.status === 'ok' && form && typeof planAddFromDetail === 'function'
        ? el('button', { class: 'detail__plan', title: '🌱 플래너 내 포켓몬에 이 개체 저장',
            onclick: (event) => { event.stopPropagation(); planAddFromDetail(pokemon); } }, '＋ ', '내 포켓몬')
        : ''));

  // ── 요약 탭: CP · 포획 CP · 기술 · (기술 변경) · 능력치
  const summary = el('div', { class: 'detail__pane', 'data-pane': 'summary' });
  if (form && cpm) {
    // 2026-09-08 v2.32.0 만렙 큰 숫자 + 레이드·부스트·야생·부스트 2×2 표. 큰 숫자(summary)는 접혀도 보이고 표만 접힌다
    const raidLabel = maxPoolKind(pokemon.sprite) ? '레이드·맥스' : '레이드';
    summary.append(el('details', { class: 'detail__cp-card' },
      el('summary', {}, el('div', { class: 'detail__cp-big' }, metaText('Lv.50 · 개체값 15/15/15'), el('span', { class: 'detail__cp-line' }, el('span', { class: 'detail__cp-label' }, 'CP'), el('b', {}, cpOf(form, cpm.l50).toLocaleString())))),
      el('div', { class: 'detail__cp-grid' },
        el('div', { class: 'detail__cp-tile' }, metaText(raidLabel), el('b', {}, cpOf(form, cpm.l20).toLocaleString())),
        el('div', { class: 'detail__cp-tile' }, metaText('부스트'), el('b', {}, cpOf(form, cpm.l25).toLocaleString())),
        el('div', { class: 'detail__cp-tile' }, metaText('야생'), el('b', {}, cpOf(form, cpm.l30).toLocaleString())),
        el('div', { class: 'detail__cp-tile' }, metaText('부스트'), el('b', {}, cpOf(form, cpm.l35).toLocaleString())))));
    summary.append(cpNode(form, pokemon.sprite, state));
  }
  if (form) summary.append(detailCard('배울 수 있는 기술', el('div', { class: 'detail__moves' }, movesNode(form))));
  // 2026-09-04 이 포켓몬에 걸린 시즌 기술 변경 (적용 전후 모두 표시 — 적용 뒤에도 "왜 순위가 움직였나"의 답이 된다)
  const moveChange = moveChangeFor(pokemon.sprite);
  if (moveChange) {
    const data = moveChangeData();
    const daysLeft = moveChangeDaysLeft();
    const bucket = (label, names, className) => (names?.length
      ? el('div', { class: `changes__row ${className}` }, el('span', { class: 'changes__mark' }, label),
          el('div', {}, el('b', {}, names.join(' · ')),
            // 레거시(지금은 못 배우는 전용 기술)가 섞여 있으면 오해하지 않게 표시한다
            names.some((name) => moveChange.legacy?.includes(name))
              ? el('div', { class: 'changes__sub' }, '※ 일부는 지금 배울 수 없는 레거시 기술이에요') : ''))
      : '');
    summary.append(detailCard(
      daysLeft > 0 ? `⚔️ ${data.date} 기술 변경 예정 (D-${daysLeft})` : `⚔️ ${data.date} 기술 변경 적용됨`,
      el('div', {},
        el('div', { class: 'changes__list' },
          bucket('▲', moveChange.up, 'is-up'), bucket('▼', moveChange.down, 'is-down'),
          bucket('·', moveChange.energy, ''), bucket('＋', moveChange.new, 'is-up')),
        footNote('위력 수치는 트레이너 배틀 기준 · 자세한 내용은 메뉴 → ⚔️ 기술 변경'))));
  }
  // 능력치 육각형 — 접어 둔다. 자주 보는 값이 아니라 아래에 두되, 도감에서 보던 사람을 위해 남긴다
  if (form) summary.append(el('details', { class: 'detail__acc detail__acc--hex' },
    el('summary', {}, '능력치 육각형'),
    el('div', { class: 'detail__acc-body' }, hexNode(form, pokemon.name, types))));
  if (!form) summary.append(el('p', { class: 'detail__none-text' }, '이 폼은 능력치 데이터가 없어요.'));

  // ── 배틀 정보 탭: 타입 상성 · 활용 순위 · (PvP 개체값) · (메가 비교) · 보스로 만났을 때
  const battle = el('div', { class: 'detail__pane', 'data-pane': 'battle' });
  if (types.length) battle.append(detailCard('타입 상성', matchupCols(types, pokemon.sprite)));
  const usage = usageNode(pokemon.name);
  battle.append(detailCard('활용 순위', usage ?? el('p', { class: 'detail__none-text' }, '아직 순위표 상위 30위에 오르지 않았어요.')));
  // 2026-09-11 v2.61.0 PvP 순위에 오른 종은 "그 리그에서는 어떤 개체값이 1위인가" 를 덧붙인다
  if (form && typeof ivrankDetailNode === 'function') battle.append(ivrankDetailNode(form, pokemon.sprite));
  const megaCmp = dex != null ? megaCompareNode(dex) : null;
  if (megaCmp) battle.append(detailCard('⚡ 메가X vs 메가Y 비교', megaCmp));
  // 2026-09-07 v2.13.0 (QA-49) 보스 종류(맥스 배틀 / 레이드)에 따라 참전 가능한 풀과 부제가 달라진다
  const counter = types.length ? counterNode(types, pokemon.name) : null;
  if (counter) battle.append(el('section', { class: 'detail__card detail__boss' },
    el('h3', {}, '보스로 만났을 때'), el('p', { class: 'detail__card-sub' }, counter.sub), counter.node));

  // ── 진화 탭
  const evo = el('div', { class: 'detail__pane', 'data-pane': 'evo' },
    detailCard('진화 계열', dex != null ? evoNode(dex, isDex, pokemon.sprite) : el('p', { class: 'detail__none-text' }, '진화가 없는 포켓몬이에요.')),
    hintNote('진화 계열과 메가·맥스 폼을 구분해서 보여 줘요 · 포켓몬을 누르면 이 창에서 상세가 바뀌고, ← 로 돌아오면 보던 탭과 위치가 그대로예요'));

  const panes = { summary, battle, evo };
  for (const [id, pane] of Object.entries(panes)) pane.hidden = id !== state.tab;
  const tabs = el('div', { class: 'detail__tabs', role: 'tablist' }, ...DETAIL_TABS.map(([id, label]) =>
    el('button', { class: 'detail__tab', role: 'tab', 'data-tab': id, 'aria-selected': String(id === state.tab), onclick: () => detailShowTab(body, state, id) }, label)));

  // ── ← 돌아가기: 팝업 안에서 다른 포켓몬으로 옮겨 온 경우에만
  const previous = DETAIL_NAV.stack.at(-1);
  const back = previous
    ? el('button', { class: 'detail__back', onclick: () => detailBack() }, '← ',
        `${previous.pokemon.name}${typeof koParticle === 'function' ? koParticle(previous.pokemon.name, 'ro') : '로'} 돌아가기`)
    : '';

  // ── CP 계산기 화면 (form 이 있을 때만)
  const calc = form ? el('div', { class: 'detail__calc' }, detailCpCalc(form, state.calc)) : '';
  const resetCalc = () => {
    Object.assign(state.calc, { level: 30, attackIv: 15, defenseIv: 15, hpIv: 15 });
    calc.replaceChildren(detailCpCalc(form, state.calc));
  };

  const main = el('div', { class: 'detail__main' },
    el('div', { class: 'detail__main-detail' }, back, tabs, el('div', { class: 'detail__scroll' }, summary, battle, evo)),
    calc);

  // ── 하단 고정 — 상세 화면: [포켓몬 도감] [CP 계산기] · 계산기 화면: [초기화] [상세로 돌아가기]
  const dock = el('div', { class: 'detail__dock' },
    el('p', { class: 'detail__dock-note' }, '포켓몬을 바꿔도 이전 화면으로 돌아갈 수 있어요'),   // PC 에서만 보인다
    el('div', { class: 'detail__dock-row detail__dock-row--detail' },
      el('button', { class: 'detail__dock-btn detail__dock-dex', onclick: () => detailGoDex() }, pxIcon('📖') ?? '📖', '포켓몬 도감'),
      form ? el('button', { class: 'detail__dock-btn detail__dock-btn--accent detail__dock-calc', onclick: () => detailShowScreen(body, state, 'calc') }, pxIcon('🧮') ?? '🧮', 'CP 계산기') : ''),
    el('div', { class: 'detail__dock-row detail__dock-row--calc' },
      el('button', { class: 'detail__dock-btn detail__dock-reset', onclick: resetCalc }, '↻ ', '초기화'),
      el('button', { class: 'detail__dock-btn detail__dock-btn--accent detail__dock-return', onclick: () => detailShowScreen(body, state, 'detail') }, '← ', '상세로 돌아가기')));

  body.append(bar, el('div', { class: 'detail__body' }, side, main), dock);
  return body;
}
