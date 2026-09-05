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
//   renderMax · renderPve · renderPveEasy · renderPvp · renderUsage · renderIfTab (views/*)
//   initReleaseBadge (components/release.js) · initMoveChangesMenu (components/changes.js) · initAuth (components/auth.js)
//
// 렌더링 흐름: 이 앱은 부분 갱신을 하지 않는다. 어떤 버튼이든 state를 고치고 render()를 부르면
// $controls·$content를 비우고 현재 탭 렌더러가 전부 새로 그린다. 그래서 각 뷰는 "지금 state로
// 화면을 처음부터 만드는 함수"로만 작성하면 되고, 펼침 상태처럼 살아남아야 하는 것만
// expanded 같은 전역에 따로 담아 둔다.
// ─────────────────────────────────────────────────────────────────────────────

// 앱 상태와 최상위 렌더링
const state = {
  tab: 'max',                // 현재 탭 id (renderTabs가 만드는 버튼들의 id 중 하나)
  league: 'great',           // PvP 탭에서 고른 리그 (LEAGUES의 id)
  pvpType: 'all',            // PvP 탭 속성 필터. 'all'이면 필터 없음
  boss: 'overall',           // PvE '전체' 탭에서 고른 보스/속성 칩
  easyBoss: 'overall',       // PvE '일반' 탭에서 고른 칩 (전체 탭과 따로 기억한다)
  maxBoss: 'overall',        // D-MAX 탭에서 고른 칩
  pveMode: 'easy',           // 2026-09-02 pveMode: PvE 탭 통합 — 'easy'(일반) / 'all'(전체)
  bossShow: 5,               // 2026-09-02 bossShow: 보스 추천 표시 개수
  // 2026-09-02 if 탭(솔플 계산기) 상태
  ifWho: 'solo',             // IF 탭 서브탭 — 'solo'(솔플 계산기) / 'pvpdeck'(PvP 덱 짜기)
  deckLeague: 'great',       // PvP 덱 짜기에서 고른 리그
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
const LAST_VIEW_FIELDS = ['tab', 'league', 'pvpType', 'boss', 'easyBoss', 'maxBoss', 'pveMode', 'ifWho', 'deckLeague'];
function restoreLastView() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(LAST_VIEW_KEY) || 'null'); } catch { return; }
  if (!saved || typeof saved !== 'object') return;
  const typeKeys = typeof TYPE_KO !== 'undefined' ? Object.keys(TYPE_KO) : [];
  const leagues = typeof LEAGUE_KO !== 'undefined' ? Object.keys(LEAGUE_KO) : ['little', 'great', 'ultra', 'master'];
  const allowed = {
    tab: ['max', 'pve', 'pvp', 'usage', 'if'],
    league: leagues, deckLeague: leagues,
    pvpType: ['all', ...typeKeys],
    boss: ['overall', ...typeKeys], easyBoss: ['overall', ...typeKeys], maxBoss: ['overall', ...typeKeys],
    pveMode: ['easy', 'all'], ifWho: ['solo', 'pvpdeck'],
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
function renderTabs() {
  $tabs.textContent = '';
  // 2026-09-02 PvE 일반·전체를 한 탭으로 통합해 메뉴 축소
  // [탭 id, 버튼에 보이는 이름] 쌍. 배열 순서가 곧 화면에 보이는 탭 순서다
  for (const [id, label] of [['max', 'D-MAX'], ['pve', 'PvE'], ['pvp', 'PvP'], ['usage', '활용처'], ['if', 'IF']]) {  // 2026-09-02 if 탭 추가
    // 2026-09-03 GA4: 탭 이름을 이벤트명에 포함(tab_max 등) — GA 이벤트 목록에서 설정 없이 탭별 순위가 바로 보임, 누를 때마다 1회씩 기록
    $tabs.append(el('button', {
      class: 'tab',
      role: 'tab',
      'aria-selected': String(state.tab === id),
      onclick: () => {
        state.tab = id;
        track('tab_' + id, { tab: id });
        render();
      },
    }, label));
  }
  // 2026-09-06 v2.9.0 도감·즐겨찾기 바로가기 — ☰ 안에만 있을 때 page_open(14)이 탭 클릭(~100)의 1/7이었다.
  // 탭이 아니라 "페이지로 가는 버튼"이라 aria-selected 없이 오른쪽 끝에 붙인다. 좁은 화면에서는 아이콘만 남는다(tabs.css)
  const quick = el('div', { class: 'tab-quick' },
    el('button', { class: 'tab quick', title: '도감', onclick: () => openPage('dex', 'tabbar') }, '📕', el('span', { class: 'lbl' }, ' 도감')));
  if (typeof authEnabled === 'function' && authEnabled() && AUTH.status === 'ok') {
    quick.append(el('button', { class: 'tab quick', title: '즐겨찾기', onclick: () => openPage('favs', 'tabbar') }, '★', el('span', { class: 'lbl' }, ` 즐겨찾기 ${AUTH.favs.size}`)));
  }
  $tabs.append(quick);
}

// 2026-09-02 PvE 탭: 일반/전체 세부 토글 (PvP 리그 토글과 같은 seg)
// 토글만 직접 그리고, 실제 목록은 고른 모드에 맞는 뷰 함수에 넘긴다
function renderPveTab() {
  $controls.append(seg([{ id: 'easy', label: '일반' }, { id: 'all', label: '전체' }], state.pveMode,
    (id) => {
      state.pveMode = id;
      track('sub_pve_' + id);  // 2026-09-03 GA4: 서브탭 사용량
      render();
    }));
  (state.pveMode === 'easy' ? renderPveEasy : renderPve)();
}

// 현재 state를 화면에 반영한다. 상태를 바꾼 곳은 어디든 마지막에 이 함수를 부른다.
// 순서가 중요하다: 탭 줄 → 보스 아코디언 숨김 → 컨테이너 비우기 → 탭별 렌더러.
// 컨테이너를 먼저 비운 뒤에 렌더러를 불러야 뷰가 append만으로 화면을 만들 수 있다.
function render() {
  renderTabs();
  document.getElementById('boss-acc').style.display = 'none';  // 2026-09-02 D-MAX 탭에서만 renderBossAcc가 다시 켬
  $controls.textContent = '';
  $content.textContent = '';
  // 탭 id → 그 탭을 그리는 함수. 찾아서 바로 호출한다
  ({ max: renderMax, pve: renderPveTab, pvp: renderPvp, usage: renderUsage, if: renderIfTab })[state.tab]();
  saveLastView();  // 2026-09-06 v2.9.0 상태가 바뀌어 다시 그릴 때마다 마지막 보기를 남긴다
}

// ── 최초 실행 (여기부터는 페이지가 열릴 때 한 번만 지나간다) ──
restoreLastView();  // 2026-09-06 v2.9.0 첫 렌더 전에 마지막 보기 복원
render();
// 2026-09-03 v2.2.1 첫 화면이 그려졌으니 로딩 가림막 제거 (페이드 후 DOM에서 삭제)
(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  // 클래스를 붙이기 전에 한 프레임 기다린다 — 같은 프레임에 붙이면 CSS 전환이 생략된다
  requestAnimationFrame(() => {
    splash.classList.add('done');
    setTimeout(() => splash.remove(), 300);  // 300ms = 페이드 시간
  });
})();
// 2026-09-03 GA4: 접속 시 처음 보이는 탭은 클릭이 없어 tab_* 에 안 잡히므로 별도 이벤트로 기록
// (tab_* 는 "일부러 눌러서 간" 횟수, tab_start 는 "접속하면 보이는" 횟수 — 섞이지 않게 분리)
// 2026-09-06 v2.9.0 standalone: 홈 화면 설치(PWA)로 열었는지 — 설치 사용자 비율을 본다. 복원된 탭이 들어가므로 이제 "시작 탭 분포 = 실제 선호"가 된다
const startedStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone ? 1 : 0;
track('tab_start', { tab: state.tab, standalone: startedStandalone });
// 2026-09-06 v2.9.0 GA4: 홈 화면 설치 완료 — 브라우저가 설치를 마쳤을 때 한 번 뜬다
window.addEventListener('appinstalled', () => track('pwa_install'));
// 2026-09-03 자동 팝업 대신 새 패치노트 뱃지 (☰에 빨간 점)
initReleaseBadge();
// 2026-09-04 시즌 기술 변경 안내: 변경 데이터가 있을 때만 메뉴에 항목이 뜬다
initMoveChangesMenu();
// 2026-09-05 즐겨찾기 메뉴는 로그인 뒤에 열리지만, 초기 상태(숨김)를 여기서 확정해 둔다
initFavsMenu();
// 2026-09-03 v2.2.0 로그인: 첫 화면이 그려진 뒤에 Firebase SDK를 받는다 (초기 로딩 영향 없음)
// 이미 load가 끝났으면 곧바로, 아니면 load 이벤트를 기다렸다가 initAuth를 부른다
(document.readyState === 'complete'
  ? Promise.resolve()
  : new Promise((resolve) => window.addEventListener('load', resolve))
).then(initAuth);
// 2026-09-03 PWA 오프라인 캐시 (배포 환경에서만 — 로컬 개발 중 캐시 꼬임 방지)
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) navigator.serviceWorker.register('sw.js').catch(() => {});
