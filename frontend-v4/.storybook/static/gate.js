'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// gate.js — 배포된 도면(/storybook/)은 관리자 계정으로 로그인해야 보인다
//
// **이건 화면 처리다, 담장이 아니다.** 도면은 GitHub Pages 의 정적 파일이라 서버 쪽 인증이
// 없다 — 주소를 아는 사람이 파일을 직접 받는 것까지는 못 막는다. 여기서 하는 일은 화면을
// 안 보여 주는 것뿐이고, 비밀은 애초에 도면에 싣지 않는다 (앱의 authApi.ts 와 같은 문장:
// "실제 차단은 규칙이 한다 — 이 코드는 공개 번들이다").
//
// 판정은 **ADMIN_UID** 로 한다 (앱과 같은 잣대 — data/meta.json 의 값).
// 이메일을 코드에 박으면 사람을 가리키는 값이 공개 저장소에 남는다 (CLAUDE.md §3 의 결).
// 로그인 세션은 앱과 같은 오리진이라 그대로 보인다 — 앱에서 로그인하고 돌아오면 열린다.
//
// 로컬(localhost)은 지나간다 — npm run storybook 에는 meta.json 도 로그인도 없다.
// 그물(check-stories.mjs)도 로컬을 훑으므로 같이 지나간다.
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

// 판정 전에는 아무것도 안 보인다 — 스크립트가 죽으면 닫힌 채로 남는다 (열린 채가 아니라)
const veil = document.createElement('style');
veil.textContent = 'html:not([data-gate="open"]) body > * { display: none !important; }';
document.head.appendChild(veil);

const open = () => { document.documentElement.setAttribute('data-gate', 'open'); };

// 잠금 화면 — 도면은 앱의 토큰 CSS 를 안 실으므로 어두운 판 한 벌 값을 여기 적는다
// (tokens.css 의 --plate 벌과 같은 값. 팔레트를 갈면 여기도 같이 간다)
function lock(message, detail) {
  document.documentElement.removeAttribute('data-gate');
  let box = document.getElementById('gate-lock');
  if (!box) {
    box = document.createElement('div');
    box.id = 'gate-lock';
    box.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:12px', 'padding:24px', 'text-align:center',
      'background:#282026', 'color:#fff5ee',
      "font-family:'Pretendard Variable',Pretendard,'Apple SD Gothic Neo',system-ui,sans-serif",
    ].join(';');
    document.documentElement.appendChild(box);
  }
  box.innerHTML = '';
  const h = document.createElement('p');
  h.style.cssText = 'margin:0;font-size:18px;font-weight:700;';
  h.textContent = message;
  const d = document.createElement('p');
  d.style.cssText = 'margin:0;font-size:13px;line-height:1.7;color:#c4b6bd;max-width:36em;';
  d.textContent = detail;
  const a = document.createElement('a');
  a.href = '/';
  a.style.cssText = 'margin-top:8px;display:inline-flex;align-items:center;min-height:44px;padding:0 20px;background:#c32f48;color:#fff5ee;font-weight:700;text-decoration:none;';
  a.textContent = '앱으로 가서 로그인';
  box.append(h, d, a);
}

async function check() {
  if (LOCAL) { open(); return; }
  try {
    // 설정은 앱이 이미 공개로 싣는 그 파일에서 — 도면에 값을 두 벌 두지 않는다
    const meta = await (await fetch('/data/meta.json')).json();
    const config = meta.FIREBASE_CONFIG;
    const adminUid = meta.ADMIN_UID;
    if (!config || !config.apiKey || !adminUid) { lock('도면이 잠겨 있어요', '이 배포에는 로그인이 꺼져 있어 도면을 열 수 없어요.'); return; }
    // 앱과 같은 SDK 판 — 다른 판을 섞으면 같은 오리진의 세션을 다르게 읽을 수 있다
    const [{ initializeApp, getApps }, { getAuth, onAuthStateChanged }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    ]);
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    onAuthStateChanged(getAuth(app), (user) => {
      if (user && user.uid === adminUid) {
        const was = document.getElementById('gate-lock');
        if (was) was.remove();
        open();
      } else {
        lock('관리자만 보는 도면이에요', user
          ? '지금 계정에는 이 도면이 열려 있지 않아요. 관리자 계정으로 로그인해 주세요.'
          : '앱에서 관리자 계정으로 로그인한 뒤 다시 열어 주세요.');
      }
    });
  } catch {
    // 회선·차단기 어느 쪽이든 — 열어 주지 않는다
    lock('도면을 확인할 수 없어요', '로그인 상태를 확인하지 못했어요. 앱에서 로그인한 뒤 다시 열어 주세요.');
  }
}

check();
