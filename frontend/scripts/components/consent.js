// ─────────────────────────────────────────────────────────────────────────────
// components/consent.js — 통계(GA4) 동의 배너 · 통계/저장소 설정 팝업 (2026-09-07 v2.18.0, 공개 준비 3)
//
// 무엇을 하나
//   첫 방문에 하단 배너로 "이 사이트가 브라우저에 무엇을 저장하는지"를 알리고 방문 통계(Google Analytics) 동의를 받는다.
//   동의 전에는 GA 스크립트를 아예 넣지 않는다 — build.py 의 GA 스니펫은 측정 ID(window.GA_PENDING_ID)만 남기고,
//   여기서 동의가 확인될 때 loadAnalytics() 가 gtag 를 붙인다. 거부하면 window.gtag 가 없으므로 track() 은 전부 무시된다.
//   위치정보는 쓰지 않으므로 배너에서 "수집하지 않음"만 밝힌다 (노션 결정 9-6).
//
// 저장
//   localStorage CONSENT_KEY = 'granted' | 'denied'  (개인정보 아님. 설정에서 언제든 변경)
//
// 제공하는 전역
//   CONSENT_KEY · consentValue() · setConsent(value, from) · loadAnalytics() · initConsent() · openConsentSettings() · clearAppCache()
//
// 의존하는 전역
//   el (dom.js) · openModal · closeModal (components/modal.js) · track (track.js) · setTrackingUser (track.js) · AUTH (components/auth.js)
//   window.GA_PENDING_ID (build.py GA 스니펫 — 배포 채널에서만 정의)
// ─────────────────────────────────────────────────────────────────────────────

const CONSENT_KEY = 'pogo_consent';
let _gaLoaded = false;

function consentValue() {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch { return null; }
}

// GA4 를 실제로 붙인다 — 동의가 있고 측정 ID 가 있을 때 한 번만. Consent Mode v2 기본값을 먼저 선언한다
function loadAnalytics() {
  if (_gaLoaded || consentValue() !== 'granted') return;
  const id = typeof window.GA_PENDING_ID === 'string' ? window.GA_PENDING_ID : '';
  if (!id) return;
  _gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', id);
  window.GA_MEASUREMENT_ID = id;  // track.js setTrackingUser 가 user_id 를 붙여 config 를 다시 부를 때 쓴다
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  // 이미 로그인돼 있으면 사용자 식별자를 이어 붙인다 (auth.js 가 먼저 돌았을 수 있다)
  if (typeof AUTH !== 'undefined' && typeof setTrackingUser === 'function') setTrackingUser(AUTH.user ? AUTH.user.uid : null, AUTH.status);
}

//   value  'granted' | 'denied'
//   from   'banner' | 'settings' (GA 이벤트용)
function setConsent(value, from = 'banner') {
  try { localStorage.setItem(CONSENT_KEY, value); } catch {}
  if (value === 'granted') {
    loadAnalytics();
    track('consent', { value, from });
  } else if (typeof window.gtag === 'function') {
    // 이미 붙은 뒤 철회: 마지막 이벤트로 남기고 저장소 동의를 끄고, track() 이 더는 못 부르게 gtag 를 지운다
    track('consent', { value, from });
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
    window.gtag = undefined;
    window.GA_MEASUREMENT_ID = undefined;
  }
  document.getElementById('consent')?.remove();
}

// 첫 방문 배너 — 선택이 저장돼 있으면 그리지 않는다
function renderConsentBanner() {
  if (consentValue() || document.getElementById('consent')) return;
  // 첫 화면 가림막(#splash)이 걷힌 뒤에 띄운다 — 로딩 중에 배너부터 보이지 않게
  const splash = document.getElementById('splash');
  if (splash && !splash.classList.contains('is-done')) { setTimeout(renderConsentBanner, 300); return; }
  const banner = el('div', { id: 'consent', class: 'consent', role: 'dialog', 'aria-label': '저장소·통계 안내' },
    el('p', { class: 'consent__text' },
      '이 사이트는 오프라인용 파일과 설정을 브라우저에 저장해요(개인정보 아님). 방문 통계(Google Analytics)는 동의할 때만 켜지고, 위치정보는 수집하지 않아요. ',
      el('a', { href: '#/privacy' }, '자세히')),
    el('div', { class: 'consent__btns' },
      el('button', { class: 'uchip consent__deny', onclick: () => setConsent('denied', 'banner') }, '통계 거부'),
      el('button', { class: 'uchip consent__allow', onclick: () => setConsent('granted', 'banner') }, '통계 동의')));
  document.body.appendChild(banner);
}

// 서비스워커 캐시 + 등록 해제 → 새로고침. 로컬 설정(pogo_*)은 지우지 않는다 (동의 선택을 포함해 사용자가 고른 값이라)
async function clearAppCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {}
  track('cache_clear');
  location.reload();
}

// ☰ 메뉴 → 통계·저장소 설정 — 현재 선택을 바꾸고, 캐시를 비운다
function openConsentSettings() {
  const current = consentValue();
  const row = (value, label, desc) => el('button', {
    class: `drawer__item consent__opt${current === value ? ' is-on' : ''}`,
    'aria-pressed': String(current === value),
    onclick: () => { setConsent(value, 'settings'); closeModal(); },
  }, el('span', {}, el('b', {}, label), el('small', {}, desc)));
  openModal(el('div', { class: 'consent__modal' },
    el('h2', { class: 'detail__name' }, '통계 · 저장소 설정'),
    el('p', { class: 'plan__desc' }, '방문 통계(Google Analytics)는 어떤 기능이 쓰이는지 보고 화면을 고치는 데만 써요. 이메일·이름은 보내지 않아요.'),
    el('div', { class: 'account__actions' },
      row('granted', '통계 동의', typeof window.GA_PENDING_ID === 'string' && window.GA_PENDING_ID ? '이용 패턴을 기록해요' : '이 빌드(미리보기·로컬)는 통계가 꺼져 있어 선택만 저장돼요'),
      row('denied', '통계 거부', '통계 스크립트를 불러오지 않아요')),
    el('h2', { class: 'page__sec' }, '브라우저에 저장된 것'),
    el('ul', { class: 'priv__list' },
      el('li', {}, '오프라인용 파일 캐시(화면·데이터·포켓몬 그림) — 서비스워커'),
      el('li', {}, '설정값(마지막 탭·모드, 패치노트 읽음, 동의 여부 등) — localStorage, pogo_ 접두사'),
      el('li', {}, '위치정보는 수집하지 않아요')),
    el('div', { class: 'account__actions' },
      el('button', { class: 'drawer__item', onclick: clearAppCache }, '🧹 캐시 비우고 새로고침')),
    footNote('설정값까지 지우려면 브라우저의 "사이트 데이터 삭제"를 쓰세요. 계정에 저장한 즐겨찾기·내 포켓몬은 여기서 지워지지 않아요 (계정 카드 → 계정 삭제).')));
}

// app.js 첫 렌더 뒤 한 번 — 이미 동의했으면 GA 를 붙이고, 아니면 배너를 띄운다
function initConsent() {
  if (consentValue() === 'granted') loadAnalytics();
  else renderConsentBanner();
  document.getElementById('menu-consent')?.addEventListener('click', openConsentSettings);
  document.getElementById('foot-consent')?.addEventListener('click', openConsentSettings);
  // 푸터·전체 페이지의 IP 고지문 (components/terms.js)
  const footNotice = document.getElementById('ip-notice');
  if (footNotice && typeof IP_NOTICE === 'string') footNotice.textContent = IP_NOTICE;
}
