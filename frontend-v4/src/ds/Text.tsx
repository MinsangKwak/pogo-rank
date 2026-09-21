// ─────────────────────────────────────────────────────────────────────────────
// ds/Text.tsx — 글자. **글꼴 줄기와 크기의 짝을 타입이 막는다**
//
// CLAUDE.md §7 의 표를 코드로 옮긴 것이다 —
//   읽는 글 (Pretendard)  1.2 · 1.4 · 1.6 rem
//   크롬   (Galmuri)      1.4 · 2.2 · 2.8 · 4.2 rem
//
// 왜 컴포넌트를 둘로 가르나. 한 컴포넌트에 `font`·`size` 를 따로 받으면
// `font="chrome" size="sub"` 같은 짝이 만들어진다 — Galmuri 12px 은 격자 밖이라
// 픽셀이 뭉개진다. 줄기마다 컴포넌트를 두면 그 짝이 **애초에 못 써진다.**
//
// Galmuri 쪽에서 본문보다 작은 글자가 필요하면 크기를 줄이지 말고 `tone="muted"` 로 누른다.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { ChromeSize, ReadSize } from './tokens';

/** 글자 흐림 · 의미 색. 의미 색은 뜻이 있는 글자에만 붙인다 */
export type Tone =
  | 'fg' | 'ink2' | 'muted' | 'faint'
  | 'brand' | 'good' | 'warn' | 'caution' | 'point';

/** 줄 높이 네 단 — 한 줄 · 제목 · 본문 · 긴 글 (§7) */
export type Leading = 'flat' | 'title' | 'body' | 'prose';

const LEADING: Record<Leading, number> = { flat: 1, title: 1.2, body: 1.5, prose: 1.7 };

interface Common {
  tone?: Tone;
  leading?: Leading;
  /** 고정폭 숫자 — 표에서 자릿수가 흔들리지 않게 */
  num?: boolean;
  /** 몇 줄까지 보이고 접을지. 안 주면 안 접는다 */
  clamp?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  title?: string;
  children?: ReactNode;
}

function build(stem: 'read' | 'chrome', size: string, props: Common) {
  const { tone = 'fg', leading = 'body', num, clamp, className, style } = props;
  const names = [
    'ds-text', `ds-text--${stem}`, `ds-text--${tone}`,
    num ? 'ds-text--num' : '',
    clamp ? 'ds-text--clamp' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  const vars = {
    ['--ds-fs']: `var(--fs-${size})`,
    ['--ds-lh']: String(LEADING[leading]),
    ...(clamp ? { ['--ds-clamp']: String(clamp) } : {}),
    ...style,
  } as CSSProperties;
  return { className: names, style: vars };
}

/** 읽는 글 — 보조(12) · 본문(14) · 강조(16). 여러 줄을 읽는 자리다 */
export function Text({ size = 'body', as: Tag = 'p', title, children, ...rest }: Common & { size?: ReadSize }) {
  const { className, style } = build('read', size, rest);
  return <Tag className={className} style={style} title={title}>{children}</Tag>;
}

/** 크롬 — 칩·탭·버튼(14) · 구역 제목(22) · 화면 제목(28) · 큰 숫자(42) */
export function Label({ size = 'body', as: Tag = 'span', title, children, ...rest }: Common & { size?: ChromeSize }) {
  const { className, style } = build('chrome', size, rest);
  return <Tag className={className} style={style} title={title}>{children}</Tag>;
}
