// ─────────────────────────────────────────────────────────────────────────────
// components/TermsConsent.tsx — 첫 로그인 동의 (v3 components/terms.js openTermsConsent)
//
// **두 체크가 모두 켜져야 버튼이 산다.** 약관·방침 동의와 만 14세 이상 확인은 다른 것이라
// 한 줄로 묶지 않는다 (14세 미만은 가입할 수 없다고 방침에 적어 뒀다).
// 동의는 이 기기에 약관 버전으로 남고, 로그인이 끝나면 가입 요청 문서에도 함께 적힌다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { markTermsAccepted, TERMS_VER } from '../lib/terms';
import { track } from '../lib/track';

export default function TermsConsent({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const box = useRef<HTMLDialogElement>(null);
  const [agree, setAgree] = useState(false);
  const [age, setAge] = useState(false);
  useEffect(() => { const node = box.current; if (!node?.open) node?.showModal(); }, []);
  return (
    <dialog className="modal" ref={box} aria-label="로그인 전에 확인해 주세요"
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <div className="consent__modal">
            <h2 className="detail__name">로그인 전에 확인해 주세요</h2>
            <p className="plan__desc">로그인 시 Google 계정의 이메일·이름·프로필 사진을 저장합니다. 관리자 승인 후 즐겨찾기와 내 포켓몬을 계정에 보관할 수 있습니다. 도감·순위표·계산기는 로그인 없이 이용할 수 있습니다.</p>
            <label className="consent__check">
              <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
              <span><a href="/terms">이용약관</a>{'과 '}<a href="/privacy">개인정보처리방침</a>{'을 읽었고 동의합니다'}</span>
            </label>
            <label className="consent__check">
              <input type="checkbox" checked={age} onChange={(event) => setAge(event.target.checked)} />
              <span>만 14세 이상입니다 (만 14세 미만은 가입할 수 없습니다)</span>
            </label>
            <button className="drawer__item account__login consent__go" disabled={!(agree && age)}
              onClick={() => { markTermsAccepted(); track('terms_accept', { ver: TERMS_VER }); onAccept(); }}>
              동의하고 로그인
            </button>
            <p className="detail__foot">{`약관 버전 ${TERMS_VER} · 동의 여부는 이 기기와 계정 카드(가입 요청)에 기록됩니다`}</p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
