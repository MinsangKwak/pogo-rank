// ─────────────────────────────────────────────────────────────────────────────
// screens/Settings.tsx — ⚙️ 설정 (v3 components/settings.js · v6 피그마 17 판)
//
// 왜 이 화면이 따로 있나 — 화면 테마가 헤더 버튼 하나로 세 상태를 돌고 있었고,
// 누를 때마다 무엇이 될지 예측이 안 됐다. 손잡이(헤더 버튼)는 둘만 돌게 하고,
// 세 갈래는 여기서 고르게 가른다. "자주 뒤집는 것" 과 "한 번 정해 두는 것" 은 같은 자리에 있을 이유가 없다.
//
// v6 에서는 판 다섯이 선다 — 마이페이지(로그인) · 화면 테마 · 포켓몬 애니메이션 · 통계 · 저장소 · 계정 관리.
// 로그인 · 로그아웃 · 삭제는 ☰ 메뉴의 계정 카드(Account.tsx)와 **같은 저장소 함수**를 쓴다 — 판정이 한 벌이다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { usePrefStore, THEME_ORDER, type Theme } from '../stores/pref';
import { spriteAnimEnabled, SPRITE_ANIM_KEY } from '../components/Bits';
import { track } from '../lib/track';
import { signInNow, signOutNow, authEmail, useAuthStore } from '../stores/auth';
import { termsAccepted } from '../lib/terms';
import TermsConsent from '../components/TermsConsent';
import ConsentDialog from '../components/Consent';
import DeleteAccountDialog from '../components/DeleteAccountDialog';
import { PixelIcon } from '../components/PixelIcon';

// 세 갈래의 이름과 한 줄 설명. 순서는 THEME_ORDER 그대로다
const THEME_TEXT: Record<Theme, [string, string]> = {
  system: ['시스템 설정 따르기', '기기에 설정된 화면 테마를 따라가요.'],
  light: ['라이트', '항상 밝은 테마로 표시해요.'],
  dark: ['다크', '항상 어두운 테마로 표시해요.'],
};

// 포켓몬 애니메이션 — 기본 끔 (기본 그림이 일러스트라). 켜면 다음에 그리는 화면부터 도트 GIF
const ANIM_TEXT: Record<'on' | 'off', string> = {
  on: '움직이는 도트 이미지를 표시해요. 이미지가 없는 포켓몬은 정지 이미지로 표시하며, 데이터 사용량이 늘어날 수 있어요.',
  off: '움직이지 않는 공식 일러스트를 표시해요.',
};

/** 판 하나 — 제목 · 설명 · 내용. 설정 화면은 이 판을 세로로 쌓는다 */
function Panel({ id, title, desc, children }: { id: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="px-panel px-skin px-drop pxp-set" aria-labelledby={`${id}-title`}>
      <div className="pxp-set__head">
        <h3 className="px-heading" id={`${id}-title`}>{title}</h3>
        {desc ? <p className="px-body px-muted">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** 마이페이지 판 — 확인 중 · 비로그인 · 승인 대기 · 승인됨 (Account.tsx 와 같은 네 상태) */
function MyPage({ onLogin }: { onLogin: () => void }) {
  const { user, status } = useAuthStore();
  if (!user && status === 'loading') {
    return <p className="px-body px-muted" aria-busy="true">로그인 확인 중…</p>;
  }
  if (!user) {
    return (
      <div className="pxp-set__row">
        <p className="px-body px-muted">로그인하면 즐겨찾기를 기기 간에 이어서 볼 수 있어요. 첫 로그인 시 <a href="/terms">이용약관</a>·<a href="/privacy">개인정보처리방침</a>에 대한 동의를 받아요.</p>
        <button type="button" className="px-btn px-btn--primary px-skin account__login" onClick={onLogin}><PixelIcon name="user" /> Google로 로그인</button>
      </div>
    );
  }
  return (
    <div className="pxp-set__row">
      <div className="pxp-who">
        {user.photoURL ? <img className="pxp-who__avatar" src={user.photoURL} alt="" width="44" height="44" /> : <span className="pxp-who__avatar" aria-hidden="true"><PixelIcon name="user" /></span>}
        <div>
          <p className="px-sub">{user.displayName || '(이름 없음)'}</p>
          <p className="px-caption px-mono">{authEmail()}</p>
        </div>
        {status === 'pending'
          ? <span className="px-badge px-skin px-badge--ko px-badge--yellow">승인 대기</span>
          : <span className="px-badge px-skin px-badge--ko px-badge--mint">로그인됨</span>}
      </div>
      {status === 'pending'
        ? <p className="px-caption">관리자가 승인하면 내 포켓몬을 계정에 저장할 수 있어요. 관리자에게 알려주세요!</p>
        : <p className="px-caption">즐겨찾기가 계정에 저장돼 다른 기기에서 로그인해도 이어서 볼 수 있어요.</p>}
    </div>
  );
}

export default function Settings() {
  const theme = usePrefStore((s) => s.theme);
  const setTheme = usePrefStore((s) => s.setTheme);
  const [anim, setAnim] = useState<'on' | 'off'>(() => (spriteAnimEnabled() ? 'on' : 'off'));
  const { enabled, user, admin, recheckError } = useAuthStore();
  const [consentOpen, setConsentOpen] = useState(false);     // 첫 로그인 동의
  const [statsOpen, setStatsOpen] = useState(false);         // 통계 · 저장소 설정
  const [deleteOpen, setDeleteOpen] = useState(false);       // 계정 삭제 확인
  // 이 기기가 지금 어느 쪽인지 — '시스템 설정 따르기' 를 골랐을 때 무엇이 되는지가 이 한 줄로 읽힌다
  const deviceNow = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? '다크 모드' : '밝은 모드';

  // 승인제라는 사실을 누르기 전에 알린다 — 그래야 "로그인했는데 왜 안 되지" 를 겪지 않는다
  const start = () => {
    if (!termsAccepted()) { setConsentOpen(true); return; }
    void signInNow();
  };

  const pickAnim = (next: 'on' | 'off') => {
    try {
      // 켬을 'on' 으로 적는다 — 기본이 끔이 되면서 '켬 = 키 삭제' 로는 선택을 남길 수 없다
      localStorage.setItem(SPRITE_ANIM_KEY, next);
    } catch { /* 저장 불가 환경 */ }
    track('sprite_anim_set', { to: next });
    document.body.classList.toggle('sprite-anim-off', next === 'off');
    setAnim(next);
  };

  return (
    <div className="pxp pxp-settings" id="page-settings" data-route="settings">
      {/* 로그인을 쓸 수 없는 빌드에서는 계정 판을 통째로 감춘다 — 눌러도 안 되는 버튼을 내밀지 않는다 (Account.tsx 와 같다) */}
      {enabled ? (
        <Panel id="settings-account" title="마이페이지">
          <MyPage onLogin={start} />
          {user && recheckError
            ? <p className="px-caption">{`⚠ 권한을 다시 확인하지 못했어요 (${recheckError}) — 지금 보이는 권한은 마지막으로 확인된 값이에요. 새로고침하면 다시 확인해요`}</p>
            : null}
        </Panel>
      ) : null}

      <Panel id="settings-theme" title="화면 테마" desc={`현재 기기의 화면 테마: ${deviceNow}`}>
        <div className="px-chips" role="radiogroup" aria-label="화면 테마">
          {THEME_ORDER.map((choice) => (
            <button key={choice} type="button" className="px-chip px-skin" role="radio" aria-checked={choice === theme} aria-pressed={choice === theme}
              onClick={() => { setTheme(choice); track('theme_set', { to: choice }); }}>
              {THEME_TEXT[choice][0]}
            </button>
          ))}
        </div>
        <p className="px-body px-muted">{THEME_TEXT[theme][1]}</p>
        <p className="px-caption">현재 설정은 이 브라우저에 저장돼요. 헤더의 테마 버튼으로 밝은 모드와 다크 모드를 전환할 수 있어요. 기기 설정을 따르려면 위에서 선택해 주세요.</p>
      </Panel>

      <Panel id="settings-animation" title="포켓몬 애니메이션">
        <div className="pxp-set__toggle">
          <button type="button" className="px-toggle" role="switch" aria-checked={anim === 'on'} onClick={() => pickAnim(anim === 'on' ? 'off' : 'on')}>
            <span className="px-toggle__track" aria-hidden="true" />
            <span>{anim === 'on' ? '켜짐' : '꺼짐'}</span>
          </button>
          <p className="px-body px-muted">{ANIM_TEXT[anim]}</p>
        </div>
        <p className="px-caption">변경한 설정은 다음에 여는 화면부터 적용돼요. 기기의 동작 줄이기 설정이 켜져 있으면 정지 이미지를 표시해요.</p>
      </Panel>

      <Panel id="settings-stats" title="통계 · 저장소" desc="방문 통계를 켜고 끄거나, 오프라인용 캐시를 비울 수 있어요. 이메일·이름은 전송하지 않아요.">
        <div className="px-note__actions">
          <button type="button" className="px-btn px-skin" onClick={() => setStatsOpen(true)}><PixelIcon name="gear" /> 통계 · 저장소 설정 열기</button>
        </div>
      </Panel>

      {enabled && user ? (
        <Panel id="settings-manage" title="계정 관리">
          <div className="px-note__actions">
            <button type="button" className="px-btn px-skin" onClick={() => void signOutNow()}>로그아웃</button>
            {/* 관리자는 여기서 지우지 않는다 — Account.tsx 와 같은 규칙 */}
            {admin ? null : (
              <button type="button" className="px-btn px-skin pxp-btn--danger account__danger" onClick={() => setDeleteOpen(true)}>계정 삭제</button>
            )}
          </div>
          <p className="px-caption">계정 삭제 전, 삭제되는 데이터와 복구 가능 여부를 확인합니다.</p>
        </Panel>
      ) : null}

      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); void signInNow(); }} />
      ) : null}
      {statsOpen ? <ConsentDialog onClose={() => setStatsOpen(false)} /> : null}
      {deleteOpen ? <DeleteAccountDialog onClose={() => setDeleteOpen(false)} /> : null}
    </div>
  );
}
