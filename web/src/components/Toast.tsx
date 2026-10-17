// ─────────────────────────────────────────────────────────────────────────────
// components/Toast.tsx — 화면 아래 가운데의 짧은 알림 (v6 D13 공통 상태 · 피드백)
//
// 한 번 꽂아 두면(App.tsx) lib/toast.ts 의 toast() 가 띄우는 것을 그린다. 3초 뒤 스스로 사라지고 ✕ 로 먼저 닫을 수도 있다.
// aria-live 자리는 늘 두고 글만 갈아 끼운다 — 자리가 생겼다 없어지면 읽어 주는 도구가 새 글을 놓친다.
// 모양은 parts.css 의 px-toast(고정 위치 · 판) 하나다. 여기는 아이콘과 닫기만 더한다
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { TOAST_MS, useToastStore, type ToastKind } from '../lib/toast';
import { PixelIcon, type PixelIconName } from './PixelIcon';

// 뜻별 아이콘 — 잘됨은 별, 주의는 안내, 보통은 정보
const ICON: Record<ToastKind, PixelIconName> = { info: 'info', good: 'star', warn: 'shield' };
const KIND_CLASS: Record<ToastKind, string> = { info: '', good: ' px-toast--good', warn: ' px-toast--warn' };

export default function Toast() {
  const item = useToastStore((s) => s.item);
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(() => dismiss(item.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [item, dismiss]);
  return (
    <div className="pxd-toast-live" role="status" aria-live="polite">
      {item ? (
        <div key={item.id} className={`px-toast px-skin pxd-toast${KIND_CLASS[item.kind]}`}>
          <PixelIcon name={ICON[item.kind]} />
          <span className="pxd-toast__text">{item.text}</span>
          <button type="button" className="pxd-toast__close" aria-label="알림 닫기" onClick={() => dismiss(item.id)}><PixelIcon name="close" /></button>
        </div>
      ) : null}
    </div>
  );
}
