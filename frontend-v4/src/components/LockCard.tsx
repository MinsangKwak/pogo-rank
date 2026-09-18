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
import TermsConsent from './TermsConsent';

export default function LockCard({ reason = 'login' }: { reason?: LockReason }) {
  const status = useAuthStore((s) => s.status);
  const [consentOpen, setConsentOpen] = useState(false);
  const beta = reason === 'beta';
  const pending = status === 'pending';
  const start = () => {
    if (!termsAccepted()) { setConsentOpen(true); return; }
    void signInNow();
  };
  if (beta) {
    return (
      <section className="plan__lock">
        <span className="plan__lock-ico" aria-hidden="true">🧪</span>
        <h2>실험 기능이에요</h2>
        <p>관리자가 열어 주면 실험 기능을 써볼 수 있어요.</p>
      </section>
    );
  }
  return (
    <section className="plan__lock">
      <span className="plan__lock-ico" aria-hidden="true">{pending ? '⏳' : '🔒'}</span>
      <h2>{pending ? '승인을 기다리는 중이에요' : '로그인하면 열려요'}</h2>
      <p>{pending ? '관리자가 승인하면 바로 열려요.' : '승인된 분만 쓸 수 있어서, 처음이라면 관리자 승인을 기다리게 돼요.'}</p>
      {pending ? null : (
        <button className="drawer__item account__login plan__lock-go" onClick={start}>🔐 Google로 로그인</button>
      )}
      <p className="detail__foot">첫 로그인 때 이용약관·개인정보처리방침 동의를 받아요.</p>
      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); void signInNow(); }} />
      ) : null}
    </section>
  );
}
