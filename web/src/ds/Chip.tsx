// ─────────────────────────────────────────────────────────────────────────────
// ds/Chip.tsx — 칩 줄 · 세그먼트. **하나를 고르는** 두 가지 모양
//
// 둘을 한 파일에 두는 이유 — 고르는 일은 같고 자리만 다르다.
//   칩(.chips)    가짓수가 많고 가로로 흐른다 (타입 필터 18개)
//   세그먼트(.seg) 가짓수가 서넛이고 붙어 있다 (리그 전환)
// 고른 것은 **`aria-pressed`** 가 말한다 — v3 CSS 가 그 속성을 보고 칠한다.
// 클래스(`.is-on`)를 쓰면 접근성은 맞아도 눌린 티가 안 난다 (Bits.tsx 머리말의 사고).
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';
import type { TypeName } from './tokens';

export interface ChoiceItem {
  id: string;
  label: string;
  /** 주면 라벨 앞에 그 타입색 점이 붙는다. '전체' 칩에는 없다 */
  type?: TypeName | string;
}

export interface ChoiceProps {
  items: readonly ChoiceItem[];
  value: string;
  onPick: (id: string) => void;
  /** 화면에 제목이 없는 자리(팝업 안)에서 묶음 이름을 준다 */
  label?: string;
  className?: string;
}

/** 칩 줄 — 가짓수가 많을 때. 넘치면 가로로 흐른다 */
export function ChipGroup({ items, value, onPick, label, className }: ChoiceProps) {
  return (
    <div className={`chips${className ? ` ${className}` : ''}`}
      {...(label ? { role: 'group', 'aria-label': label } : {})}>
      {items.map((item) => (
        <button key={item.id} type="button" className="chips__item"
          aria-pressed={item.id === value} onClick={() => onPick(item.id)}>
          {item.type ? <span className="dot" style={{ ['--c']: `var(--t-${item.type})` } as CSSProperties} /> : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 세그먼트 — 가짓수가 서넛일 때. 버튼이 붙어 한 덩어리로 읽힌다 */
export function Segmented({ items, value, onPick, label, className }: ChoiceProps) {
  return (
    <div className={`seg${className ? ` ${className}` : ''}`}
      {...(label ? { role: 'group', 'aria-label': label } : {})}>
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.id === value} onClick={() => onPick(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
