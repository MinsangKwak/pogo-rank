// 포켓몬 상세 팝업: 도트 스프라이트 · 진화 단계 · 기술 · 약점/내성 · 종족값 · 활용처
//
// [역할]
// 순위표·검색·도감 어디서든 포켓몬 하나를 눌렀을 때 뜨는 모달의 내용을 조립한다.
// 팝업은 "어디서 열었는지"에 따라 구성이 달라진다 — openDetail(pokemon, isDex) 의 isDex 참고.
//
// [이 파일이 제공하는 전역]
// - openDetail(pokemon, isDex)  : 상세 팝업을 연다 (row.js · search.js · views/max.js 에서 호출)
// - openDetailByDex(dexNumber, isDex) : 도감번호만으로 상세 팝업을 연다 (pages.js 도감 목록에서 호출)
// - dexOf(spriteId)             : 스프라이트 id → 도감번호
// - typeChipEl(typeName, extraText) : 타입 칩(색 점 + 한글 타입명 + 부가 텍스트)
// - typeMultAgainst(atkType, defTypes) : 방어 타입 조합에 대한 공격 타입 배율 (views/ifsolo.js 도 사용)
// - detailSection(title, node)  : 팝업 안의 제목 있는 섹션 래퍼
// - cpOf / cpNode / statsNode / matchupNode / matchupCols / movesNode /
//   usageNode / counterNode / evoNode / megaMonNode / megaCompareNode /
//   hexNode / svgEl / detailCpCalc : 팝업 각 블록을 만드는 조립 함수들
//
// [의존하는 전역 · 데이터]
// - el() (dom.js) · sprite() (components/sprite.js) · track() (track.js) · openModal() (components/modal.js)
// - authEnabled() · favBtn() (components/auth.js) — 로그인 기능이 켜진 빌드에서만 즐겨찾기 ★ 표시
// - calcCp() (components/pages.js) — 내 개체 CP 계산기에서 사용
// - DEX_DATA (data.js): names / forms / evo / megas / chart / dex / cpm
// - VALUE_DATA.usage (data.js): 각 순위표 상위 30위 등재 내역
// - TYPE_KO · LEAGUE_KO (data.js): 타입·리그 한글 이름
// - DMAX_DATA (data.js, 선택): 맥스 보스별 추천 카운터 (없는 빌드도 있어 typeof 로 방어)
// - MAX_POOL (data.js, 선택): 맥스 배틀에서 잡을 수 있는 종 (스프라이트 id → 'G' 거다이맥스 · 'D' 다이맥스)
// - roleToggleNode() (components/favs.js): ★ 즐겨찾기 PvE/PvP 분류 보정 토글

// 스프라이트 id → 도감번호 (기본 폼은 id가 곧 도감번호)
// 메가·리전 폼 등은 10000 이상의 별도 id를 쓰므로 DEX_DATA.dex 매핑으로 원종 번호를 찾는다.
function dexOf(spriteId) {
  const parsedId = parseInt(spriteId, 10);
  if (!Number.isFinite(parsedId)) return null;
  return DEX_DATA.dex[parsedId] ?? (parsedId < 10000 ? parsedId : null);
}

// 팝업 안의 한 블록: <section class="d-sec"><h3>제목</h3>내용</section>
function detailSection(title, node) {
  return el('section', { class: 'd-sec' }, el('h3', {}, title), node);
}

// 타입 칩: 타입 색 점 + 한글 타입명 (+ 배율 같은 부가 텍스트는 <small> 로 뒤에 붙인다)
function typeChipEl(typeName, extraText) {
  const chip = el('span', { class: 'tchip' }, el('span', { class: 'dot', style: `--c: var(--t-${typeName})` }), TYPE_KO[typeName] ?? typeName);
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
function shareBtn(pokemon) {
  const button = el('button', { class: 'd-share', 'aria-label': '링크 공유', title: '이 포켓몬 링크 공유' }, '🔗');
  const copied = () => { button.textContent = '복사됨 ✓'; setTimeout(() => { button.textContent = '🔗'; }, 1500); };
  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    const url = monShareUrl(pokemon.sprite);
    track('share', { mon: pokemon.name });  // GA4: 공유 시도 — 링크로 들어온 detail_open(from=link)과 짝을 이룬다
    try {
      if (navigator.share) await navigator.share({ title: `${pokemon.name} — POGO SEARCH`, url });
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
  const found = typeof buildSearchIndex === 'function' ? buildSearchIndex().find((pokemon) => Number(pokemon.sprite) === Number(spriteId)) : null;
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
  return el('button', { class: `evo-mon mega${spriteId === curSprite ? ' now' : ''}`,
    onclick: () => openDetail({ sprite: spriteId, name, en: '', types: DEX_DATA.forms[spriteId]?.types ?? [] }, isDex) },
    sprite(spriteId), el('span', {}, entry.label));
}

// 진화 단계 블록: [1단계] → [2단계] → [3단계] (분기 진화는 한 단계에 여러 마리) → ⚡[메가 폼들]
// 진화 계열도 없고 메가도 없으면 안내 문구만 돌려준다.
function evoNode(dex, isDex, curSprite) {
  const family = DEX_DATA.evo[dex];
  const megas = DEX_DATA.megas?.[dex];
  const hasFamily = family && family.length >= 2;
  if (!hasFamily && !megas?.length) return el('p', { class: 'd-none-text' }, '진화가 없는 포켓몬입니다.');
  const wrap = el('div', { class: 'evo' });
  if (hasFamily) family.forEach((stage, stageIndex) => {
    // 첫 단계 앞에는 화살표를 넣지 않는다
    if (stageIndex > 0) wrap.append(el('span', { class: 'evo-arrow' }, '→'));
    wrap.append(el('div', { class: 'evo-stage' }, ...stage.map((stageDex) => el('button', { class: `evo-mon${stageDex === dex && stageDex === curSprite ? ' now' : ''}`, onclick: () => openDetailByDex(stageDex, isDex) },
      sprite(stageDex), el('span', {}, DEX_DATA.names[stageDex] ?? stageDex)))));
  });
  if (megas?.length) {
    if (hasFamily) wrap.append(el('span', { class: 'evo-arrow' }, '⚡'));
    wrap.append(el('div', { class: 'evo-stage' }, ...megas.map((megaEntry) => megaMonNode(dex, megaEntry, curSprite, isDex))));
  }
  // 아래 안내 문구는 실제로 있는 것만 ' · ' 로 이어 붙인다
  const foot = [hasFamily && '진화형을 누르면 그 포켓몬의 정보를 볼 수 있습니다', megas?.length && '⚡ 메가 진화 가능 — 누르면 메가 진화 스탯을 볼 수 있습니다'].filter(Boolean);
  wrap.append(el('p', { class: 'd-foot' }, foot.join(' · ')));
  return wrap;
}

// 배울 수 있는 기술: 스피드(빠른 기술) / 차지(차지 기술) 두 줄
// form.fast · form.charged 는 [기술명, 레거시여부] 쌍의 배열이라 레거시면 이름 뒤에 ' *' 를 붙인다.
function movesNode(form) {
  const moveChip = ([name, elite]) => el('span', { class: 'mv' }, name + (elite ? ' *' : ''));
  return el('div', {},
    el('div', { class: 'mv-row' }, el('em', {}, '스피드'), el('div', { class: 'mv-list' }, ...form.fast.map(moveChip))),
    el('div', { class: 'mv-row' }, el('em', {}, '차지'), el('div', { class: 'mv-list' }, ...form.charged.map(moveChip))),
    // 레거시 기술이 하나라도 있을 때만 각주를 붙인다
    (form.fast.some((move) => move[1]) || form.charged.some((move) => move[1]))
      ? el('p', { class: 'd-foot' }, '* 레거시 기술 — 대단한 기술머신 또는 이벤트로만 습득') : '',
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
    el('div', { class: 'mv-row' }, el('em', {}, '약점'), weak.length ? chipList(weak) : el('span', { class: 'd-none-text' }, '없음')),
    el('div', { class: 'mv-row' }, el('em', {}, '내성'), resist.length ? chipList(resist) : el('span', { class: 'd-none-text' }, '없음')),
  );
}



// 종족값 막대 3개(공격·방어·체력). 320 을 100% 로 보고 막대 길이를 정한다.
function statsNode(form) {
  const MAX_STAT = 320;
  const bar = (label, value) => el('div', { class: 'statbar' },
    el('em', {}, label), el('span', { class: 'bar' }, el('i', { style: `width:${Math.min(100, value / MAX_STAT * 100)}%` })), el('b', {}, String(value)));
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

// 최대 CP 블록: 포획 경로별로 "100% CP(굵게) + 최저 CP" 를 묶어 보여준다
// spriteId 를 받는 이유는 맥스 배틀 가능 여부에 따라 라벨과 안내 문구가 달라지기 때문이다
function cpNode(form, spriteId) {
  const cpm = DEX_DATA.cpm;
  if (!cpm) return null;
  // 개체값 하한이 있는 경로: 100%를 굵게, 그 아래 "최저 N" 을 작게
  const rangeChip = (label, multiplier, floorIv) => el('span', { class: 'uchip top' }, label,
    el('b', {}, `CP ${cpOf(form, multiplier).toLocaleString()}`),
    el('i', {}, `최저 ${cpAtIv(form, multiplier, floorIv).toLocaleString()}`));
  // 하한이 없는 경로(야생·만렙): 100% 값만
  const chip = (label, multiplier) => el('span', { class: 'uchip' }, label, el('b', {}, `CP ${cpOf(form, multiplier).toLocaleString()}`));
  const maxKind = maxPoolKind(spriteId);
  const maxLabel = maxKind === 'G' ? '거다이맥스·다이맥스' : '다이맥스';
  return el('div', {},
    el('div', { class: 'cp-ctx' },
      el('em', {}, '레이드 보상 — 개체값 10 이상 확정'),
      el('div', { class: 'tchips' }, rangeChip('평시 Lv20', cpm.l20, 10), rangeChip('날씨부스트 Lv25', cpm.l25, 10))),
    // 맥스 배틀에 나오지 않는 종이면 이 줄 자체를 만들지 않는다
    maxKind
      ? el('div', { class: 'cp-ctx' },
          el('em', {}, `맥스 배틀 (${maxLabel}) — Lv20 고정, 날씨부스트 없음`),
          el('div', { class: 'tchips' }, rangeChip('포획 Lv20', cpm.l20, 10)))
      : '',
    el('div', { class: 'cp-ctx' },
      el('em', {}, '야생 스폰 — 개체값 하한 없음'),
      el('div', { class: 'tchips' }, chip('평시 Lv30', cpm.l30), chip('날씨부스트 Lv35', cpm.l35))),
    el('div', { class: 'cp-ctx' },
      el('em', {}, '강화 상한'),
      el('div', { class: 'tchips' }, chip('만렙 Lv50', cpm.l50))),
    el('p', { class: 'd-foot' }, `굵은 숫자가 개체값 100%(15/15/15) CP입니다. 잡은 개체가 이 값이면 100%. ${maxKind ? '맥스 배틀은 날씨부스트가 없어 항상 Lv20이라 레이드 평시와 같은 CP가 나옵니다. ' : ''}야생은 레벨 하한이 없어 최저 CP를 적지 않습니다.`));
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
  const row = (label, valueX, valueY, format = String) => el('div', { class: 'mega-cmp-row' },
    el('em', {}, label),
    el('b', { class: valueX > valueY ? 'hi' : '' }, format(valueX)), el('b', { class: valueY > valueX ? 'hi' : '' }, format(valueY)));
  const typeChips = (types) => el('div', { class: 'tchips' }, ...types.map((typeName) => typeChipEl(typeName)));

  // 차이 자동 요약: 타입이 다르면 한 줄, 종족값은 항목별로 어느 쪽이 얼마나 높은지
  const diffs = [];
  const typesOnlyInX = formX.types.filter((typeName) => !formY.types.includes(typeName));
  const typesOnlyInY = formY.types.filter((typeName) => !formX.types.includes(typeName));
  if (typesOnlyInX.length || typesOnlyInY.length) diffs.push(`타입: 메가X ${formX.types.map((typeName) => TYPE_KO[typeName]).join('/')} ↔ 메가Y ${formY.types.map((typeName) => TYPE_KO[typeName]).join('/')}`);
  for (const [label, key] of [['공격', 'atk'], ['방어', 'def'], ['체력', 'hp']]) {
    if (formX[key] !== formY[key]) diffs.push(`${label} 종족값 ${formX[key] > formY[key] ? '메가X' : '메가Y'}가 ${Math.abs(formX[key] - formY[key])} 더 높음`);
  }

  return el('div', { class: 'mega-cmp' },
    el('div', { class: 'mega-cmp-row mega-cmp-head' }, el('em', {}), el('b', {}, '메가X'), el('b', {}, '메가Y')),
    el('div', { class: 'mega-cmp-row' }, el('em', {}, '타입'), typeChips(formX.types), typeChips(formY.types)),
    row('공격', formX.atk, formY.atk), row('방어', formX.def, formY.def), row('체력', formX.hp, formY.hp),
    cpm ? row('CP 만렙', cpOf(formX, cpm.l50), cpOf(formY, cpm.l50), (cp) => cp.toLocaleString()) : '',
    diffs.length ? el('p', { class: 'd-foot' }, diffs.join(' · ')) : '');
}

// 활용처를 PvP · 레이드 · 맥스 그룹으로 나눠 순위 칩으로 표시
// VALUE_DATA.usage[].places 의 place 는 'pvp:great' / 'pve:fire' / 'max:overall' 처럼
// '그룹:세부항목' 형식이라 ':' 앞을 그룹 키로, 뒤를 리그명·타입명으로 읽는다.
function usageNode(name) {
  const usageEntry = (VALUE_DATA.usage ?? []).find((entry) => entry.name === name);
  if (!usageEntry) return null;
  const groups = { pvp: [], pve: [], max: [] };
  for (const placement of usageEntry.places) groups[placement.place.split(':')[0]]?.push(placement);
  const GROUP_KO = { pvp: 'PvP', pve: '레이드', max: '맥스' };
  const chip = ({ place, rank }) => {
    const key = place.split(':')[1];
    // PvP 는 리그 이름, 레이드·맥스는 타입 이름 (overall 은 '전체')
    const where = place.startsWith('pvp') ? LEAGUE_KO[key] : (key === 'overall' ? '전체' : TYPE_KO[key]);
    return el('span', { class: `uchip${rank <= 3 ? ' top' : ''}` }, where, el('b', {}, `${rank}위`));
  };
  const wrap = el('div', {});
  for (const groupKey of ['pvp', 'pve', 'max']) {
    if (!groups[groupKey].length) continue;
    groups[groupKey].sort((a, b) => a.rank - b.rank);
    wrap.append(el('div', { class: 'mv-row' }, el('em', {}, GROUP_KO[groupKey]),
      el('div', { class: 'tchips' }, ...groups[groupKey].map(chip))));
  }
  wrap.append(el('p', { class: 'd-foot' }, '각 순위표 상위 30위 기준 · 3위 안은 강조 표시'));
  return wrap;
}

// 2026-09-02 가안 A: 이 포켓몬이 보스로 나올 때 추천 카운터
// 대표 타입(types[0]) 의 맥스 배틀 딜러 상위 5마리. DMAX_DATA 가 없는 빌드면 null.
function counterNode(types) {
  const recs = (typeof DMAX_DATA !== 'undefined' ? DMAX_DATA[types[0]] : null)?.slice(0, 5);
  if (!recs?.length) return null;
  return el('div', { class: 'boss-recs' }, ...recs.map((counter, index) =>
    // 팝업 안의 버튼이라 클릭이 바깥 모달로 새지 않게 stopPropagation
    el('button', { class: 'boss-rec', onclick: (event) => { event.stopPropagation(); openDetail(counter); } },
      sprite(counter.sprite), el('span', {}, `${index + 1} ${counter.name}`))));
}


// 2026-09-03 타입 상성: 약점 위 · 내성 아래, 뱃지 중첩 없이 평평한 칩(점+타입+배율)
// 표시 기준: 배율 1.5 이상이면 약점(큰 순 정렬), 0.7 이하면 내성(작은 순 정렬).
// 1.6 / 0.625 같은 값만 나오므로 그 사이(≈1)는 어느 쪽에도 넣지 않는다.
function matchupCols(types) {
  const rows = Object.keys(TYPE_KO).map((typeName) => [typeName, typeMultAgainst(typeName, types)]);
  const chipList = (entries) => entries.length
    ? el('div', { class: 'tchips' }, ...entries.map(([typeName, multiplier]) => typeChipEl(typeName, `×${+multiplier.toFixed(2)}`)))
    : el('p', { class: 'd-none-text' }, '없음');
  const weak = rows.filter(([, multiplier]) => multiplier >= 1.5).sort((a, b) => b[1] - a[1]);
  const resist = rows.filter(([, multiplier]) => multiplier <= 0.7).sort((a, b) => a[1] - b[1]);
  return el('div', { class: 'd-matchrows' },
    el('div', {}, el('h3', {}, '약점'), chipList(weak)),
    el('div', {}, el('h3', {}, '내성'), chipList(resist)));
}

// 2026-09-03 능력치 육각형 대신 내 개체 CP 계산기: 이 포켓몬 고정, 레벨·IV만 조절
// 슬라이더 4개(레벨 · 공격/방어/체력 개체값)를 움직이면 결과 줄만 다시 그린다.
function detailCpCalc(form) {
  // 슬라이더 현재값 저장소 — 각 키가 sliderRow 의 key 인자와 짝을 이룬다
  const inputs = { level: 30, attackIv: 15, defenseIv: 15, hpIv: 15 };
  const $result = el('p', { class: 'cp-inline-result' });
  const update = () => {
    const cp = calcCp(form, inputs.level, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
    // 같은 개체값으로 Lv50 까지 올렸을 때의 CP — 지금 CP가 그 몇 %인지 보여준다
    const maxCp = calcCp(form, 50, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
    $result.replaceChildren(el('b', {}, `CP ${cp.toLocaleString()}`),
      ` · 개체값 ${Math.round((inputs.attackIv + inputs.defenseIv + inputs.hpIv) / 45 * 100)}% · 이 개체 만렙 CP ${maxCp.toLocaleString()} (${Math.round(cp / maxCp * 100)}%)`);
  };
  const sliderRow = (label, key, min, max, step) => {
    const $value = el('b', {}, String(inputs[key]));
    const $slider = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(inputs[key]) });
    $slider.addEventListener('input', () => {
      inputs[key] = +$slider.value;
      $value.textContent = $slider.value;
      update();
    });
    return el('div', { class: 'cp-slider' }, el('em', {}, label), $slider, $value);
  };
  update();
  return el('div', {},
    sliderRow('레벨', 'level', 1, 50, 0.5), sliderRow('공격 IV', 'attackIv', 0, 15, 1),
    sliderRow('방어 IV', 'defenseIv', 0, 15, 1), sliderRow('체력 IV', 'hpIv', 0, 15, 1),
    $result,
    el('p', { class: 'd-foot' }, '내 개체의 레벨·개체값을 맞추면 지금 CP와 만렙까지의 여지가 보입니다'));
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
  const usageEntry = (VALUE_DATA.usage ?? []).find((entry) => entry.name === name);
  // 'pvp' / 'pve' / 'max' 로 시작하는 등재 항목 중 가장 높은(숫자가 작은) 순위
  const bestRank = (prefix) => {
    const ranks = (usageEntry?.places ?? []).filter((placement) => placement.place.startsWith(prefix)).map((placement) => placement.rank);
    return ranks.length ? Math.min(...ranks) : null;
  };
  const rankScore = (rank) => (rank == null ? 0.08 : Math.max(0.15, 1 - (rank - 1) / 32));
  // 레이드 축은 레이드(pve)와 맥스(max) 중 더 높은 순위를 쓴다
  const raid = bestRank('pve') != null || bestRank('max') != null
    ? Math.min(bestRank('pve') ?? 99, bestRank('max') ?? 99) : null;
  const pvp = bestRank('pvp');
  const cp = DEX_DATA.cpm ? cpOf(form, DEX_DATA.cpm.l50) : null;
  // [축 이름, 라벨에 쓸 값 문자열, 0~1 비율]
  const axes = [
    ['공격', String(form.atk), Math.min(1, form.atk / 320)],
    ['방어', String(form.def), Math.min(1, form.def / 320)],
    ['레이드', raid ? `${raid}위` : '-', rankScore(raid)],
    ['체력', String(form.hp), Math.min(1, form.hp / 320)],
    ['CP', cp ? cp.toLocaleString() : '-', cp ? Math.min(1, cp / 5500) : 0.08],
    ['PvP', pvp ? `${pvp}위` : '-', rankScore(pvp)],
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
  const svg = svgEl('svg', { viewBox: '0 0 300 236', class: 'hex-svg', role: 'img', 'aria-label': '능력치 육각형' },
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
      return svgEl('text', { x, y: y - 2, 'text-anchor': anchor, class: 'hex-label' },
        svgEl('tspan', { class: 'hex-name' }, axis[0]),
        svgEl('tspan', { x, dy: 13, class: 'hex-val' }, axis[1]));
    }));
  svg.append(svgEl('title', {}, '종족값 320 · CP 5,500 기준 비율. 레이드/PvP는 도감 순위표 최고 순위'));
  return el('div', { class: 'hex-wrap' }, svg);
}

// 상세 팝업 본체.
// pokemon 은 { sprite, name, en, types } 형태 (순위표 행·검색 결과·도감 항목이 모두 이 모양으로 넘긴다).
// isDex = true (도감에서 열었을 때): 능력치 육각형 + 기술을 2열로 — "이 종이 어떤 포켓몬인가"를 본다
// isDex = false (순위표·검색에서 열었을 때): 육각형 없이 기술만 전체 폭으로 — "지금 쓸 기술"을 본다
// 섹션 순서: 헤더 → CP 계산기(아코디언) → 능력치/기술 → 타입 상성 → 활용처 → 메가 비교 → 진화 단계 → 보스 카운터
function openDetail(pokemon, isDex = false, from = null) {
  track('detail_open', { mon: pokemon.name, from: from ?? (isDex ? 'dex' : 'list') });  // 2026-09-03 GA4: 상세 팝업 사용량 · 2026-09-06 from: list/dex/link(공유 링크)

  const dex = dexOf(pokemon.sprite);
  // 폼 데이터는 스프라이트 id 로 먼저 찾고(메가·리전 폼), 없으면 원종 도감번호로 되돌아간다
  const form = DEX_DATA.forms[pokemon.sprite] ?? (dex != null ? DEX_DATA.forms[dex] : null);
  const types = (pokemon.types?.length ? pokemon.types : form?.types) ?? [];

  // 2026-09-03 최대 CP를 헤더로 — 제일 먼저 보이는 정보
  // 만렙(Lv50) / 레이드 보상(Lv20·부스트 Lv25) / 야생(Lv30·부스트 Lv35) 을 한 줄로 압축
  const cpm = DEX_DATA.cpm;
  const cpLine = form && cpm
    ? el('p', { class: 'd-cpline' },
        `CP 100% 기준 · 만렙 `, el('b', {}, cpOf(form, cpm.l50).toLocaleString()),
        ` | ${maxPoolKind(pokemon.sprite) ? '레이드·맥스' : '레이드'} ${cpOf(form, cpm.l20).toLocaleString()}, 부스트 ${cpOf(form, cpm.l25).toLocaleString()}`,
        ` | 야생 ${cpOf(form, cpm.l30).toLocaleString()}, 부스트 ${cpOf(form, cpm.l35).toLocaleString()}`)
    : '';
  // 2026-09-03 v3 헤더: 타입 → 팬텀(Gengar) → CP 만렙 | 야생, 부스트 (유저 지정 순서)
  const head = el('div', { class: 'd-head' },
    el('div', { class: 'd-sprite' }, sprite(pokemon.sprite)),
    el('div', {},
      el('div', { class: 'tchips' }, ...types.map((typeName) => typeChipEl(typeName))),
      el('h2', {}, pokemon.name, pokemon.en ? el('span', { class: 'd-en-inline' }, ` (${pokemon.en})`) : ''),
      cpLine),
    // 2026-09-03 v2.2.0 즐겨찾기 ★ (로그인 기능이 켜진 빌드에서만, 종 단위 = 도감번호)
    el('div', { class: 'd-actions' },
      authEnabled() && dex != null ? favBtn(dex, 'd-fav') : '',
      shareBtn(pokemon)));  // 2026-09-06 v2.9.0 🔗 공유

  const body = el('div', { class: 'detail' }, head);
  // 2026-09-04 포획 CP: "지금 잡은 개체가 100%인가"를 확인하는 표. 계산기보다 자주 보므로 위에 둔다
  if (form) body.append(el('details', { class: 'd-acc' },
    el('summary', {}, '🎯 포획 CP — 이 숫자면 100%'),
    el('div', { class: 'd-acc-body' }, cpNode(form, pokemon.sprite))));
  // 2026-09-03 v4: 내 개체 CP 계산기를 상성 위로, 접이식 아코디언으로
  // 2026-09-03 도감형 재배치: 계산기 아코디언 → [능력치 육각형 | 배울 수 있는 기술] → 상성 → 활용처 → 진화, "보스로 나오면"은 맨 아래
  if (form) body.append(el('details', { class: 'd-acc' },
    el('summary', {}, '🧮 내 개체 CP 계산기'),
    el('div', { class: 'd-acc-body' }, detailCpCalc(form))));
  // 2026-09-03 일반 팝업: 능력치 없이 기술만 전체 폭 / 도감 팝업: [능력치 육각형 | 기술] 2열
  if (form) {
    body.append(isDex
      ? el('div', { class: 'd-hexmoves' },
          el('div', {}, el('h3', {}, '능력치'), hexNode(form, pokemon.name, types)),
          el('div', { class: 'd-moves' }, el('h3', {}, '배울 수 있는 기술'), movesNode(form)))
      : detailSection('배울 수 있는 기술', el('div', { class: 'd-moves' }, movesNode(form))));
  }
  // 2026-09-04 이 포켓몬에 걸린 시즌 기술 변경 (적용 전후 모두 표시 — 적용 뒤에도 "왜 순위가 움직였나"의 답이 된다)
  const moveChange = moveChangeFor(pokemon.sprite);
  if (moveChange) {
    const data = moveChangeData();
    const daysLeft = moveChangeDaysLeft();
    const bucket = (label, names, className) => (names?.length
      ? el('div', { class: `chg-row ${className}` }, el('span', { class: 'chg-mark' }, label),
          el('div', {}, el('b', {}, names.join(' · ')),
            // 레거시(지금은 못 배우는 전용 기술)가 섞여 있으면 오해하지 않게 표시한다
            names.some((name) => moveChange.legacy?.includes(name))
              ? el('div', { class: 'chg-sub' }, '※ 일부는 지금 배울 수 없는 레거시 기술입니다') : ''))
      : '');
    body.append(detailSection(
      daysLeft > 0 ? `⚔️ ${data.date} 기술 변경 예정 (D-${daysLeft})` : `⚔️ ${data.date} 기술 변경 적용됨`,
      el('div', {},
        el('div', { class: 'chg-list' },
          bucket('▲', moveChange.up, 'up'), bucket('▼', moveChange.down, 'down'),
          bucket('·', moveChange.energy, ''), bucket('＋', moveChange.new, 'up')),
        el('p', { class: 'd-foot' }, '위력 수치는 트레이너 배틀 기준 · 자세한 내용은 메뉴 → ⚔️ 기술 변경'))));
  }
  if (types.length) body.append(detailSection('타입 상성', matchupCols(types)));
  // 아래 섹션들은 해당 데이터가 있을 때만 붙는다 (활용처 미등재·메가 없음·진화 없음 등)
  const usage = usageNode(pokemon.name);
  if (usage) body.append(detailSection('이 도감에서의 활용처 (상위 30위 내)', usage));
  // 2026-09-05 역할 보정: ★ 즐겨찾기 목록에서 PvE/PvP 어느 갈래로 묶일지 직접 지정
  const roleToggle = roleToggleNode(pokemon.sprite);
  if (roleToggle) body.append(detailSection('★ 즐겨찾기 분류', roleToggle));
  const megaCmp = dex != null ? megaCompareNode(dex) : null;
  if (megaCmp) body.append(detailSection('⚡ 메가X vs 메가Y 비교', megaCmp));
  if (dex != null) body.append(detailSection('진화 단계', evoNode(dex, isDex, pokemon.sprite)));
  const counter = types.length ? counterNode(types) : null;
  if (counter) body.append(detailSection(`${pokemon.name}가 보스로 나오면? (${TYPE_KO[types[0]]} 보스 공략 딜러)`, counter));
  openModal(body);
  // 2026-09-06 v2.9.0 메인 화면에서 열었을 때만 주소를 #/mon/<id>로 바꿔 둔다 — 그대로 복사하면 공유 링크가 된다.
  // openModal이 먼저 closeModal을 불러 기존 #/mon 해시를 지우므로, 반드시 그 뒤에 넣는다.
  // 페이지(#/dex 등) 위에서 열 때는 그 페이지 주소를 지우지 않도록 건드리지 않는다. replaceState라 히스토리는 안 쌓인다
  if (typeof currentPageId === 'function' && !currentPageId()) {
    try { history.replaceState(null, '', `#/mon/${pokemon.sprite}`); } catch {}
  }
}
