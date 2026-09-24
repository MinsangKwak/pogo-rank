// ─────────────────────────────────────────────────────────────────────────────
// components/LockCard.tsx — 잠긴 화면에 대신 놓이는 카드 (v3 planner/shell.js lockedCardNode)
//
// 세 줄이 각각 다른 것을 말한다 — 제목은 결론, 본문은 조건, 꼬리말은 동의.
// 같은 말을 두 번 하지 않는다 ("로그인하면 열려요 / 로그인이 필요해요" 처럼).
//
// 여기서도 바로 로그인 창을 띄우지 않는다 — 승인제라는 사실을 누르기 전에 알려야
// "로그인했는데 왜 안 되지" 를 겪지 않는다.
//
// **실험 기능은 로그인 버튼을 내밀지 않는다.** 이미 로그인한 사람이 보는 카드라
// 버튼이 있으면 눌러도 아무 일이 안 일어난다 — 눌러도 안 되는 버튼은 고장과 같다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { signInNow, useAuthStore } from '../stores/auth';
import { termsAccepted } from '../lib/terms';
import type { LockReason } from '../lib/useLocked';

// 확인 중은 잠긴 까닭이 아니라 잠겼는지 모르는 때다 — 판정(useLocked)의 답에는 안 넣는다
type CardReason = LockReason | 'checking';
import TermsConsent from './TermsConsent';

export default function LockCard({ reason = 'login' }: { reason?: CardReason }) {
  const status = useAuthStore((s) => s.status);
  const [consentOpen, setConsentOpen] = useState(false);
  const beta = reason === 'beta';
  const pending = status === 'pending';
  const start = () => {
    if (!termsAccepted()) { setConsentOpen(true); return; }
    void signInNow();
  };
  // 판정이 끝나기 전 — 본문을 그렸다 지우지 않는다. 로그인 버튼도 안 내민다 (곧 돌아오는 사람이다)
  if (reason === 'checking') {
    return (
      <section className="plan__lock" aria-busy="true">
        <span className="plan__lock-ico" aria-hidden="true">🔄</span>
        <h2>로그인을 확인하는 중이에요</h2>
      </section>
    );
  }
  // 루트 화면 — 루트가 아니면 **없는 화면**으로 보인다. 잠금 카드는 '여기 뭔가 있다' 를 알려 준다 (2026-09-24 주인 요청)
  if (reason === 'root') {
    return (
      <section className="plan__lock">
        <span className="plan__lock-ico" aria-hidden="true">🧭</span>
        <h2>없는 화면이에요</h2>
        <p>주소를 다시 확인해 주세요.</p>
        <a className="drawer__item plan__lock-go" href="/">🏠 처음으로</a>
      </section>
    );
  }
  if (beta) {
    return (
      <section className="plan__lock">
        <span className="plan__lock-ico" aria-hidden="true">🧪</span>
        <h2>실험 기능이에요</h2>
        <p>관리자가 실험 기능 이용 권한을 부여하면 사용할 수 있어요.</p>
      </section>
    );
  }
  return (
    <section className="plan__lock">
      <span className="plan__lock-ico" aria-hidden="true">{pending ? '⏳' : '🔒'}</span>
      <h2>{pending ? '승인을 기다리는 중이에요' : '로그인하면 열려요'}</h2>
      <p>{pending ? '관리자가 승인하면 바로 열려요.' : '로그인 후 관리자 승인을 받으면 이용할 수 있어요.'}</p>
      {pending ? null : (
        <button className="drawer__item account__login plan__lock-go" onClick={start}>🔐 Google로 로그인</button>
      )}
      <p className="detail__foot">첫 로그인 때 이용약관·개인정보처리방침에 대한 동의를 받아요.</p>
      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); void signInNow(); }} />
      ) : null}
    </section>
  );
}
