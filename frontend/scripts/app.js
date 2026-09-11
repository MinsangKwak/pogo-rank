// ─────────────────────────────────────────────────────────────────────────────
// app.js — 앱 상태와 최상위 렌더링 (build.py의 SCRIPTS 목록에서 가장 마지막에 붙는다)
//
// 제공하는 전역
//   state         화면 전체가 공유하는 단 하나의 상태 객체
//   expanded      list()가 "더보기"로 펼쳐 둔 목록 키 집합
//   $tabs · $controls · $content · $note   각 뷰가 그려 넣는 고정 컨테이너
//   renderTabs()  상단 탭 버튼 줄을 다시 그린다
//   renderPveTab() PvE 탭(일반/전체 서브탭) 렌더러
//   render()      상태를 화면에 반영하는 유일한 진입점. 상태를 바꾼 쪽은 반드시 이걸 부른다
//
// 의존하는 전역
//   el (dom.js) · seg (components/seg.js) · track (track.js)
//   renderMax · renderPve · renderPveEasy · renderPvp · renderSoloCalc · renderPvpDeck (views/*)
//   initReleaseBadge (components/release.js) · initMoveChangesMenu (components/changes.js) · initAuth (components/auth.js)
//
// 렌더링 흐름: 이 앱은 부분 갱신을 하지 않는다. 어떤 버튼이든 state를 고치고 render()를 부르면
// $controls·$content를 비우고 현재 탭 렌더러가 전부 새로 그린다. 그래서 각 뷰는 "지금 state로
// 화면을 처음부터 만드는 함수"로만 작성하면 되고, 펼침 상태처럼 살아남아야 하는 것만
// expanded 같은 전역에 따로 담아 둔다.
// ─────────────────────────────────────────────────────────────────────────────

// 앱 상태와 최상위 렌더링
const state = {
  appMode: 'dex',            // 2026-09-07 v2.15.0 (QA-53) 'dex'(도감, 기본) | 'plan'(🌱 플래너). 해시(#/plan*)가 정한다 — planner/shell.js applyPlanRoute
  planTab: 'home',           // 플래너 탭 — PLAN_TABS 의 id ('home' | 'collection')
  planParams: null,          // 플래너 해시의 쿼리(URLSearchParams) — 상세 팝업 → 내 개체 저장 프리필 등
  tab: 'max',                // 현재 탭 id (renderTabs가 만드는 버튼들의 id 중 하나)
  league: 'great',           // PvP 탭에서 고른 리그 (LEAGUES의 id)
  pvpType: 'all',            // PvP 탭 속성 필터. 'all'이면 필터 없음
  boss: 'overall',           // PvE '전체' 탭에서 고른 보스/속성 칩
  easyBoss: 'overall',       // PvE '일반' 탭에서 고른 칩 (전체 탭과 따로 기억한다)
  maxBoss: 'overall',        // D-MAX 탭에서 고른 칩
  maxAxis: 'all',            // 2026-09-07 v2.13.0 (QA-43) D-MAX 탭 세그먼트 — v2.14.0 (QA-52) [전체(티어표) | 딜러 | 탱커]
  pveMode: 'easy',           // 2026-09-02 pveMode: PvE 탭 통합 — 'easy'(일반) / 'all'(전체)
  bossShow: 5,               // 2026-09-02 bossShow: 보스 추천 표시 개수
  // 2026-09-07 v2.16.0 IF 탭 해체 — 솔플 계산기는 PvE 탭, PvP 덱 짜기는 PvP 탭의 오른쪽 도구 버튼으로 (활용처 탭은 검색 패널로)
  pveTool: null,             // PvE 탭 도구 — 'solo'(솔플 레이드 계산기 펼침) / null
  pvpTool: null,             // PvP 탭 도구 — 'deck'(PvP 덱 짜기 펼침) / null. 덱 리그는 state.league 를 그대로 쓴다
  deckFoes: [],              // 상대할 포켓몬 (최대 3칸)
  deckAccOpen: true,         // 덱 추천 아코디언 펼침 여부
  soloBossMon: null,         // 솔플 계산기에서 고른 보스. null이면 아직 고르기 전
  soloTierOverride: null,    // 사용자가 직접 고른 레이드 티어. null이면 보스로부터 자동 판정
  soloMode: 'auto',          // 'auto'(추천 덱) / 'mine'(내 덱 검증)
  soloLv50: false,           // 풀강50 기준으로 계산할지 (false면 레벨40)
  soloBuff: 'none',          // 적용할 버프 (BUFFS의 id)
  soloMyDeck: [],            // '내 덱 검증'에 넣은 어태커 (최대 6, 넣은 순서대로 출전)
};
// 펼쳐진 목록 키 저장
const expanded = new Set();

// ── 2026-09-06 v2.9.0 마지막 보기 기억 ─────────────────────────────────────
// GA 첫 3일: 시작 탭(tab_start)은 100% D-MAX인데 실제 클릭은 PvP·PvE로 몰렸고 세션당 3.5회를 다시 열었다.
// 열 때마다 같은 탭·리그·칩으로 옮기는 클릭을 없애기 위해 마지막 보기를 localStorage에 남긴다.
// 값은 전부 문자열 id라서 허용 목록으로 검증한 뒤에만 state에 넣는다 (옛 버전 값·손상 대비).
const LAST_VIEW_KEY = 'pogo_last_view';
const LAST_VIEW_FIELDS = ['tab', 'league', 'pvpType', 'boss', 'easyBoss', 'maxBoss', 'maxAxis', 'pveMode'];  // v2.16.0 ifWho·deckLeague 제거 (옛 값은 무시된다)
function restoreLastView() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(LAST_VIEW_KEY) || 'null'); } catch { return; }
  if (!saved || typeof saved !== 'object') return;
  const typeKeys = typeof TYPE_KO !== 'undefined' ? Object.keys(TYPE_KO) : [];
  const leagues = typeof LEAGUE_KO !== 'undefined' ? Object.keys(LEAGUE_KO) : ['little', 'great', 'ultra', 'master'];
  const allowed = {
    tab: ['max', 'pve', 'pvp'],  // v2.16.0 usage·if 탭 제거 — 옛 저장값은 허용 목록에서 걸러져 기본(max)으로
    league: leagues,
    pvpType: ['all', ...typeKeys],
    boss: ['overall', ...typeKeys], easyBoss: ['overall', ...typeKeys], maxBoss: ['overall', ...typeKeys],
    pveMode: ['easy', 'all'], maxAxis: ['all', 'dealer', 'tank'],
  };
  for (const key of LAST_VIEW_FIELDS) {
    if (typeof saved[key] === 'string' && allowed[key].includes(saved[key])) state[key] = saved[key];
  }
}
function saveLastView() {
  try { localStorage.setItem(LAST_VIEW_KEY, JSON.stringify(Object.fromEntries(LAST_VIEW_FIELDS.map((key) => [key, state[key]])))); } catch {}
}

const $tabs = document.getElementById('tabs');
const $controls = document.getElementById('controls');
const $content = document.getElementById('content');
const $note = document.getElementById('note');

// 상단 탭 버튼 줄을 처음부터 다시 만든다.
// 선택 표시는 CSS 클래스가 아니라 aria-selected로 하기 때문에(스타일과 스크린리더가 같은 값을 본다)
// 탭이 바뀔 때마다 줄 전체를 다시 그린다.
//
// 2026-09-08 v2.22.0 탭 줄 복구 — v2.21.0 에서 통째로 감췄더니 D-MAX ↔ PvE ↔ PvP 를 오가려면
// 매번 메뉴를 열거나 홈으로 돌아가야 했다. 셋은 형제 화면이라 한 번에 옮겨 다니는 줄이 맞다.
// 대신 이동은 v2.21.0 의 주소 체계(#/rank/…)를 그대로 쓴다 — 상단 바 제목·뒤로가기가 같이 맞춰진다.
// 서비스 홈에는 탭 줄이 없다 (홈 타일이 그 자리를 대신한다)
function renderTabs() {
  $tabs.replaceChildren();
  const onHome = state.appMode === 'dex' && state.tab === 'home';
  $tabs.hidden = onHome;
  if (onHome) return;
  // 2026-09-07 v2.15.0 (QA-53) 플래너 모드는 탭 줄이 통째로 바뀐다 — [육성 현황 | 🎒 내 포켓몬] (planner/shell.js)
  if (state.appMode === 'plan') return renderPlanTabs();
  // [탭 id, 버튼에 보이는 이름] 쌍. 배열 순서가 곧 화면에 보이는 탭 순서다
  // 2026-09-08 v2.30.0 [탭 id, 라벨, 라우트 id] — 주소는 router.js 의 표가 정한다
  for (const [id, label, routeId] of [['max', 'D-MAX', 'dmax'], ['pve', 'PvE', 'pve'], ['pvp', 'PvP', 'pvp']]) {
    // 2026-09-03 GA4: 탭 이름을 이벤트명에 포함(tab_max 등) — 누를 때마다 1회씩 기록
    // 2026-09-10 v2.48.1 로그인해야 쓰는 탭에는 자물쇠를 붙인다 — 눌러 보고 알게 하지 않는다.
    // 막지는 않는다: 눌러야 "왜 잠겼는지"와 로그인 버튼이 있는 화면으로 갈 수 있다
    const locked = typeof routeLocked === 'function' && routeLocked(routeId);
    $tabs.append(el('button', {
      class: `tabs__item${locked ? ' is-locked' : ''}`,
      role: 'tab',
      'aria-selected': String(state.tab === id),
      title: locked ? '로그인하면 열려요' : '',
      onclick: () => {
        track('tab_' + id, { tab: id });
        navigateHash(routeHash(routeId));  // 주소가 바뀌면 applyPlanRoute → render 가 돌고 상단 바 제목도 맞춰진다
      },
    }, label, locked ? el('span', { class: 'tabs__lock', 'aria-hidden': 'true' }, '🔒') : ''));
  }
  // 2026-09-06 v2.9.0 도감·상성·즐겨찾기 바로가기 — 탭이 아니라 "페이지로 가는 버튼"이라
  // aria-selected 없이 오른쪽 끝에 붙인다. 좁은 화면에서는 아이콘만 남는다(tabs.css)
  const quick = el('div', { class: 'tabs__quick' },
    el('button', { class: 'tabs__item tabs__item--quick', title: '도감', onclick: () => openPage('dex', 'tabbar') }, '📕', el('span', { class: 'tabs__label' }, ' 도감')),
    el('button', { class: 'tabs__item tabs__item--quick', title: '상성 검색', onclick: () => openPage('types', 'tabbar') }, '🧭', el('span', { class: 'tabs__label' }, ' 상성')));
  if (typeof authEnabled === 'function' && authEnabled() && AUTH.status === 'ok') {
    quick.append(el('button', { class: 'tabs__item tabs__item--quick', title: '즐겨찾기', onclick: () => openPage('favs', 'tabbar') }, '★', el('span', { class: 'tabs__label' }, ` 즐겨찾기 ${AUTH.favs.size}`)));
  }
  $tabs.append(quick);
}

// 2026-09-02 PvE 탭: 일반/전체 세부 토글 (PvP 리그 토글과 같은 seg)
// 토글만 직접 그리고, 실제 목록은 고른 모드에 맞는 뷰 함수에 넘긴다
function renderPveTab() {
  const modeSeg = seg([{ id: 'easy', label: '일반' }, { id: 'all', label: '전체' }], state.pveMode,
    (id) => {
      state.pveMode = id;
      state.pveTool = null;    // 서브탭을 고르면 도구는 접는다
      track('sub_pve_' + id);  // 2026-09-03 GA4: 서브탭 사용량
      render();
    });
  // 2026-09-07 v2.16.0 오른쪽 도구 버튼: 🧮 솔플 레이드 계산기 (옛 IF 탭). 누르면 티어표 자리에 계산기가 펼쳐지고, 다시 누르면 접힌다
  $controls.append(el('div', { class: 'controls__row' }, modeSeg, toolButton('🧮 솔플 계산기', state.pveTool === 'solo', () => {
    state.pveTool = state.pveTool === 'solo' ? null : 'solo';
    track('tool_solo', { on: state.pveTool ? 1 : 0 });
    render();
  })));
  if (state.pveTool === 'solo') return renderSoloCalc();
  (state.pveMode === 'easy' ? renderPveEasy : renderPve)();
}

// 2026-09-07 v2.16.0 탭 안 도구 버튼 — 세그먼트 오른쪽에 붙는 알약 버튼. 눌린 상태는 aria-pressed (seg·chip 과 같은 규칙)
function toolButton(label, pressed, onClick) {
  return el('button', { class: 'tool-btn', 'aria-pressed': String(pressed), onclick: onClick }, label);
}

// 현재 state를 화면에 반영한다. 상태를 바꾼 곳은 어디든 마지막에 이 함수를 부른다.
// 순서가 중요하다: 탭 줄 → 보스 아코디언 숨김 → 컨테이너 비우기 → 탭별 렌더러.
// 컨테이너를 먼저 비운 뒤에 렌더러를 불러야 뷰가 append만으로 화면을 만들 수 있다.
function render() {
  renderTabs();
  document.getElementById('boss-acc').style.display = 'none';  // 2026-09-02 D-MAX 탭에서만 renderBossAcc가 다시 켬
  $controls.textContent = '';
  $content.textContent = '';
  document.body.dataset.home = String(state.appMode === 'dex' && state.tab === 'home');
  if (state.appMode === 'dex' && state.tab === 'home') return renderServiceHome();
  // 2026-09-07 v2.15.0 (QA-53) 플래너 모드면 플래너 렌더러로 (도감 탭 상태는 건드리지 않는다)
  if (state.appMode === 'plan') return renderPlan();
  // 2026-09-10 v2.48.1 로그인해야 쓰는 탭(배틀 PvP)은 본문 대신 잠금 카드 (router.js ROUTES.locked)
  const tabRouteId = { max: 'dmax', pve: 'pve', pvp: 'pvp' }[state.tab];
  if (tabRouteId && routeLocked(tabRouteId)) {
    const name = tabRouteId === 'pve' ? '레이드 · PvE' : '배틀 · PvP';
    $content.append(lockedCardNode(name));
    $note.textContent = `로그인하면 열려요. 이 화면은 승인된 분만 볼 수 있어요.`;
    return;
  }
  // 탭 id → 그 탭을 그리는 함수. 찾아서 바로 호출한다
  ({ max: renderMax, pve: renderPveTab, pvp: renderPvp })[state.tab]();  // v2.16.0 usage·if 제거
  compactScreenFilters();
  saveLastView();  // 2026-09-06 v2.9.0 상태가 바뀌어 다시 그릴 때마다 마지막 보기를 남긴다
}

// 2026-09-06 v2.11.0 홈 — 열린 팝업·드로어를 닫고 서비스 홈으로.
// 2026-09-08 v2.22.0 진입점은 드로어 맨 위 "서비스 홈" 하나 (components/app-shell.js 가 여기로 연결).
// 상단 바의 제목은 이제 로고가 아니라 "지금 보는 화면 이름" 이라 누르는 버튼이 아니다
function goHome() {
  track('home');
  navigateHash('');
  window.scrollTo(0, 0);
}

// ── 최초 실행 (여기부터는 페이지가 열릴 때 한 번만 지나간다) ──
restoreLastView();  // 2026-09-06 v2.9.0 첫 렌더 전에 마지막 보기 복원
applyPlanRoute();  // 해시 없는 첫 방문은 서비스 홈으로 시작한다.
initPlanShell();
render();
// 2026-09-03 v2.2.1 첫 화면이 그려졌으니 로딩 가림막 제거 (페이드 후 DOM에서 삭제)
// 2026-09-07 v2.16.1 첫 화면의 스프라이트가 다 받아진 뒤에 걷는다(최대 2.5초) — 그림 없는 첫 화면이 보이지 않게 (components/sprite.js waitForSprites)
(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  const hide = () => requestAnimationFrame(() => {  // 클래스를 붙이기 전에 한 프레임 기다린다 — 같은 프레임에 붙이면 CSS 전환이 생략된다
    splash.classList.add('is-done');
    setTimeout(() => splash.remove(), 300);  // 300ms = 페이드 시간
  });
  (typeof waitForSprites === 'function' ? waitForSprites(2500) : Promise.resolve()).then(hide, hide);
})();
// 2026-09-03 GA4: 접속 시 처음 보이는 탭은 클릭이 없어 tab_* 에 안 잡히므로 별도 이벤트로 기록
// (tab_* 는 "일부러 눌러서 간" 횟수, tab_start 는 "접속하면 보이는" 횟수 — 섞이지 않게 분리)
// 2026-09-06 v2.9.0 standalone: 홈 화면 설치(PWA)로 열었는지 — 설치 사용자 비율을 본다. 복원된 탭이 들어가므로 이제 "시작 탭 분포 = 실제 선호"가 된다
const startedStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone ? 1 : 0;
track('tab_start', { tab: state.tab, standalone: startedStandalone });
// 2026-09-06 v2.9.0 GA4: 홈 화면 설치 완료 — 브라우저가 설치를 마쳤을 때 한 번 뜬다
window.addEventListener('appinstalled', () => track('pwa_install'));
// 2026-09-07 v2.18.0 통계 동의 배너 — 동의가 저장돼 있으면 GA 를 붙이고, 없으면 첫 화면에 배너 (components/consent.js)
initConsent();
// 2026-09-03 자동 팝업 대신 새 패치노트 뱃지 (☰에 빨간 점)
initReleaseBadge();
// 2026-09-04 시즌 기술 변경 안내: 변경 데이터가 있을 때만 메뉴에 항목이 뜬다
initMoveChangesMenu();
// 2026-09-05 즐겨찾기 메뉴는 로그인 뒤에 열리지만, 초기 상태(숨김)를 여기서 확정해 둔다
initFavsMenu();
// 2026-09-10 v2.47.0 화면 테마 버튼(해·달). 저장된 값은 index.html 의 head 스크립트가 이미 붙였고,
// 여기서는 버튼을 달고 얼굴을 맞춘다 (components/theme.js)
initTheme();
// 2026-09-10 v2.50.0 설치형 앱은 한 번 띄우면 그대로 살아 있어, 며칠 지나도 처음 받은 데이터를 보여 준다.
// 다시 보일 때 작은 표식 파일로 새 빌드가 있는지 확인한다 (components/freshness.js)
initFreshness();
// 2026-09-03 v2.2.0 로그인: 첫 화면이 그려진 뒤에 Firebase SDK를 받는다 (초기 로딩 영향 없음)
// 이미 load가 끝났으면 곧바로, 아니면 load 이벤트를 기다렸다가 initAuth를 부른다
(document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise((resolve) => window.addEventListener('load', resolve))
).then(initAuth);
// 2026-09-03 PWA 오프라인 캐시 (배포 환경에서만 — 로컬 개발 중 캐시 꼬임 방지)
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) navigator.serviceWorker.register('sw.js').catch(() => {});
