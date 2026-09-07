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

const TERMS_VER = '2026-09-07';
const TERMS_OK_KEY = 'pogo_terms_ok';
// 권리자 표기는 노션 "상용·오픈소스 전환 점검" 결정 — Pokémon GO 는 Scopely Explore, Inc. (2025년 Niantic 게임 사업 인수)
const IP_NOTICE = 'POGO PLAN은 비공식 팬 프로젝트입니다. Pokémon 및 관련 명칭·이미지의 권리는 The Pokémon Company · Nintendo · Creatures Inc. · GAME FREAK inc. 에, Pokémon GO 는 Scopely Explore, Inc. 에 있으며 이 서비스는 권리자와 무관합니다.';

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
  const go = el('button', { class: 'drawer-item acct-login consent-go', disabled: true }, '동의하고 로그인');
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
  openModal(el('div', { class: 'consent-modal' },
    el('h2', { class: 'd-name' }, '로그인 전에 확인해 주세요'),
    el('p', { class: 'plan-desc' }, '로그인하면 Google 계정의 이메일·이름·프로필 사진이 서비스에 저장되고, 즐겨찾기와 내 포켓몬을 계정에 보관합니다. 로그인 없이도 도감·순위·계산기는 그대로 쓸 수 있어요.'),
    el('label', { class: 'consent-check' }, agree, el('span', {},
      el('a', { href: '#/terms', onclick: () => closeModal({ silent: true }) }, '이용약관'), '과 ',
      el('a', { href: '#/privacy', onclick: () => closeModal({ silent: true }) }, '개인정보처리방침'), '을 읽었고 동의합니다')),
    el('label', { class: 'consent-check' }, age, el('span', {}, '만 14세 이상입니다 (14세 미만은 가입할 수 없어요)')),
    go,
    el('p', { class: 'd-foot' }, `약관 버전 ${TERMS_VER} · 동의 여부는 이 기기와 계정 카드(가입 요청)에 기록됩니다`)));
}

// 이용약관 전문 — 실제로 하는 것만 적는다. 표준 약관 복붙 금지 (privacy.js 와 같은 원칙)
function renderTermsPage() {
  const sec = (title, ...body) => el('section', { class: 'priv-sec' }, el('h2', { class: 'page-sec' }, title), ...body);
  const p = (...text) => el('p', {}, ...text);
  const ul = (...items) => el('ul', { class: 'priv-list' }, ...items.map((t) => el('li', {}, t)));
  const contact = typeof CONTACT_EMAIL !== 'undefined' && CONTACT_EMAIL ? el('a', { href: 'mailto:' + CONTACT_EMAIL }, CONTACT_EMAIL) : '사이트 운영자';

  return el('div', { class: 'page-body' },
    p('POGO PLAN(이하 "서비스")을 이용하기 전에 읽어 주세요. 서비스는 개인이 무료로 운영하는 비공식 팬 프로젝트이며, 이 약관은 서비스가 실제로 하는 것과 하지 않는 것을 정합니다.'),
    el('p', { class: 'd-foot' }, `시행일 ${TERMS_VER} (v2.18.0 신설). 개정하면 시행 7일 전에 패치노트로 알리고, 다음 로그인 때 다시 동의를 받습니다.`),

    sec('1. 서비스란',
      p('포켓몬 GO 의 순위표(D-MAX · PvE · PvP), 도감, 일정표, 계산기와 🌱 플래너(내 개체 저장·비교)를 한 화면에서 보는 웹앱입니다. 홈 화면에 설치(PWA)해 앱처럼 쓸 수 있습니다.'),
      ul('무료입니다. 수익을 목적으로 하지 않으며 광고·유료 기능이 없습니다',
         '누구나 로그인 없이 볼 수 있고, 저장 기능(즐겨찾기 · 내 포켓몬)만 Google 로그인 + 운영자 승인이 필요합니다',
         '운영자는 사전 공지 없이 기능을 바꾸거나 서비스를 중단할 수 있습니다 (개인 운영 프로젝트)')),

    sec('2. 계정과 승인',
      ul('로그인은 Google 계정만 지원합니다. 처음 로그인하면 "승인 대기" 상태가 되고, 운영자가 승인해야 저장 기능이 열립니다',
         '만 14세 미만은 가입할 수 없습니다. 로그인 전 체크로 확인하며, 14세 미만으로 확인되면 계정을 삭제합니다',
         '한 사람이 여러 계정을 만들거나 다른 사람의 계정을 쓰는 것은 금지합니다',
         '계정 삭제는 ☰ 메뉴 → 계정 카드의 "계정 삭제" 버튼으로 언제든 직접 할 수 있습니다. 즉시 저장 데이터가 지워집니다')),

    sec('3. 금지 행위',
      ul('서비스나 Firebase 저장소에 비정상적으로 많은 요청을 보내는 행위(자동화 스크립트 · 남용)',
         '다른 사용자의 데이터에 접근하거나 보안 규칙을 우회하려는 시도',
         '트레이너 코드 등 다른 사용자의 정보를 서비스 밖으로 퍼뜨리는 행위',
         '위 행위가 확인되면 운영자가 사전 통보 없이 승인을 해제하거나 계정을 정지할 수 있습니다')),

    sec('4. 데이터의 정확성과 면책',
      p('순위·CP·추천은 공개 데이터(PvPoke · PokeMiners · PokeAPI · 커뮤니티 시트)와 자체 계산으로 만든 참고값입니다. 게임 안의 실제 결과를 보장하지 않으며, 이를 근거로 한 결정(사탕·모래 사용, 교환 등)의 결과는 이용자 책임입니다.'),
      ul('데이터는 매일 자동 갱신되지만 원본 지연·오류로 틀릴 수 있습니다. 오류는 ☰ 메뉴의 제보 창구로 알려 주세요',
         '서비스 장애·데이터 손실에 대해 운영자는 고의 또는 중대한 과실이 없는 한 책임지지 않습니다')),

    sec('5. 지식재산',
      p(IP_NOTICE),
      ul('서비스의 코드는 MIT 라이선스로 공개돼 있습니다 (GitHub 저장소의 LICENSE · NOTICE)',
         '포켓몬 데이터·이미지·명칭은 각 권리자의 것이며 이 서비스가 권리를 주장하지 않습니다. 권리자의 요청이 있으면 즉시 내립니다',
         '이용자가 저장한 개체 정보·메모의 권리는 이용자에게 있습니다. 서비스는 그 이용자에게 보여 주는 목적으로만 저장합니다')),

    sec('6. 개인정보',
      p('수집 항목·목적·보관·위탁·권리는 ', el('a', { href: '#/privacy' }, '개인정보처리방침'), '에 따로 적었습니다. 이 약관과 방침이 다르면 방침이 우선합니다.')),

    sec('7. 준거법과 분쟁',
      p('이 약관은 대한민국 법을 따릅니다. 분쟁이 생기면 먼저 아래 문의처로 연락해 해결을 시도하고, 그래도 해결되지 않으면 민사소송법상 관할 법원에서 다룹니다.')),

    sec('문의처',
      p('약관 관련 문의: ', contact)),
    ipNoticeNode('d-foot'));
}
