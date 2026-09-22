// ─────────────────────────────────────────────────────────────────────────────
// ds/Button.tsx — 누르는 것 한 벌
//
// **새 클래스를 만들지 않는다.** v3 CSS 가 이미 네 종류를 들고 있고, 회귀 검사가 그 이름을
// 붙잡고 있다 (`.home__btn` · `.tool-btn` · `.icon-btn` · `.check-toggle`).
// 여기서 하는 일은 그 넷에 **이름과 규칙**을 붙이는 것이다 —
//   · 어떤 자리에 무엇을 쓰는지를 `variant` 가 말한다
//   · 켜짐은 클래스가 아니라 `aria-pressed` 로 말한다 (v3 CSS 가 그 속성을 본다)
//   · 링크로 쓰면 <a>, 아니면 <button type="button"> 이 나간다
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ReactNode } from 'react';

export type ButtonVariant =
  /** 주 행동 — 화면에 하나. 브랜드색 채움 위 --bg 글자 */
  | 'primary'
  /** 보조 행동 — 외곽선 */
  | 'secondary'
  /** 화면 머리의 도구 (덱 짜기 · 계산기). 켜면 그 줄의 제목 노릇을 한다 */
  | 'tool'
  /** 정사각 아이콘 — 테마 · 메뉴 · 보기 전환 */
  | 'icon';

const CLASS: Record<ButtonVariant, string> = {
  primary: 'home__btn home__btn--primary',
  secondary: 'home__btn',
  tool: 'tool-btn',
  icon: 'icon-btn',
};

export interface ButtonProps {
  variant?: ButtonVariant;
  children?: ReactNode;
  /** 켜짐 — `aria-pressed` 로 나간다. 안 주면 속성 자체를 안 붙인다(토글이 아닌 버튼) */
  pressed?: boolean;
  disabled?: boolean;
  /** 주면 <a> 로 나간다. 누르면 **가는 곳**이 있는 버튼이다 */
  href?: string;
  /** 아이콘만 있는 버튼은 이름이 그림 밖에 있어야 한다 */
  label?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Button({
  variant = 'secondary', children, pressed, disabled, href, label, title, className, style, onClick,
}: ButtonProps) {
  const names = `${CLASS[variant]}${className ? ` ${className}` : ''}`;
  const shared = {
    className: names,
    ...(pressed === undefined ? {} : { 'aria-pressed': pressed }),
    ...(label ? { 'aria-label': label } : {}),
    ...(title ? { title } : {}),
    ...(style ? { style } : {}),
  };
  if (href) {
    // 못 쓰는 링크는 누를 수 없어야 한다 — href 를 떼면 탭 차례에서도 빠진다
    return <a {...shared} {...(disabled ? { 'aria-disabled': true } : { href })}>{children}</a>;
  }
  return <button type="button" {...shared} disabled={disabled} onClick={onClick}>{children}</button>;
}
