// ─────────────────────────────────────────────────────────────────────────────
// ds/index.ts — 디자인 시스템 한 문
//
// 화면은 `import { Button, Stack, Text } from '../ds'` 하나로 들어온다.
// 조각마다 경로를 외우게 하면 "이게 시스템 것인지 그 화면 것인지" 가 흐려진다.
//
// **여기 없는 것은 시스템이 아니다.** 화면 하나에만 쓰이는 조각은 그 화면 곁에 둔다 —
// ds/ 에 넣는 순간 남이 쓰기 시작하고, 그때부터는 함부로 못 고친다.
// ─────────────────────────────────────────────────────────────────────────────
export * from './tokens';
export { Text, Label, type Tone, type Leading } from './Text';
export { Stack, Inline, type Align, type Justify } from './Layout';
export { Button, type ButtonVariant, type ButtonProps } from './Button';
export { ChipGroup, Segmented, type ChoiceItem, type ChoiceProps } from './Chip';
export { Badge, FormBadge, Delta, type BadgeTone, type FormKind } from './Badge';
export { TypeDots, TypePill, type TypeTagProps } from './TypeTag';
export { Card, type CardProps } from './Card';
export { Num, Word, Lines } from './Value';
export { Callout, Empty, type CalloutTone } from './Callout';
