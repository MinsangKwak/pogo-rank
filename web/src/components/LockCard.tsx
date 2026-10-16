// ─────────────────────────────────────────────────────────────────────────────
// components/LockCard.tsx — 잠긴 화면에 대신 놓이는 카드 (v3 planner/shell.js lockedCardNode · v6 픽셀 판)
//
// 세 줄이 각각 다른 것을 말한다 — 제목은 결론, 본문은 조건, 꼬리말은 동의.
// 같은 말을 두 번 하지 않는다 ("로그인하면 열려요 / 로그인이 필요해요" 처럼).
//
// 여기서도 바로 로그인 창을 띄우지 않는다 — 승인제라는 사실을 누르기 전에 알려야
// "로그인했는데 왜 안 되지" 를 겪지 않는다.
//
// **실험 기능은 로그인 버튼을 내밀지 않는다.** 이미 로그인한 사람이 보는 카드라
// 버튼이 있으면 눌러도 아무 일이 안 일어난다 — 눌러도 안 되는 버튼은 고장과 같다.
//
// `.plan__lock` · `.plan__lock-go` 이름은 남긴다 — 회귀 검사(lockgate)와 i18n 점검 스크립트가 본다 (CLAUDE.md §4)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { signInNow, useAuthStore } from '../stores/auth';
import { termsAccepted } from '../lib/terms';
import type { LockReason } from '../lib/useLocked';
import { PixelIcon, type PixelIconName } from './PixelIcon';
import TermsConsent from './TermsConsent';
import { PxButton, PxNote } from './PxParts';

// 확인 중은 잠긴 까닭이 아니라 잠겼는지 모르는 때다 — 판정(useLocked)의 답에는 안 넣는다
type CardReason = LockReason | 'checking';

/** 판 하나 — 이름표 · 아이콘 · 제목 · 본문 · 단추 */
function Card({ icon, eyebrow, title, body, children, busy }: {
  icon: PixelIconName; eyebrow: string; title: string; body?: string; children?: ReactNode; busy?: boolean;
}) {
  return (
    <PxNote className="pxp-lock plan__lock" {...(busy ? { 'aria-busy': true } : {})}
      eyebrow={<span className="pxp-lock__eyebrow"><PixelIcon name={icon} /> {eyebrow}</span>}>
      <h2 className="px-heading">{title}</h2>
      {body ? <p className="px-note__body">{body}</p> : null}
      {children}
    </PxNote>
  );
}

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
    return <Card icon="user" eyebrow="CHECKING" title="로그인을 확인하는 중이에요" busy />;
  }
  // 루트 화면 — 루트가 아니면 **없는 화면**으로 보인다. 잠금 카드는 '여기 뭔가 있다' 를 알려 준다 (2026-09-24 주인 요청)
  if (reason === 'root') {
    return (
      <Card icon="info" eyebrow="NOT FOUND" title="없는 화면이에요" body="주소를 다시 확인해 주세요.">
        <div className="px-note__actions"><PxButton className="plan__lock-go" href="/"><PixelIcon name="home" /> 처음으로</PxButton></div>
      </Card>
    );
  }
  if (beta) {
    return <Card icon="shield" eyebrow="BETA ONLY" title="실험 기능이에요" body="관리자가 실험 기능 이용 권한을 부여하면 사용할 수 있어요." />;
  }
  return (
    <Card icon="shield" eyebrow={pending ? 'PENDING' : 'LOGIN REQUIRED'}
      title={pending ? '승인을 기다리는 중이에요' : '로그인하면 열려요'}
      body={pending ? '관리자가 승인하면 바로 열려요.' : '로그인 후 관리자 승인을 받으면 이용할 수 있어요.'}>
      {pending ? null : (
        <div className="px-note__actions">
          <PxButton kind="primary" className="account__login plan__lock-go" onClick={start}><PixelIcon name="user" /> Google로 로그인</PxButton>
        </div>
      )}
      <p className="px-caption">첫 로그인 때 이용약관·개인정보처리방침에 대한 동의를 받아요.</p>
      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)}
          onAccept={() => { setConsentOpen(false); void signInNow(); }} />
      ) : null}
    </Card>
  );
}
