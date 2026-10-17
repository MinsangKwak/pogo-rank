// ─────────────────────────────────────────────────────────────────────────────
// components/detail/Pieces.tsx — 상세 팝업 · 페이지 · 계산기가 함께 쓰는 작은 조각 (v6)
//
// 모양은 parts.css(px-card · px-metric · px-stepper · px-note)에 있고, 여기는 **마크업을 한 번만 적는다** —
// 같은 판을 화면마다 날것으로 되풀이하면 클래스 하나가 빠진 자리가 꼭 생긴다 (CLAUDE.md §3).
//   Sec        제목 달린 판 — '진화 계열' · '폼별 정보' · '타입 상성' …
//   Metric     지표 타일 — 라벨 · 큰 값 · 한 줄 설명 (배틀 정보 'S TIER' · 계산기 '현재 예상 CP' · 프로필 종족값)
//   Stepper    − [숫자] + 한 벌 (계산기 레벨 · 개체값)
//   RankList   '어디 · 몇 위' 줄 목록 (활용 순위 · 폼별 정보 · PvP 리그)
//   NoteBox    안내 판 (계산기 '입력 값은 유지돼요' · 승인 대기)
//   Foot       판 아래 한 줄 작은 글 (기존 detail__foot 자리)
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from 'react';
import { num } from '../../lib/cell';

/** 제목 달린 판 — 상세의 모든 구역이 같은 판이다 (피그마 '진화 계열' · '폼별 정보' …) */
export function Sec({ title, className = '', children, ...rest }: { title: ReactNode; className?: string; children: ReactNode; 'data-boss'?: string }) {
  return (
    <section className={`px-card px-skin pxd-sec${className ? ` ${className}` : ''}`} {...rest}>
      <h3 className="px-sub pxd-sec__title">{title}</h3>
      {children}
    </section>
  );
}

/** 지표 타일 — 라벨 · 큰 값 · 한 줄 설명. 값은 글자로 받는다 (lib/cell 을 거쳐 온 것) */
export function Metric({ label, value, note, color, sunk = false, className = '' }: {
  label: ReactNode; value: ReactNode; note?: ReactNode; color?: string; sunk?: boolean; className?: string;
}) {
  const style = color ? ({ ['--px-metric-c' as string]: color } as CSSProperties) : undefined;
  return (
    <div className={`px-metric px-skin pxd-metric${sunk ? ' px-skin--bg' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <p className="px-metric__label">{label}</p>
      <p className="px-metric__value">{value}</p>
      {note ? <p className="px-metric__note">{note}</p> : null}
    </div>
  );
}

// 범위를 벗어나면 가장 가까운 눈금으로 되돌린다 (v3 clamp)
const clamp = (value: number, min: number, max: number, step: number) =>
  Math.min(max, Math.max(min, Math.round(value / step) * step));

/** − [숫자] + 한 벌 (parts.css px-stepper). 숫자 칸에 바로 적어도 된다 */
export function Stepper({ value, min, max, step, label, onChange }: {
  value: number; min: number; max: number; step: number; label: string; onChange: (next: number) => void;
}) {
  const set = (next: number) => onChange(clamp(Number.isFinite(next) ? next : value, min, max, step));
  return (
    <div className="px-stepper">
      <button type="button" className="px-btn px-btn--icon px-skin" aria-label={`${label} 줄이기`} disabled={value <= min} onClick={() => set(value - step)}>−</button>
      <span className="px-input px-skin px-input--sm">
        <input type="number" className="px-stepper__value" inputMode="decimal" aria-label={label}
          min={min} max={max} step={step} value={value}
          onChange={(event) => set(parseFloat(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
      </span>
      <button type="button" className="px-btn px-btn--icon px-skin" aria-label={`${label} 늘리기`} disabled={value >= max} onClick={() => set(value + step)}>+</button>
    </div>
  );
}

export interface RankItem {
  key: string;
  /** 어디 — '레이드 · 불꽃 보스' */
  where: ReactNode;
  /** 몇 위 — 숫자면 'n위' 로, 글자면 그대로 (개체값 '15/15/15') */
  rank: number | string;
  /** 줄 뒤 작은 글 */
  note?: ReactNode;
  /** 상위 3위처럼 진하게 */
  top?: boolean;
  /** 누르면 어디로 — 있으면 줄이 단추다 */
  onPick?: () => void;
}

/** '어디 · 몇 위' 줄 목록 */
export function RankList({ items, className = '', routeOnly = false }: { items: readonly RankItem[]; className?: string; routeOnly?: boolean }) {
  return (
    <ul className={`pxd-ranks__list${className ? ` ${className}` : ''}`}>
      {items.map((item) => {
        const inner = (
          <>
            <span className="pxd-rank__where">{item.where}</span>
            <b className={`px-mono pxd-rank__no${item.top ? ' is-top' : ''}`}>{typeof item.rank === 'number' ? `${num(item.rank)}위` : item.rank}</b>
            {item.note ? <span className="px-caption px-mono pxd-rank__note">{item.note}</span> : null}
          </>
        );
        return (
          <li key={item.key} className={item.onPick ? '' : `pxd-rank detail__rank-row${item.top ? ' is-top' : ''}`}>
            {item.onPick
              ? <>
                  <button type="button" className={`pxd-rank pxd-rank--tap${item.top ? ' is-top' : ''}${routeOnly ? ' pxd-route-cta' : ''}`} onClick={item.onPick}>{inner}</button>
                  {routeOnly ? <div className={`pxd-rank pxd-route-summary${item.top ? ' is-top' : ''}`}>{inner}</div> : null}
                </>
              : inner}
          </li>
        );
      })}
    </ul>
  );
}

/** 안내 판 — 가라앉은 판에 (제목) · 본문 · (단추) */
export function NoteBox({ title, children, actions, tone = 'sunk', className = '' }: {
  title?: ReactNode; children: ReactNode; actions?: ReactNode; tone?: 'sunk' | 'danger' | 'plain'; className?: string;
}) {
  const skin = tone === 'danger' ? ' px-skin--danger' : tone === 'sunk' ? ' px-skin--sunk' : '';
  return (
    <div className={`px-note px-skin${skin}${className ? ` ${className}` : ''}`}>
      {title ? <p className="px-note__title">{title}</p> : null}
      <p className="px-note__body">{children}</p>
      {actions ? <div className="px-note__actions">{actions}</div> : null}
    </div>
  );
}

/** 판 아래 한 줄 작은 글 */
export function Foot({ children }: { children: ReactNode }) {
  return <p className="px-caption">{children}</p>;
}

/** 단추 줄 — 판 안의 동작 */
export function Actions({ children, routeOnly = false }: { children: ReactNode; routeOnly?: boolean }) {
  return <div className={`px-note__actions${routeOnly ? ' pxd-route-cta' : ''}`}>{children}</div>;
}
