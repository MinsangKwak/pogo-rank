// 2026-09-02 if 탭 > 실측 제공자: 솔플 레이드 계산기
// v4: 타입이 아니라 실제 보스(예: 메가거북왕)를 검색해 고르면 그 보스 상대 덱을 추천
// 부활 운용(기절→부활약→재진입) 사이클 시뮬레이션으로 정예 1~6마리 중 최속 구성 선택
// 2026-09-02 난이도는 선택이 아니라 보스별 절대값: 클래스/진화 단계로 자동 판정
const SOLO_TIERS = [
  { id: 't1', label: '1성', hp: 600, time: 180 },
  { id: 't3', label: '3성', hp: 3600, time: 180 },
  { id: 't4', label: '4성', hp: 9000, time: 300 },
  { id: 't5', label: '5성', hp: 15000, time: 300 },
  { id: 'mega', label: '메가', hp: 15000, time: 300 },
];

// 2026-09-02 개체별 CP: 보스 종족값으로 레이드 표시 CP와 풀강 최대 CP 계산
// 레이드 CP = (공격+15) × √(방어+15) × √(티어 HP) / 10 — 뮤츠 5성 54,148로 실측 검증
const CPM50 = 0.8403;
function bossStats(boss) {
  if (boss.ba) return { atk: boss.ba, def: boss.bd, hp: boss.bs };  // 2026-09-02 빌드 목록의 종족값 우선
  return DEX_DATA.forms[String(boss.sprite)] ?? DEX_DATA.forms[String(DEX_DATA.dex[boss.sprite] ?? boss.sprite)];
}
function raidCp(boss, tier) {
  const st = bossStats(boss);
  return st ? Math.floor((st.atk + 15) * Math.sqrt(st.def + 15) * Math.sqrt(tier.hp) / 10) : null;
}
function maxCp(boss) {
  const st = bossStats(boss);
  return st ? Math.floor((st.atk + 15) * Math.sqrt(st.def + 15) * Math.sqrt(st.hp + 15) * CPM50 * CPM50 / 10) : null;
}

// 보스 → 티어 자동 판정: 메가·원시 → 메가, 전설·환상·울트라비스트 → 4성, 최종 진화 → 3성, 그 외 1성
// 게임 내 실제 배치와 다르면 이 규칙만 고치면 됨
function inferTier(boss) {
  if (/^(메가|원시)/.test(boss.name)) return 'mega';
  const dex = String(DEX_DATA.dex[boss.sprite] ?? boss.sprite);
  const cls = DEX_DATA.cls?.[dex];
  if (cls) return 't4';
  const evo = DEX_DATA.evo?.[dex];
  const isFinal = evo ? evo[evo.length - 1].includes(Number(dex)) : (DEX_DATA.forms[dex]?.atk ?? 0) >= 160;
  return isFinal ? 't3' : 't1';
}
const SWAP_LOSS = 1;      // 같은 팀 안에서 다음 포켓몬 교체(초)
// 2026-09-02 실측 반영(실측 제공자): 전멸 리로비가 아니라 기절 직전 이탈 → 부활 → 같은 덱 재진입, 5~6초
const REVIVE_LOSS = 5.5;

// 보스 검색 인덱스: 순위 데이터(메가·폼 포함) + 도감 기본 종 전체
let BOSS_INDEX = null;
function bossIndex() {
  if (BOSS_INDEX) return BOSS_INDEX;
  const map = new Map();
  const add = (p) => { if (p?.name && p.types?.length && !map.has(p.name)) map.set(p.name, { name: p.name, types: p.types, sprite: p.sprite, ba: p.ba, bd: p.bd, bs: p.bs }); };
  // 2026-09-02 빌드 생성 보스 목록(메가 전 종 포함)을 최우선으로
  (typeof BOSS_LIST !== 'undefined' ? BOSS_LIST : []).forEach(add);
  Object.values(PVE_DATA).forEach((l) => l.forEach(add));
  Object.values(DMAX_DATA).forEach((l) => l.forEach(add));
  Object.values(DMAX_TIER).forEach((l) => l.forEach(add));
  // 2026-09-02 활용처·가성비 목록도 포함 — 어태커 순위엔 없는 메가(예: 메가 칼라마네로)까지 커버
  ['usage', 'pvp', 'pve', 'both'].forEach((k) => (VALUE_DATA[k] ?? []).forEach(add));
  for (const [dex, name] of Object.entries(DEX_DATA.names)) {
    const f = DEX_DATA.forms[dex];
    if (f?.types?.length && !map.has(name)) map.set(name, { name, types: f.types, sprite: Number(dex) });
  }
  BOSS_INDEX = [...map.values()];
  return BOSS_INDEX;
}

// 2026-09-02 v5 계산 현실화: 자체 계산의 고정 가정(보스 방어 200 · 초당 피해 30)을
// 선택 보스의 실제 종족값으로 보정. 풀강(레벨50)·버프 토글 반영
const TDO_CAL = 3;   // 실측 보정: 자체 계산이 어태커 생존을 과소평가(보스 초당피해 30 고정)해 3배 보정 — 실측 제공자 메가 솔플 실측 기준
const DPS_CAL = 1.2; // 실측 보정: 자체 계산 DPS가 실전 대비 보수적이라 +20%
const BUFFS = [
  { id: 'none', label: '버프 없음', m: 1 },
  { id: 'mega', label: '메가부스트 +30%', m: 1.3 },
  { id: 'full', label: '풀버프 +60%', m: 1.6 },  // 메가부스트 + 날씨 + 친구 대략치
];
function scaledPool(boss) {
  const st = bossStats(boss) ?? {};
  const defScale = 200 / (st.def || 200);                 // 탱커 보스(방어↑)면 DPS↓ — 칼라마네로 케이스
  const atkScale = 200 / (st.atk || 200);                 // 공격 강한 보스면 내 생존(TDO)↓
  const lvD = state.soloLv50 ? 1.063 : 1;                 // 풀강: CPM50/CPM40 = 딜 +6.3%
  const lvT = state.soloLv50 ? 1.2 : 1;                   // 풀강: 내구·체력까지 → TDO 약 +20%
  const buff = BUFFS.find((b) => b.id === state.soloBuff).m;
  return counterPool(boss.types).map((p) => ({
    ...p,
    dps: p.dps * DPS_CAL * defScale * lvD * buff,
    tdo: Math.round(p.tdo * TDO_CAL * defScale * atkScale * lvT * buff),
  }));
}

// 보스 상대 카운터 풀: 보스 타입별 순위를 합치고, 복합 타입은 어태커 자속 타입 기준으로 근사 보정
function counterPool(bossTypes) {
  const map = new Map();
  for (let i = 0; i < bossTypes.length; i++) {
    const main = bossTypes[i], other = bossTypes[1 - i];
    for (const p of PVE_DATA[main] ?? []) {
      const adj = other ? (DEX_DATA.chart[p.types?.[0]]?.[other] ?? 1) : 1;
      const cand = { ...p, dps: p.dps * adj, tdo: Math.round(p.tdo * adj) };
      const prev = map.get(p.name);
      if (!prev || cand.dps > prev.dps) map.set(p.name, cand);
    }
  }
  return [...map.values()];
}

// 정예 k마리를 부활시켜 돌려쓰는 사이클 시뮬레이션
function simulateRevive(squad, tier) {
  const cycleDamage = squad.reduce((a, p) => a + p.tdo, 0);
  const cycleTime = squad.reduce((a, p) => a + p.tdo / p.dps, 0) + (squad.length - 1) * SWAP_LOSS;
  const fullCycles = Math.floor(tier.hp / cycleDamage);
  let remain = tier.hp - fullCycles * cycleDamage;
  // 재진입 로스는 "전멸 후 이어서 싸울 때"만: 잔여 딜이 남았으면 fullCycles회, 딱 떨어지면 fullCycles-1회
  let time = fullCycles * cycleTime + Math.max(0, fullCycles - (remain > 0 ? 0 : 1)) * REVIVE_LOSS;
  for (const p of squad) {
    if (remain <= 0) break;
    const dealt = Math.min(p.tdo, remain);
    time += dealt / p.dps + (p === squad[0] ? 0 : SWAP_LOSS);
    remain -= dealt;
  }
  return { time: Math.round(time), cycles: fullCycles + (tier.hp - fullCycles * cycleDamage > 0 ? 1 : 0), revives: fullCycles * squad.length };
}

// 2026-09-02 실측 제공자식 운용: 제일 잘난 애 1~2마리를 부활시켜 돌려쓴다
function buildSoloPlan(candidates, tier) {
  const pool = [...candidates].sort((a, b) => b.dps - a.dps).slice(0, 2);
  let best = null;
  for (let k = 1; k <= pool.length; k++) {
    const r = simulateRevive(pool.slice(0, k), tier);
    if (!best || r.time < best.time) best = { ...r, squad: pool.slice(0, k) };
  }
  if (best) best.possible = best.time <= tier.time;
  return best;
}

// 2026-09-02 딜 총량 접근: 제한 시간 동안 이 덱이 넣을 수 있는 최대 딜을 시뮬레이션
// → "딜이 얼마라 얼마가 모자라서 못 잡았다"는 결론을 낼 수 있게
function damageInTime(squad, tier) {
  let t = 0, dealt = 0, i = 0, cycle = 0;
  while (t < tier.time && cycle < 200) {
    const p = squad[i];
    const fight = Math.min(p.tdo / p.dps, tier.time - t);
    dealt += fight * p.dps;
    t += fight;
    if (t >= tier.time) break;
    i++;
    if (i >= squad.length) { i = 0; cycle++; t += REVIVE_LOSS; }
    else t += SWAP_LOSS;
  }
  return Math.round(dealt);
}

function marginText(plan, tier) {
  const m = Math.round((tier.time - plan.time) / tier.time * 100);
  return m >= 0 ? `시간 여유 ${m}%` : `약 ${-m}% 부족`;
}

function soloResultNodes(boss, tier) {
  const plan = state.soloMode === 'mine' && state.soloMyDeck.length
    ? { ...simulateRevive(state.soloMyDeck, tier), squad: state.soloMyDeck }
    : buildSoloPlan(scaledPool(boss), tier);
  if (plan && plan.possible === undefined) plan.possible = plan.time <= tier.time;
  if (!plan) return [el('p', { class: 'empty' }, '데이터가 없습니다.')];
  const typeLabel = boss.types.map((t) => TYPE_KO[t]).join('·');
  const bossLabel = `${boss.name} (${typeLabel}) ${tier.label} 기준 (체력 ${tier.hp.toLocaleString()} — 티어 고정값)`;
  const card = plan.possible
    ? el('div', { class: 'solo-card solo-ok' },
        el('p', { class: 'solo-verdict' }, `💪 솔플 가능 — 정예 ${plan.squad.length}마리, 약 ${plan.time}초`),
        el('p', { class: 'solo-why' }, `${bossLabel} · 기절 직전 이탈 → 부활(5~6초) → 같은 덱 재진입 · 총 ${plan.cycles}사이클${plan.revives ? ` · 부활 ${plan.revives}회 (부활약·회복약 챙기세요)` : ' · 부활 없이 한 번에'}`),
        el('p', { class: 'solo-stats' }, `${marginText(plan, tier)} (제한 ${tier.time}초 중 약 ${plan.time}초) · 아래 순서 그대로 내보내면 됩니다.`))
    : el('div', { class: 'solo-card solo-no' },
        el('p', { class: 'solo-verdict' }, '🙅 이건 사람 손으로는 무리예요'),
        el('p', { class: 'solo-why' }, `${bossLabel} — ${state.soloMode === 'mine' ? '이 덱으로는' : '최정예를 부활시켜 가며 무한정 갈아넣어도'} 약 ${plan.time}초 (${marginText(plan, tier)}). 친구를 부르거나 풀강·버프로 마진을 채워보세요.`),
        el('p', { class: 'solo-stats' }, '아래는 그래도 가장 빨리 깎는 구성입니다.'));
  // 2026-09-02 딜 총량 결론 줄: 제한 시간 내 최대 딜 vs 보스 체력
  const dealt = damageInTime(plan.squad, tier);
  const gap = dealt - tier.hp;
  card.append(el('p', { class: 'solo-stats' }, gap >= 0
    ? `제한 시간 내 이 덱의 총 딜 약 ${dealt.toLocaleString()} / 보스 체력 ${tier.hp.toLocaleString()} → 딜 여유 ${gap.toLocaleString()} (+${Math.round(gap / tier.hp * 100)}%)`
    : `제한 시간 내 이 덱의 최대 딜 약 ${dealt.toLocaleString()} / 보스 체력 ${tier.hp.toLocaleString()} → ${(-gap).toLocaleString()} (${Math.round(-gap / tier.hp * 100)}%) 모자라서 못 잡음`));
  return [card,
    el('div', { class: 'list-head' },
      el('h2', {}, `필요 개체 ${plan.squad.length}마리 (이 순서로)`),
      el('span', { class: 'meta' }, `${boss.name} 상대 DPS순`)),
    list(`solo-${boss.name}-${tier.id}`, plan.squad, (p, i) => row(
      p, String(i + 1),
      el('span', { class: 'score' }, p.dps.toFixed(1)),
      el('span', { class: 'sub' }, `DPS · TDO ${p.tdo}`)))];
}

function renderSoloCalc() {
  // 2026-09-02 난이도 seg 제거 — 보스 선택 시 자동 판정 (배지 탭으로 수동 보정 가능)
  const tierId = state.soloBossMon ? (state.soloTierOverride ?? inferTier(state.soloBossMon)) : 't3';
  const tier = SOLO_TIERS.find((t) => t.id === tierId);

  // 보스 검색: 이름 일부 입력 → 후보 목록 → 선택
  const sugg = el('div', { class: 'boss-sugg' });
  const input = el('input', { class: 'boss-search', type: 'search', placeholder: '보스 이름 검색 (예: 메가거북왕, 자시안)', value: '' });
  input.addEventListener('input', () => {
    const q = input.value.trim();
    sugg.textContent = '';
    if (q.length < 1) return;
    const hits = monSearch(bossIndex(), q);  // 2026-09-03 전역 검색과 같은 필터(공백 무시·영문·정확도순)
    for (const b of hits) {
      sugg.append(el('button', { class: 'boss-rec', onclick: () => {
        state.soloBossMon = b;
        state.soloTierOverride = null;  // 새 보스면 자동 판정으로 리셋
        track('solo_calc_boss', { boss: b.name });  // 2026-09-03 GA4: 솔플 계산기 사용량
        render();
      } }, sprite(b.sprite), el('span', {}, b.name)));
    }
    if (!hits.length) sugg.append(el('p', { class: 'empty' }, '검색 결과가 없습니다.'));
  });
  // 2026-09-02 v5: 추천 덱 / 내 덱 검증 모드 + 풀강·버프 토글
  $controls.append(el('div', { class: 'solo-opts' },
    seg([{ id: 'auto', label: '추천 덱' }, { id: 'mine', label: '내 덱 검증' }], state.soloMode,
      (id) => { state.soloMode = id; render(); }),
    seg([{ id: 'off', label: '레벨40' }, { id: 'on', label: '풀강50' }], state.soloLv50 ? 'on' : 'off',
      (id) => { state.soloLv50 = id === 'on'; render(); }),
    seg(BUFFS.map((b) => ({ id: b.id, label: b.label })), state.soloBuff,
      (id) => { state.soloBuff = id; render(); })));

  // 2026-09-02 선택된 보스를 검색창 아래에 유지 표시 (✕로 해제)
  const picked = state.soloBossMon
    ? el('div', { class: 'boss-selected' },
        sprite(state.soloBossMon.sprite),
        el('b', {}, state.soloBossMon.name),
        el('div', { class: 'boss-cp' },
          el('span', { class: 'meta' }, state.soloBossMon.types.map((t) => TYPE_KO[t]).join('·')),
          // 2026-09-02 개체별 레이드 CP · 최대 CP 표시
          el('span', { class: 'meta' }, (() => {
            const rc = raidCp(state.soloBossMon, tier), mc = maxCp(state.soloBossMon);
            return [rc ? `레이드 CP ${rc.toLocaleString()}` : '', mc ? `풀강 최대 CP ${mc.toLocaleString()}` : ''].filter(Boolean).join(' · ');
          })())),
        // 2026-09-02 자동 판정된 난이도 배지: 탭하면 수동으로 한 단계씩 변경
        el('button', { class: 'tag boss-tier', title: '탭하면 난이도 수동 변경', onclick: () => {
          const i = SOLO_TIERS.findIndex((t) => t.id === tierId);
          state.soloTierOverride = SOLO_TIERS[(i + 1) % SOLO_TIERS.length].id;
          render();
        } }, `${tier.label}${state.soloTierOverride ? '' : ' 자동'}`),
        el('button', { class: 'boss-clear', 'aria-label': '선택 해제', onclick: () => { state.soloBossMon = null; state.soloTierOverride = null; render(); } }, '✕'))
    : null;
  $controls.append(input, sugg);
  if (picked) $controls.append(picked);

  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, '실측 제공자-솔플 레이드 계산기'),  // 2026-09-02 표기 변경
    el('span', { class: 'meta' }, '프로토타입 · 부활 운용')));

  if (!state.soloBossMon) {
    $content.append(el('p', { class: 'empty' }, '잡고 싶은 보스를 검색해서 골라주세요. 예: 메가거북왕을 고르면 풀·전기 정예 덱이 나옵니다.'));
  } else {
    // 2026-09-02 내 덱 검증 모드: 이 보스 상대 평가 가능한 어태커를 골라 조합 구성
    if (state.soloMode === 'mine') {
      const pool = scaledPool(state.soloBossMon);
      const dsugg = el('div', { class: 'boss-sugg' });
      const dinput = el('input', { class: 'boss-search', type: 'search', placeholder: '내 어태커 검색해서 추가 (예: 자시안, 메가Y 뮤츠)' });
      dinput.addEventListener('input', () => {
        const q = dinput.value.trim();
        dsugg.textContent = '';
        if (!q) return;
        const hits = monSearch(pool.filter((a) => !state.soloMyDeck.some((d) => d.name === a.name)), q, 6);  // 2026-09-03 공용 필터
        for (const a of hits) {
          dsugg.append(el('button', { class: 'boss-rec', onclick: () => {
            if (state.soloMyDeck.length < 6) { state.soloMyDeck.push(a); render(); }
          } }, sprite(a.sprite), el('span', {}, a.name)));
        }
        if (!hits.length) dsugg.append(el('p', { class: 'empty' }, '이 보스 상대 상위 목록에 없어 평가할 수 없는 포켓몬이에요.'));
      });
      $content.append(el('div', { class: 'list-head' }, el('h2', {}, '내 덱'), el('span', { class: 'meta' }, `${state.soloMyDeck.length}/6 · 넣는 순서대로 출전`)), dinput, dsugg);
      if (state.soloMyDeck.length) {
        $content.append(list('solo-mydeck', state.soloMyDeck, (p, i) => {
          const li = row(p, String(i + 1),
            el('span', { class: 'score' }, p.dps.toFixed(1)),
            el('span', { class: 'sub' }, `DPS · TDO ${p.tdo}`)).cloneNode(true);
          li.addEventListener('click', () => { state.soloMyDeck.splice(i, 1); render(); });
          li.title = '누르면 덱에서 제거';
          return li;
        }));
      }
      if (!state.soloMyDeck.length) $content.append(el('p', { class: 'empty' }, '어태커를 추가하면 이 조합으로 되는지 판정해줍니다.'));
      else $content.append(...soloResultNodes(state.soloBossMon, tier).slice(0, 1));
    } else {
      $content.append(...soloResultNodes(state.soloBossMon, tier));
    }
  }
  $note.textContent = '프로토타입 가정: 자체 계산 PvE 수치(개체값 15/15/15) 기반에 선택 보스의 실제 방어·공격 종족값을 반영해 보정. 운용은 실측 제공자식 — 최정예 1~2마리를 기절 직전 이탈 → 부활(5~6초) → 재진입으로 돌려쓰는 방식 기준. 풀강50 토글은 딜 +6.3%·TDO +20%, 버프는 메가부스트 +30% / 풀버프(메가+날씨+친구) +60%. 실측 보정: 생존 3배 · DPS +20%. 기절 → 부활약 → 재진입 운용을 반영해 정예 1~6마리 중 가장 빨리 깎는 구성을 고릅니다 (교체 1초 · 전멸 후 재진입 13초). 난이도는 보스별로 자동 판정(메가·원시 → 메가, 전설·환상·울트라비스트 → 4성, 최종 진화 → 3성, 그 외 1성)이며 선택된 보스의 난이도 배지를 탭하면 수동 변경됩니다. 레이드 표시 CP는 개체 종족값 기반 계산값(공식 검증: 뮤츠 5성 54,148), 전투 체력은 게임 구조상 티어 고정 — 1성 600 · 3성 3,600 · 4성 9,000 · 5성/메가 15,000, 제한 1·3성 180초 / 그 외 300초. 복합 타입 보스의 두 번째 타입은 어태커 자속 타입 기준 근사 보정. 포켓몬을 누르면 상세 정보가 열립니다.';
}

// 2026-09-03 v2.1.0 IF 탭 = 실험 기능 모음: [솔플 레이드 계산기 | PvP 덱 짜기]
function renderIfTab() {
  $controls.append(seg([{ id: 'solo', label: '솔플 레이드 계산기' }, { id: 'pvpdeck', label: 'PvP 덱 짜기' }], state.ifWho,
    (id) => { state.ifWho = id; track('sub_if_' + id); render(); }));  // 2026-09-03 GA4: 서브탭 사용량
  (state.ifWho === 'pvpdeck' ? renderPvpDeck : renderSoloCalc)();
}

// 2026-09-03 v2.1.0 PvP 덱 짜기 (실험, QA-16 발전형): 상대할 포켓몬을 1~3마리 넣으면
// 그 리그 순위 상위 중 상성으로 유리한 추천 덱 3마리 + 상대별 카운터를 보여준다
function foeFit(cand, foe) {
  // 공격: 내 자속 타입이 상대를 때리는 최대 배율 / 수비: 상대 타입이 나를 때리는 최대 배율
  const off = Math.max(...(cand.types ?? ['normal']).map((t) => typeMultAgainst(t, foe.types)));
  const def = Math.max(...(foe.types ?? ['normal']).map((t) => typeMultAgainst(t, cand.types ?? [])));
  return off / def;
}

// 2026-09-03 GO배틀리그 규칙: 같은 종은 파티에 1마리만 (섀도우·일반도 같은 종) — 종 단위 중복 제거 키
function speciesKey(p) { return String(DEX_DATA.dex[p.sprite] ?? p.sprite); }

// 배율 표시용 반올림
function fmtMult(m) { return String(Math.round(m * 100) / 100); }

// 받침 유무에 따라 조사 선택: josa('두드리짱','이','가') → '두드리짱이'
function josa(w, a, b) {
  const ch = w.charCodeAt(w.length - 1);
  return w + (ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 > 0 ? a : b);
}

// 2026-09-03 왜 카운터인지 한 줄 설명: 상대 타입 → 무슨 자속으로 찌르고, 상대 자속을 어떻게 받는지
function counterWhy(c, f) {
  const foeKo = f.types.map((t) => TYPE_KO[t]).join('·');
  const off = (c.types ?? []).map((t) => [t, typeMultAgainst(t, f.types)]).sort((a, b) => b[1] - a[1])[0];
  const inc = (f.types ?? []).map((t) => [t, typeMultAgainst(t, c.types ?? [])]).sort((a, b) => b[1] - a[1])[0];
  const offTxt = off[1] > 1
    ? `${foeKo} 타입은 ${josa(TYPE_KO[off[0]], '이', '가')} 약점 → ${TYPE_KO[off[0]]} 자속 ×${fmtMult(off[1])}`
    : off[1] === 1 ? `${TYPE_KO[off[0]]} 자속은 동등(×1)`
    : `자속(${TYPE_KO[off[0]]})은 ×${fmtMult(off[1])}로 반감되지만`;
  const incTxt = inc[1] < 1
    ? `받는 ${TYPE_KO[inc[0]]} 공격은 ×${fmtMult(inc[1])} 반감`
    : inc[1] === 1 ? '받는 공격은 ×1'
    : `단 ${TYPE_KO[inc[0]]} 공격은 ×${fmtMult(inc[1])}로 아프게 받음`;
  return `${offTxt} · ${incTxt}`;
}

// 상대 f를 가장 아프게 때리는 공격 타입 (분석 카드 보완 추천용)
function topAtkType(f) {
  const best = Object.keys(TYPE_KO).sort((a, b) => typeMultAgainst(b, f.types) - typeMultAgainst(a, f.types))[0];
  return TYPE_KO[best];
}

// 2026-09-03 슬롯 3칸을 다 채우면: 추천 덱 vs 상대 덱 차이 분석 + 타입·기술 구성 가이드
function deckAnalysis(deck, foes) {
  const box = el('div', { class: 'solo-card' });
  box.append(el('p', { class: 'solo-verdict' }, '🧠 상대 덱 분석 & 구성 가이드'));
  box.append(el('p', { class: 'solo-why' }, '상대: ' + foes.map((f) => `${f.name}(${f.types.map((t) => TYPE_KO[t]).join('·')})`).join(' / ')));
  // 공격 타입 추천: 상대 몇 마리에게 효과가 굉장한지 빈도순
  const cnt = {};
  for (const t of Object.keys(TYPE_KO)) for (const f of foes) if (typeMultAgainst(t, f.types) >= 1.6) cnt[t] = (cnt[t] ?? 0) + 1;
  const atk = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (atk.length) box.append(el('p', { class: 'solo-stats' },
    '공격 기술 추천: ' + atk.map(([t, n]) => `${TYPE_KO[t]}(${n}마리 약점)`).join(' · ') + ' — 이 타입 기술을 가진 픽 위주로.'));
  // 받이 타입 추천: 상대 자속 공격을 2종 이상 반감하는 타입
  const stab = [...new Set(foes.flatMap((f) => f.types))];
  const guard = Object.keys(TYPE_KO)
    .map((t) => [t, stab.filter((s) => (DEX_DATA.chart[s]?.[t] ?? 1) < 1).length])
    .filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (guard.length) box.append(el('p', { class: 'solo-stats' },
    '몸으로 받기 좋은 타입: ' + guard.map(([t, n]) => `${TYPE_KO[t]}(자속 ${n}종 반감)`).join(' · ')));
  // 추천 덱 vs 상대 덱: 누가 누굴 맡는지 → 두 덱의 차이가 한눈에
  box.append(el('p', { class: 'solo-stats' }, '역할 분담: ' + deck.map(({ c }) => {
    const good = foes.filter((f) => foeFit(c, f) > 1).map((f) => f.name);
    return `${c.name} → ${good.length ? good.join('·') : '확실한 우위 없음'}`;
  }).join(' / ')));
  // 구멍: 추천 덱 누구도 상성 우위가 없는 상대 → 보완 방향 제시
  const holes = foes.filter((f) => !deck.some(({ c }) => foeFit(c, f) > 1));
  if (holes.length) box.append(el('p', { class: 'solo-why' },
    `⚠️ ${holes.map((f) => f.name).join('·')}를 확실히 이기는 픽이 없어요 — 아래 카운터 목록에서 ${holes.map((f) => `${topAtkType(f)} 기술`).join('·')} 픽으로 한 자리 바꿔보세요.`));
  else box.append(el('p', { class: 'solo-why' }, '✅ 상대 3마리 모두 상성 우위 픽이 있는 구성입니다.'));
  return box;
}

// 2026-09-03 진짜 추천 덱: 상대 입력 없이 리그 메타에서 3가지 컨셉으로 뽑는다
// 방어 배율: 타입 t 공격이 이 포켓몬에 들어가는 배율
function defMultOn(t, mon) { return typeMultAgainst(t, mon.types ?? []); }
function weakOf(mon) { return Object.keys(TYPE_KO).filter((t) => defMultOn(t, mon) > 1); }
// 덱에서 둘 이상이 같이 아픈 공격 타입
function sharedWeak(deck) { return Object.keys(TYPE_KO).filter((t) => deck.filter((m) => defMultOn(t, m) > 1).length >= 2); }

// 점수순 + 종 단위 중복 제거 상위 n
function topBySpecies(pool, n) {
  const seen = new Set();
  const out = [];
  for (const c of [...pool].sort((a, b) => b.score - a.score)) {
    if (seen.has(speciesKey(c))) continue;
    seen.add(speciesKey(c));
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

// 정석 코어: 1위에서 시작 → "점수 + 파트너 약점 반감 보너스 − 겹치는 약점 페널티" 그리디
function buildBalanced(top) {
  const deck = [top[0]];
  while (deck.length < 3) {
    let best = null, bestVal = -Infinity;
    for (const c of top) {
      if (deck.some((m) => speciesKey(m) === speciesKey(c))) continue;
      let cover = 0;
      for (const m of deck) for (const w of weakOf(m)) if (defMultOn(w, c) < 1) cover++;
      const val = c.score + cover * 2 - sharedWeak([...deck, c]).length * 4;
      if (val > bestVal) { bestVal = val; best = c; }
    }
    if (!best) break;
    deck.push(best);
  }
  return deck;
}

// 안티 메타: 리그 상위 10마리 상대 평균 상성 × 점수 순
function buildAntiMeta(top, exclude) {
  const meta = top.slice(0, 10);
  const deck = [];
  for (const { c } of top
    .filter((c) => !exclude.some((m) => speciesKey(m) === speciesKey(c)))
    .map((c) => ({ c, avg: meta.reduce((a, f) => a + foeFit(c, f), 0) / meta.length }))
    .sort((a, b) => b.avg * b.c.score - a.avg * a.c.score)) {
    if (deck.some((m) => speciesKey(m) === speciesKey(c))) continue;
    deck.push(c);
    if (deck.length === 3) break;
  }
  return deck;
}

// 타입 분산: 방어 타입이 하나도 안 겹치는 점수 상위 3마리 (못 채우면 점수순으로 보충)
function buildSpread(top, exclude) {
  const used = new Set();
  const deck = [];
  for (const c of top) {
    if (exclude.some((m) => speciesKey(m) === speciesKey(c))) continue;
    if (deck.some((m) => speciesKey(m) === speciesKey(c))) continue;
    if ((c.types ?? []).some((t) => used.has(t))) continue;
    deck.push(c);
    (c.types ?? []).forEach((t) => used.add(t));
    if (deck.length === 3) break;
  }
  for (const c of top) {
    if (deck.length === 3) break;
    if (exclude.concat(deck).some((m) => speciesKey(m) === speciesKey(c))) continue;
    deck.push(c);
  }
  return deck;
}

// 추천 덱 이유 문장: 서로 메워주는 관계·겹치는 약점을 실제로 계산해 설명
function recReason(deck, intro) {
  const parts = [intro];
  const covers = [];
  for (const m of deck) for (const w of weakOf(m)) {
    const p = deck.find((o) => o !== m && defMultOn(w, o) < 1);
    if (p) covers.push(`${m.name}의 ${TYPE_KO[w]} 약점은 ${josa(p.name, '이', '가')} 반감으로 받아줌`);
  }
  if (covers.length) parts.push([...new Set(covers)].slice(0, 3).join(', '));
  const sw = sharedWeak(deck);
  parts.push(sw.length
    ? `⚠️ 둘 이상 같이 아픈 타입: ${sw.map((t) => TYPE_KO[t]).join('·')} — 이 타입 상대가 나오면 조심`
    : '둘 이상 같이 아픈 타입이 없어 한 상성에 쓸리지 않음');
  return parts.join('. ') + '.';
}

function renderPvpDeck() {
  $controls.append(seg(LEAGUES.map((l) => ({ id: l.id, label: l.name })), state.deckLeague,
    (id) => { state.deckLeague = id; render(); }));

  // 2026-09-03 개편: ① 진짜 추천 덱 3종(각 3마리, 이유 포함) → ② PvP 커스텀 덱 짜기(상대 슬롯 기반)
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, 'PvP 덱 짜기'), el('span', { class: 'meta' }, '실험 기능')));

  const pool = PVP_DATA[state.deckLeague] ?? [];
  const top = topBySpecies(pool, 20);
  const meta = top.slice(0, 10);
  const d1 = buildBalanced(top);
  const d2 = buildAntiMeta(top, d1);
  const d3 = buildSpread(top, [...d1, ...d2]);
  const recs = [
    { title: '정석 코어', tag: '점수 상위 + 약점 상호 보완', deck: d1,
      reason: recReason(d1, `${LEAGUE_KO[state.deckLeague]}리그 점수 1위 ${josa(d1[0].name, '을', '를')} 중심으로, 서로 약점을 반감해주는 조합을 골랐어요`) },
    { title: '안티 메타', tag: '리그 상위 10마리 저격', deck: d2,
      reason: recReason(d2, `지금 메타 상위 10마리(${meta.slice(0, 3).map((m) => m.name).join('·')} 등) 상대 평균 상성이 가장 좋은 조합이에요`) },
    { title: '타입 분산', tag: '방어 타입 안 겹침', deck: d3,
      reason: recReason(d3, '방어 타입이 겹치지 않아 상대가 한 타입 기술로 셋을 다 뚫지 못해요') },
  ];
  recs.forEach((r, i) => {
    const body = el('div', { class: 'schedule-body no-star' },
      list(`pvprec-${state.deckLeague}-${i}`, r.deck, (c, j) => row(
        c, String(j + 1),
        el('span', { class: 'score' }, c.score.toFixed(1)),
        el('span', { class: 'sub' }, '리그 점수'))),
      el('p', { class: 'deck-reason' }, `💬 ${r.reason}`));
    const acc = el('details', { class: 'schedule deck-acc' },
      el('summary', {}, `🃏 추천 덱 ${i + 1} — ${r.title}`, el('span', { class: 'schedule-today' }, r.tag)),
      body);
    if (state.recAccOpen?.[i] ?? (i === 0)) acc.setAttribute('open', '');
    acc.addEventListener('toggle', () => { (state.recAccOpen ??= {})[i] = acc.open; });
    $content.append(acc);
  });

  // ② PvP 커스텀 덱 짜기 — 자주 만나는 상대를 슬롯에 넣으면 맞춤 추천
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, 'PvP 커스텀 덱 짜기'), el('span', { class: 'meta' }, '상대 기준 맞춤 추천')));

  // 맞춤 덱: 리그 점수 × 상대별 fit의 기하평균, 종 단위 중복 제거
  const ranked = state.deckFoes.length ? pool.map((c) => {
    const fits = state.deckFoes.map((f) => foeFit(c, f));
    const fit = fits.reduce((a, v) => a * v, 1) ** (1 / fits.length);
    return { c, fit, total: c.score * fit };
  }).sort((a, b) => b.total - a.total) : [];
  const usedSp = new Set();
  const deck = [];
  for (const r of ranked) {
    if (usedSp.has(speciesKey(r.c))) continue;
    usedSp.add(speciesKey(r.c));
    deck.push(r);
    if (deck.length === 3) break;
  }

  // [+][+][+] 슬롯 + 검색창
  const sugg = el('div', { class: 'boss-sugg' });
  const input = el('input', { class: 'boss-search', type: 'search', placeholder: '상대 포켓몬 검색해서 슬롯 채우기' });
  const slots = el('div', { class: 'deck-slots' }, ...[0, 1, 2].map((i) => {
    const f = state.deckFoes[i];
    return f
      ? el('button', { class: 'deck-slot filled', title: '누르면 제거', onclick: () => { state.deckFoes.splice(i, 1); render(); } },
          sprite(f.sprite), el('span', { class: 'slot-name' }, f.name), el('span', { class: 'slot-x' }, '✕'))
      : el('button', { class: 'deck-slot', 'aria-label': '상대 추가', onclick: () => input.focus() }, el('span', { class: 'slot-plus' }, '+'));
  }));
  input.addEventListener('input', () => {
    sugg.textContent = '';
    const q = input.value.trim();
    if (!q) return;
    for (const b of monSearch(bossIndex().filter((x) => !state.deckFoes.some((f) => f.name === x.name)), q, 6)) {
      sugg.append(el('button', { class: 'boss-rec', onclick: () => {
        if (state.deckFoes.length < 3) { state.deckFoes.push(b); track('pvp_deck_foe', { mon: b.name }); render(); }  // 2026-09-03 GA4: 커스텀 덱 사용량
      } }, sprite(b.sprite), el('span', {}, b.name)));
    }
  });
  $content.append(slots);
  if (state.deckFoes.length < 3) $content.append(input, sugg);  // 3칸 다 차면 검색창 숨김

  if (!state.deckFoes.length) {
    $content.append(el('p', { class: 'empty' }, '자주 만나는 상대를 [+]에 1~3마리 채우면, 걔들을 두루 잘 받아치는 맞춤 덱을 짜줍니다.'));
  } else if (deck.length) {
    $content.append(
      el('div', { class: 'list-head' }, el('h2', {}, '맞춤 추천 덱'), el('span', { class: 'meta' }, `상대 ${state.deckFoes.length}마리 기준`)),
      el('div', { class: 'no-star' }, list('pvpdeck', deck, ({ c, fit }, i) => row(
        c, String(i + 1),
        el('span', { class: 'score' }, c.score.toFixed(1)),
        el('span', { class: 'sub' }, `상성 계수 ×${fit.toFixed(2)}`)))));
  }

  // 3칸 다 채우면 분석 카드
  if (state.deckFoes.length === 3 && deck.length) $content.append(deckAnalysis(deck, state.deckFoes));

  for (const f of state.deckFoes) {
    // 2026-09-03 카운터도 종 단위 중복 제거 + 왜 카운터인지 이유 줄 표시
    const seen = new Set();
    const counters = [];
    for (const x of pool.map((c) => ({ c, fit: foeFit(c, f) })).sort((a, b) => b.fit * b.c.score - a.fit * a.c.score)) {
      if (seen.has(speciesKey(x.c))) continue;
      seen.add(speciesKey(x.c));
      counters.push(x);
      if (counters.length === 3) break;
    }
    $content.append(
      el('div', { class: 'list-head' }, el('h2', {}, `${f.name} 카운터`), el('span', { class: 'meta' }, '상위 3')),
      el('div', { class: 'no-star' }, list(`pvpdeck-counter-${f.name}`, counters, ({ c, fit }, i) => row(
        c, String(i + 1),
        el('span', { class: 'score' }, `×${fit.toFixed(2)}`),
        el('span', { class: 'sub' }, '상성 계수'),
        el('div', { class: 'moves counter-why' }, el('span', {}, counterWhy(c, f)))))));
  }
  $note.textContent = '실험 기능. 추천 덱 3종은 상대 입력 없이 리그 메타 기준으로 뽑습니다 — 정석 코어(점수 + 약점 상호 보완 그리디), 안티 메타(상위 10마리 상대 평균 상성순), 타입 분산(방어 타입 안 겹치게). 커스텀 덱 짜기는 PvPoke 리그 순위 × 타입 상성(공격 최대 배율 ÷ 피격 최대 배율)의 근사 추천 — 실드·기술 사이클·CP 최적화는 반영하지 않습니다. GO배틀리그 규칙상 같은 종은 파티에 1마리만(섀도우·일반도 같은 종)이라 모든 추천이 종 단위로 중복을 제거합니다. 슬롯 3칸을 다 채우면 상대 덱 분석과 구성 가이드가 나옵니다.';
}
