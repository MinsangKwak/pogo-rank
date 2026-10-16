// ─────────────────────────────────────────────────────────────────────────────
// components/ConfirmDialog.tsx — 관리자 작업 확인 팝업 (v6 피그마 A08 '확인 · 예외 상태')
//
// window.confirm 을 대신한다 — 브라우저 확인창은 **대상 · 효과를 한 줄에 섞어** 보여 줘서 "누구에게 무슨 일이 일어나나" 를
// 읽기 전에 눌렀다. 여기서는 제목 · 대상(이메일 · 이름) · 효과 문장을 각각 한 줄로 세우고, 위험한 일(승인 해제 · 삭제)은
// 확인 단추를 빨강 판이 아니라 위험 판으로 둔다 — 빨강은 '주 행동' 이라 "눌러도 되는 것" 으로 읽힌다.
// 저장 중에는 두 단추를 다 잠근다 — 같은 요청이 두 번 나가지 않게. 실패 문구는 여는 쪽이 받아 팝업 안에 적는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, type ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

export interface ConfirmProps {
  /** 제목 — '가입 승인' 처럼 하려는 일 */
  title: string;
  /** 대상 — 이메일 · 이름. 누구에게 닿는 일인지 먼저 보인다 */
  target: string;
  /** 효과 — '이 계정을 승인된 이용자로 변경합니다.' */
  effect: ReactNode;
  /** 확인 단추의 글자 — '가입 승인' · '승인 해제' */
  confirmLabel: string;
  /** 위험한 일인가 — 해제 · 삭제. 단추가 위험 판이 된다 */
  danger?: boolean;
  /** 저장 중 — 단추를 잠그고 '저장 중…' 을 적는다 */
  busy?: boolean;
  /** 실패했을 때 팝업 안에 적는 문구 */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, target, effect, confirmLabel, danger, busy, error, onConfirm, onCancel }: ConfirmProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} className="px-dialog adm-confirm" aria-labelledby="adm-confirm-title"
      // Esc · 바깥 누름은 취소다 — 저장 중에는 닫지 않는다 (닫으면 "안 된 줄" 알고 다시 누른다)
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="px-dialog__panel px-skin">
        <header className="px-dialog__head">
          <div>
            <p className="px-eyebrow px-eyebrow--brand" data-i18n="off">CONFIRM</p>
            <h2 className="px-heading" id="adm-confirm-title">{title}</h2>
          </div>
          <button type="button" className="px-btn px-btn--icon px-skin" aria-label="닫기" disabled={busy} onClick={onCancel}><PixelIcon name="close" /></button>
        </header>
        <div className="px-dialog__body">
          <p className="px-sub px-mono adm-confirm__target">{target}</p>
          <p className="px-body px-muted">{effect}</p>
          {error ? <p className="px-body adm-confirm__error" role="alert">{error}</p> : null}
        </div>
        <footer className="px-dialog__foot">
          <button type="button" className="px-btn px-skin" disabled={busy} onClick={onCancel}>취소</button>
          <button type="button" className={`px-btn px-skin ${danger ? 'adm-btn--danger' : 'px-btn--primary'}`} disabled={busy} onClick={onConfirm}>
            {busy ? '저장 중…' : confirmLabel}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
