// ─────────────────────────────────────────────────────────────────────────────
// components/AdminPanel.tsx — 🔑 가입 승인 · 👥 유저 관리 (v5 Phase 6/7)
//
// **관리자는 둘로 갈린다.**
//   루트 관리자  ROOT_EMAIL 인 사람. 로그인에서 늘 되돌아오므로 누구도 뺏을 수 없다
//   위임 관리자  루트가 여기서 지정한 사람
//
// **사람을 들이고 내보내는 일은 루트만 한다.** 위임 관리자가 또 다른 관리자를 만들 수 있으면
// 권한이 스스로 번지고, 루트를 끌어내릴 수도 있으면 되돌릴 사람이 없어진다.
// 서버도 같으므로 화면을 우회해 눌러도 막힌다 — 그래서 위임 관리자에게는 **버튼을 아예 안 준다.**
// 눌러도 안 되는 버튼은 고장과 같다.
//
// **목록이 하나가 됐다.** 전에는 allowlist 와 requests 두 컬렉션을 따로 읽고 이메일로 맞춰
// 붙였다 — 규칙이 이메일로만 문서를 찾을 수 있어서 생긴 모양이다. 이제는 `role` 한 칸이라
// 한 번 읽어 세 갈래로 나눈다. 승인 대기는 **루트에게만** 실려 온다(서버가 거른다).
//
// **깃발 둘은 서로 다른 것을 연다. 겹치지 않는다** (v4.0.1).
//   admin  유저 관리 — 이용자 목록 · 트레이너 코드 관리
//   beta   실험 기능 — 내 포켓몬
// 실험 기능을 열어 주려고 관리자를 시키면, 써 보라고 준 권한으로 유저 목록까지 열린다.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authEmail, recheckAccess, useAuthStore } from '../stores/auth';
import { serverApi, ApiError, type AdminUser, type Role } from '../lib/serverApi';

/** 목록 한 줄. 버튼을 여러 개 받는다 — 승인된 사람 줄에는 셋이 붙는다 (v3 adminRowNode) */
function AdminRow({ row, badge, children }: { row: AdminUser; badge?: string; children?: React.ReactNode }) {
  return (
    <div className={`admin__row${badge ? ' is-admin' : ''}`}>
      {row.picture ? <img className="avatar" src={row.picture} alt="" /> : <span className="avatar">👤</span>}
      <div className="admin__who">
        <b>{row.name || '(이름 없음)'}{badge ? <span className="tag admin__badge">{badge}</span> : null}</b>
        <span className="account__email">{row.email}</span>
        {/* 마지막으로 본 때. 한 번도 로그인 안 한 줄은 비어 있다 */}
        {row.lastSeenAt ? (
          <span className="account__email">{`마지막 방문 ${row.lastSeenAt.slice(0, 10)}`}</span>
        ) : null}
      </div>
      {children ? <div className="admin__acts">{children}</div> : null}
    </div>
  );
}

function Section({ title, empty, rows }: { title: string; empty: string; rows: React.ReactNode[] }) {
  return (
    <section className="detail__sec">
      <h3>{title}</h3>
      {rows.length ? <div className="admin__rows">{rows}</div> : <p className="empty">{empty}</p>}
    </section>
  );
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { user, admin, adminRoot } = useAuthStore();
  const box = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [message, setMessage] = useState('');

  // 조회를 기다리기 전에 팝업 틀부터 띄운다 — 누른 즉시 반응이 보이도록 (v3 와 같은 차례)
  useEffect(() => { const node = box.current; if (!node?.open) node?.showModal(); }, []);

  const load = useCallback(async () => {
    setRows(await serverApi.listUsers().catch(() => []));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!admin || !user) return null;

  const myMail = authEmail();
  const all = rows ?? [];
  // 본인 줄은 맨 위에 따로 그리므로 목록에서는 뺀다 — 안 빼면 이름이 두 번 나오고,
  // 자기 [승인 해제] 를 자기가 누를 수 있게 된다 (그 자리에서 권한이 날아간다)
  const others = all.filter((one) => one.email !== myMail);
  const pending = others.filter((one) => one.role === 'pending');
  const admins = others.filter((one) => one.role === 'admin' || one.role === 'root');
  const friends = others.filter((one) => one.role === 'approved');

  /**
   * 목록을 바꾼다. `mine` 은 **그 변경이 나 자신에게 닿았는가** — 닿았으면 내 권한도 그 자리에서
   * 다시 읽는다 (v4.2.1). 안 그러면 실험 기능을 나에게서 뗀 직후에도 ☰ 메뉴와 계정 카드가
   * 로그인 때 읽은 권한 그대로 남아, 탭을 나갔다 와야 맞춰졌다 — 제보.
   */
  const write = async (run: () => Promise<void>, fail: string, mine = false) => {
    try { await run(); } catch (error) {
      setMessage(`${fail}\n(${error instanceof ApiError ? error.message : String(error)})`);
      return;
    }
    setMessage('');
    if (mine) await recheckAccess();
    await load();   // 부분 수정 대신 다시 읽는다 — 화면과 저장된 것이 어긋날 자리를 아예 없앤다
  };

  const setRole = (row: AdminUser, role: Role, question: string) => {
    if (!window.confirm(question)) return;
    void write(() => serverApi.setRole(row.id, { role }), '바꾸지 못했어요.', row.email === myMail);
  };

  const setBeta = (row: AdminUser, on: boolean) => {
    if (!window.confirm(on
      ? `${row.email} 님에게 실험 기능 이용 권한을 부여할까요?`
      : `${row.email} 님의 실험 기능 이용 권한을 해제할까요?`)) return;
    void write(() => serverApi.setRole(row.id, { beta: on }), '바꾸지 못했어요.', row.email === myMail);
  };

  const approvedRow = (one: AdminUser, isAdmin: boolean) => (
    <AdminRow key={one.id} row={one} badge={one.role === 'root' ? '루트 관리자' : isAdmin ? '관리자' : ''}>
      {adminRoot && one.role !== 'root' ? (
        <>
          <button className={`uchip admin__act${isAdmin ? ' is-danger' : ''}`}
            onClick={() => setRole(one, isAdmin ? 'approved' : 'admin', isAdmin
              ? `${one.email} 님의 관리자 권한을 해제할까요? 일반 이용자 승인 상태는 유지돼요.`
              : `${one.email} 님을 관리자로 지정할까요? 이용자 목록과 트레이너 코드를 관리할 수 있어요. 가입 승인은 루트 관리자만 할 수 있어요.`)}>
            {isAdmin ? '관리자 해제' : '관리자 지정'}
          </button>
          {/* 실험 기능은 관리자 권한과 뜻이 다르다 — 운영을 돕는 자리가 아니라 먼저 써 보는 자리다.
              여는 것을 하나하나 세지 않는다 — 실험 기능은 늘고 줄고, 문구는 그때마다 낡는다 */}
          <button className={`uchip admin__act${one.beta ? ' is-on' : ''}`} aria-pressed={one.beta}
            onClick={() => setBeta(one, !one.beta)}>
            {one.beta ? '🧪 실험 해제' : '🧪 실험 기능'}
          </button>
          <button className="uchip admin__act is-danger"
            onClick={() => setRole(one, 'pending', `${one.email} 승인을 해제할까요? 그 사람의 로그인도 함께 끊겨요.`)}>
            승인 해제
          </button>
        </>
      ) : null}
    </AdminRow>
  );

  const me: AdminUser = {
    id: user.uid, email: myMail, name: user.displayName, picture: user.photoURL,
    role: adminRoot ? 'root' : 'admin', beta: useAuthStore.getState().beta,
    createdAt: '', lastSeenAt: null,
  };

  const title = adminRoot ? '🔑 가입 승인' : '👥 유저 관리';
  return (
    <dialog className="modal" ref={box} aria-label={title}
      onClick={(event) => { if (event.target === box.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div className="modal__wrap">
        <button className="modal__close" aria-label="닫기" onClick={onClose}>✕</button>
        <div className="modal__box">
          <div className="detail admin">
            <h2>{title}</h2>
            {adminRoot ? (
              <Section title="승인 대기" empty="대기 중인 요청이 없어요."
                rows={pending.map((one) => (
                  <AdminRow key={one.id} row={one}>
                    <button className="uchip admin__act"
                      onClick={() => setRole(one, 'approved', `${one.email} 님을 승인할까요?`)}>승인</button>
                  </AdminRow>
                ))} />
            ) : null}
            <Section title={`관리자 ${admins.length + 1}명`} empty="관리자가 없어요."
              rows={[
                <AdminRow key="me" row={me} badge={adminRoot ? '루트 관리자 · 나' : '나'} />,
                ...admins.map((one) => approvedRow(one, true)),
              ]} />
            <Section title={`승인된 친구 ${friends.length}명`} empty="아직 승인된 이용자가 없어요."
              rows={friends.map((one) => approvedRow(one, false))} />
            {adminRoot ? null : (
              <p className="detail__foot">가입 승인·해제와 관리자 지정은 루트 관리자만 할 수 있어요. 이 화면에서는 이용자 목록을 확인하고 트레이너 코드를 관리할 수 있어요. 실험 기능에는 별도의 이용 권한이 필요해요.</p>
            )}
            {message ? <p className="account__msg">{message}</p> : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}
