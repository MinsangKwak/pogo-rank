// ─────────────────────────────────────────────────────────────────────────────
// components/Account.tsx — ☰ 메뉴 맨 위의 마이페이지 카드 (v3 renderAccount)
//
// 네 상태가 각각 다른 화면이다 — 확인 중 · 비로그인 · 승인 대기 · 승인됨.
// 셋의 UI 가 서로 많이 달라 v3 도 상태마다 통째로 다시 그렸다.
//
// **로그인을 쓸 수 없는 빌드에서는 카드를 통째로 감춘다** — 눌러도 안 되는 버튼을 내밀지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { authEmail, useAuthStore } from '../stores/auth';
import { routeHash } from '../routes';
import { track } from '../lib/track';
import TermsConsent from './TermsConsent';
import AdminPanel from './AdminPanel';
import { termsAccepted } from '../lib/terms';

export default function Account({ onGo }: { onGo: () => void }) {
  const { enabled, user, status, admin, adminRoot, favs, requestError, api } = useAuthStore();
  const [consentOpen, setConsentOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [message, setMessage] = useState('');

  if (!enabled) return null;

  const start = () => {
    // 승인제라는 사실을 누르기 전에 알린다 — 그래야 "로그인했는데 왜 안 되지" 를 겪지 않는다
    if (!termsAccepted()) { setConsentOpen(true); return; }
    void api?.signIn().catch((error) => setMessage(`로그인 실패: ${(error as { code?: string })?.code ?? error}`));
  };

  const card = (() => {
    // (0) 확인 중 — 이 기기에 로그인 자취가 있는데 SDK 가 아직 안 왔다.
    // 여기서 로그인 버튼을 내밀면 "새로고침했더니 로그아웃됐다" 로 읽힌다
    if (!user && status === 'loading') {
      return <p className="account__sub account__loading">🔄 로그인 확인 중…</p>;
    }
    if (!user) {
      return (
        <>
          <button className="drawer__item account__login" onClick={start}>🔐 Google로 로그인</button>
          <p className="account__sub">
            {'로그인하면 내 포켓몬과 화면 설정이 계정에 저장돼요. 승인된 분만 쓸 수 있고, 첫 로그인 때 '}
            <a href="#/terms">이용약관</a>·<a href="#/privacy">개인정보처리방침</a>{' 동의를 받아요'}
          </p>
        </>
      );
    }
    const who = (
      <div className="account__who">
        {user.photoURL ? <img className="avatar" src={user.photoURL} alt="" /> : <span className="avatar">👤</span>}
        <div><b>{user.displayName || '(이름 없음)'}</b><span className="account__email">{authEmail()}</span></div>
      </div>
    );
    if (status === 'pending') {
      return (
        <>
          {who}
          {/* 가입 요청이 저장되지 못했으면 "기다리세요" 라고 말하면 안 된다 —
              관리자 화면에는 이 사람이 아예 안 보이므로 기다려도 승인이 오지 않는다 */}
          {requestError
            ? <p className="account__sub account__pending">{`⚠ 가입 요청을 저장하지 못했어요 (${requestError}) — 다시 로그인해 보고, 그래도 안 되면 관리자에게 알려주세요`}</p>
            : <p className="account__sub account__pending">⏳ 승인 대기 중 — 관리자가 승인하면 내 포켓몬을 계정에 저장할 수 있어요. 관리자에게 알려주세요!</p>}
          <div className="account__actions">
            <button className="drawer__item" onClick={() => void api?.signOut()}>로그아웃</button>
            <button className="drawer__item account__danger" onClick={() => void remove(setMessage)}>계정 삭제</button>
          </div>
        </>
      );
    }
    return (
      <>
        {who}
        {/* 셈만 보여 주고 갈 길이 없으면 "어디서 보지" 가 남는다 — 누르면 그 화면으로 간다 */}
        <div className="account__stats">
          <a className="account__stat-go" href={routeHash('planner')} onClick={onGo}>
            {'🎒 내 포켓몬 '}<b>{`${favs.length}마리`}</b><span aria-hidden="true"> ›</span>
          </a>
        </div>
        <div className="account__actions">
          {/* 이름이 곧 할 수 있는 일이다 — 루트는 사람을 들이고 내보내고(가입 승인),
              위임 관리자는 누가 쓰는지 보고 운영을 돕는다(유저 관리).
              없는 권한을 이름으로 약속하지 않는다 */}
          {admin ? (
            <button className="drawer__item account__primary" onClick={() => setAdminOpen(true)}>
              {adminRoot ? '🔑 가입 승인' : '👥 유저 관리'}
            </button>
          ) : null}
          <button className="drawer__item" onClick={() => void api?.signOut()}>로그아웃</button>
          {admin ? null : <button className="drawer__item account__danger" onClick={() => void remove(setMessage)}>계정 삭제</button>}
        </div>
      </>
    );
  })();

  return (
    <>
      <h2 className="drawer__sec" id="account-title">👤 마이페이지</h2>
      <div className="account" id="account">
        {card}
        {message ? <p className="account__msg">{message}</p> : null}
      </div>
      {adminOpen ? <AdminPanel onClose={() => setAdminOpen(false)} /> : null}
      {consentOpen ? (
        <TermsConsent onClose={() => setConsentOpen(false)} onAccept={() => {
          setConsentOpen(false);
          void api?.signIn().catch((error) => setMessage(`로그인 실패: ${(error as { code?: string })?.code ?? error}`));
        }} />
      ) : null}
    </>
  );
}

/**
 * 계정 삭제 — 본인 문서를 지운 뒤 인증 계정을 지운다.
 * 규칙(firestore.rules)의 본인 delete 허용이 전제다. 되돌릴 수 없으므로 한 번 더 묻는다.
 */
async function remove(setMessage: (text: string) => void) {
  const { api, user } = useAuthStore.getState();
  if (!api || !user) return;
  if (!window.confirm('계정을 삭제하면 담아 둔 ★ 와 승인 정보가 함께 지워져요. 되돌릴 수 없어요. 삭제할까요?')) return;
  track('account_delete');
  await api.deleteDoc(`users/${user.uid}`);
  await api.deleteDoc(`requests/${user.email}`);
  await api.deleteUser().catch((error) => setMessage(`삭제 실패: ${(error as { code?: string })?.code ?? error}`));
}
