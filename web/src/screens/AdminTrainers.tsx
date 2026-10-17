// ─────────────────────────────────────────────────────────────────────────────
// screens/AdminTrainers.tsx — 트레이너 코드 관리 (v6 피그마 A05)
//
// components/TrainerAdmin.tsx(팝업)의 규칙을 그대로 옮겼다 — **한 명씩 받는 폼 대신 붙여넣기**다. 코드는 단톡방에서 여러 줄로
// 한꺼번에 오고, 오는 모양 그대로 받는 것이 옮겨 적는 것보다 빠르고 덜 틀린다. 줄 가르기(parseLine) · 보기용 묶음(fmtCode) ·
// 응답 없음 끊기(withLimit)는 그 파일의 것을 그대로 쓴다 — 규칙이 두 벌이면 한쪽만 고쳐지는 날이 온다.
//
// 여기서 더한 것 —
//   저장 전 검토   줄마다 미리 판정해 '새 항목 · 기존 코드 변경 · 형식 오류' 를 센다. 틀린 줄은 몇 번째 줄인지 적는다
//   한 줄 수정     이름은 열쇠라 고정하고 코드만 바꾼다 — 같은 이름을 다시 저장하면 코드가 갈리는 서버 규칙 그대로
//   삭제 확인      window.confirm 대신 ConfirmDialog (A08)
//   저장 뒤        저장된 줄은 지우고 **실패 · 형식 오류 줄은 남긴다** — 고쳐서 다시 누를 수 있게
// 관리자 둘 다 쓸 수 있다 — 판정은 서버가 한다 (`PUT /v1/trainers/{name}` 는 admin 부터)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../stores/auth';
import { serverApi, ApiError, type Trainer } from '../lib/serverApi';
import { routeById } from '../routes';
import { count } from '../lib/cell';
import { AdminHead } from '../components/AdminShell';
import ConfirmDialog from '../components/ConfirmDialog';
import { PixelIcon } from '../components/PixelIcon';
import { fmtCode, parseLine, withLimit } from '../components/TrainerAdmin';
import AdminDenied from '../components/admin/AdminDenied';
import { AdminPanel, ListState, Note, SearchBox, type LoadFail } from '../components/admin/Panels';

/** 붙여 넣은 글의 한 줄 — 몇 번째 줄인지(1부터), 갈라진 결과, 기존 목록과 견준 갈래 */
export interface ReviewLine {
  no: number;
  line: string;
  parsed: { name: string; code: string } | null;
  kind: 'new' | 'change' | 'same' | 'bad';
}

/** 저장 전 검토 — 빈 줄은 세지 않는다. 같은 이름이 있으면 코드가 다를 때만 '변경' 이다 */
export function reviewLines(text: string, existing: readonly Trainer[]): ReviewLine[] {
  const codes = new Map(existing.map((one) => [one.name, one.code.replace(/\D/g, '')]));
  return text.split('\n').map((raw, index) => ({ no: index + 1, line: raw.trim() })).filter((one) => one.line).map((one) => {
    const parsed = parseLine(one.line);
    if (!parsed) return { ...one, parsed: null, kind: 'bad' as const };
    const was = codes.get(parsed.name);
    return { ...one, parsed, kind: was === undefined ? 'new' as const : was === parsed.code ? 'same' as const : 'change' as const };
  });
}

// 형식 오류 줄 안내 — 처음에는 세 줄만, [형식 다시 확인] 을 누르면 전부
const BAD_FOLD = 3;

export default function AdminTrainers({ rest }: { rest?: string }) {
  void rest;
  const admin = useAuthStore((s) => s.admin);
  const route = routeById('admin-trainers')!;
  const [rows, setRows] = useState<Trainer[] | null>(null);
  const [failed, setFailed] = useState<LoadFail | null>(null);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showAllBad, setShowAllBad] = useState(false);
  // 한 줄 수정 — 이름은 고정, 코드만 받는다
  const [edit, setEdit] = useState<{ name: string; code: string; error: string } | null>(null);
  // 삭제 확인 팝업
  const [ask, setAsk] = useState<Trainer | null>(null);
  const [askError, setAskError] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setFailed(null);
    try {
      setRows(await serverApi.trainers());
    } catch (caught) {
      setFailed(caught instanceof ApiError && caught.status === 403
        ? { kind: '403', text: '관리자 권한이 없어요' }
        : { kind: 'fail', text: '목록을 불러오지 못했어요 — 이 상태는 빈 목록과 다릅니다. 새로고침 후 다시 시도해 주세요.' });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const review = useMemo(() => reviewLines(text, rows ?? []), [text, rows]);
  const tally = {
    new: review.filter((one) => one.kind === 'new').length,
    change: review.filter((one) => one.kind === 'change').length,
    same: review.filter((one) => one.kind === 'same').length,
    bad: review.filter((one) => one.kind === 'bad'),
  };
  const valid = review.filter((one) => one.parsed);

  if (!admin) return null;

  const shown = (rows ?? []).filter((one) => !query.trim() || one.name.toLowerCase().includes(query.trim().toLowerCase()));

  // 한 줄 저장 — 이름은 그대로, 코드만. 숫자 12자리가 아니면 보내지 않는다
  const saveEdit = async () => {
    if (!edit || busy) return;
    const code = edit.code.replace(/\D/g, '');
    if (code.length !== 12) { setEdit({ ...edit, error: '12자리 숫자가 필요해요' }); return; }
    setBusy(true);
    try {
      const order = rows?.find((one) => one.name === edit.name)?.sortOrder ?? 0;
      await withLimit(serverApi.putTrainer(edit.name, code, order));
    } catch (caught) {
      setEdit({ ...edit, error: `저장하지 못했어요 (${caught instanceof ApiError ? caught.message : (caught as Error).message})` });
      setBusy(false);
      return;
    }
    setBusy(false);
    setEdit(null);
    setMessage(`${edit.name} 코드를 바꿨어요.`);
    await load();
  };

  // 삭제 — 팝업의 [삭제] 에서. 실패하면 팝업 안에 적고 목록은 그대로
  const remove = async () => {
    if (!ask || busy) return;
    setBusy(true);
    setAskError('');
    try {
      await withLimit(serverApi.removeTrainer(ask.name));
    } catch (caught) {
      setAskError(`삭제하지 못했어요 (${caught instanceof ApiError ? caught.message : (caught as Error).message})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    setMessage(`${ask.name} 코드를 지웠어요.`);
    setAsk(null);
    await load();
  };

  // 일괄 저장 — 유효한 줄만 차례로. 저장 중에는 잠근다(같은 줄이 두 번 들어가지 않게). 실패 · 형식 오류 줄은 남긴다
  const saveAll = async () => {
    if (!valid.length || busy) return;
    setBusy(true);
    setMessage('저장 중…');
    let saved = 0;
    const keep: string[] = [];
    const errors: string[] = [];
    for (const one of review) {
      if (!one.parsed) { keep.push(one.line); continue; }
      try {
        await withLimit(serverApi.putTrainer(one.parsed.name, one.parsed.code, one.no - 1));
        saved += 1;
      } catch (caught) {
        keep.push(one.line);
        errors.push(`${one.parsed.name}: ${caught instanceof ApiError ? caught.message : (caught as Error).message}`);
      }
    }
    setBusy(false);
    const parts = [`${count(saved)}개 저장`];
    if (tally.bad.length) parts.push(`형식 오류 ${count(tally.bad.length)}개는 남겨 뒀어요`);
    if (errors.length) parts.push(`실패 ${count(errors.length)}개 — ${errors[0]}`);
    let out = parts.join(' · ');
    // 권한이 모자라면 서버가 403 을 준다 — 관리자 자리에서 내려온 뒤에도 화면이 열려 있는 경우다. 추측 대신 할 일을 바로 적는다
    if (errors.some((one) => /권한/.test(one))) out += ' → 관리자 권한이 유지되고 있는지 확인하세요 (화면을 새로 열면 다시 판정합니다).';
    setMessage(out);
    setText(keep.join('\n'));
    if (saved) await load();
  };

  const badShown = showAllBad ? tally.bad : tally.bad.slice(0, BAD_FOLD);
  return (
    <>
      <AdminHead route={route} title="트레이너 코드 관리" desc="이름과 12자리 코드를 한 줄에 하나씩 붙여 넣으세요. 같은 이름은 기존 코드를 바꿉니다." />
      <div className="adm-page">
        <div className="adm-toolbar">
          <SearchBox value={query} placeholder="트레이너 이름" label="트레이너 검색" onChange={setQuery} />
          <button type="button" className="px-btn px-btn--primary px-skin" onClick={() => { area.current?.focus(); area.current?.scrollIntoView({ block: 'center' }); }}>
            <PixelIcon name="file" /> 새 코드 입력
          </button>
        </div>

        {failed?.kind === '403' ? <AdminDenied kind="403" /> : (
          <AdminPanel title={`등록된 코드 ${count(rows?.length ?? 0)}개`} note={query && rows ? `검색 ${count(shown.length)}개` : undefined}>
            <ListState loaded={rows !== null} failed={failed} isEmpty={rows !== null && rows.length === 0} empty="아직 등록된 항목이 없어요" onRetry={() => void load()} />
            {rows && !failed && rows.length ? (
              shown.length === 0 ? <p className="px-body px-muted">이름에 맞는 코드가 없어요.</p>
                : (
                  <ul className="adm-codes">
                    {shown.map((one) => (
                      <li key={one.name} className="adm-codes__row">
                        <b className="px-body adm-codes__name">{one.name}</b>
                        {edit?.name === one.name ? (
                          <form className="adm-codes__edit" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
                            <label className={`px-input px-skin px-input--sm${edit.error ? ' px-input--error' : ''}`}>
                              <input type="text" inputMode="numeric" value={edit.code} aria-label={`${one.name} 코드`} placeholder="0000 0000 0000"
                                onChange={(event) => setEdit({ ...edit, code: event.target.value, error: '' })} autoFocus />
                            </label>
                            <button type="submit" className="px-btn px-btn--sm px-btn--primary px-skin" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
                            <button type="button" className="px-btn px-btn--sm px-skin" disabled={busy} onClick={() => setEdit(null)}>취소</button>
                            {edit.error ? <span className="px-caption adm-codes__error" role="alert">{edit.error}</span> : null}
                          </form>
                        ) : (
                          <>
                            <span className="px-body px-mono adm-codes__code">{fmtCode(one.code)}</span>
                            <span className="adm-codes__acts">
                              <button type="button" className="px-btn px-btn--sm px-skin" disabled={busy} onClick={() => setEdit({ name: one.name, code: fmtCode(one.code), error: '' })}>수정</button>
                              <button type="button" className="px-btn px-btn--sm px-skin adm-btn--danger" disabled={busy} onClick={() => { setAskError(''); setAsk(one); }}>삭제</button>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )
            ) : null}
          </AdminPanel>
        )}

        <AdminPanel title="여러 코드 한 번에 등록" className="adm-bulk">
          <label className="px-input px-skin px-input--area">
            <textarea ref={area} rows={6} value={text} aria-label="코드 붙여넣기" disabled={busy}
              placeholder={'한 줄에 하나씩\n이름 0000 0000 0000\n이름2 1111 2222 3333'} onChange={(event) => setText(event.target.value)} />
          </label>
          {review.length ? (
            <div aria-live="polite">
              <Note tone={tally.bad.length ? 'caution' : 'good'}
                title={`새 항목 ${count(tally.new)}개 · 기존 코드 변경 ${count(tally.change)}개 · 형식 오류 ${count(tally.bad.length)}개${tally.same ? ` · 변경 없음 ${count(tally.same)}개` : ''}`}>
                {badShown.length ? (
                  <ul className="adm-review__bad">
                    {badShown.map((one) => <li key={one.no} className="px-caption">{`${count(one.no)}번째 줄은 12자리 숫자가 필요해요.`}</li>)}
                    {!showAllBad && tally.bad.length > BAD_FOLD ? <li className="px-caption">{`… 외 ${count(tally.bad.length - BAD_FOLD)}줄`}</li> : null}
                  </ul>
                ) : null}
              </Note>
            </div>
          ) : null}
          {message ? <p className="px-body adm-bulk__msg" role="status">{message}</p> : null}
          <div className="adm-bulk__acts">
            <button type="button" className="px-btn px-skin" disabled={busy || !review.length} onClick={() => { setShowAllBad(true); area.current?.focus(); }}>형식 다시 확인</button>
            <button type="button" className="px-btn px-btn--primary px-skin" disabled={busy || !valid.length} onClick={() => void saveAll()}>
              {busy ? '저장 중…' : `유효한 ${count(valid.length)}개 저장`}
            </button>
          </div>
        </AdminPanel>
      </div>
      {ask ? (
        <ConfirmDialog title="트레이너 코드 삭제" target={`${ask.name} · ${fmtCode(ask.code)}`} effect="이 코드를 목록에서 지웁니다. 같은 이름으로 다시 붙여 넣으면 새로 등록돼요."
          confirmLabel="삭제" danger busy={busy} error={askError} onConfirm={() => void remove()} onCancel={() => { if (!busy) setAsk(null); }} />
      ) : null}
    </>
  );
}
