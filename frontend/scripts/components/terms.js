// ─────────────────────────────────────────────────────────────────────────────
// components/terms.js — 이용약관 페이지(#/terms) · 첫 로그인 동의 팝업 · IP 고지문 (2026-09-07 v2.18.0, 공개 준비 2)
//
// 무엇을 하나
//   (1) 이용약관 전문을 전체 페이지로 보여 준다 (PAGES.terms, pages.js 가 등록)
//   (2) 처음 로그인할 때 "약관·개인정보처리방침 동의 + 만 14세 이상" 체크를 받는다 (openTermsConsent)
//       동의는 localStorage TERMS_OK_KEY 에 약관 버전으로 남기고, auth.js 가 requests 문서에도 consent 로 적는다
//       약관을 개정해 TERMS_VER 를 올리면 다음 로그인 때 다시 묻는다
//   (3) 푸터·전체 페이지 하단에 상시 노출하는 IP 고지문 한 줄 (IP_NOTICE)
//
// 제공하는 전역
//   TERMS_VER · TERMS_OK_KEY · IP_NOTICE · termsAccepted() · markTermsAccepted() · openTermsConsent(onAccept)
//   renderTermsPage() · ipNoticeNode()
//
// 의존하는 전역
//   el (dom.js) · openModal · closeModal (components/modal.js) · track (track.js) · CONTACT_EMAIL (build.py)
// ─────────────────────────────────────────────────────────────────────────────

const TERMS_VER = '2026-09-28';
const TERMS_OK_KEY = 'pogo_terms_ok';
// 권리자 표기는 노션 "상용·오픈소스 전환 점검" 결정 — Pokémon GO 는 Scopely Explore, Inc. (2025년 Niantic 게임 사업 인수)
const IP_NOTICE = 'moncamp는 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc.에, Pokémon GO는 Scopely Explore, Inc.에 있으며 이 서비스는 권리자와 무관합니다.';

function termsAccepted() {
  try { return localStorage.getItem(TERMS_OK_KEY) === TERMS_VER; } catch { return false; }
}
function markTermsAccepted() {
  try { localStorage.setItem(TERMS_OK_KEY, TERMS_VER); } catch {}
}

// 푸터·전체 페이지 하단에 붙이는 고지 노드 (같은 문장을 한 곳에서 관리)
function ipNoticeNode(extraClass = '') {
  return el('p', { class: `ip-notice ${extraClass}`.trim() }, IP_NOTICE);
}

// 첫 로그인 동의 팝업 — 두 체크가 모두 켜져야 [동의하고 로그인] 이 살아난다
//   onAccept  동의 뒤 이어서 실행할 것 (auth.js 의 실제 로그인)
function openTermsConsent(onAccept) {
  const agree = el('input', { type: 'checkbox' });
  const age = el('input', { type: 'checkbox' });
  const go = el('button', { class: 'drawer__item account__login consent__go', disabled: true }, '동의하고 로그인');
  const sync = () => { go.disabled = !(agree.checked && age.checked); };
  agree.addEventListener('change', sync);
  age.addEventListener('change', sync);
  go.addEventListener('click', () => {
    if (go.disabled) return;
    markTermsAccepted();
    track('terms_accept', { ver: TERMS_VER });
    closeModal({ silent: true });
    onAccept?.();
  });
  openModal(el('div', { class: 'consent__modal' },
    el('h2', { class: 'detail__name' }, '로그인 전에 확인해 주세요'),
    el('p', { class: 'plan__desc' }, '로그인 시 Google 계정의 이메일·이름·프로필 사진을 저장합니다. 관리자 승인 후 즐겨찾기와 내 포켓몬을 계정에 보관할 수 있습니다. 도감·순위표·계산기는 로그인 없이 이용할 수 있습니다.'),
    el('label', { class: 'consent__check' }, agree, el('span', {},
      el('a', { href: '#/terms', onclick: () => closeModal({ silent: true }) }, '이용약관'), '과 ',
      el('a', { href: '#/privacy', onclick: () => closeModal({ silent: true }) }, '개인정보처리방침'), '을 읽었고 동의합니다')),
    el('label', { class: 'consent__check' }, age, el('span', {}, '만 14세 이상입니다 (만 14세 미만은 가입할 수 없습니다)')),
    go,
    footNote(`약관 버전 ${TERMS_VER} · 동의 여부는 이 기기와 계정 카드(가입 요청)에 기록됩니다`)));
}

// 이용약관 전문 — 실제로 하는 것만 적는다. 표준 약관 복붙 금지 (privacy.js 와 같은 원칙)
function renderTermsPage() {
  const sec = (title, ...body) => el('section', { class: 'priv__sec' }, el('h2', { class: 'page__sec' }, title), ...body);
  const p = (...text) => el('p', {}, ...text);
  const ul = (...items) => el('ul', { class: 'priv__list' }, ...items.map((t) => el('li', {}, t)));
  const contact = typeof CONTACT_EMAIL !== 'undefined' && CONTACT_EMAIL ? el('a', { href: 'mailto:' + CONTACT_EMAIL }, CONTACT_EMAIL) : '사이트 운영자';

  // 2026-09-08 v2.29.0 한국어 원문이 효력을 갖는 문서라 번역하지 않는다 (영어 안내만 위에 단다)
  return el('div', { class: 'page__body' },
    i18nKoOnlyNote(),
    p('이 약관은 moncamp(이하 "서비스")의 이용 조건과 이용자·운영자의 권리 및 책임을 안내합니다. 서비스는 개인이 무료로 운영하는 비공식 팬 프로젝트입니다. 이용 전에 내용을 확인해 주세요.'),
    footNote(`시행일 ${TERMS_VER} (v2.18.0 신설). 약관 개정 시 시행 7일 전에 패치노트로 공지하고, 다음 로그인 시 다시 동의를 받습니다.`),

    sec('1. 서비스 소개',
      p('포켓몬 GO의 순위표(D-MAX · PvE · PvP), 도감, 일정표, 계산기 및 플래너(내 개체 저장·비교)를 제공하는 웹앱입니다. 홈 화면에 설치(PWA)하여 앱처럼 이용할 수 있습니다.'),
      ul('서비스는 무료이며, 광고나 유료 기능을 제공하지 않습니다',
         '일반 정보는 로그인 없이 확인할 수 있습니다. 즐겨찾기·내 포켓몬의 계정 저장에는 Google 로그인과 운영자의 승인이 필요합니다',
         '개인이 운영하는 프로젝트의 특성상, 운영자는 사전 공지 없이 기능을 변경하거나 서비스를 중단할 수 있습니다')),

    sec('2. 계정과 승인',
      ul('Google 계정으로만 로그인할 수 있습니다. 첫 로그인 시 승인 대기 상태가 되며, 운영자의 승인 후 계정 저장 기능을 이용할 수 있습니다',
         '만 14세 미만은 가입할 수 없습니다. 로그인 전 동의 화면에서 연령을 확인하며, 만 14세 미만으로 확인되면 계정을 삭제합니다',
         '한 사람이 여러 계정을 생성하거나 다른 사람의 계정을 사용하는 행위를 금지합니다',
         '메뉴 → 계정 카드 → 계정 삭제에서 언제든 직접 탈퇴할 수 있습니다. 계정에 저장된 데이터는 즉시 삭제됩니다')),

    sec('3. 금지 행위',
      ul('서비스나 Firebase 저장소에 비정상적으로 많은 요청을 보내는 행위(자동화 스크립트 · 남용)',
         '다른 사용자의 데이터에 접근하거나 보안 규칙을 우회하려는 시도',
         '트레이너 코드 등 다른 이용자의 정보를 서비스 외부에 유출하는 행위',
         '위 행위가 확인되면 운영자가 사전 통보 없이 승인을 해제하거나 계정을 정지할 수 있습니다')),

    sec('4. 데이터의 정확성과 면책',
      p('순위·CP·추천은 공개 데이터(PvPoke · PokeMiners · PokeAPI · 커뮤니티 시트)와 자체 계산으로 만든 참고값입니다. 게임 내 실제 결과를 보장하지 않으며, 이를 근거로 한 결정(사탕·모래 사용, 교환 등)의 결과는 이용자 책임입니다.'),
      ul('데이터는 매일 자동 갱신되지만, 원본의 갱신 지연이나 오류로 실제 게임과 다를 수 있습니다. 오류는 메뉴의 버그 제보를 통해 알려 주세요',
         '서비스 장애·데이터 손실에 대해 운영자는 고의 또는 중대한 과실이 없는 한 책임지지 않습니다')),

    sec('5. 지식재산',
      p(IP_NOTICE),
      ul('서비스 코드는 열람용으로 공개하며, 포크와 재배포를 허용하지 않습니다. 자세한 조건은 GitHub 저장소의 LICENSE와 NOTICE를 확인해 주세요',
         '포켓몬 데이터·이미지·명칭의 권리는 각 권리자에게 있습니다. 서비스는 이에 대한 권리를 주장하지 않으며, 권리자의 요청이 있으면 해당 자료를 즉시 삭제합니다',
         '이용자가 저장한 개체 정보·메모의 권리는 이용자에게 있습니다. 서비스는 해당 이용자에게 정보를 제공하는 목적으로만 이를 저장합니다')),

    sec('6. 개인정보',
      p('개인정보의 수집 항목·이용 목적·보관·처리위탁 및 이용자의 권리는 ', el('a', { href: '#/privacy' }, '개인정보처리방침'), '에서 안내합니다. 이 약관과 개인정보처리방침의 내용이 다르면 개인정보처리방침을 우선 적용합니다.')),

    sec('7. 준거법과 분쟁',
      p('이 약관에는 대한민국 법령을 적용합니다. 분쟁이 발생하면 아래 문의처를 통해 우선 협의하며, 협의로 해결되지 않는 경우 민사소송법에 따른 관할 법원에서 해결합니다.')),

    sec('문의처',
      p('약관 관련 문의: ', contact)),
    ipNoticeNode('detail__foot'));
}
