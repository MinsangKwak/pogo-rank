// ─────────────────────────────────────────────────────────────────────────────
// components/TermsConsent.tsx — 첫 로그인 동의 (v3 components/terms.js openTermsConsent · v6 D08 '최초 로그인 동의')
//
// **세 확인란이 모두 켜져야 버튼이 산다.** 약관 동의 · 방침 확인 · 만 14세 이상은 다른 것이라
// 한 줄로 묶지 않는다 (14세 미만은 가입할 수 없다고 방침에 적어 뒀다).
// 동의는 이 기기에 약관 버전으로 남고(markTermsAccepted — 저장 로직은 전과 같다), 로그인이 끝나면 가입 요청 문서에도 함께 적힌다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { markTermsAccepted, TERMS_VER } from '../lib/terms';
import { track } from '../lib/track';
import { PixelIcon } from './PixelIcon';
import { PxDialog, PxDialogBody, PxDialogFoot, PxDialogHead } from './PxDialog';

// 확인란 셋 — 이름 · 글 · (내용 보기 링크)
const CHECKS: { key: 'terms' | 'privacy' | 'age'; text: string; href?: string }[] = [
  { key: 'terms', text: '이용약관에 동의합니다', href: '/terms' },
  { key: 'privacy', text: '개인정보처리방침을 확인했습니다', href: '/privacy' },
  { key: 'age', text: '만 14세 이상입니다 (만 14세 미만은 가입할 수 없습니다)' },
];

export default function TermsConsent({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const [on, setOn] = useState<Record<'terms' | 'privacy' | 'age', boolean>>({ terms: false, privacy: false, age: false });
  const ready = on.terms && on.privacy && on.age;
  return (
    <PxDialog onClose={onClose} labelledBy="terms-consent-title" className="pxd-dialog pxd-dialog--narrow" panelClassName="pxd-consent">
      <PxDialogHead titleId="terms-consent-title" title="서비스 이용 전 확인해 주세요." caption="최초 로그인 동의" onClose={onClose} />
      <PxDialogBody>
        <p className="px-body px-muted">로그인 시 Google 계정의 이메일·이름·프로필 사진을 저장합니다. 계정 정보는 싱가포르의 데이터베이스(Neon)에 보관됩니다(개인정보처리방침 제4항). 관리자 승인 후 즐겨찾기와 내 포켓몬을 계정에 보관할 수 있습니다. 도감·순위표·계산기는 로그인 없이 이용할 수 있습니다.</p>
        <div className="pxd-checks">
          {CHECKS.map((one) => (
            <div key={one.key} className="pxd-checks__row">
              <label className="px-check">
                <input type="checkbox" checked={on[one.key]} onChange={(event) => setOn({ ...on, [one.key]: event.target.checked })} />
                <span>{one.text}</span>
              </label>
              {one.href ? <a className="px-btn px-btn--sm px-skin" href={one.href} target="_blank" rel="noopener">내용 보기 <PixelIcon name="arrow" /></a> : null}
            </div>
          ))}
        </div>
        <p className="px-caption">{`약관 버전 ${TERMS_VER} · 동의 여부는 이 기기에 기록됩니다`}</p>
      </PxDialogBody>
      <PxDialogFoot hint="모든 필수 항목을 선택한 뒤 활성화됩니다.">
        <button type="button" className="px-btn px-btn--primary px-btn--block px-skin" disabled={!ready}
          onClick={() => { markTermsAccepted(); track('terms_accept', { ver: TERMS_VER }); onAccept(); }}>
          동의하고 계속하기
        </button>
      </PxDialogFoot>
    </PxDialog>
  );
}
