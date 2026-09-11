'use strict';
// 2026-09-11 v2.61.0 🧬 PvP 개체값 순위 — 실험 기능 (백로그)
//
// ── 왜 만들었나 ────────────────────────────────────────────────────────────────
// PvE 와 PvP 는 "좋은 개체" 의 기준이 정반대다.
//   PvE  공격 개체값이 높을수록 좋다. 15/15/15 가 항상 1위라 볼 것이 없다.
//   PvP  리그마다 CP 상한이 있어, 공격이 **낮을수록** 같은 CP 안에서 레벨을 더 올릴 수 있다.
//        그래서 0/15/15 같은 조합이 1위가 되는 일이 흔하다.
// 서비스는 만렙 CP 와 리그 도달 레벨까지는 보여 줬지만 "이 개체가 그 리그에서 몇 위냐" 는
// 답하지 않았다. 그 한 줄이 없어서 사람들이 바깥 사이트로 나가 다시 찾아봤다.
//
// ── 무엇으로 순위를 매기나 (스탯 곱) ───────────────────────────────────────────
// CP 상한 안에서 가장 높은 레벨까지 올렸을 때의 공격 × 방어 × 체력 이 클수록 좋은 개체다.
//   공격 = (종족값.atk + IV.atk) × cpm
//   방어 = (종족값.def + IV.def) × cpm
//   체력 = floor((종족값.hp + IV.hp) × cpm)      ← 체력에만 floor
// 체력에만 내림을 쓰는 것이 핵심이다 — 게임이 체력을 정수로 끊기 때문에 순위가 계단처럼
// 갈라진다. 이걸 빼면 순위가 미세하게 어긋난다.
//
// ── 새 데이터 원본이 필요 없다 ────────────────────────────────────────────────
// 종족값은 data/dex.json 의 forms, 레벨별 배율은 같은 파일의 cpms 51개.
// 둘 다 이미 화면이 쓰고 있는 값이라 지어낸 수치가 하나도 없다.
//
// ── 쓰는 것 ───────────────────────────────────────────────────────────────────
//   el · pageBody · footNote · uchip (dom.js · components/ui.js)
//   DEX_DATA · LEAGUE_KO (data.js) · calcCp · cpmAt (components/pages.js)
//   sprite (components/sprite.js) · monSearch (components/search.js) · track (track.js)
// ─────────────────────────────────────────────────────────────────────────────

// 리그 CP 상한. 마스터는 상한이 없다 — planner/collection.js 의 PLAN_LEAGUES 와 같은 값이지만
// 이 화면은 그 파일보다 먼저 읽힐 수 있어 따로 적는다 (const 는 번들 전체로 끌어올려지지 않는다)
const IVRANK_LEAGUES = [['little', 500], ['great', 1500], ['ultra', 2500], ['master', null]];
const IVRANK_MAX_LEVEL = 50;   // 베스트 버디(+1)는 빼고 본다 — 모두가 가질 수 있는 조건이 아니다
const IVRANK_STORE = 'pogo_ivrank';

// 같은 종·같은 리그를 다시 볼 때를 위해 한 번 낸 표를 들고 있는다 (새로고침하면 사라진다)
const IVRANK_CACHE = new Map();

// 한 조합의 스탯 곱. 체력에만 floor 를 쓴다 (게임이 체력만 정수로 끊는다)
function ivStatProduct(form, level, atkIv, defIv, hpIv) {
  const m = cpmAt(level);
  const hp = Math.floor((form.hp + hpIv) * m);
  return (form.atk + atkIv) * m * ((form.def + defIv) * m) * hp;
}

// CP 상한을 넘지 않는 가장 높은 레벨. 상한이 없으면 만렙.
// CP 는 레벨에 대해 단조 증가하므로 반씩 좁혀 찾는다 (조합이 4,096개라 선형 탐색은 느리다)
function ivBestLevel(form, cap, atkIv, defIv, hpIv) {
  if (cap == null) return IVRANK_MAX_LEVEL;
  let low = 1, high = IVRANK_MAX_LEVEL, best = null;
  while (low <= high) {
    // 0.5 단위 레벨이라 중간값도 0.5 로 맞춘다
    const mid = Math.round((low + high)) / 2;
    const level = Math.floor(mid * 2) / 2;
    if (calcCp(form, level, atkIv, defIv, hpIv) <= cap) { best = level; low = level + 0.5; }
    else high = level - 0.5;
  }
  return best;
}

// 한 종·한 리그의 개체값 순위표. floorIv 아래 조합은 아예 빼고 센다 (획득 경로별 하한)
//   반환값 [{ ivs:[a,d,h], level, cp, product }] — 스탯 곱 내림차순
function ivRankTable(form, cap, floorIv) {
  const key = `${form.atk}/${form.def}/${form.hp}/${cap}/${floorIv}`;
  const cached = IVRANK_CACHE.get(key);
  if (cached) return cached;
  const rows = [];
  for (let atkIv = floorIv; atkIv <= 15; atkIv += 1) {
    for (let defIv = floorIv; defIv <= 15; defIv += 1) {
      for (let hpIv = floorIv; hpIv <= 15; hpIv += 1) {
        const level = ivBestLevel(form, cap, atkIv, defIv, hpIv);
        if (level == null) continue;   // Lv1 CP 가 이미 상한을 넘는다 (리틀리그의 전설 등)
        rows.push({
          ivs: [atkIv, defIv, hpIv],
          level,
          cp: calcCp(form, level, atkIv, defIv, hpIv),
          product: ivStatProduct(form, level, atkIv, defIv, hpIv),
        });
      }
    }
  }
  rows.sort((a, b) => b.product - a.product);
  IVRANK_CACHE.set(key, rows);
  return rows;
}

// 내 조합이 그 표에서 몇 번째인가 → { rank, total, percent, level, cp, best }
//   percent 는 1위 대비 스탯 곱 백분율 — "4위" 보다 "1위의 99.4%" 가 실제 차이를 말한다
function ivRankOf(form, cap, floorIv, ivs) {
  const rows = ivRankTable(form, cap, floorIv);
  if (!rows.length) return null;
  const [atkIv, defIv, hpIv] = ivs;
  const index = rows.findIndex((r) => r.ivs[0] === atkIv && r.ivs[1] === defIv && r.ivs[2] === hpIv);
  if (index < 0) return null;   // 하한 아래 조합을 물어본 경우
  const mine = rows[index];
  return {
    rank: index + 1,
    total: rows.length,
    percent: Math.round(mine.product / rows[0].product * 1000) / 10,
    level: mine.level,
    cp: mine.cp,
    best: rows[0],
  };
}

// 획득 경로마다 개체값 하한이 다르다 — 야생만 0부터 나온다.
// 하한이 올라가면 "0/15/15 가 1위" 같은 답이 아예 불가능해지므로 순위 자체가 달라진다
const IVRANK_FLOORS = [
  ['야생 · 교환', 0, '야생에서 잡거나 교환으로 받은 개체'],
  ['알 · 레이드 · 리서치', 10, '세 경로는 개체값이 10 아래로 내려가지 않아요'],
  ['섀도우 (교환 전)', 6, '섀도우는 6 아래가 나오지 않아요'],
];

function ivrankState() {
  try {
    const raw = localStorage.getItem(IVRANK_STORE);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') return saved;
  } catch { /* 저장 불가 환경 */ }
  return { sprite: null, ivs: [0, 15, 15], floor: 0 };
}
function ivrankSave(picked) {
  try { localStorage.setItem(IVRANK_STORE, JSON.stringify(picked)); } catch { /* 저장 불가 환경 */ }
}

// 리그 카드 한 장 — 순위 · 1위 대비 · 도달 레벨 · CP
function ivrankLeagueCard(form, league, cap, floorIv, ivs) {
  const name = `${LEAGUE_KO[league]}리그`;
  // 마스터는 CP 상한이 없어 개체값이 높을수록 좋다 — 순위를 매기면 15/15/15 가 늘 1위라 볼 것이 없다
  if (cap == null) {
    const level = IVRANK_MAX_LEVEL;
    return el('div', { class: 'ivrank__card ivrank__card--master' },
      el('div', { class: 'ivrank__lg' }, name, el('span', { class: 'meta' }, 'CP 상한 없음')),
      el('b', { class: 'ivrank__rank' }, '순위 없음'),
      el('span', { class: 'meta' }, `개체값이 높을수록 좋아요 · Lv${level} CP ${calcCp(form, level, ...ivs).toLocaleString()}`));
  }
  const got = ivRankOf(form, cap, floorIv, ivs);
  if (!got) {
    return el('div', { class: 'ivrank__card is-out' },
      el('div', { class: 'ivrank__lg' }, name, el('span', { class: 'meta' }, `CP ${cap}`)),
      el('b', { class: 'ivrank__rank' }, '못 들어가요'),
      el('span', { class: 'meta' }, 'Lv1 CP 가 이미 상한을 넘어요'));
  }
  const top = got.rank === 1;
  return el('div', { class: `ivrank__card${top ? ' is-top' : ''}` },
    el('div', { class: 'ivrank__lg' }, name, el('span', { class: 'meta' }, `CP ${cap}`)),
    el('b', { class: 'ivrank__rank' }, `${got.rank.toLocaleString()}위`,
      el('span', { class: 'ivrank__total' }, ` / ${got.total.toLocaleString()}`)),
    el('span', { class: 'ivrank__pct' }, `1위의 ${got.percent}%`),
    el('span', { class: 'meta' }, `Lv${got.level} · CP ${got.cp.toLocaleString()}`),
    el('span', { class: 'meta ivrank__best' }, `1위는 ${got.best.ivs.join('/')}`));
}

// "어디에 쓸까" 한 줄 — 상한이 있는 세 리그 중 순위가 가장 앞선 곳
function ivrankVerdict(form, floorIv, ivs) {
  const scored = [];
  for (const [league, cap] of IVRANK_LEAGUES) {
    if (cap == null) continue;
    const got = ivRankOf(form, cap, floorIv, ivs);
    if (got) scored.push({ league, got });
  }
  if (!scored.length) return el('p', { class: 'ivrank__verdict' }, el('b', {}, '들어갈 리그가 없어요'), ' 상한이 있는 리그는 Lv1 CP 가 이미 넘어요.');
  scored.sort((a, b) => a.got.rank - b.got.rank || b.got.percent - a.got.percent);
  const best = scored[0];
  return el('p', { class: 'ivrank__verdict' },
    el('b', {}, `${LEAGUE_KO[best.league]}리그에서 가장 쓸 만해요`),
    ` — 4,096 조합 중 ${best.got.rank.toLocaleString()}위 (1위의 ${best.got.percent}%).`);
}

// 그 리그의 상위 개체값 열 줄 — "그럼 뭘 노려야 하나" 에 답한다
function ivrankTopList(form, league, cap, floorIv, ivs) {
  if (cap == null) return '';
  const rows = ivRankTable(form, cap, floorIv).slice(0, 10);
  if (!rows.length) return '';
  const mineKey = ivs.join('/');
  return el('div', { class: 'ivrank__top' },
    el('div', { class: 'row-head' }, el('h2', {}, `${LEAGUE_KO[league]}리그 상위 10`),
      el('span', { class: 'meta' }, `CP ${cap} 기준`)),
    el('ol', { class: 'ivrank__list' }, ...rows.map((row, i) => el('li',
      { class: row.ivs.join('/') === mineKey ? 'is-mine' : '' },
      el('span', { class: 'ivrank__no' }, String(i + 1)),
      el('b', {}, row.ivs.join('/')),
      el('span', { class: 'meta' }, `Lv${row.level} · CP ${row.cp.toLocaleString()}`)))));
}

function renderIvRankPage() {
  track('ivrank_view');
  const picked = ivrankState();
  const $body = pageBody('ivrank');
  const $pick = el('div', { class: 'ivrank__pick' });
  const $chips = el('div', { class: 'tchips ivrank__floors' });
  const $out = el('div', { class: 'ivrank__out' });

  const drawOut = () => {
    $out.replaceChildren();
    if (picked.sprite == null) {
      $out.append(el('p', { class: 'empty' }, '위에서 종을 고르면 리그별 순위가 나와요.'));
      return;
    }
    const form = DEX_DATA.forms?.[picked.sprite] ?? DEX_DATA.forms?.[dexOf(picked.sprite)] ?? null;
    if (!form) { $out.append(el('p', { class: 'empty' }, '이 종의 종족값이 아직 없어요.')); return; }
    $out.append(ivrankVerdict(form, picked.floor, picked.ivs));
    $out.append(el('div', { class: 'ivrank__cards' },
      ...IVRANK_LEAGUES.map(([league, cap]) => ivrankLeagueCard(form, league, cap, picked.floor, picked.ivs))));
    // 상위 목록은 "가장 쓸 만한" 리그 것을 보여 준다 — 네 벌을 다 깔면 무엇을 볼지 모른다
    const scored = IVRANK_LEAGUES.filter(([, cap]) => cap != null)
      .map(([league, cap]) => ({ league, cap, got: ivRankOf(form, cap, picked.floor, picked.ivs) }))
      .filter((entry) => entry.got);
    scored.sort((a, b) => a.got.rank - b.got.rank);
    if (scored.length) $out.append(ivrankTopList(form, scored[0].league, scored[0].cap, picked.floor, picked.ivs));
  };

  // ── 종 고르기 (플래너 개체 추가와 같은 줄 — components/search.js monSuggestRow)
  const drawPick = () => {
    $pick.replaceChildren();
    if (picked.sprite != null) {
      const form = DEX_DATA.forms?.[picked.sprite] ?? null;
      const dex = dexOf(picked.sprite);
      $pick.append(el('div', { class: 'plan__picked' },
        sprite(picked.sprite),
        el('div', {},
          el('b', {}, DEX_DATA.names?.[dex ?? picked.sprite] ?? String(picked.sprite)),
          el('span', { class: 'meta' }, form ? `공격 ${form.atk} · 방어 ${form.def} · 체력 ${form.hp}` : '폼 데이터 없음')),
        el('button', { class: 'boss__clear', 'aria-label': '다른 종 고르기', onclick: () => {
          picked.sprite = null; ivrankSave(picked); drawPick(); drawOut();
        } }, '✕')));
      return;
    }
    const $input = el('input', { class: 'boss__search', placeholder: '종 이름 검색 (예: 레지스틸, 앱솔)', autocomplete: 'off' });
    const $sugg = el('div', { class: 'boss__sugg' });
    $input.addEventListener('input', () => {
      $sugg.textContent = '';
      const query = $input.value.trim();
      if (!query) return;
      const candidates = buildSearchIndex().filter((entry) => !/^(다이맥스|거다이맥스) /.test(entry.name));
      for (const hit of monSearch(candidates, query, 8)) {
        $sugg.append(monSuggestRow(hit, () => {
          picked.sprite = hit.sprite;
          ivrankSave(picked);
          drawPick(); drawOut();
        }));
      }
      if (!$sugg.childElementCount) $sugg.append(el('span', { class: 'sugg__none' }, '검색 결과가 없어요'));
    });
    $pick.append($input, $sugg);
  };

  // ── 획득 경로 칩 — 하한이 바뀌면 칩 상태와 개체값 칸이 함께 바뀐다
  const drawChips = () => {
    $chips.replaceChildren(...IVRANK_FLOORS.map(([label, value, why]) =>
      el('button', {
        class: `uchip${picked.floor === value ? ' is-on' : ''}`, title: why,
        onclick: () => {
          picked.floor = value;
          // 하한보다 낮은 칸은 하한으로 끌어올린다 — 있을 수 없는 조합을 물어보지 않게
          picked.ivs = picked.ivs.map((iv) => Math.max(iv, value));
          ivrankSave(picked);
          drawChips(); drawIvs(); drawOut();
        },
      }, label, el('b', {}, ` ${value}↑`))));
  };

  // ── 개체값 세 칸
  const ivBox = (index, label) => {
    const $input = el('input', {
      class: 'ivrank__iv', type: 'number', min: '0', max: '15', inputmode: 'numeric',
      value: String(picked.ivs[index]),
      oninput: () => {
        const value = Math.max(0, Math.min(15, Number($input.value) || 0));
        picked.ivs[index] = value;
        ivrankSave(picked);
        drawOut();
      },
    });
    return el('label', { class: 'ivrank__ivbox' }, el('span', { class: 'meta' }, label), $input);
  };
  const $ivs = el('div', { class: 'ivrank__ivs' });
  const drawIvs = () => $ivs.replaceChildren(ivBox(0, '공격'), ivBox(1, '방어'), ivBox(2, '체력'));

  $body.append(
    el('p', { class: 'note' }, '실험 기능이에요. ',
      el('b', {}, 'PvP 는 CP 상한이 있어 공격이 낮을수록 좋은 개체'), '가 돼요 — 같은 CP 안에서 레벨을 더 올릴 수 있어서예요. ',
      '그래서 0/15/15 같은 조합이 1위가 되는 일이 흔해요.'),
    el('div', { class: 'row-head' }, el('h2', {}, '어느 포켓몬인가요')),
    $pick,
    el('div', { class: 'row-head' }, el('h2', {}, '개체값'),
      el('span', { class: 'meta' }, '공격 · 방어 · 체력')),
    $ivs,
    el('div', { class: 'row-head' }, el('h2', {}, '어디서 얻었나요'),
      el('span', { class: 'meta' }, '하한이 달라 순위도 달라져요')),
    $chips,
    $out,
    footNote('순위는 CP 상한 안에서 가장 높은 레벨까지 올렸을 때의 공격 × 방어 × 체력(스탯 곱)으로 매겨요. ',
      '체력만 내림으로 끊는 게임 규칙까지 그대로 반영했고, 종족값과 레벨별 배율은 화면이 이미 쓰는 값 그대로예요. ',
      '베스트 버디(+1레벨)는 빼고 봐요 — 모두가 가질 수 있는 조건이 아니라서예요. ',
      '마스터리그는 CP 상한이 없어 개체값이 높을수록 좋아요(순위를 매기지 않아요).'));
  drawPick();
  drawIvs();
  drawChips();
  drawOut();
  return $body;
}

// ── 상세 팝업·패널에 붙는 PvP 블록 ───────────────────────────────────────────
// 스크린샷의 그 자리 — PvP 순위에서 포켓몬을 열었는데 "CP 100% 기준 2,544" 만 떴다.
// 그 숫자는 PvE 기준(15/15/15 만렙)이라 PvP 에서는 쓸 데가 없다.
// PvE 값은 그대로 두고, **PvP 순위에 오른 종에만** 리그별 최적 개체값을 덧붙인다.

// 이 종이 순위에 오른 리그들 → [{ league, cap, rank }]
// PVP_DATA 는 리그별 상위 40 (backend/build.py) — 화면이 보여 주는 그 목록과 같은 기준이다
function ivrankLeaguesOf(spriteId) {
  if (typeof PVP_DATA === 'undefined' || !PVP_DATA) return [];
  const out = [];
  for (const [league, cap] of IVRANK_LEAGUES) {
    const rows = PVP_DATA[league];
    if (!Array.isArray(rows)) continue;
    const hit = rows.find((row) => row.sprite === spriteId);
    if (hit) out.push({ league, cap, rank: hit.rank });
  }
  return out;
}

// 상세에 넣을 노드. 이 종이 PvP 순위에 없으면 아무것도 만들지 않는다 —
// 모든 종에 다 붙이면 "이 화면에 왜 이게 있지" 가 되고, 실제로 쓰는 사람은 순위권 종만 본다
function ivrankDetailNode(form, spriteId) {
  const leagues = ivrankLeaguesOf(spriteId);
  if (!form || !leagues.length) return '';
  const rows = leagues.map(({ league, cap, rank }) => {
    const table = ivRankTable(form, cap, 0);
    const best = table[0];
    if (!best) return '';
    return el('div', { class: 'ivrank__pick-row' },
      el('span', { class: 'ivrank__pick-lg' }, `${LEAGUE_KO[league]}리그`,
        el('span', { class: 'meta' }, ` 순위 ${rank}위`)),
      el('b', {}, best.ivs.join('/')),
      el('span', { class: 'meta' }, `Lv${best.level} · CP ${best.cp.toLocaleString()}`));
  }).filter(Boolean);
  if (!rows.length) return '';
  return el('details', { class: 'detail__acc ivrank__detail' },
    el('summary', {}, '🧬 PvP 라면 이 개체값',
      el('span', { class: 'ivrank__badge ivrank__badge--pvp' }, 'PvP')),
    el('div', { class: 'detail__acc-body' },
      el('p', { class: 'meta ivrank__why' }, 'PvP 는 CP 상한이 있어 공격이 낮을수록 레벨을 더 올릴 수 있어요. 그래서 100% 개체가 1위가 아니에요.'),
      ...rows,
      el('p', { class: 'meta ivrank__more' }, '🧬 PvP 개체값 순위 화면에서 내 개체가 몇 위인지 볼 수 있어요.')));
}
