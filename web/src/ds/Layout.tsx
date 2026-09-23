// ─────────────────────────────────────────────────────────────────────────────
// ds/Layout.tsx — 간격을 **격자 위에만** 두게 하는 배치
//
// 직접 `margin: 1.5rem` 을 적던 자리를 대신한다. v4.3.4 에 간격 1,484군데를 4px 격자로
// 스냅했는데, 스냅만 해 두면 다음 화면이 또 격자 밖 값을 적는다.
// 여기서는 `gap` 이 `SpaceStep` 여섯 칸(none·xs·sm·md·lg·xl)뿐이라 **격자 밖 값이 안 들어간다.**
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { space, type SpaceStep } from './tokens';

interface Box {
  gap?: SpaceStep;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** 세로로 쌓는다. 기본 간격은 덩어리 사이(md · 1.6rem) */
export function Stack({ gap = 'md', as: Tag = 'div', className, style, children }: Box) {
  return (
    <Tag className={`ds-stack${className ? ` ${className}` : ''}`}
      style={{ ['--ds-gap']: space(gap), ...style } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** 세로 맞춤 — 가운데 · 위 · 글줄(baseline). 숫자와 단위를 나란히 놓을 때는 baseline 이다 */
export type Align = 'center' | 'top' | 'baseline';
/** 가로 배분 — 왼쪽(기본) · 양끝 · 오른쪽 */
export type Justify = 'start' | 'between' | 'end';

/** 가로로 늘어놓는다. 기본 간격은 한 덩어리 안(sm · 0.8rem), 넘치면 접는다 */
export function Inline({
  gap = 'sm', align = 'center', justify = 'start', wrap = true,
  as: Tag = 'div', className, style, children,
}: Box & { align?: Align; justify?: Justify; wrap?: boolean }) {
  const names = [
    'ds-inline',
    align === 'top' ? 'ds-inline--top' : '',
    align === 'baseline' ? 'ds-inline--baseline' : '',
    justify === 'between' ? 'ds-inline--between' : '',
    justify === 'end' ? 'ds-inline--end' : '',
    wrap ? '' : 'ds-inline--nowrap',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <Tag className={names} style={{ ['--ds-gap']: space(gap), ...style } as CSSProperties}>
      {children}
    </Tag>
  );
}
