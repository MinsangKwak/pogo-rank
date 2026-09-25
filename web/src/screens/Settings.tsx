// ─────────────────────────────────────────────────────────────────────────────
// screens/Settings.tsx — ⚙️ 설정 (v3 components/settings.js)
//
// 왜 이 화면이 따로 있나 — 화면 테마가 헤더 버튼 하나로 세 상태를 돌고 있었고,
// 누를 때마다 무엇이 될지 예측이 안 됐다. 손잡이(헤더 버튼)는 둘만 돌게 하고,
// 세 갈래는 여기서 고르게 가른다. "자주 뒤집는 것" 과 "한 번 정해 두는 것" 은 같은 자리에 있을 이유가 없다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { usePrefStore, THEME_ORDER, type Theme } from '../stores/pref';
import { spriteAnimEnabled, SPRITE_ANIM_KEY } from '../components/Bits';
import { track } from '../lib/track';
import { signInNow, authEmail, useAuthStore } from '../stores/auth';
import { termsAccepted } from '../lib/terms';
import TermsConsent from '../components/TermsConsent';

// 세 갈래의 이름과 한 줄 설명. 순서는 THEME_ORDER 그대로다
const THEME_TEXT: Record<Theme, [string, string]> = {
  system: ['기기 설정 따름', '기기에 설정된 화면 테마를 따라가요.'],
  light: ['밝게', '항상 밝은 테마로 표시해요.'],
  dark: ['어둡게', '항상 어두운 테마로 표시해요.'],
};

// 포켓몬 애니메이션 — 기본 끔 (기본 그림이 일러스트라). 켜면 다음에 그리는 화면부터 도트 GIF
const ANIM: [string, string, string][] = [
  ['on', '켜기', '움직이는 도트 이미지를 표시해요. 이미지가 없는 포켓몬은 정지 이미지로 표시하며, 데이터 사용량이 늘어날 수 있어요.'],
  ['off', '끄기', '움직이지 않는 공식 일러스트를 표시해요.'],
];

function Choice({ on, name, desc, onPick }: { on: boolean; name: string; desc: string; onPick: () => void }) {
  return (
    <button className={`settings__choice${on ? ' is-on' : ''}`} role="radio" aria-checked={on} onClick={onPick}>
      <span className="settings__mark" aria-hidden="true" />
      <span className="settings__choice-main"><b>{name}</b><span>{desc}</span></span>
    </button>
  );
}

/**
 * 고른 테마가 어디에 남는지 (v3 settings.js savedWhere).
 * **지어내지 않는다** — 규칙상 계정 문서는 승인된 사람만 쓸 수 있고, 그 외에는 이 브라우저에만 남는다.
 * v3 는 이 줄을 한 번 그리고 말아 로그인이 늦게 붙으면 '브라우저에만' 이 그대로 남았다. 여기서는 따라 바뀐다
 */
function SavedWhere() {
  const { enabled, status } = useAuthStore();
  const [consentOpen, setConsentOpen] = useState(false);
  if (status === 'ok') {
    return <p className="dex__hint">{`✓ 계정(${authEmail()})에 저장돼요 — 다른 기기에서 로그인해도 같은 화면으로 열려요.`}</p>;
  }
  const start = () => {
    if (!termsAccepted()) { setConsentOpen(true); return; }
    void signInNow();
  };
  return (
    <p className="dex__hint">
      {'현재 설정은 이 브라우저에 저장돼요. '}
      {status === 'anon' && enabled
        ? <button className="uchip" onClick={start}>로그인하고 계정에 저장하기</button>
        : '계정 이용이 승인되면 저장한 설정을 다른 기기에서도 사용할 수 있어요.'}
      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); void signInNow(); }} />
      ) : null}
    </p>
  );
}

export default function Settings() {
  const theme = usePrefStore((s) => s.theme);
  const setTheme = usePrefStore((s) => s.setTheme);
  const [anim, setAnim] = useState(() => (spriteAnimEnabled() ? 'on' : 'off'));
  // 이 기기가 지금 어느 쪽인지 — '기기 설정 따름' 을 골랐을 때 무엇이 되는지가 이 한 줄로 읽힌다
  const deviceNow = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '다크 모드' : '밝은 모드';

  return (
    <div className="page__body" id="page-settings" data-route="settings">
      <section className="settings__section" aria-labelledby="settings-theme-title">
      <header className="settings__section-head">
      <h2 className="page__sec" id="settings-theme-title">화면 테마</h2>
      <p className="settings__desc">{`현재 기기의 화면 테마: ${deviceNow}`}</p>
      </header>
      <div className="settings__group" role="radiogroup" aria-label="화면 테마">
        <div className="settings__choices">
          {THEME_ORDER.map((choice) => {
            const [name, desc] = THEME_TEXT[choice];
            return <Choice key={choice} on={choice === theme} name={name} desc={desc}
              onPick={() => { setTheme(choice); track('theme_set', { to: choice }); }} />;
          })}
        </div>
      </div>
      <div className="settings__notes">
      <SavedWhere />
      <p className="detail__foot">헤더의 테마 버튼으로 밝은 모드와 다크 모드를 전환할 수 있어요. 기기 설정을 따르려면 위에서 선택해 주세요.</p>
      </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-animation-title">
      <header className="settings__section-head">
      <h2 className="page__sec" id="settings-animation-title">포켓몬 애니메이션</h2>
      </header>
      <div className="settings__group" role="radiogroup" aria-label="포켓몬 애니메이션">
        <div className="settings__choices">
          {ANIM.map(([choice, name, desc]) => (
            <Choice key={choice} on={choice === anim} name={name} desc={desc} onPick={() => {
              try {
                // 켬을 'on' 으로 적는다 — 기본이 끔이 되면서 '켬 = 키 삭제' 로는 선택을 남길 수 없다
                localStorage.setItem(SPRITE_ANIM_KEY, choice);
              } catch { /* 저장 불가 환경 */ }
              track('sprite_anim_set', { to: choice });
              document.body.classList.toggle('sprite-anim-off', choice === 'off');
              setAnim(choice);
            }} />
          ))}
        </div>
      </div>
      <div className="settings__notes">
      <p className="detail__foot">변경한 설정은 다음에 여는 화면부터 적용돼요. 기기의 동작 줄이기 설정이 켜져 있으면 정지 이미지를 표시해요.</p>
      </div>
      </section>
    </div>
  );
}
