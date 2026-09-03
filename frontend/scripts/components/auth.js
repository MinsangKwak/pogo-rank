// 2026-09-03 v2.2.0 로그인: Google 계정만, 관리자(ADMIN_EMAIL) 승인제. 즐겨찾기(★)를 계정에 저장
// Firebase compat SDK는 첫 렌더가 끝난 뒤 지연 로드 — 초기 로딩 속도(v2.0.0 최적화)를 지킨다
// FIREBASE_CONFIG가 비어 있으면(backend/build.py) 로그인 UI 자체가 안 뜨고 나머지 기능은 그대로
const FIREBASE_VER = '12.18.0';
const AUTH = {
  ready: false,      // SDK 로드·초기화 완료
  user: null,        // firebase user
  status: 'anon',    // anon(비로그인) | pending(승인 대기) | ok(승인됨)
  admin: false,
  favs: new Set(),   // 즐겨찾기 도감번호
  db: null,
};

function authEnabled() {
  return typeof FIREBASE_CONFIG !== 'undefined' && !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
}
function authEmail() { return (AUTH.user?.email || '').toLowerCase(); }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initAuth() {
  renderAccount();
  if (!authEnabled()) return;
  // 테스트용 목(mock)이 이미 있으면 SDK를 안 받는다
  if (typeof window.firebase === 'undefined') {
    try {
      for (const m of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VER}/firebase-${m}-compat.js`);
    } catch {
      renderAccount('SDK 로드 실패 — 네트워크를 확인하세요');
      return;
    }
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    AUTH.db = firebase.firestore();
    AUTH.ready = true;
    firebase.auth().getRedirectResult().catch(() => {});
    firebase.auth().onAuthStateChanged(onAuthChange);
  } catch (e) {
    renderAccount('초기화 실패: ' + (e.message || e));
  }
}

async function onAuthChange(user) {
  AUTH.user = user;
  AUTH.status = 'anon';
  AUTH.admin = false;
  AUTH.favs = new Set();
  if (user) {
    const email = authEmail();
    // ADMIN_UID가 채워져 있으면 uid로 판정(공개 저장소에 이메일을 남기지 않기 위함), 없으면 이메일로 폴백
    AUTH.admin = (typeof ADMIN_UID !== 'undefined' && ADMIN_UID)
      ? user.uid === ADMIN_UID
      : !!(typeof ADMIN_EMAIL !== 'undefined' && ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase());
    let approved = AUTH.admin;
    if (!approved) {
      const snap = await AUTH.db.collection('allowlist').doc(email).get().catch(() => null);
      approved = !!(snap && snap.exists);
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
  TRAINERS_CACHE = null;  // 계정이 바뀌면 트레이너 코드도 다시 조회
  if (typeof renderTrainers === 'function') renderTrainers();
  // 도감이 열려 있으면 ★ 표시를 다시 그린다
  if (typeof currentPageId === 'function' && currentPageId() === 'dex') renderPage();
}

async function signIn() {
  if (!authEnabled()) return;
  if (!AUTH.ready) { renderAccount('로그인 준비 중… 잠시 후 다시 눌러주세요'); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // 홈 화면 설치(PWA) 환경은 팝업이 막히므로 리다이렉트 방식
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  try {
    if (standalone) await firebase.auth().signInWithRedirect(provider);
    else await firebase.auth().signInWithPopup(provider);
  } catch (e) {
    if (/popup/i.test(e.code || '')) { await firebase.auth().signInWithRedirect(provider).catch(() => {}); return; }
    if (e.code !== 'auth/cancelled-popup-request') renderAccount('로그인 실패: ' + (e.code || e.message));
  }
}
function signOut() { if (AUTH.ready) firebase.auth().signOut(); }

// ── 즐겨찾기 ────────────────────────────────────────────
async function loadFavs() {
  const ref = AUTH.db.collection('users').doc(AUTH.user.uid);
  const snap = await ref.get().catch(() => null);
  const favs = snap && snap.exists ? (snap.data().favs || []) : [];
  AUTH.favs = new Set(favs.map(Number));
  if (!snap || !snap.exists) {
    ref.set({ email: authEmail(), name: AUTH.user.displayName || '', favs: [], updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
  }
}
function isFav(dex) { return AUTH.status === 'ok' && AUTH.favs.has(Number(dex)); }
async function toggleFav(dex) {
  if (AUTH.status === 'anon') { signIn(); return; }
  if (AUTH.status === 'pending') { renderAccount('승인 대기 중이라 아직 즐겨찾기를 저장할 수 없어요'); openDrawer(); return; }
  dex = Number(dex);
  const on = !AUTH.favs.has(dex);
  if (on) AUTH.favs.add(dex); else AUTH.favs.delete(dex);
  refreshFavUi(dex);
  renderAccount();
  const FV = firebase.firestore.FieldValue;
  await AUTH.db.collection('users').doc(AUTH.user.uid).set({
    email: authEmail(), favs: on ? FV.arrayUnion(dex) : FV.arrayRemove(dex), updatedAt: FV.serverTimestamp(),
  }, { merge: true }).catch(() => {});
}
// ★ 버튼: 같은 도감번호의 버튼이 여러 곳(도감 목록·팝업)에 있어도 refreshFavUi로 동시에 갱신
function favBtn(dex, cls = '') {
  const on = isFav(dex);
  return el('button', { class: `fav${on ? ' on' : ''}${cls ? ' ' + cls : ''}`, 'data-dex': String(dex), 'aria-label': '즐겨찾기',
    title: AUTH.status === 'ok' ? '즐겨찾기 토글' : '로그인하면 즐겨찾기 저장', onclick: (e) => { e.stopPropagation(); toggleFav(dex); } }, on ? '★' : '☆');
}
function refreshFavUi(only) {
  for (const b of document.querySelectorAll('.fav[data-dex]')) {
    if (only != null && Number(b.dataset.dex) !== Number(only)) continue;
    const on = isFav(b.dataset.dex);
    b.classList.toggle('on', on);
    b.textContent = on ? '★' : '☆';
  }
  // 도감의 "★ 즐겨찾기 N" 칩 카운트도 갱신
  for (const c of document.querySelectorAll('.fav-chip')) c.textContent = `★ 즐겨찾기 ${AUTH.favs.size}`;
}

// ── 드로어 계정 영역 ────────────────────────────────────
function renderAccount(msg) {
  const box = document.getElementById('account');
  const hb = document.getElementById('account-toggle');
  if (!box) return;
  if (!authEnabled()) { box.hidden = true; if (hb) hb.hidden = true; return; }
  box.hidden = false;
  if (hb) {
    hb.hidden = false;
    hb.textContent = '';
    if (AUTH.user?.photoURL) hb.append(el('img', { class: 'avatar', src: AUTH.user.photoURL, alt: '' }));
    else hb.textContent = '👤';
    hb.classList.toggle('pending', AUTH.status === 'pending');
  }
  box.textContent = '';
  const note = msg ? el('p', { class: 'acct-msg' }, msg) : '';
  if (!AUTH.user) {
    box.append(
      el('button', { class: 'drawer-item acct-login', onclick: signIn }, '🔐 Google로 로그인'),
      el('p', { class: 'acct-sub' }, '승인된 친구만 사용할 수 있어요. 로그인하면 즐겨찾기 ★를 내 계정에 저장합니다.'),
      note);
    return;
  }
  const who = el('div', { class: 'acct-who' },
    AUTH.user.photoURL ? el('img', { class: 'avatar', src: AUTH.user.photoURL, alt: '' }) : el('span', { class: 'avatar' }, '👤'),
    el('div', {}, el('b', {}, AUTH.user.displayName || '(이름 없음)'), el('span', { class: 'acct-email' }, authEmail())));
  if (AUTH.status === 'pending') {
    box.append(who,
      el('p', { class: 'acct-sub acct-pending' }, '⏳ 승인 대기 중 — 관리자가 승인하면 즐겨찾기를 쓸 수 있어요. 카톡으로 알려주세요!'),
      note,
      el('button', { class: 'drawer-item', onclick: signOut }, '로그아웃'));
    return;
  }
  box.append(who,
    el('p', { class: 'acct-sub' }, `★ 즐겨찾기 ${AUTH.favs.size}마리 · 도감에서 별을 눌러 채워보세요`),
    note,
    el('div', { class: 'acct-actions' },
      el('button', { class: 'drawer-item', onclick: () => { closeDrawer(); openPage('dex'); } }, '📕 도감에서 채우기'),
      AUTH.admin ? el('button', { class: 'drawer-item', onclick: openAdminPanel }, '🔑 가입 승인') : '',
      el('button', { class: 'drawer-item', onclick: signOut }, '로그아웃')));
}

// ── 관리자 패널: 승인 요청 → 허용 목록 ───────────────────
async function openAdminPanel() {
  if (!AUTH.admin) return;
  closeDrawer();  // 드로어가 팝업 위에 겹치지 않게
  const body = el('div', { class: 'detail admin' }, el('h2', {}, '🔑 가입 승인'));
  openModal(body);
  const [reqs, allow] = await Promise.all([
    AUTH.db.collection('requests').get().catch(() => null),
    AUTH.db.collection('allowlist').get().catch(() => null),
  ]);
  const allowed = new Set((allow?.docs || []).map((d) => d.id));
  const pending = (reqs?.docs || []).filter((d) => !allowed.has(d.id));
  const sec = (title, rows, emptyText) => el('section', { class: 'd-sec' }, el('h3', {}, title),
    rows.length ? el('div', { class: 'admin-rows' }, ...rows) : el('p', { class: 'empty' }, emptyText));
  body.append(sec('승인 대기', pending.map((d) => adminRow(d.id, d.data(), '승인', async () => {
    await AUTH.db.collection('allowlist').doc(d.id).set({ approved: true, name: d.data().name || '', at: firebase.firestore.FieldValue.serverTimestamp() });
    await AUTH.db.collection('requests').doc(d.id).delete().catch(() => {});
    openAdminPanel();
  })), '대기 중인 요청이 없어요.'));
  body.append(sec('승인된 친구', (allow?.docs || []).map((d) => adminRow(d.id, d.data(), '해제', async () => {
    if (!confirm(`${d.id} 승인을 해제할까요?`)) return;
    await AUTH.db.collection('allowlist').doc(d.id).delete();
    openAdminPanel();
  })), '아직 승인된 친구가 없어요.'));
  // 내 uid — firestore.rules와 build.py의 ADMIN_UID를 이메일 대신 uid로 바꿀 때 사용
  const uidBtn = el('button', { class: 'uchip' }, '내 uid 복사');
  uidBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(AUTH.user.uid); uidBtn.textContent = '복사됨 ✓'; }
    catch { uidBtn.textContent = AUTH.user.uid; }
  });
  body.append(el('p', { class: 'd-foot' }, `내 uid: ${AUTH.user.uid} `, uidBtn));
}
function adminRow(email, data, label, onclick) {
  return el('div', { class: 'admin-row' },
    data.photo ? el('img', { class: 'avatar', src: data.photo, alt: '' }) : el('span', { class: 'avatar' }, '👤'),
    el('div', { class: 'admin-who' }, el('b', {}, data.name || '(이름 없음)'), el('span', { class: 'acct-email' }, email)),
    el('button', { class: `uchip admin-act${label === '해제' ? ' danger' : ''}`, onclick }, label));
}
