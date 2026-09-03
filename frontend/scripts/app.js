// 앱 상태와 최상위 렌더링
const state = { tab: 'max', league: 'great', pvpType: 'all', boss: 'overall', easyBoss: 'overall', maxBoss: 'overall', pveMode: 'easy', bossShow: 5, ifWho: 'solo', deckLeague: 'great', deckFoes: [], deckAccOpen: true, soloBossMon: null, soloTierOverride: null, soloMode: 'auto', soloLv50: false, soloBuff: 'none', soloMyDeck: [] };  // 2026-09-02 if 탭(솔플 계산기) 상태  // 2026-09-02 bossShow: 보스 추천 표시 개수  // 2026-09-02 pveMode: PvE 탭 통합
// 펼쳐진 목록 키 저장
const expanded = new Set();

const $tabs = document.getElementById('tabs');
const $controls = document.getElementById('controls');
const $content = document.getElementById('content');
const $note = document.getElementById('note');

function renderTabs() {
  $tabs.textContent = '';
  // 2026-09-02 PvE 일반·전체를 한 탭으로 통합해 메뉴 축소
  for (const [id, label] of [['max', 'D-MAX'], ['pve', 'PvE'], ['pvp', 'PvP'], ['usage', '활용처'], ['if', 'IF']]) {  // 2026-09-02 if 탭 추가
    // 2026-09-03 GA4: 탭 이름을 이벤트명에 포함(tab_max 등) — GA 이벤트 목록에서 설정 없이 탭별 순위가 바로 보임, 누를 때마다 1회씩 기록
    $tabs.append(el('button', { class: 'tab', role: 'tab', 'aria-selected': String(state.tab === id), onclick: () => { state.tab = id; track('tab_' + id, { tab: id }); render(); } }, label));
  }
}

// 2026-09-02 PvE 탭: 일반/전체 세부 토글 (PvP 리그 토글과 같은 seg)
function renderPveTab() {
  $controls.append(seg([{ id: 'easy', label: '일반' }, { id: 'all', label: '전체' }], state.pveMode,
    (id) => { state.pveMode = id; track('sub_pve_' + id); render(); }));  // 2026-09-03 GA4: 서브탭 사용량
  (state.pveMode === 'easy' ? renderPveEasy : renderPve)();
}

function render() {
  renderTabs();
  document.getElementById('boss-acc').style.display = 'none';  // 2026-09-02 D-MAX 탭에서만 renderBossAcc가 다시 켬
  $controls.textContent = '';
  $content.textContent = '';
  ({ max: renderMax, pve: renderPveTab, pvp: renderPvp, usage: renderUsage, if: renderIfTab })[state.tab]();
}

render();
// 2026-09-03 v2.2.1 첫 화면이 그려졌으니 로딩 가림막 제거 (페이드 후 DOM에서 삭제)
(() => {
  const sp = document.getElementById('splash');
  if (!sp) return;
  requestAnimationFrame(() => {
    sp.classList.add('done');
    setTimeout(() => sp.remove(), 300);
  });
})();
// 2026-09-03 GA4: 접속 시 처음 보이는 탭은 클릭이 없어 tab_* 에 안 잡히므로 별도 이벤트로 기록
// (tab_* 는 "일부러 눌러서 간" 횟수, tab_start 는 "접속하면 보이는" 횟수 — 섞이지 않게 분리)
track('tab_start', { tab: state.tab });
// 2026-09-03 자동 팝업 대신 새 패치노트 뱃지 (☰에 빨간 점)
initReleaseBadge();
// 2026-09-03 v2.2.0 로그인: 첫 화면이 그려진 뒤에 Firebase SDK를 받는다 (초기 로딩 영향 없음)
(document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r))).then(initAuth);
// 2026-09-03 PWA 오프라인 캐시 (배포 환경에서만 — 로컬 개발 중 캐시 꼬임 방지)
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) navigator.serviceWorker.register('sw.js').catch(() => {});
