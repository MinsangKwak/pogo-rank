// ─────────────────────────────────────────────────────────────────────────────
// screens/AdminUsers.tsx — 가입 승인 · 유저 관리 (v6 피그마 A03 루트 · A06 위임 관리자 · A04 이용자 권한 상세)
//
// components/AdminPanel.tsx(설정의 팝업)의 판단을 그대로 옮겼다 —
//   루트 관리자  사람을 들이고(승인) 내보내고(해제) 관리자 · 실험 기능 깃발을 단다
//   위임 관리자  목록만 본다. 단추를 아예 안 준다 — 서버도 막으니 눌러도 안 되는 단추는 고장과 같다
// 본인 줄은 맨 위 '내 계정' 판에 따로 세우고 목록에서는 뺀다 — 자기 [승인 해제] 를 자기가 누르면 그 자리에서 권한이 날아간다.
// 루트 계정 줄에는 상세에 가도 단추가 없다 — 루트를 끌어내릴 수 있으면 되돌릴 사람이 없어진다.
//
// 변경은 **부분 수정 대신 다시 읽는다** — 화면과 저장된 것이 어긋날 자리를 없앤다. 변경이 나 자신에게 닿았으면 내 권한도 그 자리에서
// 다시 읽는다(recheckAccess, v4.2.1) — 안 그러면 ☰ 메뉴와 계정 카드가 로그인 때 읽은 권한으로 남는다.
// 확인은 window.confirm 대신 ConfirmDialog — 대상 · 효과를 따로 읽고 누른다 (A08).
// 표 · 배지 · 아바타는 components/admin/UserTable.tsx, 판 · 안내 · 상태는 components/admin/Panels.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authEmail, recheckAccess, useAuthStore } from '../stores/auth';
import { serverApi, ApiError, type AdminUser, type Role } from '../lib/serverApi';
import { routeById, routeHref } from '../routes';
import { count } from '../lib/cell';
import { AdminHead } from '../components/AdminShell';
import ConfirmDialog, { type ConfirmProps } from '../components/ConfirmDialog';
import { PixelIcon } from '../components/PixelIcon';
import { PxChips } from '../components/Bits';
import AdminDenied from '../components/admin/AdminDenied';
import { AdminPanel, KvList, ListState, Note, SearchBox, Toast, type LoadFail } from '../components/admin/Panels';
import UserTable, { Avatar, RoleBadge, dayOf, matchUser, sortUsers, tableFoot, userName } from '../components/admin/UserTable';

type Filter = 'all' | 'pending' | 'approved' | 'admin';

// 확인 팝업에 올릴 일 — 팝업의 글과 실제로 보낼 요청을 한 덩어리로
interface Ask extends Omit<ConfirmProps, 'onConfirm' | 'onCancel' | 'busy' | 'error'> {
  run: () => Promise<void>;
  /** 나 자신에게 닿는 변경인가 — 끝난 뒤 내 권한을 다시 읽는다 */
  mine: boolean;
}

export default function AdminUsers({ rest }: { rest?: string }) {
  const { user, admin, adminRoot } = useAuthStore();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [failed, setFailed] = useState<LoadFail | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [askError, setAskError] = useState('');
  const [toast, setToast] = useState('');
  const route = routeById('admin-users')!;
  const myMail = authEmail();

  const load = useCallback(async () => {
    setFailed(null);
    try {
      setRows(await serverApi.listUsers());
    } catch (caught) {
      // 실패는 빈 목록이 아니다 — 앞 목록이 있으면 그대로 두고 문구만 세운다
      setFailed(caught instanceof ApiError && caught.status === 403
        ? { kind: '403', text: '관리자 권한이 없어요' }
        : { kind: 'fail', text: '목록을 불러오지 못했어요 — 이 상태는 빈 목록과 다릅니다. 새로고침 후 다시 시도해 주세요.' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // 본인 줄은 위 판에 따로 — 목록에서는 뺀다
  const others = useMemo(() => sortUsers((rows ?? []).filter((one) => one.email.toLowerCase() !== myMail)), [rows, myMail]);
  const counts = {
    pending: others.filter((one) => one.role === 'pending').length,
    approved: others.filter((one) => one.role === 'approved').length,
    admin: others.filter((one) => one.role === 'admin' || one.role === 'root').length,
  };
  const shown = others.filter((one) => matchUser(one, query) && (
    filter === 'all' ? true : filter === 'admin' ? one.role === 'admin' || one.role === 'root' : one.role === filter));

  // 확인 팝업의 [확인] — 저장 중 잠그고, 실패는 팝업 안에, 성공은 닫고 다시 읽는다
  const confirm = async () => {
    if (!ask || busy) return;
    setBusy(true);
    setAskError('');
    try {
      await ask.run();
    } catch (caught) {
      setAskError(`바꾸지 못했어요. (${caught instanceof ApiError ? caught.message : String(caught)})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    setAsk(null);
    setToast(`${ask.target} · ${ask.title} 완료`);
    if (ask.mine) await recheckAccess();
    await load();
  };

  // 승인 · 해제 · 관리자 · 실험 기능 — 팝업 글은 피그마 A08 의 문장 그대로
  const askRole = (row: AdminUser, role: Role) => {
    const mine = row.email.toLowerCase() === myMail;
    const run = () => serverApi.setRole(row.id, { role });
    if (role === 'approved' && row.role === 'pending') setAsk({ title: '가입 승인', target: row.email, effect: '이 계정을 승인된 이용자로 변경합니다.', confirmLabel: '가입 승인', run, mine });
    else if (role === 'approved') setAsk({ title: '관리자 해제', target: row.email, effect: '관리자 권한을 해제합니다. 승인된 이용자 상태는 유지돼요.', confirmLabel: '관리자 해제', danger: true, run, mine });
    else if (role === 'admin') setAsk({ title: '관리자 지정', target: row.email, effect: '이용자 목록과 트레이너 코드를 관리할 수 있게 됩니다. 가입 승인은 루트 관리자만 할 수 있어요.', confirmLabel: '관리자 지정', run, mine });
    else if (role === 'pending') setAsk({ title: '승인 해제', target: row.email, effect: '승인 대기로 바뀌며 로그인 세션도 종료됩니다. 계정 삭제는 아닙니다.', confirmLabel: '승인 해제', danger: true, run, mine });
  };
  const askBeta = (row: AdminUser, on: boolean) => {
    setAsk({
      title: on ? '실험 기능 권한 부여' : '실험 기능 권한 해제', target: row.email,
      effect: on ? '실험 기능(내 포켓몬 등)을 먼저 써 볼 수 있게 됩니다. 관리자 권한과는 별개예요.' : '실험 기능을 더 쓸 수 없게 됩니다. 승인 상태는 그대로예요.',
      confirmLabel: on ? '실험 기능 부여' : '실험 기능 해제', danger: !on,
      run: () => serverApi.setRole(row.id, { beta: on }), mine: row.email.toLowerCase() === myMail,
    });
  };

  if (!admin || !user) return null;

  const dialog = ask ? (
    <ConfirmDialog {...ask} busy={busy} error={askError} onConfirm={() => void confirm()} onCancel={() => { if (!busy) { setAsk(null); setAskError(''); } }} />
  ) : null;
  const detailHref = (row: AdminUser) => `${routeHref('admin-users')}/${encodeURIComponent(row.id)}`;

  // ── A04 상세 ───────────────────────────────────────────────────────────────
  if (rest) {
    const row = (rows ?? []).find((one) => one.id === rest);
    const mine = !!row && row.email.toLowerCase() === myMail;
    // 루트만 바꾼다. 루트 본인 · 루트 계정은 못 바꾼다 — 단추를 안 준다
    const editable = adminRoot && !!row && row.role !== 'root' && !mine;
    const isAdmin = row?.role === 'admin';
    return (
      <>
        <AdminHead route={route} title={adminRoot ? '이용자 권한 상세' : '이용자 프로필'}
          desc={adminRoot ? '한 사람의 승인 · 운영 권한 · 실험 기능을 확인하고 변경합니다.' : '승인된 이용자의 정보를 조회합니다. 권한 변경은 루트 전용입니다.'} />
        <div className="adm-page">
          <a className="px-btn px-btn--sm px-skin adm-back" href={routeHref('admin-users')}><PixelIcon name="back" /> 이용자 목록</a>
          <ListState loaded={rows !== null} failed={failed} loading="이용자를 찾는 중이에요…" isEmpty={rows !== null && !row}
            empty="이용자를 찾지 못했어요 — 목록에 없는 ID 예요. 주소를 확인하거나 목록에서 다시 골라 주세요." onRetry={() => void load()} />
          {row ? (
            <>
              <section className="px-panel px-skin px-drop adm-profile">
                <Avatar row={row} />
                <div className="adm-profile__body">
                  <RoleBadge role={row.role} code />
                  <h3 className="px-heading">{userName(row.name)}{mine ? ' · 나' : ''}</h3>
                  <p className="px-body px-mono">{row.email}</p>
                  <KvList tight rows={[
                    { label: '가입일', value: dayOf(row.createdAt) },
                    { label: '최근 방문', value: dayOf(row.lastSeenAt) },
                    { label: '사용자 ID', value: row.id },
                  ]} />
                </div>
              </section>
              <div className="px-grid px-grid--3 adm-grid">
                <section className="px-note px-skin px-drop">
                  <p className="px-note__title">운영 권한</p>
                  <p className="px-note__body">{isAdmin ? '위임 관리자예요. 이용자 목록 조회와 트레이너 코드 관리를 할 수 있어요.' : row.role === 'root' ? '루트 관리자예요. 이 화면에서 바꿀 수 없어요.' : '일반 이용자예요. 관리자로 지정하면 이용자 목록과 트레이너 코드를 관리할 수 있어요.'}</p>
                  {editable && row.role !== 'pending' ? (
                    <div className="px-note__actions">
                      <button type="button" className={`px-btn px-skin${isAdmin ? ' adm-btn--danger' : ''}`} onClick={() => askRole(row, isAdmin ? 'approved' : 'admin')}>
                        {isAdmin ? '관리자 해제 검토' : '관리자 지정 검토'}
                      </button>
                    </div>
                  ) : null}
                </section>
                <section className="px-note px-skin px-drop">
                  <p className="px-note__title">실험 기능</p>
                  <p className="px-note__body">{row.beta ? '실험 기능 사용 중' : '사용 안 함'} — 먼저 써 보는 자리예요. 관리자 권한과는 별개로 달아요.</p>
                  {editable ? (
                    <div className="px-note__actions">
                      <button type="button" className={`px-btn px-skin${row.beta ? ' adm-btn--danger' : ''}`} onClick={() => askBeta(row, !row.beta)}>
                        {row.beta ? '실험 기능 해제 검토' : '실험 기능 부여 검토'}
                      </button>
                    </div>
                  ) : null}
                </section>
                <section className="px-note px-skin px-drop">
                  <p className="px-note__title">{row.role === 'pending' ? '가입 승인' : '가입 승인 해제'}</p>
                  <p className="px-note__body">{row.role === 'pending'
                    ? '승인하면 로그인한 뒤 잠긴 화면을 쓸 수 있어요.'
                    : '승인을 해제하면 승인 대기로 돌아가고 로그인 세션도 종료돼요. 계정 삭제는 아닙니다.'}</p>
                  {editable ? (
                    <div className="px-note__actions">
                      {row.role === 'pending'
                        ? <button type="button" className="px-btn px-btn--primary px-skin" onClick={() => askRole(row, 'approved')}>승인 검토</button>
                        : <button type="button" className="px-btn px-skin adm-btn--danger" onClick={() => askRole(row, 'pending')}>승인 해제 검토</button>}
                    </div>
                  ) : null}
                </section>
              </div>
              <Note tone="info" title="변경 전 대상 · 효과를 다시 확인해요">
                <p>{editable
                  ? '단추를 누르면 확인 팝업에서 이메일과 바뀌는 내용을 한 번 더 보여 줘요. 변경은 바로 저장되고 목록을 다시 읽어요.'
                  : mine ? '본인 계정은 이 화면에서 바꿀 수 없어요.' : row.role === 'root' ? '루트 계정은 이 화면에서 바꿀 수 없어요.' : '권한 변경은 루트 관리자만 할 수 있어요.'}</p>
              </Note>
            </>
          ) : null}
          <Toast text={toast} onClose={() => setToast('')} />
        </div>
        {dialog}
      </>
    );
  }

  // ── A03 루트 · A06 위임 관리자 목록 ──────────────────────────────────────
  const chips = [
    { id: 'pending', label: `대기 ${count(counts.pending)}` }, { id: 'approved', label: `승인 ${count(counts.approved)}` }, { id: 'admin', label: `관리자 ${count(counts.admin)}` },
  ];
  return (
    <>
      <AdminHead route={route} title={adminRoot ? '가입 승인 · 유저 관리' : '유저 관리'}
        desc={adminRoot ? '가입 승인과 운영 권한, 실험 기능 권한을 각각 관리합니다.' : '승인된 이용자와 관리자를 조회합니다. 가입 승인과 권한 변경은 루트 전용입니다.'} />
      <div className="adm-page">
        <section className="px-panel px-skin px-drop adm-me">
          <Avatar row={{ picture: user.photoURL, name: user.displayName }} />
          <div className="adm-me__body">
            <h3 className="px-sub">{adminRoot ? '내 계정 · 루트 관리자' : '위임 관리자 계정'}</h3>
            <p className="px-body px-mono">{myMail}</p>
            <p className="px-caption">{adminRoot ? '본인과 루트 권한은 이 화면에서 해제할 수 없어요.' : '트레이너 코드를 등록·수정·삭제할 수 있어요.'}</p>
          </div>
        </section>

        <div className="adm-toolbar">
          {/* 칩은 거르기다 — 켜진 칩을 다시 누르면 전체로 돌아온다 */}
          {adminRoot ? <PxChips items={chips} value={filter} onPick={(id) => setFilter(filter === id ? 'all' : id as Filter)} label="역할로 거르기" /> : null}
          <SearchBox value={query} placeholder="이름 또는 이메일" label="이용자 검색" onChange={setQuery} />
        </div>

        {failed?.kind === '403' ? <AdminDenied kind="403" /> : (
          <AdminPanel className="adm-users">
            <ListState loaded={rows !== null} failed={failed} isEmpty={others.length === 0} empty="아직 등록된 항목이 없어요" onRetry={() => void load()} />
            {rows && !failed && others.length ? (
              shown.length === 0
                ? <p className="px-body px-muted">조건에 맞는 이용자가 없어요 — 검색어나 거르기를 지워 보세요.</p>
                : <UserTable rows={shown} root={adminRoot} detailHref={detailHref} onApprove={(row) => askRole(row, 'approved')} onBeta={askBeta} />
            ) : null}
            {rows ? <p className="px-caption">{tableFoot(shown.length)}</p> : null}
          </AdminPanel>
        )}

        {adminRoot ? null : (
          <Note title="트레이너 코드 관리"
            actions={<a className="px-btn px-btn--primary px-skin" href={routeHref('admin-trainers')}><PixelIcon name="box" /> 트레이너 코드 열기</a>}>
            <p>코드 목록을 확인하거나 여러 코드를 붙여 넣어 저장하세요.</p>
          </Note>
        )}
        <Toast text={toast} onClose={() => setToast('')} />
      </div>
      {dialog}
    </>
  );
}
