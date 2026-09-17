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

// 세 갈래의 이름과 한 줄 설명. 순서는 THEME_ORDER 그대로다
const THEME_TEXT: Record<Theme, [string, string]> = {
  system: ['기기 설정 따름', '휴대폰·PC 가 어두우면 같이 어두워져요.'],
  light: ['밝게', '기기 설정과 상관없이 늘 밝게 봐요.'],
  dark: ['어둡게', '기기 설정과 상관없이 늘 어둡게 봐요.'],
};

// 움직이는 그림 — 기본 켬. 끄면 다음에 그리는 화면부터 정지본
const ANIM: [string, string, string][] = [
  ['on', '켜기', '포켓몬이 움직여요. 움직이는 그림이 없는 종은 정지 그림 그대로예요. 그림을 더 받아서 데이터를 조금 더 써요.'],
  ['off', '끄기', '정지 그림만 써요. 느린 회선이나 데이터를 아낄 때.'],
];

function Choice({ on, name, desc, onPick }: { on: boolean; name: string; desc: string; onPick: () => void }) {
  return (
    <button className={`settings__choice${on ? ' is-on' : ''}`} role="radio" aria-checked={on} onClick={onPick}>
      <span className="settings__mark" aria-hidden="true" />
      <span className="settings__choice-main"><b>{name}</b><span>{desc}</span></span>
    </button>
  );
}

export default function Settings() {
  const theme = usePrefStore((s) => s.theme);
  const setTheme = usePrefStore((s) => s.setTheme);
  const [anim, setAnim] = useState(() => (spriteAnimEnabled() ? 'on' : 'off'));
  // 이 기기가 지금 어느 쪽인지 — '기기 설정 따름' 을 골랐을 때 무엇이 되는지가 이 한 줄로 읽힌다
  const deviceNow = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '어둡게' : '밝게';

  return (
    <div className="page__body" id="page-settings" data-route="settings">
      <h2 className="page__sec">화면 테마</h2>
      <p className="page-head__desc settings__desc">{`지금 이 기기의 설정은 ${deviceNow}예요.`}</p>
      <div className="settings__group" role="radiogroup" aria-label="화면 테마">
        <div className="settings__choices">
          {THEME_ORDER.map((choice) => {
            const [name, desc] = THEME_TEXT[choice];
            return <Choice key={choice} on={choice === theme} name={name} desc={desc}
              onPick={() => { setTheme(choice); track('theme_set', { to: choice }); }} />;
          })}
        </div>
      </div>
      {/* 미리보기에는 로그인이 없다 — 지어내지 않고 지금 사실만 적는다 (v3 는 여기서 계정 저장을 안내한다) */}
      <p className="dex__hint">지금은 이 브라우저에만 저장돼요. 계정 저장은 로그인이 붙는 판에 이어져요.</p>
      <p className="detail__foot">상단 바의 테마 버튼은 밝게 ↔ 어둡게만 한 번에 뒤집어요. 기기 설정을 따르게 하려면 여기서 고르세요.</p>

      <h2 className="page__sec">움직이는 그림</h2>
      <div className="settings__group" role="radiogroup" aria-label="움직이는 그림">
        <div className="settings__choices">
          {ANIM.map(([choice, name, desc]) => (
            <Choice key={choice} on={choice === anim} name={name} desc={desc} onPick={() => {
              try {
                if (choice === 'on') localStorage.removeItem(SPRITE_ANIM_KEY);
                else localStorage.setItem(SPRITE_ANIM_KEY, 'off');
              } catch { /* 저장 불가 환경 */ }
              track('sprite_anim_set', { to: choice });
              document.body.classList.toggle('sprite-anim-off', choice === 'off');
              setAnim(choice);
            }} />
          ))}
        </div>
      </div>
      <p className="detail__foot">바꾸면 다음에 여는 화면부터 적용돼요. 기기의 "동작 줄이기" 설정이 켜져 있으면 늘 정지 그림이에요.</p>
    </div>
  );
}
