// ─────────────────────────────────────────────────────────────────────────────
// components/ToolBits.tsx — 도구 화면(D-MAX 덱 · 솔플 · PvP 덱 · 개체값)이 함께 쓰는 조각
//
// 화면 파일에 px-* 마크업을 되풀이하지 않는다 — 슬롯 판 · 지표 타일 · 스테퍼 · 후보 줄 · 표를 여기 한 번만 그린다.
// 모양은 parts.css 의 px-* 조각이고 자리는 pixel/tools.css 다. 다른 화면도 쓰게 되면 Bits.tsx 로 올린다(보고서의 '공통으로 올릴 후보').
// 값은 호출처가 lib/cell 로 닫아 글자로 넘긴다 — 여기서는 숫자를 만지지 않는다(§1).
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from 'react';
import { BASE } from '../lib/base';
import { PixelIcon } from './PixelIcon';

/** 몬스터볼 틀 위 그림 — 빈 칸(null)은 틀만. 없는 그림 주소를 불러 깨진 그림을 띄우지 않는다 */
export function Ball({ sprite, size }: { sprite: number | null; size?: 'sm' | 'lg' }) {
  return (
    <span className={`px-ball${size ? ` px-ball--${size}` : ''}`}>
      {sprite == null ? null : <img src={`${BASE}sprites/${sprite}.png`} alt="" width="96" height="96" loading="lazy" decoding="async" />}
    </span>
  );
}

/** 구역 제목 줄 — 제목 + 한 마디 (+ 오른쪽 링크) */
export function SecHead({ id, title, note, more }: { id?: string; title: string; note?: string; more?: ReactNode }) {
  return (
    <h2 className="px-sec">
      <span className="px-heading" id={id}>{title}</span>
      {note ? <span className="px-sec__note">{note}</span> : null}
      {more}
    </h2>
  );
}

/** 라벨 한 줄 + 조각 (칩 줄 · 입력) */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="pxt-field"><span className="px-caption">{label}</span>{children}</div>;
}

/** 검색 입력 — 돋보기 아이콘이 앞에 선다 */
export function SearchBox({ id, value, placeholder, label, onChange, className }: {
  id?: string; value: string; placeholder: string; label?: string; onChange: (next: string) => void; className?: string;
}) {
  return (
    <label className={`px-input px-skin${className ? ` ${className}` : ''}`}>
      <PixelIcon name="search" />
      <input id={id} type="search" placeholder={placeholder} aria-label={label ?? placeholder} autoComplete="off" value={value}
        onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

/** 안내 판 — 제목 · 본문 · 단추 */
export function Note({ title, children, actions, sunk, live }: { title: string; children: ReactNode; actions?: ReactNode; sunk?: boolean; live?: boolean }) {
  return (
    <section className={`px-note px-skin${sunk ? ' px-skin--sunk' : ' px-drop'}`} aria-live={live ? 'polite' : undefined}>
      <p className="px-note__title">{title}</p>
      {typeof children === 'string' ? <p className="px-note__body">{children}</p> : children}
      {actions ? <div className="px-note__actions">{actions}</div> : null}
    </section>
  );
}

/** 후보 한 줄 — 그림 · 이름(+배지) · 한두 줄 · 오른쪽 동작. 검색 결과 · 교체 후보 · 상대 칸이 같은 줄이다 */
export function CandRow({ sprite, name, badge, lines = [], no, ops, muted, onOpen }: {
  sprite: number | null; name: string; badge?: ReactNode; lines?: readonly string[]; no?: string; ops?: ReactNode; muted?: boolean; onOpen?: () => void;
}) {
  const text = (
    <>
      <b className={`px-sub${muted ? ' px-muted' : ''}`}>{name}{badge}</b>
      {lines.filter(Boolean).map((line, index) => <span key={index} className={`px-caption${index ? ' px-muted' : ''}`}>{line}</span>)}
    </>
  );
  return (
    <li className={`pxt-cand px-skin px-skin--sunk${sprite == null ? ' is-empty' : ''}`}>
      {no ? <span className="px-mono px-caption pxt-cand__no">{no}</span> : null}
      <Ball sprite={sprite} size="sm" />
      {onOpen
        ? <button type="button" className="pxt-cand__text pxt-cand__open" onClick={onOpen} aria-label={`${name} 상세 보기`}>{text}</button>
        : <span className="pxt-cand__text">{text}</span>}
      {ops ? <span className="pxt-cand__ops">{ops}</span> : null}
    </li>
  );
}

export function CandList({ children, ordered, label }: { children: ReactNode; ordered?: boolean; label?: string }) {
  return ordered ? <ol className="pxt-cands" aria-label={label}>{children}</ol> : <ul className="pxt-cands" aria-label={label}>{children}</ul>;
}

/** 고른 보스 · 고른 포켓몬 한 장 — 큰 몬스터볼 · 이름 · 메타 줄 · ✕ */
export function PickedCard({ sprite, name, lines, onClear, clearLabel = '선택 해제' }: {
  sprite: number; name: string; lines: readonly string[]; onClear: () => void; clearLabel?: string;
}) {
  return (
    <div className="pxt-boss">
      <Ball sprite={sprite} />
      <div className="pxt-boss__text">
        <b className="px-heading">{name}</b>
        {lines.filter(Boolean).map((line, index) => <span key={index} className="px-caption">{line}</span>)}
      </div>
      <button type="button" className="px-btn px-btn--icon px-skin" aria-label={clearLabel} onClick={onClear}><PixelIcon name="close" /></button>
    </div>
  );
}

/** 슬롯 판 — SLOT 01 · 역할 배지 · 그림 · 이름 · 타입 · 기술 · 지표 · 교체 단추 (D-MAX 팀 · PvP 덱) */
export function SlotCard({ index, role, roleTone = 'orange', sprite, name, types, moves, metric, value, note, onOpen, onSwap, emptyText }: {
  index: number; role: string; roleTone?: 'orange' | 'blue' | 'purple';
  sprite: number | null; name: string; types?: string; moves?: string;
  metric: string; value: string; note: string;
  onOpen?: () => void; onSwap?: () => void; emptyText?: string;
}) {
  const body = (
    <>
      <Ball sprite={sprite} />
      <b className="px-sub">{name}</b>
      <span className="px-caption">{sprite == null ? emptyText : types}</span>
      <span className="px-caption pxt-slot__moves">{moves}</span>
    </>
  );
  return (
    <article className={`px-skin px-drop px-card pxt-slot${sprite == null ? ' is-empty' : ''}`} data-slot={index}>
      <div className="pxt-slot__head">
        <span className="px-mono px-caption">{`SLOT 0${index + 1}`}</span>
        <span className={`px-badge px-skin px-badge--ko px-badge--${roleTone}`}>{role}</span>
      </div>
      {sprite != null && onOpen
        ? <button type="button" className="pxt-slot__body" onClick={onOpen} aria-label={`${name} 상세 보기`}>{body}</button>
        : <div className="pxt-slot__body">{body}</div>}
      <div className="pxt-slot__metric">
        <span className="px-mono px-caption">{metric}</span>
        <b className="px-number">{value}</b>
        <span className="px-caption">{note}</span>
      </div>
      {onSwap ? <button type="button" className="px-btn px-btn--block px-skin" onClick={onSwap}>포켓몬 교체 ↗</button> : null}
    </article>
  );
}

/** 지표 타일 — 라벨 · 큰 숫자 · 한 마디. tone 이 값의 색이다 */
export function MetricTile({ label, value, note, caption, tone, on, className }: {
  label: string; value: string; note?: string; caption?: string; tone?: 'orange' | 'mint' | 'muted'; on?: boolean; className?: string;
}) {
  const style = tone ? ({ ['--px-metric-c' as string]: `var(--${tone})` } as CSSProperties) : undefined;
  return (
    <div className={`px-metric px-skin${className ? ` ${className}` : ' px-skin--sunk'}${on ? ' is-on' : ''}`} style={style} aria-current={on ? 'true' : undefined}>
      <span className="px-metric__label">{label}</span>
      <b className="px-metric__value">{value}</b>
      {note ? <span className="px-metric__note">{note}</span> : null}
      {caption ? <span className="px-caption">{caption}</span> : null}
    </div>
  );
}

/** ± 스테퍼 — 라벨 | − 값 + . 값 칸은 직접 칠 수도 있다(개체값). 비운 채 나가면 저장값으로 돌아간다 */
export function Stepper({ label, value, draft, min, max, onStep, onType, onFocus, onBlur }: {
  label: string; value: number; draft: string | null; min: number; max: number;
  onStep: (next: number) => void; onType: (raw: string) => void; onFocus: () => void; onBlur: () => void;
}) {
  return (
    <div className="pxt-ivbox px-skin px-skin--sunk">
      <span className="px-caption">{label}</span>
      <div className="px-stepper">
        <button type="button" className="px-btn px-btn--icon px-skin" aria-label={`${label} 1 내리기`} disabled={value <= min} onClick={() => onStep(value - 1)}>−</button>
        <input className="px-stepper__value pxt-ivbox__input" type="number" min={min} max={max} inputMode="numeric" aria-label={`${label} 값`}
          value={draft ?? String(value)} onFocus={onFocus} onBlur={onBlur} onChange={(event) => onType(event.target.value)} />
        <button type="button" className="px-btn px-btn--icon px-skin" aria-label={`${label} 1 올리기`} disabled={value >= max} onClick={() => onStep(value + 1)}>+</button>
      </div>
    </div>
  );
}

/** 표 — 머리 열 · 줄. 좁은 화면은 줄 카드가 된다(tools.css, data-label). num 열은 오른쪽 정렬 */
export function DataTable({ columns, rows, rowHead, className }: {
  columns: readonly { key: string; label: string; num?: boolean }[];
  rows: readonly { key: string; head?: ReactNode; cells: Record<string, ReactNode>; mine?: boolean }[];
  /** 첫 열을 줄 머리(th scope=row)로 — 대응력 표 */
  rowHead?: string;
  className?: string;
}) {
  return (
    <div className="px-skin px-drop pxt-tablewrap">
      <table className={`px-table pxt-table${className ? ` ${className}` : ''}`}>
        <thead>
          <tr>
            {rowHead ? <th scope="col">{rowHead}</th> : null}
            {columns.map((col) => <th key={col.key} scope="col" className={col.num ? 'is-num' : undefined}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.mine ? 'is-mine' : undefined}>
              {rowHead ? <th scope="row">{row.head}</th> : null}
              {columns.map((col) => <td key={col.key} data-label={col.label} className={col.num ? 'is-num' : undefined}>{row.cells[col.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 상태 배지 — 유리 · 보통 · 주의 같은 세 단계 */
export function Grade({ label, tone }: { label: string; tone: 'mint' | 'orange' | 'muted' }) {
  return <span className={`px-badge px-skin px-badge--ko px-badge--${tone}`}>{label}</span>;
}
