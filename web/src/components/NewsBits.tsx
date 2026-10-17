// ─────────────────────────────────────────────────────────────────────────────
// components/NewsBits.tsx — '지금 뭐 하지' 화면들(게임 업데이트 · 기술 변경 · 이벤트 일정 · 레이드 보스 · 알 부화)이 함께 쓰는 작은 조각 (2026-10-16 v6)
//
// 화면 파일에 px-* 날 마크업을 되풀이하지 않으려고 뺐다. 모양은 pixel/parts.css 의 px-badge · px-note · px-sec · px-metric 그대로이고,
// 여기는 그 클래스 묶음을 한 번만 적는다. 다른 화면에서도 같은 자리가 생기면 Bits.tsx 로 올린다 — "공통으로 올릴 후보".
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from 'react';

export type BadgeTone = 'brand' | 'mint' | 'blue' | 'orange' | 'purple' | 'yellow' | 'muted' | 'fill';

/** 배지 — 한국어 글자(px-badge--ko)가 기본. mono 면 영문 · 숫자용 모노 글꼴 그대로 */
export function NwBadge({ text, tone = 'brand', mono = false, color, children }: {
  text?: string; tone?: BadgeTone; mono?: boolean; color?: string; children?: ReactNode;
}) {
  const style = color ? ({ ['--px-badge-c' as string]: color } as CSSProperties) : undefined;
  return (
    <span className={`px-badge px-skin${mono ? '' : ' px-badge--ko'}${tone === 'brand' ? '' : ` px-badge--${tone}`}`} style={style}>
      {children}{text}
    </span>
  );
}

/** 안내 판 — 제목 한 줄 + 본문 문단(들). 본문은 문단마다 px-note__body 로 */
export function NwNote({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`px-note px-skin px-drop${className ? ` ${className}` : ''}`}>
      {title ? <p className="px-note__title">{title}</p> : null}
      {children}
    </div>
  );
}

/** 안내 판 본문 한 문단 */
export function NwNoteBody({ children }: { children: ReactNode }) {
  return <p className="px-note__body">{children}</p>;
}

/** 구역 제목 줄 — 제목 · 한 마디 · 오른쪽 수(또는 아무 노드). 판 안에서는 as='h3' */
export function NwSecHead({ title, note, right, as: Tag = 'h2', size = 'heading', lead, className }: {
  title: ReactNode; note?: string; right?: ReactNode; as?: 'h2' | 'h3'; size?: 'heading' | 'sub'; lead?: ReactNode; className?: string;
}) {
  return (
    <Tag className={`px-sec${className ? ` ${className}` : ''}`}>
      {lead}
      <span className={size === 'sub' ? 'px-sub' : 'px-heading'}>{title}</span>
      {note ? <span className="px-sec__note">{note}</span> : null}
      {right !== undefined ? <span className="px-sec__more px-mono">{right}</span> : null}
    </Tag>
  );
}

/** 지표 타일 — 라벨 · 큰 값 · 한 마디. 누를 수 있으면 button 으로 */
export function NwMetric({ label, value, note, color, sunk = false, pressed, onClick, className }: {
  label: string; value: ReactNode; note?: string; color?: string; sunk?: boolean; pressed?: boolean; onClick?: () => void; className?: string;
}) {
  const klass = `px-metric px-skin${sunk ? ' px-skin--sunk' : ' px-drop'}${onClick ? ' px-card--tap' : ''}${className ? ` ${className}` : ''}`;
  const style = color ? ({ ['--px-metric-c' as string]: color } as CSSProperties) : undefined;
  const body = (
    <>
      <span className="px-metric__label">{label}</span>
      <span className="px-metric__value">{value}</span>
      {note ? <span className="px-metric__note">{note}</span> : null}
    </>
  );
  return onClick
    ? <button type="button" className={klass} style={style} aria-pressed={pressed} onClick={onClick}>{body}</button>
    : <div className={klass} style={style}>{body}</div>;
}

/** 바닥 한 줄 — 출처 · 주의 */
export function NwFoot({ children }: { children: ReactNode }) {
  return <p className="px-caption nw-foot">{children}</p>;
}

/** 빈 상태 한 줄 — 판 하나에 문장 하나 */
export function NwEmpty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`px-note px-skin px-body${className ? ` ${className}` : ''}`}>{children}</p>;
}
