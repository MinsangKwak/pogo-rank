// ─────────────────────────────────────────────────────────────────────────────
// components/AdminPanel.tsx — 🔑 가입 승인 · 👥 유저 관리 (v3 auth.js openAdminPanel)
//
// **관리자는 둘로 갈린다.**
//   루트 관리자  ADMIN_UID 인 사람. 규칙(firestore.rules)에 박혀 있어 누구도 뺏을 수 없다
//   위임 관리자  allowlist/{이메일} 문서에 admin: true 가 붙은 사람. 루트가 여기서 지정한다
//
// **사람을 들이고 내보내는 일은 루트만 한다.** 위임 관리자가 또 다른 관리자를 만들 수 있으면
// 권한이 스스로 번지고, 루트를 끌어내릴 수도 있으면 되돌릴 사람이 없어진다.
// 규칙도 같으므로 화면을 우회해 눌러도 막힌다 — 그래서 위임 관리자에게는 **버튼을 아예 안 준다.**
// 눌러도 안 되는 버튼은 고장과 같다.
//
// 가입 요청(requests)은 규칙상 루트만 읽는다. 위임 관리자가 부르면 조회가 실패하므로
// 아예 부르지 않고 '승인 대기' 칸도 그리지 않는다.
//
// **깃발 둘은 서로 다른 것을 연다. 겹치지 않는다.**
//   admin  유저 관리 — 승인된 사람 목록 · 트레이너 코드 관리
//   beta   실험 기능 — 내 포켓몬 · D-MAX [미구현]
// 운영을 돕는 사람과 먼저 써 보는 사람은 다르다. 실험 기능을 열어 주려고 관리자를
// 시키게 되면, 써 보라고 준 권한으로 유저 목록까지 열린다.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { authEmail, useAuthStore } from '../stores/auth';
import { useMeta } from '../lib/data';
import type { DocData } from '../lib/authApi';

interface Row { id: string; data: DocData }

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 목록 한 줄. 버튼을 여러 개 받는다 — 승인된 사람 줄에는 셋이 붙는다 (v3 adminRowNode) */
function AdminRow({ email, data, badge, children }: { email: string; data: DocData; badge?: string; children?: React.ReactNode }) {
  const photo = str(data['photo']);
  const uid = str(data['uid']);
  return (
    <div className={`admin__row${badge ? ' is-admin' : ''}`}>
      {photo ? <img className="avatar" src={photo} alt="" /> : <span className="avatar">👤</span>}
      <div className="admin__who">
        <b>{str(data['name']) || '(이름 없음)'}{badge ? <span className="tag admin__badge">{badge}</span> : null}</b>
        <span className="account__email">{email}</span>
        {/* GA 사용자 탐색기의 User-ID 와 대조할 값. 한 번도 로그인 안 한 옛 승인자는 비어 있다 */}
        {uid ? <span className="account__email" title="GA User-ID">{`uid ${uid}`}</span> : null}
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

/** 내 uid — 규칙과 빌드의 ADMIN_UID 를 바꿀 때 쓴다 */
function UidCopy({ uid }: { uid: string }) {
  const [label, setLabel] = useState('내 uid 복사');
  return (
    <button className="uchip" onClick={() => {
      navigator.clipboard.writeText(uid)
        .then(() => setLabel('복사됨 ✓'))
        // 클립보드가 막힌 환경에서는 버튼에 uid 를 그대로 띄워 직접 고르게 한다
        .catch(() => setLabel(uid));
    }}>{label}</button>
  );
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { user, admin, adminRoot, api } = useAuthStore();
  const { data: meta } = useMeta();
  const box = useRef<HTMLDialogElement>(null);
  const [requests, setRequests] = useState<Row[] | null>(null);
  const [allow, setAllow] = useState<Row[] | null>(null);
  const [message, setMessage] = useState('');

  // 조회를 기다리기 전에 팝업 틀부터 띄운다 — 누른 즉시 반응이 보이도록 (v3 와 같은 차례)
  useEffect(() => { const node = box.current; if (!node?.open) node?.showModal(); }, []);

  const load = useCallback(async () => {
    if (!api) return;
    const [got, list] = await Promise.all([
      adminRoot ? api.listDocs('requests') : Promise.resolve([]),
      api.listDocs('allowlist'),
    ]);
    setRequests(got.map(({ id, ...data }) => ({ id, data })));
    setAllow(list.map(({ id, ...data }) => ({ id, data })));
  }, [api, adminRoot]);

  useEffect(() => { void load(); }, [load]);

  if (!admin || !user || !api) return null;

  const myMail = authEmail();
  const rootUid = meta.ADMIN_UID;
  const allowed = new Set((allow ?? []).map((one) => one.id));
  // 관리자 본인과 루트는 대기에서 뺀다 — 둘 다 규칙상 allowlist 문서 없이도 승인된 사람이라,
  // 문서가 없다고 '승인 대기' 로 뜨면 다른 관리자 화면에 운영자가 대기자로 보인다
  const pending = (requests ?? []).filter((one) => !allowed.has(one.id)
    && str(one.data['uid']) !== user.uid
    && !(rootUid && str(one.data['uid']) === rootUid));
  // 이메일 → 가입 요청 문서. 승인된 친구 줄에 uid 를 채워 넣는 데 쓴다
  const cardByEmail = new Map((requests ?? []).map((one) => [one.id, one.data]));
  // 본인 줄은 맨 위에 따로 그리므로 목록에서는 뺀다 — 안 빼면 이름이 두 번 나오고,
  // 자기 [승인 해제] 를 자기가 누를 수 있게 된다 (그 자리에서 권한이 날아간다)
  const approved: Row[] = (allow ?? [])
    .filter((one) => one.id !== myMail)
    .map((one) => ({ id: one.id, data: { ...one.data, uid: str(one.data['uid']) || str(cardByEmail.get(one.id)?.['uid']) } }));
  const admins = approved.filter((one) => one.data['admin'] === true);
  const friends = approved.filter((one) => one.data['admin'] !== true);

  const write = async (run: () => Promise<void>, fail: string) => {
    try { await run(); } catch (error) {
      setMessage(`${fail}\n(${(error as { code?: string })?.code ?? String(error)})`);
      return;
    }
    setMessage('');
    await load();   // 부분 수정 대신 다시 읽는다 — 화면과 저장된 것이 어긋날 자리를 아예 없앤다
  };

  const approve = (row: Row) => void write(async () => {
    // v3 는 여기에 at: serverTimestamp() 를 적는다. setDoc 이 updatedAt 을 같은 값으로 남기므로
    // 같은 뜻의 칸을 둘 두지 않는다 — 읽는 곳은 어차피 없다
    await api.setDoc(`allowlist/${row.id}`, { approved: true, name: str(row.data['name']), uid: str(row.data['uid']) });
    // 가입 요청 문서는 지우지 않는다 — 승인 뒤에도 이메일 ↔ uid 대조에 쓴다
  }, '승인하지 못했어요.');

  const setFlag = (email: string, field: 'admin' | 'beta', on: boolean, question: string) => {
    if (!window.confirm(question)) return;
    void write(() => api.setDoc(`allowlist/${email}`, { [field]: on }), '바꾸지 못했어요. 보안 규칙을 최신으로 게시했는지 확인해 주세요.');
  };

  const revoke = (email: string) => {
    if (!window.confirm(`${email} 승인을 해제할까요?`)) return;
    void write(() => api.deleteDoc(`allowlist/${email}`), '해제하지 못했어요.');
  };

  const approvedRow = (one: Row, isAdmin: boolean) => {
    const onBeta = one.data['beta'] === true;
    return (
      <AdminRow key={one.id} email={one.id} data={one.data} badge={isAdmin ? '관리자' : ''}>
        {adminRoot ? (
          <>
            <button className={`uchip admin__act${isAdmin ? ' is-danger' : ''}`}
              onClick={() => setFlag(one.id, 'admin', !isAdmin, isAdmin
                ? `${one.id} 님의 관리자 권한을 해제할까요? 승인된 친구로는 남아요.`
                : `${one.id} 님을 관리자로 지정할까요? 유저 관리(승인된 사람 목록·트레이너 코드)를 쓸 수 있게 돼요 (가입 승인은 루트만).`)}>
              {isAdmin ? '관리자 해제' : '관리자 지정'}
            </button>
            {/* 실험 기능은 관리자 권한과 뜻이 다르다 — 운영을 돕는 자리가 아니라 먼저 써 보는 자리다 */}
            {/* 여는 것을 하나하나 세지 않는다 — 실험 기능은 늘어나고 줄고, 문구는 그때마다 낡는다 */}
            <button className={`uchip admin__act${onBeta ? ' is-on' : ''}`} aria-pressed={onBeta}
              onClick={() => setFlag(one.id, 'beta', !onBeta, onBeta
                ? `${one.id} 님의 실험 기능을 닫을까요?`
                : `${one.id} 님에게 실험 기능을 열까요? 실험 기능을 써볼 수 있어요.`)}>
              {onBeta ? '🧪 실험 해제' : '🧪 실험 기능'}
            </button>
            <button className="uchip admin__act is-danger" onClick={() => revoke(one.id)}>승인 해제</button>
          </>
        ) : null}
      </AdminRow>
    );
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
                  <AdminRow key={one.id} email={one.id} data={one.data}>
                    <button className="uchip admin__act" onClick={() => approve(one)}>승인</button>
                  </AdminRow>
                ))} />
            ) : null}
            <Section title={`관리자 ${admins.length + 1}명`} empty="관리자가 없어요."
              rows={[
                <AdminRow key="me" email={myMail} badge={adminRoot ? '루트 관리자 · 나' : '나'}
                  data={{ name: user.displayName, photo: user.photoURL, uid: user.uid }} />,
                ...admins.map((one) => approvedRow(one, true)),
              ]} />
            <Section title={`승인된 친구 ${friends.length}명`} empty="아직 승인된 친구가 없어요."
              rows={friends.map((one) => approvedRow(one, false))} />
            {adminRoot ? null : (
              <p className="detail__foot">가입 승인·해제와 관리자 지정은 루트 관리자만 할 수 있어요. 여기서는 누가 쓰고 있는지 볼 수 있고, 트레이너 코드 관리를 쓸 수 있어요. 실험 기능은 따로 열어 드려요.</p>
            )}
            {message ? <p className="account__msg">{message}</p> : null}
            <p className="detail__foot">{`내 uid: ${user.uid} `}<UidCopy uid={user.uid} /></p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
