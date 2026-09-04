// ============================================================================
// IF 탭 (실험 기능 모음) — 두 개의 서브 기능을 한 탭에 담는다.
//
//  ① 솔플 레이드 계산기 (renderSoloCalc)
//     입력: 잡고 싶은 레이드 보스 1마리(검색해서 선택) + 옵션(추천 덱 / 내 덱 검증,
//           레벨40 / 풀강50, 버프 없음 / 메가부스트 / 풀버프)
//     판정: 보스 티어(체력·제한시간)를 자동으로 정하고, 부활 운용 사이클을 시뮬레이션해
//           "혼자 제한 시간 안에 잡을 수 있는지"와 "부족하면 딜이 얼마나 모자란지"를 낸다.
//     출력: 가능/불가능 판정 카드 + 출전 순서대로 정렬된 필요 개체 목록.
//
//  ② PvP 덱 짜기 (renderPvpDeck)
//     입력: 리그 선택 + (선택 사항) 자주 만나는 상대 포켓몬 1~3마리
//     판정: 상대 입력이 없으면 리그 메타만으로 컨셉이 다른 추천 덱 3종을 뽑고,
//           상대를 넣으면 그 상대들에 대한 타입 상성 계수로 맞춤 덱과 상대별 카운터를 뽑는다.
//     출력: 추천 덱 3종(이유 문장 포함) + 맞춤 덱 + 상대 덱 분석 카드 + 카운터 목록.
//
// 두 기능 모두 "근사 추천"이다 — 기술 사이클·실드·CP 최적화 같은 세부는 반영하지 않고,
// 미리 계산된 순위 데이터(PVE_DATA / PVP_DATA)와 타입 상성표(DEX_DATA.chart)만 사용한다.
//
// 도메인 약어(코드 전반에서 그대로 씀):
//   DPS = damage per second, 초당 피해량
//   TDO = total damage output, 기절할 때까지 한 마리가 누적으로 넣는 총 피해량
//   CP  = combat power, 게임에 표시되는 전투력
//   CPM = CP multiplier, 레벨별 능력치 배율
//   STAB = same-type attack bonus, 자속(자기 타입과 같은 기술의 추가 배율)
// ============================================================================

// ── 솔플 레이드 계산기 ──────────────────────────────────────────────────────

// 2026-09-02 if 탭 > 실측 제공자: 솔플 레이드 계산기
// v4: 타입이 아니라 실제 보스(예: 메가거북왕)를 검색해 고르면 그 보스 상대 덱을 추천
// 부활 운용(기절→부활약→재진입) 사이클 시뮬레이션으로 정예 1~6마리 중 최속 구성 선택
// 2026-09-02 난이도는 선택이 아니라 보스별 절대값: 클래스/진화 단계로 자동 판정
//
// 티어별 체력·제한시간 표의 근거: 레이드 보스의 전투 체력은 개체 종족값과 무관하게
// 게임 구조상 티어마다 고정값이다(1성 600 · 3성 3,600 · 4성 9,000 · 5성/메가 15,000).
// 제한 시간도 티어 고정 — 1·3성은 180초, 4성 이상은 300초.
// 따라서 "이 보스를 솔플할 수 있나"는 곧 "이 티어의 고정 체력을 제한 시간 안에 깎을 수 있나"다.
const SOLO_TIERS = [
  { id: 't1', label: '1성', hp: 600, time: 180 },
  { id: 't3', label: '3성', hp: 3600, time: 180 },
  { id: 't4', label: '4성', hp: 9000, time: 300 },
  { id: 't5', label: '5성', hp: 15000, time: 300 },
  { id: 'mega', label: '메가', hp: 15000, time: 300 },
];

// 2026-09-02 개체별 CP: 보스 종족값으로 레이드 표시 CP와 풀강 최대 CP 계산
// 레이드 CP = (공격+15) × √(방어+15) × √(티어 HP) / 10 — 뮤츠 5성 54,148로 실측 검증
// (+15는 레이드 보스의 개체값 15/15/15 가정, √(티어 HP)는 개체 HP 자리에 티어 고정 체력을 넣은 것)
const CPM50 = 0.8403;  // 레벨50의 CP 배율(CPM)

// 보스의 종족값(공격·방어·체력)을 구한다. 빌드가 심어준 값이 있으면 그것을, 없으면 도감에서.
function bossStats(boss) {
  if (boss.ba) return { atk: boss.ba, def: boss.bd, hp: boss.bs };  // 2026-09-02 빌드 목록의 종족값 우선
  // 폼 스프라이트 키로 먼저 찾고, 없으면 기본 종의 도감 번호로 폴백
  return DEX_DATA.forms[String(boss.sprite)] ?? DEX_DATA.forms[String(DEX_DATA.dex[boss.sprite] ?? boss.sprite)];
}

// 레이드 화면에 표시되는 보스 CP: 체력 자리에 티어 고정 체력을 넣은 CP 공식
function raidCp(boss, tier) {
  const stats = bossStats(boss);
  return stats ? Math.floor((stats.atk + 15) * Math.sqrt(stats.def + 15) * Math.sqrt(tier.hp) / 10) : null;
}

// 잡은 뒤 레벨50까지 풀강했을 때의 최대 CP: 일반 CP 공식(개체값 15/15/15 · CPM50)
function maxCp(boss) {
  const stats = bossStats(boss);
  return stats ? Math.floor((stats.atk + 15) * Math.sqrt(stats.def + 15) * Math.sqrt(stats.hp + 15) * CPM50 * CPM50 / 10) : null;
}

// 보스 → 티어 자동 판정: 메가·원시 → 메가, 전설·환상·울트라비스트 → 4성, 최종 진화 → 3성, 그 외 1성
// 게임 내 실제 배치와 다르면 이 규칙만 고치면 됨
function inferTier(boss) {
  if (/^(메가|원시)/.test(boss.name)) return 'mega';
  const pokedexNumber = String(DEX_DATA.dex[boss.sprite] ?? boss.sprite);
  // DEX_DATA.cls에 값이 있으면 전설·환상·울트라비스트 계열
  const rarityClass = DEX_DATA.cls?.[pokedexNumber];
  if (rarityClass) return 't4';
  // 진화 트리가 있으면 마지막 단계에 속하는지로, 없으면 공격 종족값 160 이상을 최종 진화 근사치로 본다
  const evolutionChain = DEX_DATA.evo?.[pokedexNumber];
  const isFinalEvolution = evolutionChain
    ? evolutionChain[evolutionChain.length - 1].includes(Number(pokedexNumber))
    : (DEX_DATA.forms[pokedexNumber]?.atk ?? 0) >= 160;
  return isFinalEvolution ? 't3' : 't1';
}

// ── 부활 사이클 운용 모델의 손실 상수 ──
// 이 계산기는 "전멸하고 리로비(다시 입장)"가 아니라, 기절 직전에 이탈해서 부활약을 쓰고
// 같은 덱으로 재진입하는 실전 운용을 가정한다. 그래서 두 종류의 시간 손실만 센다.
const SWAP_LOSS = 1;      // 같은 팀 안에서 다음 포켓몬 교체(초)
// 2026-09-02 실측 반영(실측 제공자): 전멸 리로비가 아니라 기절 직전 이탈 → 부활 → 같은 덱 재진입, 5~6초
const REVIVE_LOSS = 5.5;

// 보스 검색 인덱스: 순위 데이터(메가·폼 포함) + 도감 기본 종 전체
// 한 번 만들면 캐시해서 재사용한다(BOSS_INDEX). 이름이 먼저 들어온 출처가 이긴다.
let BOSS_INDEX = null;
function bossIndex() {
  if (BOSS_INDEX) return BOSS_INDEX;
  const byName = new Map();
  const add = (pokemon) => {
    if (pokemon?.name && pokemon.types?.length && !byName.has(pokemon.name)) {
      byName.set(pokemon.name, {
        name: pokemon.name,
        types: pokemon.types,
        sprite: pokemon.sprite,
        ba: pokemon.ba,  // 종족값 공격
        bd: pokemon.bd,  // 종족값 방어
        bs: pokemon.bs,  // 종족값 체력
      });
    }
  };
  // 2026-09-02 빌드 생성 보스 목록(메가 전 종 포함)을 최우선으로
  (typeof BOSS_LIST !== 'undefined' ? BOSS_LIST : []).forEach(add);
  Object.values(PVE_DATA).forEach((rankingList) => rankingList.forEach(add));
  Object.values(DMAX_DATA).forEach((rankingList) => rankingList.forEach(add));
  Object.values(DMAX_TIER).forEach((rankingList) => rankingList.forEach(add));
  // 2026-09-02 활용처·가성비 목록도 포함 — 어태커 순위엔 없는 메가(예: 메가 칼라마네로)까지 커버
  ['usage', 'pvp', 'pve', 'both'].forEach((valueKey) => (VALUE_DATA[valueKey] ?? []).forEach(add));
  // 마지막으로 도감 전체를 채워 넣어 어떤 종이든 검색은 되게 한다
  for (const [pokedexNumber, name] of Object.entries(DEX_DATA.names)) {
    const formStats = DEX_DATA.forms[pokedexNumber];
    if (formStats?.types?.length && !byName.has(name)) {
      byName.set(name, { name, types: formStats.types, sprite: Number(pokedexNumber) });
    }
  }
  BOSS_INDEX = [...byName.values()];
  return BOSS_INDEX;
}

// 2026-09-02 v5 계산 현실화: 자체 계산의 고정 가정(보스 방어 200 · 초당 피해 30)을
// 선택 보스의 실제 종족값으로 보정. 풀강(레벨50)·버프 토글 반영
//
// PVE_DATA의 DPS·TDO는 "방어 200 / 초당 피해 30인 가상의 보스" 기준으로 미리 계산된 값이라
// 그대로 쓰면 실전과 어긋난다. 아래 두 상수는 실측 제공자의 메가 솔플 실측치에 맞춘 보정 계수다.
const TDO_CAL = 3;   // 실측 보정: 자체 계산이 어태커 생존을 과소평가(보스 초당피해 30 고정)해 3배 보정 — 실측 제공자 메가 솔플 실측 기준
const DPS_CAL = 1.2; // 실측 보정: 자체 계산 DPS가 실전 대비 보수적이라 +20%

// 버프 배율: 메가부스트만 걸면 +30%, 메가부스트 + 날씨 + 친구까지 겹치면 대략 +60%로 잡는다
const BUFFS = [
  { id: 'none', label: '버프 없음', m: 1 },
  { id: 'mega', label: '메가부스트 +30%', m: 1.3 },
  { id: 'full', label: '풀버프 +60%', m: 1.6 },  // 메가부스트 + 날씨 + 친구 대략치
];

// 이 보스 상대 카운터 풀을 실제 종족값·풀강·버프로 스케일링한다.
// 스케일링 근거:
//   200/보스방어 → 방어가 높은 보스일수록 내 DPS가 줄고, 그만큼 나도 오래 버텨(TDO↑ 방향) 준다.
//   200/보스공격 → 공격이 높은 보스일수록 내가 빨리 죽으므로 TDO만 줄인다.
function scaledPool(boss) {
  const stats = bossStats(boss) ?? {};
  const defenseScale = 200 / (stats.def || 200);           // 탱커 보스(방어↑)면 DPS↓ — 칼라마네로 케이스
  const attackScale = 200 / (stats.atk || 200);            // 공격 강한 보스면 내 생존(TDO)↓
  const levelDamageMult = state.soloLv50 ? 1.063 : 1;      // 풀강: CPM50/CPM40 = 딜 +6.3%
  const levelTdoMult = state.soloLv50 ? 1.2 : 1;           // 풀강: 내구·체력까지 → TDO 약 +20%
  const buffMult = BUFFS.find((buff) => buff.id === state.soloBuff).m;
  return counterPool(boss.types).map((attacker) => ({
    ...attacker,
    dps: attacker.dps * DPS_CAL * defenseScale * levelDamageMult * buffMult,
    tdo: Math.round(attacker.tdo * TDO_CAL * defenseScale * attackScale * levelTdoMult * buffMult),
  }));
}

// 보스 상대 카운터 풀: 보스 타입별 순위를 합치고, 복합 타입은 어태커 자속 타입 기준으로 근사 보정
// 복합 타입 보스는 타입별 순위를 각각 가져와서, 어태커의 첫 자속 타입이 "나머지 타입"에
// 얼마로 들어가는지를 곱해 근사한다. 같은 포켓몬이 두 타입 목록에 겹치면 DPS가 높은 쪽을 남긴다.
function counterPool(bossTypes) {
  const byName = new Map();
  for (let index = 0; index < bossTypes.length; index++) {
    const mainType = bossTypes[index];
    const otherType = bossTypes[1 - index];  // 단일 타입 보스면 undefined
    for (const attacker of PVE_DATA[mainType] ?? []) {
      const secondTypeAdjust = otherType ? (DEX_DATA.chart[attacker.types?.[0]]?.[otherType] ?? 1) : 1;
      const candidate = {
        ...attacker,
        dps: attacker.dps * secondTypeAdjust,
        tdo: Math.round(attacker.tdo * secondTypeAdjust),
      };
      const previous = byName.get(attacker.name);
      if (!previous || candidate.dps > previous.dps) byName.set(attacker.name, candidate);
    }
  }
  return [...byName.values()];
}

// 정예 k마리를 부활시켜 돌려쓰는 사이클 시뮬레이션
// 한 사이클 = 덱 전원이 각자 TDO만큼 딜을 넣고 전부 기절하기까지. 사이클을 다 돌면
// 부활약을 써서 같은 덱으로 다시 들어간다(REVIVE_LOSS). 사이클 안에서의 교체는 SWAP_LOSS.
// 반환: 총 소요 시간(초) · 필요한 사이클 수 · 총 부활 횟수
function simulateRevive(squad, tier) {
  const cycleDamage = squad.reduce((sum, member) => sum + member.tdo, 0);
  // 각 멤버가 자기 TDO를 다 쏟는 데 걸리는 시간(TDO/DPS)의 합 + 멤버 사이 교체 손실
  const cycleTime = squad.reduce((sum, member) => sum + member.tdo / member.dps, 0) + (squad.length - 1) * SWAP_LOSS;
  const fullCycles = Math.floor(tier.hp / cycleDamage);
  let remain = tier.hp - fullCycles * cycleDamage;
  // 재진입 로스는 "전멸 후 이어서 싸울 때"만: 잔여 딜이 남았으면 fullCycles회, 딱 떨어지면 fullCycles-1회
  let time = fullCycles * cycleTime + Math.max(0, fullCycles - (remain > 0 ? 0 : 1)) * REVIVE_LOSS;
  // 마지막 자투리 체력은 덱 앞쪽부터 필요한 만큼만 때려서 마무리
  for (const member of squad) {
    if (remain <= 0) break;
    const dealt = Math.min(member.tdo, remain);
    time += dealt / member.dps + (member === squad[0] ? 0 : SWAP_LOSS);
    remain -= dealt;
  }
  return {
    time: Math.round(time),
    cycles: fullCycles + (tier.hp - fullCycles * cycleDamage > 0 ? 1 : 0),
    revives: fullCycles * squad.length,
  };
}

// 2026-09-02 실측 제공자식 운용: 제일 잘난 애 1~2마리를 부활시켜 돌려쓴다
// DPS 상위 2마리만 후보로 두고 1마리 덱 / 2마리 덱을 각각 시뮬레이션해 더 빠른 쪽을 고른다.
function buildSoloPlan(candidates, tier) {
  const pool = [...candidates].sort((left, right) => right.dps - left.dps).slice(0, 2);
  let best = null;
  for (let squadSize = 1; squadSize <= pool.length; squadSize++) {
    const result = simulateRevive(pool.slice(0, squadSize), tier);
    if (!best || result.time < best.time) best = { ...result, squad: pool.slice(0, squadSize) };
  }
  if (best) best.possible = best.time <= tier.time;  // 제한 시간 안에 끝나면 솔플 가능
  return best;
}

// 2026-09-02 딜 총량 접근: 제한 시간 동안 이 덱이 넣을 수 있는 최대 딜을 시뮬레이션
// → "딜이 얼마라 얼마가 모자라서 못 잡았다"는 결론을 낼 수 있게
// simulateRevive와 방향이 반대다: 시간을 고정하고 그 안에 들어가는 누적 딜을 센다.
// cycle < 200은 무한 루프 방지용 상한.
function damageInTime(squad, tier) {
  let elapsed = 0;
  let dealtDamage = 0;
  let index = 0;
  let cycleCount = 0;
  while (elapsed < tier.time && cycleCount < 200) {
    const member = squad[index];
    // 기절할 때까지 싸우거나, 제한 시간이 먼저 끝나면 그때까지만
    const fightTime = Math.min(member.tdo / member.dps, tier.time - elapsed);
    dealtDamage += fightTime * member.dps;
    elapsed += fightTime;
    if (elapsed >= tier.time) break;
    index++;
    if (index >= squad.length) {
      // 덱 전원 소진 → 부활약 쓰고 처음부터 다시
      index = 0;
      cycleCount++;
      elapsed += REVIVE_LOSS;
    } else {
      elapsed += SWAP_LOSS;
    }
  }
  return Math.round(dealtDamage);
}

// 제한 시간 대비 여유(또는 부족) 비율 문구
function marginText(plan, tier) {
  const marginPercent = Math.round((tier.time - plan.time) / tier.time * 100);
  return marginPercent >= 0 ? `시간 여유 ${marginPercent}%` : `약 ${-marginPercent}% 부족`;
}

// 판정 카드 + 필요 개체 목록 노드를 만든다.
// 내 덱 검증 모드면 사용자가 넣은 순서 그대로 시뮬레이션하고, 아니면 추천 덱을 자동 구성한다.
function soloResultNodes(boss, tier) {
  const plan = state.soloMode === 'mine' && state.soloMyDeck.length
    ? { ...simulateRevive(state.soloMyDeck, tier), squad: state.soloMyDeck }
    : buildSoloPlan(scaledPool(boss), tier);
  if (plan && plan.possible === undefined) plan.possible = plan.time <= tier.time;
  if (!plan) return [el('p', { class: 'empty' }, '데이터가 없습니다.')];
  const typeLabel = boss.types.map((typeName) => TYPE_KO[typeName]).join('·');
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
  const dealtDamage = damageInTime(plan.squad, tier);
  const damageGap = dealtDamage - tier.hp;
  card.append(el('p', { class: 'solo-stats' }, damageGap >= 0
    ? `제한 시간 내 이 덱의 총 딜 약 ${dealtDamage.toLocaleString()} / 보스 체력 ${tier.hp.toLocaleString()} → 딜 여유 ${damageGap.toLocaleString()} (+${Math.round(damageGap / tier.hp * 100)}%)`
    : `제한 시간 내 이 덱의 최대 딜 약 ${dealtDamage.toLocaleString()} / 보스 체력 ${tier.hp.toLocaleString()} → ${(-damageGap).toLocaleString()} (${Math.round(-damageGap / tier.hp * 100)}%) 모자라서 못 잡음`));
  return [card,
    el('div', { class: 'list-head' },
      el('h2', {}, `필요 개체 ${plan.squad.length}마리 (이 순서로)`),
      el('span', { class: 'meta' }, `${boss.name} 상대 DPS순`)),
    list(`solo-${boss.name}-${tier.id}`, plan.squad, (member, index) => row(
      member, String(index + 1),
      el('span', { class: 'score' }, member.dps.toFixed(1)),
      el('span', { class: 'sub' }, `DPS · TDO ${member.tdo}`)))];
}

function renderSoloCalc() {
  // 2026-09-02 난이도 seg 제거 — 보스 선택 시 자동 판정 (배지 탭으로 수동 보정 가능)
  const tierId = state.soloBossMon ? (state.soloTierOverride ?? inferTier(state.soloBossMon)) : 't3';
  const tier = SOLO_TIERS.find((candidateTier) => candidateTier.id === tierId);

  // 보스 검색: 이름 일부 입력 → 후보 목록 → 선택
  const bossSuggestionBox = el('div', { class: 'boss-sugg' });
  const bossSearchInput = el('input', { class: 'boss-search', type: 'search', placeholder: '보스 이름 검색 (예: 메가거북왕, 자시안)', value: '' });
  bossSearchInput.addEventListener('input', () => {
    const query = bossSearchInput.value.trim();
    bossSuggestionBox.textContent = '';
    if (query.length < 1) return;
    const hits = monSearch(bossIndex(), query);  // 2026-09-03 전역 검색과 같은 필터(공백 무시·영문·정확도순)
    for (const boss of hits) {
      bossSuggestionBox.append(el('button', { class: 'boss-rec', onclick: () => {
        state.soloBossMon = boss;
        state.soloTierOverride = null;  // 새 보스면 자동 판정으로 리셋
        track('solo_calc_boss', { boss: boss.name });  // 2026-09-03 GA4: 솔플 계산기 사용량
        render();
      } }, sprite(boss.sprite), el('span', {}, boss.name)));
    }
    if (!hits.length) bossSuggestionBox.append(el('p', { class: 'empty' }, '검색 결과가 없습니다.'));
  });
  // 2026-09-02 v5: 추천 덱 / 내 덱 검증 모드 + 풀강·버프 토글
  $controls.append(el('div', { class: 'solo-opts' },
    seg([{ id: 'auto', label: '추천 덱' }, { id: 'mine', label: '내 덱 검증' }], state.soloMode,
      (id) => { state.soloMode = id; render(); }),
    seg([{ id: 'off', label: '레벨40' }, { id: 'on', label: '풀강50' }], state.soloLv50 ? 'on' : 'off',
      (id) => { state.soloLv50 = id === 'on'; render(); }),
    seg(BUFFS.map((buff) => ({ id: buff.id, label: buff.label })), state.soloBuff,
      (id) => { state.soloBuff = id; render(); })));

  // 2026-09-02 선택된 보스를 검색창 아래에 유지 표시 (✕로 해제)
  const pickedBossCard = state.soloBossMon
    ? el('div', { class: 'boss-selected' },
        sprite(state.soloBossMon.sprite),
        el('b', {}, state.soloBossMon.name),
        el('div', { class: 'boss-cp' },
          el('span', { class: 'meta' }, state.soloBossMon.types.map((typeName) => TYPE_KO[typeName]).join('·')),
          // 2026-09-02 개체별 레이드 CP · 최대 CP 표시
          el('span', { class: 'meta' }, (() => {
            const raidCpValue = raidCp(state.soloBossMon, tier);
            const maxCpValue = maxCp(state.soloBossMon);
            return [raidCpValue ? `레이드 CP ${raidCpValue.toLocaleString()}` : '', maxCpValue ? `풀강 최대 CP ${maxCpValue.toLocaleString()}` : ''].filter(Boolean).join(' · ');
          })())),
        // 2026-09-02 자동 판정된 난이도 배지: 탭하면 수동으로 한 단계씩 변경
        el('button', { class: 'tag boss-tier', title: '탭하면 난이도 수동 변경', onclick: () => {
          const currentTierIndex = SOLO_TIERS.findIndex((candidateTier) => candidateTier.id === tierId);
          state.soloTierOverride = SOLO_TIERS[(currentTierIndex + 1) % SOLO_TIERS.length].id;
          render();
        } }, `${tier.label}${state.soloTierOverride ? '' : ' 자동'}`),
        el('button', { class: 'boss-clear', 'aria-label': '선택 해제', onclick: () => { state.soloBossMon = null; state.soloTierOverride = null; render(); } }, '✕'))
    : null;
  $controls.append(bossSearchInput, bossSuggestionBox);
  if (pickedBossCard) $controls.append(pickedBossCard);

  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, '실측 제공자-솔플 레이드 계산기'),  // 2026-09-02 표기 변경
    el('span', { class: 'meta' }, '프로토타입 · 부활 운용')));

  if (!state.soloBossMon) {
    $content.append(el('p', { class: 'empty' }, '잡고 싶은 보스를 검색해서 골라주세요. 예: 메가거북왕을 고르면 풀·전기 정예 덱이 나옵니다.'));
  } else {
    // 2026-09-02 내 덱 검증 모드: 이 보스 상대 평가 가능한 어태커를 골라 조합 구성
    if (state.soloMode === 'mine') {
      // 평가 가능한 어태커 = 이 보스 상대 카운터 풀에 있는 포켓몬(수치가 있어야 시뮬레이션이 된다)
      const pool = scaledPool(state.soloBossMon);
      const deckSuggestionBox = el('div', { class: 'boss-sugg' });
      const deckSearchInput = el('input', { class: 'boss-search', type: 'search', placeholder: '내 어태커 검색해서 추가 (예: 자시안, 메가Y 뮤츠)' });
      deckSearchInput.addEventListener('input', () => {
        const query = deckSearchInput.value.trim();
        deckSuggestionBox.textContent = '';
        if (!query) return;
        // 이미 덱에 넣은 포켓몬은 후보에서 뺀다
        const hits = monSearch(pool.filter((attacker) => !state.soloMyDeck.some((deckMember) => deckMember.name === attacker.name)), query, 6);  // 2026-09-03 공용 필터
        for (const attacker of hits) {
          deckSuggestionBox.append(el('button', { class: 'boss-rec', onclick: () => {
            if (state.soloMyDeck.length < 6) { state.soloMyDeck.push(attacker); render(); }
          } }, sprite(attacker.sprite), el('span', {}, attacker.name)));
        }
        if (!hits.length) deckSuggestionBox.append(el('p', { class: 'empty' }, '이 보스 상대 상위 목록에 없어 평가할 수 없는 포켓몬이에요.'));
      });
      $content.append(el('div', { class: 'list-head' }, el('h2', {}, '내 덱'), el('span', { class: 'meta' }, `${state.soloMyDeck.length}/6 · 넣는 순서대로 출전`)), deckSearchInput, deckSuggestionBox);
      if (state.soloMyDeck.length) {
        $content.append(list('solo-mydeck', state.soloMyDeck, (member, index) => {
          // row()가 붙여둔 기본 클릭(상세 열기)을 떼기 위해 복제한 뒤 "덱에서 제거"를 다시 붙인다
          const listItem = row(member, String(index + 1),
            el('span', { class: 'score' }, member.dps.toFixed(1)),
            el('span', { class: 'sub' }, `DPS · TDO ${member.tdo}`)).cloneNode(true);
          listItem.addEventListener('click', () => { state.soloMyDeck.splice(index, 1); render(); });
          listItem.title = '누르면 덱에서 제거';
          return listItem;
        }));
      }
      if (!state.soloMyDeck.length) $content.append(el('p', { class: 'empty' }, '어태커를 추가하면 이 조합으로 되는지 판정해줍니다.'));
      else $content.append(...soloResultNodes(state.soloBossMon, tier).slice(0, 1));  // 판정 카드만 (목록은 위의 내 덱이 대신함)
    } else {
      $content.append(...soloResultNodes(state.soloBossMon, tier));
    }
  }
  $note.textContent = '프로토타입 가정: 자체 계산 PvE 수치(개체값 15/15/15) 기반에 선택 보스의 실제 방어·공격 종족값을 반영해 보정. 운용은 실측 제공자식 — 최정예 1~2마리를 기절 직전 이탈 → 부활(5~6초) → 재진입으로 돌려쓰는 방식 기준. 풀강50 토글은 딜 +6.3%·TDO +20%, 버프는 메가부스트 +30% / 풀버프(메가+날씨+친구) +60%. 실측 보정: 생존 3배 · DPS +20%. 기절 → 부활약 → 재진입 운용을 반영해 정예 1~6마리 중 가장 빨리 깎는 구성을 고릅니다 (교체 1초 · 전멸 후 재진입 13초). 난이도는 보스별로 자동 판정(메가·원시 → 메가, 전설·환상·울트라비스트 → 4성, 최종 진화 → 3성, 그 외 1성)이며 선택된 보스의 난이도 배지를 탭하면 수동 변경됩니다. 레이드 표시 CP는 개체 종족값 기반 계산값(공식 검증: 뮤츠 5성 54,148), 전투 체력은 게임 구조상 티어 고정 — 1성 600 · 3성 3,600 · 4성 9,000 · 5성/메가 15,000, 제한 1·3성 180초 / 그 외 300초. 복합 타입 보스의 두 번째 타입은 어태커 자속 타입 기준 근사 보정. 포켓몬을 누르면 상세 정보가 열립니다.';
}

// ── IF 탭 진입점 ────────────────────────────────────────────────────────────

// 2026-09-03 v2.1.0 IF 탭 = 실험 기능 모음: [솔플 레이드 계산기 | PvP 덱 짜기]
// app.js가 호출하는 유일한 진입점. 서브탭 선택(state.ifWho)에 따라 두 렌더러 중 하나를 실행.
function renderIfTab() {
  $controls.append(seg([{ id: 'solo', label: '솔플 레이드 계산기' }, { id: 'pvpdeck', label: 'PvP 덱 짜기' }], state.ifWho,
    (id) => { state.ifWho = id; track('sub_if_' + id); render(); }));  // 2026-09-03 GA4: 서브탭 사용량
  (state.ifWho === 'pvpdeck' ? renderPvpDeck : renderSoloCalc)();
}

// ── PvP 덱 짜기 ─────────────────────────────────────────────────────────────

// 2026-09-03 v2.1.0 PvP 덱 짜기 (실험, QA-16 발전형): 상대할 포켓몬을 1~3마리 넣으면
// 그 리그 순위 상위 중 상성으로 유리한 추천 덱 3마리 + 상대별 카운터를 보여준다
//
// 상성 계수 foeFit 정의: (내 자속이 상대를 때리는 최대 배율) ÷ (상대 자속이 나를 때리는 최대 배율).
// 1보다 크면 "때리는 게 받는 것보다 세다" = 상성 우위, 1보다 작으면 불리.
// 기술 구성이 아니라 타입만 보는 근사치라 자속(STAB)으로 찌른다고 가정한다.
function foeFit(candidate, foe) {
  // 공격: 내 자속 타입이 상대를 때리는 최대 배율 / 수비: 상대 타입이 나를 때리는 최대 배율
  const offenseMult = Math.max(...(candidate.types ?? ['normal']).map((typeName) => typeMultAgainst(typeName, foe.types)));
  const defenseMult = Math.max(...(foe.types ?? ['normal']).map((typeName) => typeMultAgainst(typeName, candidate.types ?? [])));
  return offenseMult / defenseMult;
}

// 2026-09-03 GO배틀리그 규칙: 같은 종은 파티에 1마리만 (섀도우·일반도 같은 종) — 종 단위 중복 제거 키
// 폼·섀도우가 달라도 같은 도감 번호면 같은 키가 나오므로, 이 키로 걸러야 규칙에 맞는 덱이 된다.
function speciesKey(pokemon) {
  return String(DEX_DATA.dex[pokemon.sprite] ?? pokemon.sprite);
}

// 배율 표시용 반올림 (소수 둘째 자리까지, 불필요한 0은 안 붙게)
function fmtMult(mult) {
  return String(Math.round(mult * 100) / 100);
}

// 받침 유무에 따라 조사 선택: josa('두드리짱','이','가') → '두드리짱이'
// 이유 설명 문장을 자동 생성하다 보면 "○○가/○○이"가 어색해지는데, 마지막 글자가 한글 음절이고
// 종성이 있으면 withFinalConsonant, 없으면 withoutFinalConsonant를 붙여 자연스럽게 만든다.
// (한글 음절 코드 0xAC00~0xD7A3에서 (코드 - 0xAC00) % 28 이 종성 인덱스)
function josa(word, withFinalConsonant, withoutFinalConsonant) {
  const lastCharCode = word.charCodeAt(word.length - 1);
  const hasFinalConsonant = lastCharCode >= 0xac00 && lastCharCode <= 0xd7a3 && (lastCharCode - 0xac00) % 28 > 0;
  return word + (hasFinalConsonant ? withFinalConsonant : withoutFinalConsonant);
}

// 2026-09-03 왜 카운터인지 한 줄 설명: 상대 타입 → 무슨 자속으로 찌르고, 상대 자속을 어떻게 받는지
// 내 자속 중 가장 잘 들어가는 타입 하나와, 상대 자속 중 내가 가장 아프게 받는 타입 하나를 뽑아 문장화.
function counterWhy(candidate, foe) {
  const foeKo = foe.types.map((typeName) => TYPE_KO[typeName]).join('·');
  // 내가 때리는 쪽: 배율이 가장 높은 자속 타입
  const bestOffense = (candidate.types ?? []).map((typeName) => [typeName, typeMultAgainst(typeName, foe.types)]).sort((left, right) => right[1] - left[1])[0];
  // 내가 받는 쪽: 상대 자속 중 배율이 가장 높은(= 가장 아픈) 타입
  const worstIncoming = (foe.types ?? []).map((typeName) => [typeName, typeMultAgainst(typeName, candidate.types ?? [])]).sort((left, right) => right[1] - left[1])[0];
  const offenseText = bestOffense[1] > 1
    ? `${foeKo} 타입은 ${josa(TYPE_KO[bestOffense[0]], '이', '가')} 약점 → ${TYPE_KO[bestOffense[0]]} 자속 ×${fmtMult(bestOffense[1])}`
    : bestOffense[1] === 1 ? `${TYPE_KO[bestOffense[0]]} 자속은 동등(×1)`
    : `자속(${TYPE_KO[bestOffense[0]]})은 ×${fmtMult(bestOffense[1])}로 반감되지만`;
  const incomingText = worstIncoming[1] < 1
    ? `받는 ${TYPE_KO[worstIncoming[0]]} 공격은 ×${fmtMult(worstIncoming[1])} 반감`
    : worstIncoming[1] === 1 ? '받는 공격은 ×1'
    : `단 ${TYPE_KO[worstIncoming[0]]} 공격은 ×${fmtMult(worstIncoming[1])}로 아프게 받음`;
  return `${offenseText} · ${incomingText}`;
}

// 상대 f를 가장 아프게 때리는 공격 타입 (분석 카드 보완 추천용)
function topAtkType(foe) {
  const bestType = Object.keys(TYPE_KO).sort((left, right) => typeMultAgainst(right, foe.types) - typeMultAgainst(left, foe.types))[0];
  return TYPE_KO[bestType];
}

// 2026-09-03 슬롯 3칸을 다 채우면: 추천 덱 vs 상대 덱 차이 분석 + 타입·기술 구성 가이드
// deck은 맞춤 추천 덱 엔트리 배열({ candidate, fit, total }), foes는 사용자가 넣은 상대 3마리.
function deckAnalysis(deck, foes) {
  const box = el('div', { class: 'solo-card' });
  box.append(el('p', { class: 'solo-verdict' }, '🧠 상대 덱 분석 & 구성 가이드'));
  box.append(el('p', { class: 'solo-why' }, '상대: ' + foes.map((foe) => `${foe.name}(${foe.types.map((typeName) => TYPE_KO[typeName]).join('·')})`).join(' / ')));
  // 공격 타입 추천: 상대 몇 마리에게 효과가 굉장한지 빈도순 (1.6배 이상을 "약점"으로 본다)
  const weaknessHitCount = {};
  for (const typeName of Object.keys(TYPE_KO)) {
    for (const foe of foes) {
      if (typeMultAgainst(typeName, foe.types) >= 1.6) weaknessHitCount[typeName] = (weaknessHitCount[typeName] ?? 0) + 1;
    }
  }
  const bestAtkTypes = Object.entries(weaknessHitCount).sort((left, right) => right[1] - left[1]).slice(0, 3);
  if (bestAtkTypes.length) box.append(el('p', { class: 'solo-stats' },
    '공격 기술 추천: ' + bestAtkTypes.map(([typeName, count]) => `${TYPE_KO[typeName]}(${count}마리 약점)`).join(' · ') + ' — 이 타입 기술을 가진 픽 위주로.'));
  // 받이 타입 추천: 상대 자속 공격을 2종 이상 반감하는 타입
  const foeStabTypes = [...new Set(foes.flatMap((foe) => foe.types))];
  const guardTypes = Object.keys(TYPE_KO)
    .map((typeName) => [typeName, foeStabTypes.filter((stabType) => (DEX_DATA.chart[stabType]?.[typeName] ?? 1) < 1).length])
    .filter(([, count]) => count >= 2).sort((left, right) => right[1] - left[1]).slice(0, 3);
  if (guardTypes.length) box.append(el('p', { class: 'solo-stats' },
    '몸으로 받기 좋은 타입: ' + guardTypes.map(([typeName, count]) => `${TYPE_KO[typeName]}(자속 ${count}종 반감)`).join(' · ')));
  // 추천 덱 vs 상대 덱: 누가 누굴 맡는지 → 두 덱의 차이가 한눈에
  box.append(el('p', { class: 'solo-stats' }, '역할 분담: ' + deck.map(({ candidate }) => {
    const favorableFoes = foes.filter((foe) => foeFit(candidate, foe) > 1).map((foe) => foe.name);
    return `${candidate.name} → ${favorableFoes.length ? favorableFoes.join('·') : '확실한 우위 없음'}`;
  }).join(' / ')));
  // 구멍: 추천 덱 누구도 상성 우위가 없는 상대 → 보완 방향 제시
  const holes = foes.filter((foe) => !deck.some(({ candidate }) => foeFit(candidate, foe) > 1));
  if (holes.length) box.append(el('p', { class: 'solo-why' },
    `⚠️ ${holes.map((foe) => foe.name).join('·')}를 확실히 이기는 픽이 없어요 — 아래 카운터 목록에서 ${holes.map((foe) => `${topAtkType(foe)} 기술`).join('·')} 픽으로 한 자리 바꿔보세요.`));
  else box.append(el('p', { class: 'solo-why' }, '✅ 상대 3마리 모두 상성 우위 픽이 있는 구성입니다.'));
  return box;
}

// 2026-09-03 진짜 추천 덱: 상대 입력 없이 리그 메타에서 3가지 컨셉으로 뽑는다
// 방어 배율: 타입 t 공격이 이 포켓몬에 들어가는 배율
function defMultOn(typeName, mon) {
  return typeMultAgainst(typeName, mon.types ?? []);
}

// 이 포켓몬이 아프게 받는(배율 > 1) 공격 타입 목록 = 약점
function weakOf(mon) {
  return Object.keys(TYPE_KO).filter((typeName) => defMultOn(typeName, mon) > 1);
}

// 덱에서 둘 이상이 같이 아픈 공격 타입
// (한 타입 기술에 덱 절반이 쓸려나가는 구성을 피하기 위한 페널티 지표)
function sharedWeak(deck) {
  return Object.keys(TYPE_KO).filter((typeName) => deck.filter((member) => defMultOn(typeName, member) > 1).length >= 2);
}

// 점수순 + 종 단위 중복 제거 상위 n
function topBySpecies(pool, limit) {
  const seenSpecies = new Set();
  const result = [];
  for (const candidate of [...pool].sort((left, right) => right.score - left.score)) {
    if (seenSpecies.has(speciesKey(candidate))) continue;
    seenSpecies.add(speciesKey(candidate));
    result.push(candidate);
    if (result.length === limit) break;
  }
  return result;
}

// 정석 코어: 1위에서 시작 → "점수 + 파트너 약점 반감 보너스 − 겹치는 약점 페널티" 그리디
// 세 컨셉 중 유일하게 "이미 뽑은 멤버와의 궁합"을 매 단계 다시 계산하는 방식이다.
// 보너스 2점 / 페널티 4점은 리그 점수(보통 80~100 스케일)와 균형을 맞춘 경험적 가중치.
function buildBalanced(top) {
  const deck = [top[0]];
  while (deck.length < 3) {
    let best = null;
    let bestVal = -Infinity;
    for (const candidate of top) {
      if (deck.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
      // cover: 이미 뽑은 멤버의 약점을 이 후보가 반감해주는 횟수
      let cover = 0;
      for (const member of deck) {
        for (const weakType of weakOf(member)) {
          if (defMultOn(weakType, candidate) < 1) cover++;
        }
      }
      const val = candidate.score + cover * 2 - sharedWeak([...deck, candidate]).length * 4;
      if (val > bestVal) { bestVal = val; best = candidate; }
    }
    if (!best) break;
    deck.push(best);
  }
  return deck;
}

// 안티 메타: 리그 상위 10마리 상대 평균 상성 × 점수 순
// 궁합은 안 보고 "지금 자주 만나는 얼굴들 전체에 평균적으로 강한지"만 본다.
// exclude로 정석 코어와 겹치는 종을 빼서 세 추천 덱이 서로 달라 보이게 한다.
function buildAntiMeta(top, exclude) {
  const meta = top.slice(0, 10);
  const deck = [];
  for (const { candidate } of top
    .filter((poolCandidate) => !exclude.some((member) => speciesKey(member) === speciesKey(poolCandidate)))
    .map((poolCandidate) => ({ candidate: poolCandidate, avg: meta.reduce((sum, foe) => sum + foeFit(poolCandidate, foe), 0) / meta.length }))
    .sort((left, right) => right.avg * right.candidate.score - left.avg * left.candidate.score)) {
    if (deck.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
    deck.push(candidate);
    if (deck.length === 3) break;
  }
  return deck;
}

// 타입 분산: 방어 타입이 하나도 안 겹치는 점수 상위 3마리 (못 채우면 점수순으로 보충)
// 상대가 한 타입 기술로 셋을 다 뚫지 못하게 하는 게 목적이라 상성 계산은 아예 안 쓴다.
function buildSpread(top, exclude) {
  const usedTypes = new Set();
  const deck = [];
  for (const candidate of top) {
    if (exclude.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
    if (deck.some((member) => speciesKey(member) === speciesKey(candidate))) continue;
    if ((candidate.types ?? []).some((typeName) => usedTypes.has(typeName))) continue;
    deck.push(candidate);
    (candidate.types ?? []).forEach((typeName) => usedTypes.add(typeName));
    if (deck.length === 3) break;
  }
  // 타입이 안 겹치는 조합만으로 3마리를 못 채웠으면 점수순으로 빈 자리를 메운다
  for (const candidate of top) {
    if (deck.length === 3) break;
    if (exclude.concat(deck).some((member) => speciesKey(member) === speciesKey(candidate))) continue;
    deck.push(candidate);
  }
  return deck;
}

// 추천 덱 이유 문장: 서로 메워주는 관계·겹치는 약점을 실제로 계산해 설명
// intro(컨셉 한 줄) + 상호 보완 관계 최대 3개 + 공통 약점 경고를 이어 붙인다.
function recReason(deck, intro) {
  const parts = [intro];
  const covers = [];
  for (const member of deck) {
    for (const weakType of weakOf(member)) {
      // 그 약점을 반감해주는 다른 멤버가 있으면 "받아준다"고 설명
      const coveringMember = deck.find((other) => other !== member && defMultOn(weakType, other) < 1);
      if (coveringMember) covers.push(`${member.name}의 ${TYPE_KO[weakType]} 약점은 ${josa(coveringMember.name, '이', '가')} 반감으로 받아줌`);
    }
  }
  if (covers.length) parts.push([...new Set(covers)].slice(0, 3).join(', '));
  const sharedWeakTypes = sharedWeak(deck);
  parts.push(sharedWeakTypes.length
    ? `⚠️ 둘 이상 같이 아픈 타입: ${sharedWeakTypes.map((typeName) => TYPE_KO[typeName]).join('·')} — 이 타입 상대가 나오면 조심`
    : '둘 이상 같이 아픈 타입이 없어 한 상성에 쓸리지 않음');
  return parts.join('. ') + '.';
}

function renderPvpDeck() {
  $controls.append(seg(LEAGUES.map((league) => ({ id: league.id, label: league.name })), state.deckLeague,
    (id) => { state.deckLeague = id; render(); }));

  // 2026-09-03 개편: ① 진짜 추천 덱 3종(각 3마리, 이유 포함) → ② PvP 커스텀 덱 짜기(상대 슬롯 기반)
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, 'PvP 덱 짜기'), el('span', { class: 'meta' }, '실험 기능')));

  const pool = PVP_DATA[state.deckLeague] ?? [];
  const top = topBySpecies(pool, 20);   // 종 단위 중복을 뺀 리그 점수 상위 20
  const meta = top.slice(0, 10);        // 그중 상위 10 = "지금 메타"
  const balancedDeck = buildBalanced(top);
  const antiMetaDeck = buildAntiMeta(top, balancedDeck);
  const spreadDeck = buildSpread(top, [...balancedDeck, ...antiMetaDeck]);
  const recommendations = [
    { title: '정석 코어', tag: '점수 상위 + 약점 상호 보완', deck: balancedDeck,
      reason: recReason(balancedDeck, `${LEAGUE_KO[state.deckLeague]}리그 점수 1위 ${josa(balancedDeck[0].name, '을', '를')} 중심으로, 서로 약점을 반감해주는 조합을 골랐어요`) },
    { title: '안티 메타', tag: '리그 상위 10마리 저격', deck: antiMetaDeck,
      reason: recReason(antiMetaDeck, `지금 메타 상위 10마리(${meta.slice(0, 3).map((member) => member.name).join('·')} 등) 상대 평균 상성이 가장 좋은 조합이에요`) },
    { title: '타입 분산', tag: '방어 타입 안 겹침', deck: spreadDeck,
      reason: recReason(spreadDeck, '방어 타입이 겹치지 않아 상대가 한 타입 기술로 셋을 다 뚫지 못해요') },
  ];
  recommendations.forEach((recommendation, index) => {
    const body = el('div', { class: 'schedule-body no-star' },
      list(`pvprec-${state.deckLeague}-${index}`, recommendation.deck, (candidate, slotIndex) => row(
        candidate, String(slotIndex + 1),
        el('span', { class: 'score' }, candidate.score.toFixed(1)),
        el('span', { class: 'sub' }, '리그 점수'))),
      el('p', { class: 'deck-reason' }, `💬 ${recommendation.reason}`));
    const accordion = el('details', { class: 'schedule deck-acc' },
      el('summary', {}, `🃏 추천 덱 ${index + 1} — ${recommendation.title}`, el('span', { class: 'schedule-today' }, recommendation.tag)),
      body);
    // 첫 번째만 기본으로 펼치고, 사용자가 접었다 펼친 상태는 state.recAccOpen에 기억
    if (state.recAccOpen?.[index] ?? (index === 0)) accordion.setAttribute('open', '');
    accordion.addEventListener('toggle', () => { (state.recAccOpen ??= {})[index] = accordion.open; });
    $content.append(accordion);
  });

  // ② PvP 커스텀 덱 짜기 — 자주 만나는 상대를 슬롯에 넣으면 맞춤 추천
  $content.append(el('div', { class: 'list-head' },
    el('h2', {}, 'PvP 커스텀 덱 짜기'), el('span', { class: 'meta' }, '상대 기준 맞춤 추천')));

  // 맞춤 덱: 리그 점수 × 상대별 fit의 기하평균, 종 단위 중복 제거
  // 기하평균을 쓰는 이유 — 한 상대에게 극단적으로 강해도 다른 상대에게 0에 가깝게 약하면
  // 곱이 작아져서 걸러진다(산술평균이면 극단값이 평균을 끌어올려 버린다).
  const ranked = state.deckFoes.length ? pool.map((candidate) => {
    const fits = state.deckFoes.map((foe) => foeFit(candidate, foe));
    const fit = fits.reduce((product, value) => product * value, 1) ** (1 / fits.length);
    return { candidate, fit, total: candidate.score * fit };
  }).sort((left, right) => right.total - left.total) : [];
  // GO배틀리그 같은 종 1마리 규칙: 점수 높은 순으로 훑으면서 처음 나온 종만 채택
  const usedSpecies = new Set();
  const deck = [];
  for (const entry of ranked) {
    if (usedSpecies.has(speciesKey(entry.candidate))) continue;
    usedSpecies.add(speciesKey(entry.candidate));
    deck.push(entry);
    if (deck.length === 3) break;
  }

  // [+][+][+] 슬롯 + 검색창
  const foeSuggestionBox = el('div', { class: 'boss-sugg' });
  const foeSearchInput = el('input', { class: 'boss-search', type: 'search', placeholder: '상대 포켓몬 검색해서 슬롯 채우기' });
  const slots = el('div', { class: 'deck-slots' }, ...[0, 1, 2].map((slotIndex) => {
    const foe = state.deckFoes[slotIndex];
    return foe
      ? el('button', { class: 'deck-slot filled', title: '누르면 제거', onclick: () => { state.deckFoes.splice(slotIndex, 1); render(); } },
          sprite(foe.sprite), el('span', { class: 'slot-name' }, foe.name), el('span', { class: 'slot-x' }, '✕'))
      : el('button', { class: 'deck-slot', 'aria-label': '상대 추가', onclick: () => foeSearchInput.focus() }, el('span', { class: 'slot-plus' }, '+'));
  }));
  foeSearchInput.addEventListener('input', () => {
    foeSuggestionBox.textContent = '';
    const query = foeSearchInput.value.trim();
    if (!query) return;
    // 이미 슬롯에 넣은 포켓몬은 후보에서 제외
    for (const foeCandidate of monSearch(bossIndex().filter((bossEntry) => !state.deckFoes.some((foe) => foe.name === bossEntry.name)), query, 6)) {
      foeSuggestionBox.append(el('button', { class: 'boss-rec', onclick: () => {
        if (state.deckFoes.length < 3) { state.deckFoes.push(foeCandidate); track('pvp_deck_foe', { mon: foeCandidate.name }); render(); }  // 2026-09-03 GA4: 커스텀 덱 사용량
      } }, sprite(foeCandidate.sprite), el('span', {}, foeCandidate.name)));
    }
  });
  $content.append(slots);
  if (state.deckFoes.length < 3) $content.append(foeSearchInput, foeSuggestionBox);  // 3칸 다 차면 검색창 숨김

  if (!state.deckFoes.length) {
    $content.append(el('p', { class: 'empty' }, '자주 만나는 상대를 [+]에 1~3마리 채우면, 걔들을 두루 잘 받아치는 맞춤 덱을 짜줍니다.'));
  } else if (deck.length) {
    $content.append(
      el('div', { class: 'list-head' }, el('h2', {}, '맞춤 추천 덱'), el('span', { class: 'meta' }, `상대 ${state.deckFoes.length}마리 기준`)),
      el('div', { class: 'no-star' }, list('pvpdeck', deck, ({ candidate, fit }, index) => row(
        candidate, String(index + 1),
        el('span', { class: 'score' }, candidate.score.toFixed(1)),
        el('span', { class: 'sub' }, `상성 계수 ×${fit.toFixed(2)}`)))));
  }

  // 3칸 다 채우면 분석 카드
  if (state.deckFoes.length === 3 && deck.length) $content.append(deckAnalysis(deck, state.deckFoes));

  for (const foe of state.deckFoes) {
    // 2026-09-03 카운터도 종 단위 중복 제거 + 왜 카운터인지 이유 줄 표시
    const seenSpecies = new Set();
    const counters = [];
    // 상성 계수 × 리그 점수가 높은 순 — 상성만 좋고 실전 성능이 낮은 픽이 위로 오지 않게
    for (const entry of pool.map((candidate) => ({ candidate, fit: foeFit(candidate, foe) })).sort((left, right) => right.fit * right.candidate.score - left.fit * left.candidate.score)) {
      if (seenSpecies.has(speciesKey(entry.candidate))) continue;
      seenSpecies.add(speciesKey(entry.candidate));
      counters.push(entry);
      if (counters.length === 3) break;
    }
    $content.append(
      el('div', { class: 'list-head' }, el('h2', {}, `${foe.name} 카운터`), el('span', { class: 'meta' }, '상위 3')),
      el('div', { class: 'no-star' }, list(`pvpdeck-counter-${foe.name}`, counters, ({ candidate, fit }, index) => row(
        candidate, String(index + 1),
        el('span', { class: 'score' }, `×${fit.toFixed(2)}`),
        el('span', { class: 'sub' }, '상성 계수'),
        el('div', { class: 'moves counter-why' }, el('span', {}, counterWhy(candidate, foe)))))));
  }
  $note.textContent = '실험 기능. 추천 덱 3종은 상대 입력 없이 리그 메타 기준으로 뽑습니다 — 정석 코어(점수 + 약점 상호 보완 그리디), 안티 메타(상위 10마리 상대 평균 상성순), 타입 분산(방어 타입 안 겹치게). 커스텀 덱 짜기는 PvPoke 리그 순위 × 타입 상성(공격 최대 배율 ÷ 피격 최대 배율)의 근사 추천 — 실드·기술 사이클·CP 최적화는 반영하지 않습니다. GO배틀리그 규칙상 같은 종은 파티에 1마리만(섀도우·일반도 같은 종)이라 모든 추천이 종 단위로 중복을 제거합니다. 슬롯 3칸을 다 채우면 상대 덱 분석과 구성 가이드가 나옵니다.';
}
