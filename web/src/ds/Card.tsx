// ─────────────────────────────────────────────────────────────────────────────
// ds/Card.tsx — 카드 한 장
//
// 레시피(박테 · 링 · 계단 그림자 · 아이보리 판)는 surfaces.css 가 도감·랭킹·홈의
// 선택자마다 따로 박아 두고 있었다. 새 화면이 카드를 만들 때 **베낄 자리가 없어서**
// 매번 조금씩 다른 카드가 생겼다. 이제 이 하나를 쓴다.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from 'react';
import { space, type SpaceStep } from './tokens';

export interface CardProps {
  children?: ReactNode;
  /** 머리 띠에 들어갈 제목. 안 주면 띠 자체를 안 만든다 */
  title?: ReactNode;
  /** 머리 띠 오른쪽 — 버튼·뱃지 한 칸 */
  action?: ReactNode;
  /** 늘 옅은 홀로를 깐 카드 — 상위 세 장처럼 "레어" 로 읽혀야 하는 자리 */
  rare?: boolean;
  /** 안쪽 여백. 그림이 가장자리까지 차야 하면 `none` */
  pad?: SpaceStep;
  /** 주면 누를 수 있는 카드가 된다 — <button> 으로 나가고 스치면 들린다 */
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function Card({ children, title, action, rare, pad = 'md', onClick, className, style }: CardProps) {
  const names = [
    'ds-card',
    rare ? 'ds-card--rare' : '',
    onClick ? 'ds-card--tap' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  const vars = { ['--ds-pad']: space(pad), ...style } as CSSProperties;
  const body = (
    <>
      {title ? (
        <div className="ds-card__head">
          <span>{title}</span>
          {action}
        </div>
      ) : null}
      {children}
    </>
  );
  // 누를 수 있으면 <button> 이어야 한다 — div 에 onClick 을 달면 키보드로는 못 누른다
  if (onClick) return <button type="button" className={names} style={vars} onClick={onClick}>{body}</button>;
  return <div className={names} style={vars}>{body}</div>;
}
