// 2026-09-03 v2.2.0 로그인: Google 계정만, 관리자(ADMIN_EMAIL) 승인제. 즐겨찾기(★)를 계정에 저장
// Firebase compat SDK는 첫 렌더가 끝난 뒤 지연 로드 — 초기 로딩 속도(v2.0.0 최적화)를 지킨다
// FIREBASE_CONFIG가 비어 있으면(backend/build.py) 로그인 UI 자체가 안 뜨고 나머지 기능은 그대로
//
// ── 로그인 흐름: 세 가지 상태를 지나간다 (AUTH.status) ─────────────────────────
//   anon(비로그인)   로그인 버튼만 보인다. 즐겨찾기 ★를 누르면 곧바로 로그인 유도
//   pending(승인 대기) Google 로그인은 됐지만 아직 허용 목록(allowlist)에 없는 상태.
//                     requests 컬렉션에 본인 이메일로 요청 문서를 남기고 관리자 승인을 기다린다
//   ok(승인됨)        allowlist에 있거나 본인이 관리자. 즐겨찾기·트레이너 코드를 쓸 수 있다
//
// ── 접근 제어의 주체는 이 화면 코드가 아니다 ────────────────────────────────
// 여기서 하는 상태 판정·UI 숨김은 어디까지나 "보여주는 방식"일 뿐이고,
// 실제 접근 차단은 전부 Firestore 보안 규칙(firestore.rules)이 담당한다.
// 이 파일은 빌드되면 dist/index.html에 그대로 인라인되는 공개 코드이므로
// 누구나 읽고 고칠 수 있다 — 화면 조건문을 우회해도 규칙이 막아 준다는 전제로 짜여 있다.
// 그래서 실패 처리는 대체로 조용히 무시(.catch(() => {}))하거나 안내 문구만 띄운다.
//
// ── SDK를 지연 로드하는 이유 ────────────────────────────────────────────────
// firebase compat SDK 3개(app·auth·firestore)는 용량이 커서 첫 화면을 늦춘다.
// 로그인은 티어표를 보는 데 꼭 필요한 기능이 아니므로, 첫 렌더가 끝난 뒤
// initAuth()에서 순차적으로 <script>를 붙여 받아온다.
// 그래서 SDK가 도착하기 전에 사용자가 로그인 버튼을 누를 수 있고(AUTH.ready === false),
// 그 경우 signIn()은 "로그인 준비 중" 안내만 보여 준다.
//
// ── FIREBASE_CONFIG가 비면 로그인 UI가 아예 안 뜬다 ─────────────────────────
// build.py는 로컬/공개 빌드에 따라 FIREBASE_CONFIG를 비워 둘 수 있다.
// 설정이 없으면 SDK를 받아도 로그인이 불가능하므로, authEnabled()가 false일 때는
// 계정 영역과 헤더 👤 버튼을 감춰서 눌러도 안 되는 버튼을 노출하지 않는다.
const FIREBASE_VER = '12.18.0';
const AUTH = {
  ready: false,      // SDK 로드·초기화 완료
  user: null,        // firebase user
  status: 'anon',    // anon(비로그인) | pending(승인 대기) | ok(승인됨)
  admin: false,
  favs: new Set(),   // 즐겨찾기 도감번호
  roles: {},         // 2026-09-05 역할 수동 보정 — '도감번호|폼라벨' → ['pve'] / ['pvp'] / []
  db: null,
};

// 로그인 기능을 켤 수 있는 빌드인지 — FIREBASE_CONFIG.apiKey가 있어야 의미가 있다
function authEnabled() {
  return typeof FIREBASE_CONFIG !== 'undefined' && !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
}

// 로컬 테스트 목 모드 여부 — localhost/127.0.0.1 에서 주소에 ?mock 이 있을 때만 (자세한 사용법은 static/dev-mock.js 머리말)
function mockAuthWanted() {
  return ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('mock');
}

// allowlist·requests 문서 id로 쓰는 값. 보안 규칙(myEmail())도 소문자로 비교하므로 반드시 소문자
function authEmail() {
  return (AUTH.user?.email || '').toLowerCase();
}

// <script>를 붙여 외부 스크립트를 받아온다. 로드 완료/실패를 await로 기다리기 위한 래퍼
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function initAuth() {
  // SDK를 받기 전에 계정 영역을 먼저 그려 둔다 — 비로그인 상태의 로그인 버튼은 즉시 보인다
  renderAccount();
  if (!authEnabled()) return;
  // 2026-09-05 v2.7.1 로컬 테스트: localhost에서 ?mock 이 붙어 있으면 실제 SDK 대신 목(static/dev-mock.js)을 쓴다.
  // 로컬에서는 Google 팝업이 막히는 일이 잦아 로그인 뒤 화면(즐겨찾기 페이지·역할 보정·관리자 패널)을 볼 수 없었다.
  // hostname 조건 때문에 배포(github.io)에서는 이 분기가 절대 타지 않는다
  if (mockAuthWanted() && typeof window.firebase === 'undefined') {
    try {
      await loadScript('dev-mock.js');
    } catch {
      renderAccount('테스트 목(dev-mock.js) 로드 실패 — dist/ 를 다시 빌드하세요');
      return;
    }
  }
  // 테스트용 목(mock)이 이미 있으면 SDK를 안 받는다
  if (typeof window.firebase === 'undefined') {
    try {
      // app → auth → firestore 순서로 하나씩 기다린다: auth·firestore는 app이 먼저 있어야 한다
      for (const moduleName of ['app', 'auth', 'firestore']) {
        await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-${moduleName}-compat.js`);
      }
    } catch {
      renderAccount('SDK 로드 실패 — 네트워크를 확인하세요');
      return;
    }
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    AUTH.db = firebase.firestore();
    AUTH.ready = true;
    // PWA 리다이렉트 로그인으로 돌아온 경우의 결과 수거. 실패해도 onAuthStateChanged가 처리한다
    firebase.auth().getRedirectResult().catch(() => {});
    firebase.auth().onAuthStateChanged(onAuthChange);
  } catch (error) {
    renderAccount('초기화 실패: ' + (error.message || error));
  }
}

// 로그인·로그아웃·토큰 갱신마다 호출된다. 여기서 AUTH 상태를 다시 계산하고 화면을 갱신한다
async function onAuthChange(user) {
  AUTH.user = user;
  AUTH.status = 'anon';
  AUTH.admin = false;
  AUTH.favs = new Set();
  AUTH.roles = {};
  if (user) {
    const email = authEmail();
    // ADMIN_UID가 채워져 있으면 uid로 판정(공개 저장소에 이메일을 남기지 않기 위함), 없으면 이메일로 폴백
    // 주의: 여기서 쓰는 값은 firestore.rules의 isAdmin()과 반드시 같아야 한다.
    //       화면에서만 관리자로 보이고 규칙이 막으면 승인 버튼이 permission-denied로 실패한다.
    AUTH.admin = (typeof ADMIN_UID !== 'undefined' && ADMIN_UID)
      ? user.uid === ADMIN_UID
      : !!(typeof ADMIN_EMAIL !== 'undefined' && ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase());
    let approved = AUTH.admin;
    if (!approved) {
      // 규칙상 본인 이메일 문서는 읽을 수 있다 — 문서가 있으면 승인된 친구
      const snapshot = await AUTH.db.collection('allowlist').doc(email).get().catch(() => null);
      approved = !!(snapshot && snapshot.exists);
    }
    if (approved) {
      AUTH.status = 'ok';
      await loadFavs();
    } else {
      AUTH.status = 'pending';
      // 승인 요청 문서(본인 이메일)를 남긴다 — 관리자 패널에서 승인
      await AUTH.db.collection('requests').doc(email).set({
        email, name: user.displayName || '', photo: user.photoURL || '',
        at: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }
  }
  renderAccount();
  refreshFavUi();
  if (typeof renderFavDigest === 'function') renderFavDigest();
  TRAINERS_CACHE = null;  // 계정이 바뀌면 트레이너 코드도 다시 조회
  if (typeof renderTrainers === 'function') renderTrainers();
  // 2026-09-05 로그인 상태에 따라 ★ 즐겨찾기 메뉴 항목을 열고 닫는다
  if (typeof initFavsMenu === 'function') initFavsMenu();
  // 도감·즐겨찾기 페이지가 열려 있으면 ★ 표시를 다시 그린다
  if (typeof currentPageId === 'function' && ['dex', 'favs'].includes(currentPageId())) renderPage();
}

async function signIn() {
  if (!authEnabled()) return;
  // SDK 지연 로드가 아직 안 끝난 경우 — 버튼을 없애는 대신 잠시 후 다시 누르라고 안내
  if (!AUTH.ready) {
    renderAccount('로그인 준비 중… 잠시 후 다시 눌러주세요');
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // 홈 화면 설치(PWA) 환경은 팝업이 막히므로 리다이렉트 방식
  // 설치된 앱은 별도 창을 띄울 수 없어 팝업이 즉시 닫히거나 아예 열리지 않는다.
  // 리다이렉트는 같은 창에서 구글 로그인 화면으로 이동한 뒤 돌아오므로 PWA에서도 동작한다
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  try {
    if (standalone) await firebase.auth().signInWithRedirect(provider);
    else await firebase.auth().signInWithPopup(provider);
  } catch (error) {
    // 브라우저가 팝업을 막은 경우(popup-blocked·popup-closed 등)도 리다이렉트로 한 번 더 시도
    if (/popup/i.test(error.code || '')) {
      await firebase.auth().signInWithRedirect(provider).catch(() => {});
      return;
    }
    // 사용자가 연달아 눌러 앞선 팝업 요청이 취소된 경우는 오류가 아니므로 안내하지 않는다
    if (error.code !== 'auth/cancelled-popup-request') renderAccount('로그인 실패: ' + (error.code || error.message));
  }
}

function signOut() {
  if (AUTH.ready) firebase.auth().signOut();
}

// ── 즐겨찾기 ────────────────────────────────────────────
// 즐겨찾기는 폼(메가·리전폼)이 아니라 종 단위(도감번호)로 저장한다.
// 사용자가 "이 포켓몬을 키운다"고 표시하는 대상은 폼이 아니라 종이고,
// 도감번호 하나로 저장하면 도감·상세 팝업·검색 어디서든 같은 값으로 판정할 수 있다.
// users/{uid}.favs에 숫자 배열로 두어 arrayUnion/arrayRemove만으로 갱신된다(문서 전체를 안 덮어씀).
async function loadFavs() {
  const docRef = AUTH.db.collection('users').doc(AUTH.user.uid);
  const snapshot = await docRef.get().catch(() => null);
  const favs = snapshot && snapshot.exists ? (snapshot.data().favs || []) : [];
  AUTH.favs = new Set(favs.map(Number));
  // 2026-09-05 역할 보정: 자동 분류와 다를 때만 저장되므로 보통 비어 있다
  AUTH.roles = (snapshot && snapshot.exists ? snapshot.data().roles : null) || {};
  if (!snapshot || !snapshot.exists) {
    // 첫 로그인이면 빈 문서를 만들어 둔다 — 이후 즐겨찾기 갱신이 merge로 항상 성공하도록
    docRef.set({ email: authEmail(), name: AUTH.user.displayName || '', favs: [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
  }
}

// 승인된 사용자에게만 ★가 채워진다 — 승인 대기 중에는 저장이 안 되므로 표시도 하지 않는다
function isFav(dex) {
  return AUTH.status === 'ok' && AUTH.favs.has(Number(dex));
}

async function toggleFav(dex) {
  if (AUTH.status === 'anon') {
    signIn();
    return;
  }
  if (AUTH.status === 'pending') {
    renderAccount('승인 대기 중이라 아직 즐겨찾기를 저장할 수 없어요');
    openDrawer();
    return;
  }
  dex = Number(dex);
  const on = !AUTH.favs.has(dex);
  // 서버 응답을 기다리지 않고 화면을 먼저 바꾼다(낙관적 갱신) — 별을 눌렀을 때 즉시 반응하도록
  if (on) AUTH.favs.add(dex);
  else AUTH.favs.delete(dex);
  refreshFavUi(dex);
  renderAccount();
  if (typeof renderFavDigest === 'function') renderFavDigest();
  if (typeof initFavsMenu === 'function') initFavsMenu();   // 메뉴의 즐겨찾기 개수 갱신
  const fieldValue = firebase.firestore.FieldValue;
  await AUTH.db.collection('users').doc(AUTH.user.uid).set({
    email: authEmail(), favs: on ? fieldValue.arrayUnion(dex) : fieldValue.arrayRemove(dex), updatedAt: fieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

// 2026-09-05 역할 수동 보정 저장.
// 자동 분류(ROLES)가 맞으면 아무것도 저장하지 않고, 다를 때만 이 표에 예외로 남긴다.
// 그래서 대부분의 사용자 문서에는 roles 필드가 아예 없거나 몇 줄뿐이다.
//
// 키는 '도감번호|폼라벨' — backend/roles_build.py·pve_full.json과 같은 형식이라
// 아머드 뮤츠('150|아머드')와 일반 뮤츠('150|')가 갈린다.
// (섀도우는 상세 팝업이 기본 폼으로 열리므로 일반 폼과 보정을 공유한다)
async function setRole(formKey, roleList) {
  if (AUTH.status !== 'ok') {
    if (AUTH.status === 'anon') signIn();
    return;
  }
  // 낙관적 갱신 — 저장 응답을 기다리지 않고 화면부터 바꾼다
  if (roleList && roleList.length) AUTH.roles[formKey] = roleList;
  else delete AUTH.roles[formKey];
  const fieldValue = firebase.firestore.FieldValue;
  await AUTH.db.collection('users').doc(AUTH.user.uid).set({
    email: authEmail(), roles: AUTH.roles, updatedAt: fieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});
}

// ★ 버튼: 같은 도감번호의 버튼이 여러 곳(도감 목록·팝업)에 있어도 refreshFavUi로 동시에 갱신
// 그래서 버튼은 상태를 스스로 들고 있지 않고 data-dex만 남기며, 실제 표시는 AUTH.favs를 보고 정한다
function favBtn(dex, extraClass = '') {
  const on = isFav(dex);
  return el('button', { class: `fav${on ? ' on' : ''}${extraClass ? ' ' + extraClass : ''}`, 'data-dex': String(dex), 'aria-label': '즐겨찾기',
    title: AUTH.status === 'ok' ? '즐겨찾기 토글' : '로그인하면 즐겨찾기 저장',
    onclick: (event) => {
      // 카드 전체가 상세 팝업을 여는 클릭 대상이므로, ★는 팝업이 뜨지 않게 전파를 막는다
      event.stopPropagation();
      toggleFav(dex);
    } }, on ? '★' : '☆');
}

// onlyDex를 주면 그 도감번호의 버튼만, 없으면 화면의 모든 ★ 버튼을 다시 칠한다
// (로그인·로그아웃 때는 전체, 별 하나를 토글할 때는 해당 번호만)
function refreshFavUi(onlyDex) {
  for (const button of document.querySelectorAll('.fav[data-dex]')) {
    if (onlyDex != null && Number(button.dataset.dex) !== Number(onlyDex)) continue;
    const on = isFav(button.dataset.dex);
    button.classList.toggle('on', on);
    button.textContent = on ? '★' : '☆';
  }
  // 도감의 "★ 즐겨찾기 N" 칩 카운트도 갱신
  for (const chip of document.querySelectorAll('.fav-chip')) chip.textContent = `★ 즐겨찾기 ${AUTH.favs.size}`;
}

// ── 드로어 계정 영역 ────────────────────────────────────
// message를 주면 계정 영역 아래에 안내문을 함께 그린다(로그인 실패·승인 대기 안내 등).
// 상태가 바뀔 때마다 영역 전체를 비우고 다시 그리는 방식 — 세 상태의 UI가 서로 많이 달라서다
function renderAccount(message) {
  const accountBox = document.getElementById('account');
  const headerButton = document.getElementById('account-toggle');
  if (!accountBox) return;
  // 로그인을 쓸 수 없는 빌드에서는 계정 영역과 헤더 👤 버튼을 둘 다 감춘다
  if (!authEnabled()) {
    accountBox.hidden = true;
    if (headerButton) headerButton.hidden = true;
    return;
  }
  accountBox.hidden = false;
  if (headerButton) {
    headerButton.hidden = false;
    headerButton.textContent = '';
    if (AUTH.user?.photoURL) headerButton.append(el('img', { class: 'avatar', src: AUTH.user.photoURL, alt: '' }));
    else headerButton.textContent = '👤';
    // 승인 대기 중임을 헤더 버튼에서도 알 수 있게 표시(드로어를 열지 않아도 보이도록)
    headerButton.classList.toggle('pending', AUTH.status === 'pending');
  }
  accountBox.textContent = '';
  const note = message ? el('p', { class: 'acct-msg' }, message) : '';
  // (1) 비로그인
  if (!AUTH.user) {
    accountBox.append(
      el('button', { class: 'drawer-item acct-login', onclick: signIn }, '🔐 Google로 로그인'),
      el('p', { class: 'acct-sub' }, '승인된 친구만 사용할 수 있어요. 로그인하면 즐겨찾기 ★를 내 계정에 저장합니다. ',
        el('a', { href: '#/privacy' }, '수집하는 개인정보 보기')),
      note);
    return;
  }
  const who = el('div', { class: 'acct-who' },
    AUTH.user.photoURL ? el('img', { class: 'avatar', src: AUTH.user.photoURL, alt: '' }) : el('span', { class: 'avatar' }, '👤'),
    el('div', {}, el('b', {}, AUTH.user.displayName || '(이름 없음)'), el('span', { class: 'acct-email' }, authEmail())));
  // (2) 승인 대기 — 쓸 수 있는 기능이 없으므로 안내와 로그아웃만
  if (AUTH.status === 'pending') {
    accountBox.append(who,
      el('p', { class: 'acct-sub acct-pending' }, '⏳ 승인 대기 중 — 관리자가 승인하면 즐겨찾기를 쓸 수 있어요. 관리자에게 알려주세요!'),
      note,
      el('button', { class: 'drawer-item', onclick: signOut }, '로그아웃'));
    return;
  }
  // (3) 승인됨 — 즐겨찾기 개수와 바로가기, 관리자에게만 승인 패널 버튼
  accountBox.append(who,
    el('p', { class: 'acct-sub' }, `★ 즐겨찾기 ${AUTH.favs.size}마리 · 도감에서 별을 눌러 채워보세요`),
    note,
    el('div', { class: 'acct-actions' },
      el('button', { class: 'drawer-item', onclick: () => { closeDrawer(); openPage('dex'); } }, '📕 도감에서 채우기'),
      AUTH.admin ? el('button', { class: 'drawer-item', onclick: openAdminPanel }, '🔑 가입 승인') : '',
      el('button', { class: 'drawer-item', onclick: signOut }, '로그아웃')));
}

// ── 관리자 패널: 승인 요청 → 허용 목록 ───────────────────
// requests(가입 요청)와 allowlist(승인된 친구)를 나란히 보여 주고,
// 승인하면 allowlist에 문서를 만들고 requests에서 지운다.
// 이 패널은 관리자에게만 보이지만, 실제 쓰기 권한은 firestore.rules의 isAdmin()이 통제한다
async function openAdminPanel() {
  if (!AUTH.admin) return;
  closeDrawer();  // 드로어가 팝업 위에 겹치지 않게
  // 조회를 기다리기 전에 팝업 틀을 먼저 띄운다 — 누른 즉시 반응이 보이도록
  const body = el('div', { class: 'detail admin' }, el('h2', {}, '🔑 가입 승인'));
  openModal(body);
  const [requests, allow] = await Promise.all([
    AUTH.db.collection('requests').get().catch(() => null),
    AUTH.db.collection('allowlist').get().catch(() => null),
  ]);
  // 두 컬렉션 모두 문서 id가 이메일이라 id 비교로 "이미 승인된 요청"을 걸러낼 수 있다
  const allowed = new Set((allow?.docs || []).map((doc) => doc.id));
  const pending = (requests?.docs || []).filter((doc) => !allowed.has(doc.id));
  const renderSection = (title, rows, emptyText) => el('section', { class: 'd-sec' }, el('h3', {}, title),
    rows.length ? el('div', { class: 'admin-rows' }, ...rows) : el('p', { class: 'empty' }, emptyText));
  body.append(renderSection('승인 대기', pending.map((doc) => adminRow(doc.id, doc.data(), '승인', async () => {
    await AUTH.db.collection('allowlist').doc(doc.id).set({ approved: true, name: doc.data().name || '', at: firebase.firestore.FieldValue.serverTimestamp() });
    await AUTH.db.collection('requests').doc(doc.id).delete().catch(() => {});
    // 목록을 부분 수정하지 않고 패널을 다시 열어 최신 상태로 그린다
    openAdminPanel();
  })), '대기 중인 요청이 없어요.'));
  body.append(renderSection('승인된 친구', (allow?.docs || []).map((doc) => adminRow(doc.id, doc.data(), '해제', async () => {
    if (!confirm(`${doc.id} 승인을 해제할까요?`)) return;
    await AUTH.db.collection('allowlist').doc(doc.id).delete();
    openAdminPanel();
  })), '아직 승인된 친구가 없어요.'));
  // 내 uid — firestore.rules와 build.py의 ADMIN_UID를 이메일 대신 uid로 바꿀 때 사용
  const uidButton = el('button', { class: 'uchip' }, '내 uid 복사');
  uidButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(AUTH.user.uid);
      uidButton.textContent = '복사됨 ✓';
    } catch {
      // 클립보드가 막힌 환경에서는 버튼에 uid를 그대로 띄워 직접 복사하게 한다
      uidButton.textContent = AUTH.user.uid;
    }
  });
  body.append(el('p', { class: 'd-foot' }, `내 uid: ${AUTH.user.uid} `, uidButton));
}

// 승인 대기·승인된 친구 목록의 한 줄. label에 따라 버튼 색만 달라진다('해제'는 위험 동작이라 danger)
function adminRow(email, data, label, onclick) {
  return el('div', { class: 'admin-row' },
    data.photo ? el('img', { class: 'avatar', src: data.photo, alt: '' }) : el('span', { class: 'avatar' }, '👤'),
    el('div', { class: 'admin-who' }, el('b', {}, data.name || '(이름 없음)'), el('span', { class: 'acct-email' }, email)),
    el('button', { class: `uchip admin-act${label === '해제' ? ' danger' : ''}`, onclick }, label));
}
