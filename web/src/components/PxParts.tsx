// ─────────────────────────────────────────────────────────────────────────────
// components/PxParts.tsx — v6 픽셀 조각의 작은 컴포넌트 묶음 (판 · 단추 · 배지 · 입력 · 지표 · 안내 · 구역 제목 · 세 갈래 칩)
//
// parts.css 의 클래스 계약(px-skin · px-panel · px-btn …)을 화면마다 날 마크업으로 되풀이하지 않기 위한 자리다 (소유자 지시 2026-10-16).
// 모양은 parts.css 가 정하고 여기는 **클래스 조합만** 맡는다 — 새 모양을 여기서 만들지 않는다.
// 내 포켓몬 · 검색식 · 설정 · 패치노트 · 방침 · 약관 · 잠금 카드 · 계정 삭제 팝업이 쓴다. 공통(Bits.tsx)으로 올릴 후보다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes, InputHTMLAttributes } from 'react';

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

type Tone = 'brand' | 'sunk' | 'danger' | 'bg';
const TONE: Record<Tone, string> = { brand: 'px-skin--brand', sunk: 'px-skin--sunk', danger: 'px-skin--danger', bg: 'px-skin--bg' };

/** 판 — 그림자 달린 픽셀 판. `pad` 는 panel(2.4) · card(1.6) · none(안쪽은 자식이 정함) */
export function PxPanel({ as: Tag = 'section', pad = 'panel', tone, drop = true, className, children, ...rest }: {
  as?: 'section' | 'div' | 'article' | 'details'; pad?: 'panel' | 'card' | 'none'; tone?: Tone; drop?: boolean; className?: string; children: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag className={cx('px-skin', drop && 'px-drop', pad === 'panel' && 'px-panel', pad === 'card' && 'px-card', tone && TONE[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}

type BtnKind = 'primary' | 'ghost' | 'danger';
const BTN: Record<BtnKind, string> = { primary: 'px-btn--primary', ghost: 'px-btn--ghost', danger: 'pxp-btn--danger' };

/** 단추 — `href` 를 주면 링크, 아니면 <button type="button"> */
export function PxButton({ kind, size, block, icon, href, className, children, ...rest }: {
  kind?: BtnKind; size?: 'sm'; block?: boolean; icon?: boolean; href?: string; className?: string; children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement> & AnchorHTMLAttributes<HTMLAnchorElement>, 'type'>) {
  const name = cx('px-btn', 'px-skin', kind && BTN[kind], size === 'sm' && 'px-btn--sm', block && 'px-btn--block', icon && 'px-btn--icon', className);
  if (href) return <a className={name} href={href} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>;
  return <button type="button" className={name} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
}

type BadgeTone = 'mint' | 'blue' | 'orange' | 'purple' | 'yellow' | 'muted' | 'fill';
/** 배지 — 기본은 영문 모노(대문자). `ko` 는 한국어 본문 글꼴 */
export function PxBadge({ tone, ko, className, children }: { tone?: BadgeTone; ko?: boolean; className?: string; children: ReactNode }) {
  return <span className={cx('px-badge', 'px-skin', tone && `px-badge--${tone}`, ko && 'px-badge--ko', className)}>{children}</span>;
}

/** 라벨 + 픽셀 입력 틀. `lead` 는 입력 앞 아이콘 자리 */
export function PxField({ label, lead, className, ...input }: { label: string; lead?: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx('pxp-field', className)}>
      <span className="px-caption">{label}</span>
      <span className="px-input px-skin">{lead}<input aria-label={label} {...input} /></span>
    </label>
  );
}

/** 지표 타일 — 라벨 · 큰 수 · 한 마디. 값은 lib/cell.ts 로 다듬어 넘긴다 */
export function PxMetric({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'mint' }) {
  return (
    <div className={cx('px-metric', 'px-skin', 'px-drop', tone === 'mint' && 'pxp-metric--mint')}>
      <p className="px-metric__label">{label}</p>
      <p className="px-metric__value">{value}</p>
      {note ? <p className="px-metric__note">{note}</p> : null}
    </div>
  );
}

/** 안내 판 — 이름표(영문) · 제목 · 본문 · 동작 줄 */
export function PxNote({ eyebrow, title, body, actions, tone, drop = true, className, children, ...rest }: {
  eyebrow?: ReactNode; title?: ReactNode; body?: ReactNode; actions?: ReactNode; tone?: Tone; drop?: boolean; className?: string; children?: ReactNode;
} & Record<string, unknown>) {
  return (
    <section className={cx('px-note', 'px-skin', drop && 'px-drop', tone && TONE[tone], className)} {...rest}>
      {eyebrow ? <p className="px-eyebrow">{eyebrow}</p> : null}
      {title ? <p className="px-note__title">{title}</p> : null}
      {body ? <p className="px-note__body">{body}</p> : null}
      {children}
      {actions ? <div className="px-note__actions">{actions}</div> : null}
    </section>
  );
}

/** 구역 제목 줄 — 제목 + 한 마디 (+ 오른쪽 더보기) */
export function PxSectionHead({ id, title, note, more }: { id?: string; title: string; note?: string; more?: ReactNode }) {
  return (
    <h3 className="px-sec">
      <span className="px-heading" id={id}>{title}</span>
      {note ? <span className="px-sec__note">{note}</span> : null}
      {more}
    </h3>
  );
}

export type TriMode = 'on' | 'off' | undefined;
/**
 * 세 갈래 칩 줄 — 포함(aria-pressed) → 제외(data-mode="exclude") → 해제. 검색식의 조건 칩.
 * PxChips 는 켜짐 · 꺼짐 둘뿐이라 따로 둔다. `title` 은 칩에 마우스를 올렸을 때의 설명
 */
export function PxTriChips({ items, mode, onCycle, label }: {
  items: { id: string; label: string; title?: string }[]; mode: (id: string) => TriMode; onCycle: (id: string) => void; label?: string;
}) {
  return (
    <div className="px-chips" role="group" aria-label={label}>
      {items.map((item) => {
        const now = mode(item.id);
        return (
          <button key={item.id} type="button" className="px-chip px-skin" title={item.title}
            aria-pressed={now === 'on'} data-mode={now === 'off' ? 'exclude' : undefined} onClick={() => onCycle(item.id)}>
            {now === 'on' ? '＋' : now === 'off' ? '－' : ''}{item.label}
          </button>
        );
      })}
    </div>
  );
}

/** 표 — 좁은 화면에서는 줄마다 카드가 된다(info.css). 칸 머리말(data-label)을 CSS 가 앞에 붙인다 */
export function PxTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="pxp-table-wrap">
      <table className="px-table pxp-table">
        <thead><tr>{head.map((one) => <th key={one}>{one}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, at) => <td key={at} data-label={head[at]}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
