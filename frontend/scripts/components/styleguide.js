// ─────────────────────────────────────────────────────────────────────────────
// components/styleguide.js — UI 목록 (#/styleguide) · 2026-09-09 v2.41.0
//
// 무엇을 하나
//   이 서비스가 쓰는 조각(색·글자·버튼·칩·태그·목록·카드·메뉴·팝업)을 한 화면에 늘어놓는다.
//   화면이 마흔 판을 넘기면서 같은 뜻의 조각이 여러 벌 생기기 쉬워졌는데, 늘어놓고 봐야
//   "이건 저것과 같은 것 아닌가"가 눈에 걸린다.
//
// 왜 스토리북이 아닌가
//   스토리북을 붙이면 npm·번들러가 통째로 들어와 "의존성 없는 바닐라 JS"라는 전제가 깨지고,
//   무엇보다 조각을 스토리용으로 한 벌 더 적게 되어 실제 화면과 조용히 어긋나기 시작한다.
//   여기서는 **실제 CSS 와 실제 함수**(uchip · seg · layoutToggle · sprite …)를 그대로 부른다 —
//   그래서 이 화면이 보여 주는 모양은 정의상 실제 화면의 모양이다.
//
// 왜 dev 빌드에만 있나
//   방문자에게는 쓸모가 없고 번들만 키운다. backend/build.py 가 BUILD_CHANNEL=dev 일 때만
//   이 파일을 SCRIPTS 에 넣는다 — 실서비스 번들에는 이 화면도, 이 주소도 존재하지 않는다.
//   그래서 라우트(ROUTES)·페이지(PAGES) 등록도 여기서 스스로 한다.
//
// 의존하는 전역
//   el (dom.js) · ROUTES (router.js) · PAGES (components/pages.js)
//   uchip · iconBtn · pageBody · sectionTitle · footNote · hintNote · metaText · layoutToggle (components/ui.js)
//   seg (components/seg.js) · sprite (components/sprite.js) · openModal (components/modal.js)
// ─────────────────────────────────────────────────────────────────────────────

// 라우트·페이지를 스스로 등록한다 — 이 파일이 없는 빌드(실서비스)에는 주소 자체가 없다.
ROUTES.push({ id: 'styleguide', path: 'styleguide', kind: 'page', nav: 'UI 목록', icon: '🧩' });
// 2026-09-10 v2.42.0 이동 목록에도 올린다. ROUTE_NAV 는 router.js 가 읽는 즉시 굳는 표라 여기서 다시
// 만들 수 없고, 목록 DOM 은 app-shell.js 가 이 파일보다 뒤에 만든다 — 그래서 그 뒤로 미뤄 붙인다.
// 실서비스에는 이 파일이 없으니 항목도 없다 (메뉴에 죽은 링크가 남지 않는다)
queueMicrotask(() => {
  const nav = document.querySelector('.nav-menu');
  if (!nav || nav.querySelector('[href="#/styleguide"]')) return;
  const item = el('a', { href: '#/styleguide', class: 'drawer__item' },
    el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, '🧩'),
    el('span', { class: 'drawer__label' }, 'UI 목록'));
  nav.append(item);
  if (typeof syncAppShell === 'function') syncAppShell();
});

// 한 칸 = [조각 이름] + 실제로 그려진 조각. 이름은 CSS 에서 찾을 때 쓰는 클래스 그대로 적는다
function sgItem(name, ...nodes) {
  return el('div', { class: 'sg__item' },
    el('code', { class: 'sg__name' }, name),
    el('div', { class: 'sg__demo' }, ...nodes));
}

// 여러 칸을 한 줄에 늘어놓는 묶음
function sgRow(...items) {
  return el('div', { class: 'sg__row' }, ...items);
}

// 2026-09-10 v2.42.0 구역 하나 = 번호가 붙은 카드 한 장. 위에서 아래로 길게 늘어놓으면 스크롤만 길어져
// "우리가 가진 조각이 이만큼" 이라는 감이 안 온다 — 카드로 깔면 한 화면에 전체가 들어온다
let sgNo = 0;
function sgSection(title, note, ...children) {
  sgNo += 1;
  return el('section', { class: 'sg__sec' },
    el('h2', { class: 'sg__sec-title' },
      el('span', { class: 'sg__sec-no' }, String(sgNo).padStart(2, '0') + '.'),
      title),
    note ? el('p', { class: 'sg__note' }, note) : '',
    ...children);
}

// 색 한 칸 — 실제 변수값을 읽어 견본과 함께 보여 준다 (다크 모드에서 값이 달라지므로 화면에서 읽는다)
function sgSwatch(varName, label) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return el('div', { class: 'sg__swatch' },
    el('span', { class: 'sg__chip-color', style: `background:${value}` }),
    el('div', {},
      el('code', { class: 'sg__name' }, varName),
      el('span', { class: 'sg__val' }, `${label} · ${value}`)));
}

function renderStyleguidePage() {
  sgNo = 0;   // 다시 그릴 때마다 번호를 처음부터 (언어 전환·뒤로가기로 두 번 그려질 수 있다)
  const body = pageBody('styleguide');

  // ── 색 ──────────────────────────────────────────────────────────────────
  body.append(sgSection('색 토큰', '값은 지금 이 화면(라이트/다크)에서 읽은 실제 값이다. 색은 "의미"에만 쓴다 — 타입·폼·순위·지금 위치.',
    el('div', { class: 'sg__grid' },
      sgSwatch('--bg', '바탕'), sgSwatch('--fg', '글자'), sgSwatch('--muted', '보조 글자'),
      sgSwatch('--line', '테두리'), sgSwatch('--surface', '카드 면'), sgSwatch('--hover', '가리킴'),
      sgSwatch('--accent', '지금 여기')),
    el('h3', { class: 'sg__sub' }, '폼 색'),
    el('div', { class: 'sg__grid' },
      sgSwatch('--c-max', '다이맥스'), sgSwatch('--c-mega', '메가'), sgSwatch('--c-shadow', '섀도우')),
    el('h3', { class: 'sg__sub' }, '타입 색 (18종)'),
    el('div', { class: 'sg__types' },
      ...Object.entries(typeof TYPE_KO !== 'undefined' ? TYPE_KO : {}).map(([key, korean]) =>
        el('span', { class: 'tchips__item' },
          el('span', { class: 'dot', style: `--c: var(--t-${key})` }), korean)))));

  // ── 글자 ────────────────────────────────────────────────────────────────
  body.append(sgSection('글자', '크기 체계는 손대지 않는다 — 강조는 굵기와 테두리로 한다.',
    el('div', { class: 'sg__stack' },
      sgItem('.page__sec (소제목)', el('h2', { class: 'page__sec' }, '5성 레이드', metaText(' 4종'))),
      sgItem('본문', el('p', {}, '보스를 누르면 약점과 추천 딜러가 열려요.')),
      sgItem('.meta (보조)', metaText('CP 1703–1784 · 눈 부스트')),
      sgItem('.note (안내)', el('p', { class: 'note' }, '지금 도는 레이드 로테이션입니다.')),
      sgItem('.dex__hint (빈 상태·유도)', hintNote('로그인하면 ★로 담은 포켓몬을 볼 수 있어요.')),
      sgItem('.detail__foot (각주)', footNote('출처 LeekDuck(ScrapedDuck) · 지역과 이벤트에 따라 실제와 다를 수 있습니다')),
      sgItem('.empty (비어 있음)', el('p', { class: 'empty' }, '아직 받은 정보가 없습니다.')))));

  // ── 버튼 ────────────────────────────────────────────────────────────────
  body.append(sgSection('버튼', '손가락 대상은 44px(--tap). 가리키거나 눌러도 자리는 움직이지 않는다 — 색만 바뀐다.',
    el('div', { class: 'sg__stack' },
      sgItem('.uchip', sgRow(uchip('1세대'), uchip('★ 즐겨찾기 9', null, { class: 'fav-chip' }), uchip('눌림', null, { on: true }))),
      sgItem('.icon-btn', sgRow(iconBtn('🔍', '검색'), iconBtn('☰', '메뉴'), iconBtn('EN', '언어 전환', null, { class: 'lang-toggle' }))),
      sgItem('.drawer__item (메뉴 줄)',
        el('div', { class: 'sg__box' },
          el('button', { class: 'drawer__item' },
            el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, '🎉'),
            el('span', { class: 'drawer__label' }, '패치노트')))),
      sgItem('.copy-btn', el('button', { class: 'copy-btn' }, '복사')),
      sgItem('.tool-btn', el('button', { class: 'tool-btn' }, '🧮 솔플 계산기')),
      sgItem('.schedule__more', el('button', { class: 'schedule__more' }, '자세히 보기 (전체 화면) →')))));

  // ── 고르기 ──────────────────────────────────────────────────────────────
  const $segDemo = seg([{ id: 'all', label: '전체' }, { id: 'pve', label: 'PvE' }, { id: 'pvp', label: 'PvP' }], 'all', () => {});
  const $viewDemo = layoutToggle('pogo_sg_demo', true, () => {});
  body.append(sgSection('고르기', '누르는 즉시 뜻이 바뀌는 것은 세그먼트로 — 지금 무엇인지와 고를 수 있는 것이 함께 보여야 한다.',
    el('div', { class: 'sg__stack' },
      sgItem('.seg (리그·갈래 토글)', $segDemo),
      sgItem('.view-toggle (보기 방식, v2.40.0)', $viewDemo),
      sgItem('.chips / .chips__item',
        el('div', { class: 'chips' },
          el('button', { class: 'chips__item' }, '불꽃'),
          el('button', { class: 'chips__item is-on' }, '물'),
          el('button', { class: 'chips__item' }, '풀'))),
      sgItem('.tabs / .tabs__item',
        el('div', { class: 'tabs' },
          el('button', { class: 'tabs__item is-on' }, 'D-MAX'),
          el('button', { class: 'tabs__item' }, '레이드 · PvE'),
          el('button', { class: 'tabs__item' }, '배틀 · PvP'))))));

  // ── 태그·뱃지 ───────────────────────────────────────────────────────────
  body.append(sgSection('태그·뱃지', '이름 앞뒤에 붙어 "이건 보통 개체가 아니다"를 알린다. 폼 색은 게임 아이콘 색을 따른다.',
    el('div', { class: 'sg__stack' },
      sgItem('.form-tag', sgRow(
        el('span', { class: 'form-tag form-tag--mega' }, '메가'),
        el('span', { class: 'form-tag form-tag--max' }, '거다이맥스'),
        el('span', { class: 'form-tag form-tag--shadow' }, '섀도우'),
        el('span', { class: 'form-tag' }, '히스이'))),
      sgItem('.tag', sgRow(
        el('span', { class: 'tag tag--gmax' }, 'G-MAX'),
        el('span', { class: 'tag tag--use' }, '활용 3곳'),
        el('span', { class: 'tag tag--use tag--many' }, '활용 7곳'),
        el('span', { class: 'tag tag--chg is-up' }, '기술 상향'),
        el('span', { class: 'tag tag--chg is-down' }, '기술 하향'))),
      sgItem('.tier__badge (등급)', sgRow(
        el('span', { class: 'tier__badge tier__badge--s' }, 'S'),
        el('span', { class: 'tier__badge tier__badge--a' }, 'A'),
        el('span', { class: 'tier__badge tier__badge--b' }, 'B'),
        el('span', { class: 'tier__badge tier__badge--c' }, 'C'))),
      sgItem('.grade-mark (PvE 평가)', sgRow(
        el('span', { class: 'grade-mark grade-mark--s' }, 'S'),
        el('span', { class: 'grade-mark grade-mark--a' }, 'A'),
        el('span', { class: 'grade-mark grade-mark--b' }, 'B'))),
      sgItem('.delta (순위 변동)', sgRow(
        el('span', { class: 'delta is-up' }, '▲2'),
        el('span', { class: 'delta is-down' }, '▼3'))),
      sgItem('.plan__hundo (유사백 판정)', sgRow(
        el('span', { class: 'tag plan__hundo plan__hundo--hundo' }, '백개체'),
        el('span', { class: 'tag plan__hundo plan__hundo--near' }, '유사백'),
        el('span', { class: 'tag plan__hundo plan__hundo--good' }, '준수'))),
      sgItem('.dot-badge (새 소식 점)',
        el('div', { class: 'sg__box' },
          el('button', { class: 'drawer__item dot-badge' },
            el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, '🎉'),
            el('span', { class: 'drawer__label' }, '패치노트')))))));

  // ── 목록 ────────────────────────────────────────────────────────────────
  const demoRow = (grid) => el('div', { class: `dex__list${grid ? ' is-grid' : ''}` },
    ...[[6, '리자몽', '불꽃·비행 · CP 1855–1937'], [150, '뮤츠', '에스퍼 · CP 2294–2387']].map(([dex, name, note]) =>
      el('button', { class: 'dex__row gameday__row' },
        sprite(dex),
        el('div', { class: 'gameday__main' },
          el('b', {}, name),
          el('span', { class: 'meta gameday__note' }, note)))));
  body.append(sgSection('목록', '고르는 화면은 카드, 훑는 화면은 줄. 좁은 화면은 줄이 빠르고 넓은 화면은 카드가 눈에 든다.',
    el('div', { class: 'sg__stack' },
      sgItem('.dex__list (줄)', demoRow(false)),
      sgItem('.dex__list.is-grid (카드)', demoRow(true)),
      // 2026-09-10 v2.46.0 검색 결과 줄 — 헤더 검색 패널 안에서만 보이던 조각이라 여기 한 번 꺼내 둔다
      sgItem('.sugg__item (검색 결과)', el('div', { class: 'sugg' },
        ...[[258, '물짱이', ['water']], [94, '팬텀', ['ghost', 'poison']]].map(([dex, name, types]) =>
          el('button', { class: 'sugg__item' },
            sprite(dex),
            el('span', { class: 'sugg__main' },
              el('span', { class: 'sugg__name' }, name),
              el('span', { class: 'sugg__meta' },
                ...types.map((typeName) => el('span', { class: 'dex__type', style: `--c: var(--t-${typeName})` },
                  el('i', { class: 'dot', 'aria-hidden': 'true' }),
                  el('b', {}, TYPE_KO[typeName] ?? typeName))),
                el('span', { class: 'dex__no sugg__no' }, `#${String(dex).padStart(4, '0')}`))),
            el('span', { class: 'sugg__go', 'aria-hidden': 'true' }, '›'))))),
      sgItem('.row-list > .row (랭킹 줄·카드)',
        el('ul', { class: 'row-list' },
          el('li', { class: 'row' },
            el('span', { class: 'row__rank' }, '1'),
            sprite(149),
            el('div', { class: 'row__main' },
              el('div', { class: 'row__name' }, el('b', {}, '망나뇽')),
              el('div', { class: 'row__moves' }, '용의숨결 / 역린')),
            el('div', { class: 'row__stats' },
              el('span', { class: 'row__score' }, '92.4'),
              el('span', { class: 'row__sub' }, '1위 대비 100%'))))))));

  // ── 카드·판 ─────────────────────────────────────────────────────────────
  body.append(sgSection('카드·판', '테두리 1px · 반경 12px · --surface 배경이 이 서비스의 "카드" 한 가지 문법이다.',
    el('div', { class: 'sg__stack' },
      sgItem('.schedule (아코디언)',
        el('details', { class: 'schedule' },
          el('summary', {}, '📅 일정표'),
          el('div', { class: 'schedule__body' }, el('p', { class: 'schedule__item' }, '9/12 커뮤니티 데이')))),
      sgItem('.detail__cp-card (큰 숫자 카드)',
        el('details', { class: 'detail__cp-card' },
          el('summary', {},
            el('span', { class: 'meta' }, 'CP 100% 기준'),
            el('b', { class: 'detail__cp-big' }, '3,412')),
          el('div', { class: 'detail__cp-grid' },
            ...[['레이드', '1,830'], ['부스트', '2,288'], ['야생', '1,464'], ['부스트', '1,830']].map(([label, value]) =>
              el('div', { class: 'detail__cp-tile' }, el('span', { class: 'meta' }, label), el('b', {}, value)))))),
      sgItem('.plan__card', el('div', { class: 'plan__card' },
        el('b', { class: 'plan__title' }, '내 포켓몬'),
        el('p', { class: 'plan__desc' }, '개체를 저장해 두면 만렙 CP 를 견줄 수 있어요.'))),
      sgItem('.home__tile (서비스 홈 타일)',
        el('div', { class: 'home__grid sg__tiles' },
          el('a', { class: 'home__tile', href: '#/styleguide' },
            el('div', { class: 'home__tile-top' },
              el('span', { class: 'home__icon', 'aria-hidden': 'true' }, '📕'),
              el('span', { class: 'home__number' }, '02')),
            el('strong', {}, '포켓몬 도감'),
            el('span', { class: 'home__desc' }, '능력치부터 기술·진화까지'),
            el('span', { class: 'home__arrow', 'aria-hidden': 'true' }, '↗')))),
      sgItem('.sprite-box (그림 판)',
        el('div', { class: 'sprite-box' }, sprite(384))))));

  // ── 메뉴 ────────────────────────────────────────────────────────────────
  body.append(sgSection('메뉴 (v2.40.0)', '성격이 같은 것끼리 카드 한 장에 담고 사이는 얇은 선으로만 나눈다. 줄 하나 = [아이콘] 이름 [›].',
    el('div', { class: 'sg__stack' },
      sgItem('.drawer__sec + .nav-menu',
        el('div', { class: 'sg__drawer' },
          el('h3', { class: 'drawer__sec' }, '서비스'),
          el('nav', { class: 'nav-menu' },
            ...[['🏠', '서비스 홈', false], ['📕', '포켓몬 도감', true], ['⚔️', '레이드 보스', false]].map(([icon, label, current]) =>
              el('a', Object.assign({ class: 'drawer__item', href: '#/styleguide' }, current ? { 'aria-current': 'page' } : {}),
                el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, icon),
                el('span', { class: 'drawer__label' }, label)))))),
      sgItem('.drawer__group (정보 카드)',
        el('div', { class: 'sg__drawer' },
          el('h3', { class: 'drawer__sec' }, '정보'),
          el('div', { class: 'drawer__group' },
            el('details', { class: 'schedule' },
              el('summary', {},
                el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, 'ℹ️'),
                el('span', { class: 'drawer__label' }, '기준 안내')),
              el('div', { class: 'schedule__body' }, el('p', { class: 'note' }, '이 화면 숫자의 근거를 적는 자리.'))),
            // 실제 드로어의 #drawer-extra 와 같은 자리지만 id 를 빌리지 않는다 — 한 문서에 같은 id 가
            // 둘이면 getElementById 가 어느 쪽을 집을지가 문서 순서에 달리게 된다 (app-shell.js 가 그 id 를 쓴다)
            el('div', { class: 'sg__extra' },
              el('button', { class: 'drawer__item' },
                el('span', { class: 'drawer__ico', 'aria-hidden': 'true' }, '📜'),
                el('span', { class: 'drawer__label' }, '이용약관')),
              el('p', { class: 'drawer__meta' }, 'PvPoke · PokeMiners 데이터'))))),
      sgItem('.account (계정 카드)',
        el('div', { class: 'sg__drawer' },
          el('div', { class: 'account' },
            el('div', { class: 'account__who' },
              el('span', { class: 'avatar' }, '👤'),
              el('div', {}, el('b', {}, '로컬 테스트'), el('span', { class: 'account__email' }, 'test@example.com'))),
            el('div', { class: 'account__stats' },
              el('span', {}, '★ 즐겨찾기 ', el('b', {}, '9마리')),
              el('span', {}, '🎒 내 포켓몬 ', el('b', {}, '2마리'))),
            el('div', { class: 'account__actions' },
              el('button', { class: 'drawer__item account__primary' }, '🔑 가입 승인'),
              el('button', { class: 'drawer__item' }, '로그아웃'))))))));

  // ── 겹쳐 뜨는 것 ────────────────────────────────────────────────────────
  body.append(sgSection('겹쳐 뜨는 것', '팝업은 눌러서 실제로 열어 본다 — 배경 어둡기·닫기 버튼 자리·스크롤 잠금이 모두 여기서 드러난다.',
    el('div', { class: 'sg__stack' },
      sgItem('.modal (팝업)',
        uchip('팝업 열기', () => openModal(el('div', { class: 'detail' },
          el('h2', { class: 'detail__name' }, '팝업 예시'),
          el('p', {}, '✕ 는 카드 밖 오른쪽 위에 뜬다 (v2.34.0).'),
          footNote('닫기: ✕ · Esc · 배경 누르기'))))),
      // 타입 배지는 실제로 그림 상자 왼쪽 위에 겹쳐 붙는 조각이라(v2.35.0), 상자와 함께 보여야 뜻이 맞다
      sgItem('.detail__type-pill (그림 위 타입 배지)',
        el('div', { class: 'sprite-box' }, sprite(6),
          el('div', { class: 'detail__types' },
            el('span', { class: 'detail__type-pill', style: '--c: var(--t-fire)' }, '불꽃'),
            el('span', { class: 'detail__type-pill', style: '--c: var(--t-flying)' }, '비행')))))));

  body.append(footNote('이 화면은 dev 미리보기 빌드에만 있습니다 (실서비스 번들에는 들어가지 않습니다). ',
    '조각은 실제 CSS·실제 함수를 그대로 부르므로, 여기 보이는 모양이 곧 실제 화면의 모양입니다.'));
  return body;
}

PAGES.styleguide = { title: '🎨 UI 목록', render: renderStyleguidePage };

// components/pages.js 는 제 파일 끝에서 renderPage() 를 한 번 부른다 — 이 주소로 바로 들어와도
// 그 시점엔 위 등록이 아직 안 돼 홈이 그려진다. 등록을 마친 지금 한 번 더 부른다.
// (다른 주소로 들어왔다면 currentPageId() 가 다른 값이라 아무 일도 하지 않는다)
if (currentPageId() === 'styleguide') renderPage();
