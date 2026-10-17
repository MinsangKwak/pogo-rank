// ─────────────────────────────────────────────────────────────────────────────
// components/PxDialog.tsx — v6 팝업 판 한 벌 (피그마 D01~D13 공통: 머리 · 본문만 스크롤 · 바닥 고정)
//
// 모양은 parts.css 의 px-dialog(판 · 머리 · 본문 · 바닥) 하나다. 여기는 **마크업을 한 번만 적는다** — 상세 · 검색 · 로그인 안내 ·
// 동의 · 통계 설정이 같은 네 조각을 쓴다. 팝업마다 <dialog> showModal · 바깥 누름 · Esc 를 손으로 적으면 하나씩 어긋난다.
//   <PxDialog onClose>            <dialog class="px-dialog"> + 판. 열리면 showModal(), 바깥 누름 · Esc 는 onClose
//   <PxDialogHead title caption>  머리 — (그림) · 제목 · 한 줄 설명 · 오른쪽 단추들 · ✕
//   <PxDialogBody>                본문 — 세로 스크롤 상자
//   <PxDialogFoot hint>           바닥 — 동작 단추 줄. hint 가 있으면 그 위에 한 줄(요약 팝업의 '자세한 건 도감을 참고하세요!')
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { PixelIcon } from './PixelIcon';

export interface PxDialogProps {
  /** 바깥 누름 · Esc · ✕ 가 부른다 */
  onClose: () => void;
  /** 저장 중처럼 닫으면 안 되는 때 — 바깥 누름 · Esc 를 막는다 */
  locked?: boolean;
  /** 읽어 주는 이름 — labelledby 가 없을 때 */
  label?: string;
  /** 제목 요소의 id — 있으면 aria-labelledby 로 잇는다 */
  labelledBy?: string;
  id?: string;
  /** dialog 에 더 붙일 클래스 (화면별 폭 · 배치) */
  className?: string;
  /** 판(px-dialog__panel)에 더 붙일 클래스 */
  panelClassName?: string;
  /** 판에 얹을 data-* 속성 (GA · 검사가 읽는다) */
  panelProps?: Record<string, string | number | undefined>;
  panelId?: string;
  /** 판 바깥(dialog 안)에 더 둘 것 — 겹쳐 뜨는 둘째 팝업 */
  after?: ReactNode;
  dialogRef?: Ref<HTMLDialogElement>;
  children: ReactNode;
}

export function PxDialog({ onClose, locked = false, label, labelledBy, id, className = '', panelClassName = '', panelProps, panelId, after, dialogRef, children }: PxDialogProps) {
  const own = useRef<HTMLDialogElement>(null);
  // 바깥 ref 와 안쪽 ref 를 같이 채운다 — 여는 쪽이 요소를 들고 있어야 하는 때(검색 팔레트의 포커스)도 있다
  const attach = (node: HTMLDialogElement | null) => {
    own.current = node;
    if (typeof dialogRef === 'function') dialogRef(node);
    else if (dialogRef) (dialogRef as { current: HTMLDialogElement | null }).current = node;
  };
  // <dialog> 로 열어야 Esc · 배경 잠금 · 포커스 가두기가 브라우저 몫이 된다 (v3 modal.js 와 같다). 닫히면 포커스는 연 자리로 돌아간다
  useEffect(() => {
    const node = own.current;
    if (node && !node.open && typeof node.showModal === 'function') node.showModal();
  }, []);
  return (
    <dialog ref={attach} className={`px-dialog${className ? ` ${className}` : ''}`} id={id} aria-label={label} aria-labelledby={labelledBy}
      onClick={(event) => { if (!locked && event.target === own.current) onClose(); }}
      onCancel={(event) => { event.preventDefault(); if (!locked) onClose(); }}>
      <div className={`px-dialog__panel px-skin${panelClassName ? ` ${panelClassName}` : ''}`} id={panelId} {...panelProps}>
        {children}
      </div>
      {after}
    </dialog>
  );
}

/** 머리 — 왼쪽 그림(선택) · 제목 · 한 줄 설명 · 오른쪽 단추들 · ✕ */
export function PxDialogHead({ art, title, titleId, caption, actions, onClose, closeLabel = '닫기', locked = false, className = '' }: {
  art?: ReactNode; title: ReactNode; titleId?: string; caption?: ReactNode; actions?: ReactNode;
  onClose?: () => void; closeLabel?: string; locked?: boolean; className?: string;
}) {
  return (
    <header className={`px-dialog__head${className ? ` ${className}` : ''}`}>
      {art}
      <div>
        <h2 className="px-heading" id={titleId}>{title}</h2>
        {caption ? <p className="px-caption">{caption}</p> : null}
      </div>
      {actions}
      {onClose ? <button type="button" className="px-btn px-btn--icon px-skin" aria-label={closeLabel} disabled={locked} onClick={onClose}><PixelIcon name="close" /></button> : null}
    </header>
  );
}

/** 본문 — 세로 스크롤 상자. 판들을 1.6rem 간격으로 쌓는다 */
export function PxDialogBody({ children, className = '', bodyRef }: { children: ReactNode; className?: string; bodyRef?: Ref<HTMLDivElement> }) {
  return <div className={`px-dialog__body${className ? ` ${className}` : ''}`} ref={bodyRef}>{children}</div>;
}

/** 바닥 — 동작 단추 줄. 주 행동(px-btn--primary)이 더 넓다 (parts.css) */
export function PxDialogFoot({ children, hint, className = '' }: { children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <footer className={`px-dialog__foot${className ? ` ${className}` : ''}`}>
      {hint ? <p className="px-caption px-dialog__hint">{hint}</p> : null}
      {children}
    </footer>
  );
}
