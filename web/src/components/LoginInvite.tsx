// ─────────────────────────────────────────────────────────────────────────────
// components/LoginInvite.tsx — ★ 를 눌렀는데 로그인 전일 때 (v3 auth.js openLoginInvite · v6 D07 '로그인 안내')
//
// **승인제라는 것을 누르기 전에 말한다.** 로그인부터 시키고 나서 "왜 아직도 안 되지" 를
// 겪게 하지 않으려고, 세 걸음을 먼저 펼쳐 보인다. 승인 대기 중이면 그 사실을 판 하나로 적는다.
//
// 화면 이름 뒤에 조사를 붙이지 않는다 — 받침만 보는 규칙은 "레이드 · PvE" 처럼 라틴 문자로
// 끝나는 이름에서 늘 틀린다 ("PvE은"). 조사가 필요 없는 문장으로 적는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { signInNow, useAuthStore } from '../stores/auth';
import { termsAccepted } from '../lib/terms';
import { track } from '../lib/track';
import TermsConsent from './TermsConsent';
import { PixelIcon } from './PixelIcon';
import { PxDialog, PxDialogBody, PxDialogFoot, PxDialogHead } from './PxDialog';
import { NoteBox } from './detail/Pieces';

const STEPS: [string, string, string][] = [
  ['1', 'Google 계정으로 로그인', '계정의 이메일·이름·프로필 사진을 받아요.'],
  ['2', '관리자 승인 기다리기', '바로 승인되지 않을 수 있어요. 관리자에게 알려 주세요.'],
  ['3', '승인 후 이용하기', '승인 후 계정에 저장한 정보를 다른 기기에서도 사용할 수 있어요.'],
];

export default function LoginInvite({ screen, onClose }: { screen: string; onClose: () => void }) {
  const status = useAuthStore((s) => s.status);
  const [consentOpen, setConsentOpen] = useState(false);
  const pending = status === 'pending';

  // GA4: 어느 화면이 로그인을 부르나 — 한 번만 센다
  useEffect(() => { track('login_invite', { screen, status }); }, [screen, status]);

  const start = () => {
    if (!termsAccepted()) { setConsentOpen(true); return; }
    onClose();
    void signInNow();
  };

  const where = screen ? `${screen} ` : '이 ';
  return (
    <PxDialog onClose={onClose} labelledBy="login-invite-title" className="pxd-dialog pxd-dialog--narrow" panelClassName="pxd-invite"
      // 동의 팝업은 이 dialog 안에 겹쳐 선다 — 바깥에 두면 showModal 의 순서가 뒤집혀 아래 판이 눌린다
      after={consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); onClose(); void signInNow(); }} />
      ) : null}>
      <PxDialogHead titleId="login-invite-title" title={pending ? '승인을 기다리는 중이에요.' : '즐겨찾기를 이어서 모아보세요.'}
        caption="로그인 안내" onClose={onClose} />
      <PxDialogBody>
        <p className="px-body">관심 포켓몬과 화면 설정을 내 계정에 안전하게 저장해요.</p>
        <p className="px-body px-muted">
          {pending ? `${where}화면은 관리자가 승인하면 바로 열려요.` : `${where}화면은 승인된 분만 볼 수 있어요. 로그인 없이도 도감·순위표·계산기를 이용할 수 있어요. 내 포켓몬 기능은 운영자 승인 후 사용할 수 있습니다.`}
        </p>
        {pending ? (
          <NoteBox title="승인 대기 상태">요청을 확인 중이에요. 승인이 완료되면 저장 기능을 사용할 수 있습니다.</NoteBox>
        ) : (
          <ol className="px-notelist">
            {STEPS.map(([no, title, desc]) => (
              <li key={no}>
                <span className="px-notelist__no px-mono">{no.padStart(2, '0')}</span>
                <span><b>{title}</b>{' '}<span className="px-muted">{desc}</span></span>
              </li>
            ))}
          </ol>
        )}
        <p className="px-caption">
          {'첫 로그인 때 '}<a href="/terms" onClick={onClose}>이용약관</a>{'·'}
          <a href="/privacy" onClick={onClose}>개인정보처리방침</a>{'에 대한 동의를 받아요.'}
        </p>
      </PxDialogBody>
      <PxDialogFoot>
        {pending ? (
          <button type="button" className="px-btn px-btn--primary px-skin" onClick={onClose}>확인</button>
        ) : (
          <>
            <button type="button" className="px-btn px-btn--primary px-skin" onClick={start}><PixelIcon name="user" />Google로 계속하기</button>
            <button type="button" className="px-btn px-skin" onClick={onClose}>지금은 둘러보기</button>
          </>
        )}
      </PxDialogFoot>
    </PxDialog>
  );
}
