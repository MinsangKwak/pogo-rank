// ─────────────────────────────────────────────────────────────────────────────
// components/LoginInvite.tsx — ★ 를 눌렀는데 로그인 전일 때 (v3 auth.js openLoginInvite)
//
// **승인제라는 것을 누르기 전에 말한다.** 로그인부터 시키고 나서 "왜 아직도 안 되지" 를
// 겪게 하지 않으려고, 세 걸음을 먼저 펼쳐 보인다.
//
// 화면 이름 뒤에 조사를 붙이지 않는다 — 받침만 보는 규칙은 "레이드 · PvE" 처럼 라틴 문자로
// 끝나는 이름에서 늘 틀린다 ("PvE은"). 조사가 필요 없는 문장으로 적는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { signInNow, useAuthStore } from '../stores/auth';
import { termsAccepted } from '../lib/terms';
import { track } from '../lib/track';
import TermsConsent from './TermsConsent';

const STEPS: [string, string, string][] = [
  ['1', 'Google 계정으로 로그인', '이메일·이름·프로필 사진만 받아요.'],
  ['2', '관리자 승인 기다리기', '바로 승인되지 않을 수 있어요. 관리자에게 알려 주세요.'],
  ['3', '승인되면 열려요', '내 포켓몬·검색식·화면 설정이 계정에 묶여 어느 기기에서든 같아요.'],
];

export default function LoginInvite({ screen, onClose }: { screen: string; onClose: () => void }) {
  const status = useAuthStore((s) => s.status);
  const box = useRef<HTMLDialogElement>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const pending = status === 'pending';

  // GA4: 어느 화면이 로그인을 부르나 — 한 번만 센다
  useEffect(() => { track('login_invite', { screen, status }); }, [screen, status]);
  useEffect(() => { const node = box.current; if (!node?.open) node?.showModal(); }, []);

  const start = () => {
    if (!termsAccepted()) { setConsentOpen(true); return; }
    onClose();
    void signInNow();
  };

  const where = screen ? `${screen} ` : '이 ';
  return (
    <dialog className="modal" ref={box} aria-label={pending ? '승인을 기다리는 중이에요' : '로그인하면 열려요'}
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <div className="consent__modal login-invite">
            <div className="login-invite__head">
              <span className="login-invite__ico" aria-hidden="true">{pending ? '⏳' : '🔒'}</span>
              <h2 className="detail__name">{pending ? '승인을 기다리는 중이에요' : '로그인하면 열려요'}</h2>
            </div>
            <p className="plan__desc">
              {pending ? `${where}화면은 관리자가 승인하면 바로 열려요.` : `${where}화면은 승인된 분만 볼 수 있어요.`}
            </p>
            {pending ? null : (
              <ol className="login-invite__steps">
                {STEPS.map(([no, title, desc]) => (
                  <li key={no}>
                    <span className="login-invite__no">{no}</span>
                    <div><b>{title}</b><span>{desc}</span></div>
                  </li>
                ))}
              </ol>
            )}
            {pending ? null : (
              <button className="drawer__item account__login login-invite__go" onClick={start}>🔐 Google로 로그인</button>
            )}
            <button className="drawer__item login-invite__later" onClick={onClose}>{pending ? '확인' : '나중에'}</button>
            <p className="detail__foot">
              {'첫 로그인 때 '}<a href="#/terms" onClick={onClose}>이용약관</a>{'·'}
              <a href="#/privacy" onClick={onClose}>개인정보처리방침</a>{' 동의를 받아요.'}
            </p>
          </div>
        </div>
      </div>
      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); onClose(); void signInNow(); }} />
      ) : null}
    </dialog>
  );
}
