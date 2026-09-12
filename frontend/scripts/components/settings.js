// ─────────────────────────────────────────────────────────────────────────────
// components/settings.js — 설정 화면 (#/settings) (2026-09-12 v3.11.0)
//
// 왜 만드나
//   화면 테마가 헤더 버튼 하나로 세 상태(기기 설정 · 밝게 · 어둡게)를 돌고 있었다.
//   누를 때마다 무엇이 될지 예측이 안 됐다 — '기기 설정' 은 지금 화면이 밝은지 어두운지와
//   따로 놀아서, 같은 그림을 눌러도 어떤 날은 밝아지고 어떤 날은 어두워졌다.
//   손잡이(헤더 버튼)는 둘만 돌게 하고, 세 갈래는 여기서 고르게 가른다.
//   "자주 뒤집는 것" 과 "한 번 정해 두는 것" 은 같은 자리에 있을 이유가 없다.
//
// 계정 저장
//   로그인(승인)한 사용자는 고른 값이 Firestore users/{uid}.theme 에 적힌다 —
//   applyTheme() 이 이미 하던 일이다(components/theme.js saveThemeToAccount).
//   여기서는 그 사실을 화면에 밝혀 준다. 로그인하지 않았으면 이 브라우저에만 남는다.
//
// 제공하는 전역
//   renderSettingsPage()   PAGES.settings 가 부른다 (components/pages.js)
//
// 의존하는 전역
//   el (dom.js) · uchip · footNote · hintNote (components/ui.js)
//   THEME_ORDER · THEME_WORD · themeChoice · applyTheme (components/theme.js)
//   AUTH · authEmail · signIn (components/auth.js) · track (track.js)
// ─────────────────────────────────────────────────────────────────────────────

// 세 갈래의 이름과 한 줄 설명. 순서는 THEME_ORDER 그대로다
const SETTINGS_THEME = {
  system: ['기기 설정 따름', '휴대폰·PC 가 어두우면 같이 어두워져요.'],
  light: ['밝게', '기기 설정과 상관없이 늘 밝게 봐요.'],
  dark: ['어둡게', '기기 설정과 상관없이 늘 어둡게 봐요.'],
};

// 2026-09-12 v3.18.0 움직이는 그림 — 기본 켬. 끄면 다음에 그리는 화면부터 정지본 (components/sprite.js)
const SETTINGS_ANIM = [
  ['on', '켜기', '포켓몬이 움직여요. 그림을 더 받아서 데이터를 조금 더 써요.'],
  ['off', '끄기', '정지 그림만 써요. 느린 회선이나 데이터를 아낄 때.'],
];

function renderSettingsPage() {
  const $rows = el('div', { class: 'settings__choices' });
  // 고른 줄을 다시 그린다 — 눌린 표시(aria-checked)는 한 줄에만 있어야 한다
  const draw = () => {
    const now = themeChoice();
    $rows.replaceChildren(...THEME_ORDER.map((choice) => {
      const [name, desc] = SETTINGS_THEME[choice];
      return el('button', {
        class: `settings__choice${choice === now ? ' is-on' : ''}`,
        role: 'radio', 'aria-checked': String(choice === now),
        onclick: () => {
          applyTheme(choice);
          track('theme_set', { to: choice });   // GA4: 설정 화면에서 직접 고른 값
          draw();
        },
      },
        el('span', { class: 'settings__mark', 'aria-hidden': 'true' }),
        el('span', { class: 'settings__choice-main' }, el('b', {}, name), el('span', {}, desc)));
    }));
  };
  draw();
  // 이 기기가 지금 어느 쪽인지 — '기기 설정 따름' 을 골랐을 때 무엇이 되는지가 이 한 줄로 읽힌다
  const deviceNow = typeof themeIsDark === 'function' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '어둡게' : '밝게';
  // 계정 저장 안내 — 로그인 상태에 따라 다른 말을 한다. 지어내지 않는다:
  // 승인된 사용자만 계정에 써진다(firestore.rules), 그 외에는 이 브라우저에만 남는다
  const savedWhere = AUTH.status === 'ok'
    ? hintNote(`✓ 계정(${authEmail()})에 저장돼요 — 다른 기기에서 로그인해도 같은 화면으로 열려요.`)
    : hintNote('지금은 이 브라우저에만 저장돼요. ',
        AUTH.status === 'anon' && typeof authEnabled === 'function' && authEnabled()
          ? uchip('로그인하고 계정에 저장하기', () => signIn())
          : '승인되면 계정에 저장돼 어느 기기에서든 같아요.');

  // 움직이는 그림 줄 — 테마 줄과 같은 라디오 문법
  const $anim = el('div', { class: 'settings__choices' });
  const drawAnim = () => {
    const now = typeof spriteAnimEnabled === 'function' && spriteAnimEnabled() ? 'on' : 'off';
    $anim.replaceChildren(...SETTINGS_ANIM.map(([choice, name, desc]) => el('button', {
      class: `settings__choice${choice === now ? ' is-on' : ''}`,
      role: 'radio', 'aria-checked': String(choice === now),
      onclick: () => {
        try { if (choice === 'on') localStorage.removeItem(SPRITE_ANIM_KEY); else localStorage.setItem(SPRITE_ANIM_KEY, 'off'); } catch {}
        track('sprite_anim_set', { to: choice });
        drawAnim();
      },
    },
      el('span', { class: 'settings__mark', 'aria-hidden': 'true' }),
      el('span', { class: 'settings__choice-main' }, el('b', {}, name), el('span', {}, desc)))));
  };
  drawAnim();

  return pageBody('settings',
    sectionTitle('화면 테마'),
    el('p', { class: 'page-head__desc settings__desc' }, `지금 이 기기의 설정은 ${deviceNow}예요.`),
    el('div', { class: 'settings__group', role: 'radiogroup', 'aria-label': '화면 테마' }, $rows),
    savedWhere,
    footNote('상단 바의 테마 버튼은 밝게 ↔ 어둡게만 한 번에 뒤집어요. 기기 설정을 따르게 하려면 여기서 고르세요.'),
    sectionTitle('움직이는 그림'),
    el('div', { class: 'settings__group', role: 'radiogroup', 'aria-label': '움직이는 그림' }, $anim),
    footNote('바꾸면 다음에 여는 화면부터 적용돼요. 기기의 "동작 줄이기" 설정이 켜져 있으면 늘 정지 그림이에요.'));
}
