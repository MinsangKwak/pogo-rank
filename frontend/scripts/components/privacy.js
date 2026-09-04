// ─────────────────────────────────────────────────────────────────────────────
// components/privacy.js — 개인정보처리방침 전체 페이지 (#/privacy)
//
// 실제로 수집·저장하는 항목만 적는다 (문구만 그럴싸한 표준 약관 복붙 금지) — 새 기능이
// 개인정보를 추가로 만지면 이 파일도 같이 고칠 것. 근거:
//   - Google 로그인          frontend/scripts/components/auth.js (Firebase Auth, email/name/photo/uid)
//   - Firestore 저장 항목    firestore.rules 의 allowlist/requests/users/trainers 컬렉션
//   - GA4 이벤트             frontend/scripts/track.js (개인 식별값 없음 — 탭 이름 등만)
//   - 로컬 저장소            pogo_release_hide(패치노트 읽음) · pogo_dex_cols(도감 열 수), 둘 다 개인정보 아님
//
// 제공하는 전역
//   renderPrivacyPage() : 개인정보처리방침 전체 페이지

function renderPrivacyPage() {
  const sec = (title, ...body) => el('section', { class: 'priv-sec' }, el('h2', { class: 'page-sec' }, title), ...body);
  const p = (...text) => el('p', {}, ...text);
  const ul = (...items) => el('ul', { class: 'priv-list' }, ...items.map((t) => el('li', {}, t)));

  return el('div', { class: 'page-body' },
    p('POGO SEARCH(이하 "서비스")는 Google 로그인으로 승인된 친구에게만 즐겨찾기 저장 기능을 제공합니다. 이 페이지는 그 과정에서 어떤 개인정보를 수집·보관하는지 설명합니다.'),
    el('p', { class: 'd-foot' }, '시행일 2026-09-04. 서비스는 개인이 친구들을 위해 무료로 운영하며 상업적 목적이 없습니다.'),

    sec('수집하는 개인정보',
      p('로그인하지 않고 도감·순위표·계산기를 쓰는 경우 개인정보를 전혀 수집하지 않습니다. 아래 항목은 헤더 👤 버튼으로 Google 로그인을 했을 때만 발생합니다.'),
      ul(
        '이메일 주소, 이름, 프로필 사진 URL — Google 계정에서 제공 (최초 로그인 시 승인 대기 목록에 기록)',
        '즐겨찾기(★)로 저장한 포켓몬 도감번호 목록 — 승인된 사용자만',
        'Firebase 인증 uid — 계정 식별용, 서비스 내에서 이메일 대신 이 값으로 관리자 여부를 판정')),

    sec('수집 목적과 보관 위치',
      p('수집한 정보는 아래 목적에만 사용하며, Google의 인프라인 Firebase Authentication·Firestore(서울 리전)에 저장합니다. 서비스를 운영하는 개인이 별도 서버나 데이터베이스에 이메일·이름을 옮겨 저장하지 않습니다.'),
      ul(
        '승인제 운영 — 처음 로그인한 사람을 "승인 대기" 목록에 올리고, 운영자가 승인해야 즐겨찾기를 쓸 수 있습니다',
        '즐겨찾기 동기화 — 어느 기기에서 로그인해도 같은 즐겨찾기가 보이도록')),

    sec('보관 기간',
      p('승인을 해제해도 그동안 저장한 즐겨찾기 데이터는 곧바로 삭제되지 않고, 접근만 차단됩니다(다시 승인하면 그대로 복원). 완전 삭제를 원하면 아래 문의처로 요청해 주세요 — 확인 후 승인 대기 기록과 즐겨찾기 데이터를 지웁니다.')),

    sec('제3자 제공',
      p('수집한 개인정보를 광고·마케팅 등 다른 목적으로 제3자에게 제공하지 않습니다. 다만 서비스 운영에 아래 두 곳의 처리위탁을 이용합니다.'),
      ul(
        'Google Firebase(Authentication·Firestore) — 로그인 처리와 즐겨찾기 데이터 저장',
        'Google Analytics(GA4) — 방문자 통계. 클릭한 탭 이름·포켓몬 이름 등 이용 패턴만 기록하며, 이메일·이름 등 개인 식별 정보는 함께 전송하지 않습니다. 로컬 미리보기(개발 중)에서는 아예 작동하지 않습니다')),

    sec('쿠키·로컬 저장소',
      p('서비스가 직접 쿠키를 사용하지는 않습니다. 브라우저 로컬 저장소(localStorage)에는 "패치노트 읽음 여부"와 "도감 화면 열 수" 두 가지 개인정보와 무관한 설정만 저장합니다. Google 로그인·Firebase SDK가 자체적으로 세션 유지를 위한 저장소를 사용할 수 있습니다.')),

    sec('이용자의 권리',
      p('로그인한 계정의 정보 열람·수정·삭제를 언제든 요청할 수 있습니다. 헤더 👤 → 계정 메뉴에서 즐겨찾기를 직접 지울 수 있고, 계정 자체(로그인 기록·승인 정보) 삭제는 아래 문의처로 이메일 주소를 알려주시면 처리합니다.')),

    sec('문의처',
      p('개인정보 관련 문의·삭제 요청: ', el('a', { href: 'mailto:contact@example.com' }, 'contact@example.com'))),

    // 2026-09-04 이 요약본의 원본 — 표·콜아웃 등 더 자세한 형태는 노션에 둔다
    el('p', { class: 'd-foot' }, '더 자세한 내용은 ',
      el('a', { href: 'https://app.notion.com/p/3d1cbbdd109b81a9b5dcf344e4432ae2', target: '_blank', rel: 'noopener' }, '노션 상세 페이지'),
      '에서도 확인할 수 있습니다.'),
  );
}
