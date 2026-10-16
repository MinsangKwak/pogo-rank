// ─────────────────────────────────────────────────────────────────────────────
// components/DeleteAccountDialog.tsx — 계정 삭제 확인 팝업 (v6 피그마 D10)
//
// 되돌릴 수 없는 일이라 **'삭제' 를 직접 입력해야** 단추가 산다 — window.confirm 한 번보다 손이 한 번 더 간다.
// 삭제 자체는 Account.tsx 의 remove() 와 같은 한 줄이다: `DELETE /v1/me` 뒤 applyAnon(). 딸린 줄(세션 · ★)은 DB 가 연쇄로 지운다.
// 실패하면 팝업을 닫지 않고 같은 문구로 알린다 — 닫아 버리면 "지워진 줄 알았다" 가 된다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { applyAnon, useAuthStore } from '../stores/auth';
import { serverApi, ApiError } from '../lib/serverApi';
import { track } from '../lib/track';
import { PixelIcon } from './PixelIcon';

// 입력해야 하는 글자 — 안내문과 판정이 같은 값을 본다
const WORD = '삭제';

export default function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  const ready = typed.trim() === WORD && !busy;

  const remove = async () => {
    if (!ready || !useAuthStore.getState().user) return;
    track('account_delete');
    setBusy(true);
    try {
      await serverApi.deleteAccount();
    } catch (error) {
      setMessage(`삭제 실패: ${error instanceof ApiError ? error.message : String(error)} — 아직 지워지지 않았어요. 다시 눌러 보고, 그래도 안 되면 관리자에게 알려주세요`);
      setBusy(false);
      return;
    }
    applyAnon();
    onClose();
  };

  return (
    <dialog ref={ref} className="px-dialog" id="delete-account-dialog" aria-labelledby="delete-account-title" onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="px-dialog__panel px-skin pxp-delete">
        <header className="px-dialog__head">
          <div>
            <h2 className="px-heading" id="delete-account-title">계정을 삭제할까요?</h2>
            <p className="px-caption">되돌리기 어려운 작업</p>
          </div>
          <button type="button" className="px-btn px-btn--icon px-skin" aria-label="닫기" disabled={busy} onClick={onClose}><PixelIcon name="close" /></button>
        </header>
        <div className="px-dialog__body">
          <div className="px-note px-skin px-skin--danger">
            <p className="px-eyebrow">WARNING</p>
            <p className="px-note__title">주의 · 데이터 삭제</p>
            <p className="px-note__body">계정에 연결된 즐겨찾기와 저장 정보가 삭제됩니다. 삭제 범위와 복구 가능 여부를 확인한 뒤 진행해 주세요.</p>
          </div>
          <label className="pxp-field">
            <span className="px-caption">{`확인을 위해 '${WORD}'를 입력하세요`}</span>
            <span className="px-input px-skin">
              <input type="text" autoComplete="off" value={typed} placeholder={WORD} aria-label={`${WORD} 입력`}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void remove(); }} />
            </span>
          </label>
          {message ? <p className="px-body pxp-delete__error" role="alert">{message}</p> : null}
        </div>
        <footer className="px-dialog__foot">
          <button type="button" className="px-btn px-skin" disabled={busy} onClick={onClose}>취소</button>
          <button type="button" className="px-btn px-btn--primary px-skin" disabled={!ready} onClick={() => void remove()}>
            {busy ? '삭제하는 중…' : '계정 삭제'}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
