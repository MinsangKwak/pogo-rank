// ─────────────────────────────────────────────────────────────────────────────
// planner/shell.js — 🌱 플래너 모드 셸 (2026-09-07 v2.15.0, QA-53)
//
// 무엇을 하나
//   한 앱에 두 모드를 둔다. 🔎 도감 모드(기존 화면 전부)와 🌱 플래너 모드(내 개체를 키우는 계획).
//   헤더의 모드 배지(#mode-toggle)를 누르면 전환되고, 탭 줄이 통째로 바뀐다. 전환 버튼은 이것 하나뿐이다 (v2.15.1).
//
// 모드는 해시가 정한다 (딥링크·뒤로가기가 그대로 동작하도록)
//   #/plan              플래너 홈            → state.appMode = 'plan', state.planTab = 'home'
//   #/plan/collection   내 포켓몬            → state.planTab = 'collection'
//   그 밖의 해시(없음 · #/dex 등) 전부      → 도감 모드
//   해시 없이 처음 열었을 때만 마지막 모드(localStorage pogo_plan_last)가 플래너면 #/plan 으로 보낸다(replaceState).
//   기본은 도감 모드 — 기존 사용자 동선은 그대로다.
//
// 제공하는 전역
//   PLAN_TABS · planRouteFromHash() · applyPlanRoute({ initial }) · switchMode(to, from)
//   updateModeBadge() · renderPlanTabs() · renderPlan() · initPlanShell()
//
// 의존하는 전역
//   el (dom.js) · track (track.js) · navigateHash · NAV (components/history.js) · closeDrawer · closeModal
//   state · $tabs · $controls · $content · $note · render (app.js — 호출 시점에는 정의돼 있다)
//   renderPlanHome (planner/home.js) · renderPlanCollection (planner/collection.js)
// ─────────────────────────────────────────────────────────────────────────────

const PLAN_LAST_KEY = 'pogo_plan_last';
// 번들은 파일 전체가 한 <script> 라 app.js 의 함수들은 호이스팅되지만 const state 는 초기화 전(TDZ)이다.
// pages.js 가 로드 직후 부르는 renderPage() 는 이 플래그로 "앱이 준비됐는지"를 판단한다 (initPlanShell 이 켠다)
let _planShellReady = false;
// [탭 id, 라벨] — 배열 순서가 곧 탭 줄 순서. 후속 버전(배틀·도구·일정)은 여기에 줄을 더한다
// 2026-09-08 v2.22.0 탭 라벨은 텍스트로 통일 — 도감 쪽 탭(D-MAX·PvE·PvP)과 같은 언어.
// 아이콘은 탭 줄 오른쪽 바로가기(📕 🧭 ★)에만 쓴다
const PLAN_TABS = [['home', '육성 현황'], ['collection', '내 포켓몬']];

// 현재 해시가 플래너 주소면 { tab, params }, 아니면 null
// 2026-09-08 v2.30.0 주소 해석은 router.js 가 한다 — 여기서 정규식을 또 쓰지 않는다
function planRouteFromHash() {
  const found = routeOf();
  if (!found || found.route.kind !== 'plan') return null;
  const tab = PLAN_TABS.some(([id]) => id === found.route.tab) ? found.route.tab : 'home';
  return { tab, params: found.params };
}

function savePlanLast(mode) {
  try { localStorage.setItem(PLAN_LAST_KEY, mode); } catch {}
}
function planLastMode() {
  try { return localStorage.getItem(PLAN_LAST_KEY) === 'plan' ? 'plan' : 'dex'; } catch { return 'dex'; }
}

// 해시를 읽어 서비스 홈·랭킹·플래너 상태를 맞춘다.
function applyPlanRoute() {
  const route = planRouteFromHash();
  // 해시 없는 첫 진입은 서비스 홈. 저장된 마지막 모드로 홈을 건너뛰지 않는다.
  state.appMode = route ? 'plan' : 'dex';
  if (!route) state.tab = routeOf()?.route.tab ?? 'home';   // v2.30.0 셸 라우트(#/dmax·#/pve·#/pvp)가 탭을 정한다
  state.planTab = route ? route.tab : 'home';
  state.planParams = route ? route.params : null;
  document.body.dataset.mode = state.appMode;  // CSS 가 모드별로 숨길 것(즐겨찾기 카드 등)을 고른다
  savePlanLast(state.appMode);
  updateModeBadge();
}

// 모드 전환. to 를 생략하면 반대 모드로. from 은 GA 용 진입 경로(badge · menu · home)
function switchMode(to, from = 'badge') {
  const target = to ?? (state.appMode === 'plan' ? 'dex' : 'plan');
  track('mode_switch', { to: target, from });
  savePlanLast(target);
  if (target === 'plan') {
    navigateHash(routeHash('planner'));
    return;
  }
  // 도감 모드 = 해시 없음. 열린 팝업·드로어는 닫고 메인으로 (goHome 과 같은 규칙)
  closeDrawer({ silent: true });
  closeModal({ silent: true });
  NAV.open = false;
  state.tab = 'home';
  if (location.hash) location.hash = '';
  else { applyPlanRoute(); render(); }
  window.scrollTo(0, 0);
}

// 헤더 배지·서문·메뉴 항목 문구를 현재 모드에 맞춘다
function updateModeBadge() {
  const isPlan = state.appMode === 'plan';
  const badge = document.getElementById('mode-toggle');
  if (badge) {
    badge.textContent = isPlan ? '🔎 도감' : '🌱 플래너';
    badge.title = isPlan ? '도감 모드로 전환' : '플래너 모드로 전환';
    badge.classList.toggle('is-plan', isPlan);
  }
  const tagline = document.querySelector('.tagline');
  if (tagline) tagline.textContent = isPlan ? '내 개체 키우기 계획' : '편하게 검색하세요';  // 배지와 한 줄에 들어가게 짧게
}

// 플래너 탭 줄 — 도감 모드의 D-MAX·PvE… 자리에 [홈 | 내 포켓몬] 이 들어간다. 탭 = 해시 이동이라 뒤로가기가 탭도 되돌린다
function renderPlanTabs() {
  for (const [id, label] of PLAN_TABS) {
    $tabs.append(el('button', {
      class: 'tabs__item', role: 'tab', 'aria-selected': String(state.planTab === id),
      onclick: () => {
        track('plan_tab', { tab: id });
        navigateHash(routeHash(id === 'home' ? 'planner' : `planner-${id}`));   // v2.30.0 주소는 router.js 표에서
      },
    }, label));
  }
}

// 플래너 화면 렌더러 — app.js render() 가 appMode === 'plan' 일 때 부른다
function renderPlan() {
  track('plan_view', { tab: state.planTab });
  ({ home: renderPlanHome, collection: renderPlanCollection })[state.planTab]();
}

function initPlanShell() {
  _planShellReady = true;
  // 2026-09-07 v2.15.1 모드 전환 버튼은 헤더 배지 하나뿐 (드로어 항목·플래너 홈 카드의 중복 버튼 제거)
  document.getElementById('mode-toggle')?.addEventListener('click', () => switchMode(undefined, 'badge'));
}
