// ─────────────────────────────────────────────────────────────────────────────
// components/consent.js — 통계(GA4) 동의 배너 · 통계/저장소 설정 팝업 (2026-09-07 v2.18.0, 공개 준비 3)
//
// 무엇을 하나
//   첫 방문에 하단 배너로 "이 사이트가 브라우저에 무엇을 저장하는지"를 알리고, 통계를 **끌 수 있는 길**을 준다.
//
// 2026-09-15 v3.39.0 옵트인 → **옵트아웃** 으로 바꿨다.
//   전에는 "통계 동의" 를 누른 사람만 GA 가 켜졌다. 그런데 배너에서 아무것도 안 누르고 떠나는 사람이
//   대부분이라 방문의 대다수가 한 건도 안 찍혔다 — 통계를 보려고 붙인 것이 통계를 못 보게 막고 있었다.
//   이제 **들어오면 바로 켜지고**(build.py 의 GA 스니펫이 head 에서 직접 붙인다), 끄고 싶은 사람이 끈다.
//   광고·개인화는 계속 꺼 둔다(ad_storage 등 denied) — 우리가 보는 것은 방문 수와 기능 사용량뿐이다.
//   ※ EU/UK 방문자에게는 사전 동의가 원칙이다. 국내 이용자 기준으로 둔 선택이고, 방침(#/privacy)에 그대로 적었다.
//
// 저장
//   localStorage CONSENT_KEY = 'granted' | 'denied'  (개인정보 아님. 설정에서 언제든 변경)
//     값이 없음 = 아직 아무것도 안 고름 → **켜짐**(기본). 'denied' 일 때만 끈다
//
// 제공하는 전역
//   CONSENT_KEY · consentValue() · analyticsWanted() · setConsent(value, from) · loadAnalytics() · initConsent() · openConsentSettings() · clearAppCache()
//   2026-09-15 v3.45.0 renderConsentBanner() 는 없어졌다 — 끄는 길은 ☰ 메뉴 → 통계·저장소 설정 하나다
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

// 통계를 켤 것인가 — **'끄기' 를 고른 적이 없으면 켠다**(기본 켜짐).
// 규칙을 이름 있는 한 곳에 둔다: head 스니펫(build.py)도 같은 판정을 하므로 둘이 어긋나면 안 된다
function analyticsWanted() {
  return consentValue() !== 'denied';
}

// GA4 를 붙인다 — 보통은 build.py 의 head 스니펫이 이미 붙여 놨고, 여기서는 두 경우만 일한다.
//   ① 껐다가 다시 켠 사람 (설정 팝업)  ② 스니펫이 없는 빌드에서 부르는 경우
// '거부' 면 아무것도 안 한다. Consent Mode v2 기본값은 스니펫과 같은 값으로 맞춘다
function loadAnalytics() {
  if (!analyticsWanted()) return;
  // head 스니펫이 이미 붙였으면 여기서 또 붙이지 않는다 (page_view 가 두 번 찍힌다)
  if (_gaLoaded || typeof window.gtag === 'function') { _gaLoaded = true; return; }
  if (typeof IS_BOT_LIKE !== 'undefined' && IS_BOT_LIKE) return;
  const id = typeof window.GA_PENDING_ID === 'string' ? window.GA_PENDING_ID : '';
  if (!id) return;
  _gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date());
  // v3.57.0 여기서 붙는 경우(동의를 뒤늦게 켠 길)도 첫 조회를 가상 경로로 보낸다 — head 스니펫과 같은 규칙
  window.gtag('config', id, typeof window.gaVirtualUrl === 'function' ? { page_location: window.gaVirtualUrl() } : {});
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
    // 껐다가 다시 켠 경우 — gtag 는 지워졌고 새로 붙였으니 저장소 동의도 되돌린다
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'granted' });
  } else if (typeof window.gtag === 'function') {
    // 이미 붙은 뒤 철회: 마지막 이벤트로 남기고 저장소 동의를 끄고, track() 이 더는 못 부르게 gtag 를 지운다
    track('consent', { value, from });
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
    window.gtag = undefined;
    window.GA_MEASUREMENT_ID = undefined;
  }
  document.getElementById('consent')?.remove();
}

// 2026-09-15 v3.45.0 **첫 방문 배너를 걷어냈다.**
//   v2.18.0 에 동의를 받는 자리로 만들고 v3.39.0 에 "끌 수 있다고 알리는" 자리로 바꿨지만,
//   처음 들어온 사람에게 화면 아래를 막는 안내가 먼저 뜨는 것은 그 자체로 문턱이었다
//   (제보 — "이걸 팝업으로 띄우니까 아무도 안 들어오는 느낌이야").
//   고지가 사라진 것은 아니다 — 무엇을 저장하고 무엇을 보내는지는 개인정보처리방침에 그대로 있고,
//   **끄는 길도 그대로다**: ☰ 메뉴 → 통계·저장소 설정, 그리고 푸터의 같은 항목.
//   판정(analyticsWanted)과 저장 키(pogo_consent)는 손대지 않았다 — 이미 끈 사람은 계속 꺼진다.
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
      row('granted', '통계 켜기', typeof window.GA_PENDING_ID === 'string' && window.GA_PENDING_ID ? '이용 패턴을 기록해요 (기본값)' : '이 빌드(미리보기·로컬)는 통계가 꺼져 있어 선택만 저장돼요'),
      row('denied', '통계 끄기', '통계 스크립트를 불러오지 않아요')),
    el('h2', { class: 'page__sec' }, '브라우저에 저장된 것'),
    el('ul', { class: 'priv__list' },
      el('li', {}, '오프라인용 파일 캐시(화면·데이터·포켓몬 그림) — 서비스워커'),
      el('li', {}, '설정값(마지막 탭·모드, 패치노트 읽음, 동의 여부 등) — localStorage, pogo_ 접두사'),
      el('li', {}, '위치정보는 수집하지 않아요')),
    el('div', { class: 'account__actions' },
      el('button', { class: 'drawer__item', onclick: clearAppCache }, '🧹 캐시 비우고 새로고침')),
    footNote('설정값까지 지우려면 브라우저의 "사이트 데이터 삭제"를 쓰세요. 계정에 저장한 즐겨찾기·내 포켓몬은 여기서 지워지지 않아요 (계정 카드 → 계정 삭제).')));
}

// app.js 첫 렌더 뒤 한 번.
// GA 는 보통 head 스니펫이 이미 붙여 놨다 — 여기서는 스니펫이 없는 빌드를 위해 한 번 더 부른다(거부면 안 붙는다)
function initConsent() {
  loadAnalytics();
  document.getElementById('menu-consent')?.addEventListener('click', openConsentSettings);
  document.getElementById('foot-consent')?.addEventListener('click', openConsentSettings);
  // 푸터·전체 페이지의 IP 고지문 (components/terms.js)
  const footNotice = document.getElementById('ip-notice');
  if (footNotice && typeof IP_NOTICE === 'string') footNotice.textContent = IP_NOTICE;
}
