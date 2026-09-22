// ─────────────────────────────────────────────────────────────────────────────
// ds/Callout.tsx — 안내 한 줄 · 빈 자리
//
// Callout 과 Empty 는 **뜻이 다르다.** 섞으면 화면이 거짓말한다 —
//   Callout  "이 화면에 대해 알아 둘 것이 있다"
//   Empty    "여기 세울 줄이 하나도 없다"
// 그리고 Empty 는 대시(—)와도 다르다. 대시는 **한 칸**의 값이 없다는 뜻이고,
// Empty 는 **줄 자체**가 없다는 뜻이다. 대시 수백 개로 빈 표를 그리면 둘이 뒤섞인다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

/** 띠 색이 곧 뜻이다 — 알림 · 좋음 · 주의 · 나쁨 · 브랜드 */
export type CalloutTone = 'info' | 'good' | 'caution' | 'warn' | 'brand';

export function Callout({ tone = 'info', title, icon, children }: {
  tone?: CalloutTone; title?: ReactNode; icon?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className={`ds-callout ds-callout--${tone}`} role={tone === 'warn' ? 'alert' : undefined}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <div className="ds-callout__body">
        {title ? <b className="ds-callout__title">{title}</b> : null}
        {children}
      </div>
    </div>
  );
}

/** 세울 줄이 하나도 없을 때. **왜 비었는지**를 적는다 — '없음' 한 마디는 고장과 구분이 안 된다 */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="ds-empty">{children}</p>;
}
