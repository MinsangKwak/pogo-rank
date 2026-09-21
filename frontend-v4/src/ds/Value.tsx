// ─────────────────────────────────────────────────────────────────────────────
// ds/Value.tsx — 값을 글자로 바꾸는 **컴포넌트 쪽 관문**
//
// CLAUDE.md §1 은 "값을 글자로 바꾸는 일은 lib/cell.ts 에서만 한다" 고 못 박는다.
// 그런데 관문이 함수라 화면에서는 `{num(row.dps)}` 처럼 **부르는 것을 잊을 수 있다.**
// 여기 컴포넌트를 두면 그 자리에 `<Num of={row.dps} />` 가 서고, 값을 그대로 꽂으려면
// 오히려 더 손이 간다 — 쉬운 길이 옳은 길이 되게 한다.
//
// 세 칸은 lib/cell.ts 의 세 함수를 그대로 부른다. 규칙은 그쪽 한 곳에만 있다.
// ─────────────────────────────────────────────────────────────────────────────
import { lines as keep, num, word } from '../lib/cell';
import { Text } from './Text';
import type { ReadSize, SpaceStep } from './tokens';
import { Stack } from './Layout';

/** 숫자 칸. 비면 대시(—)가 선다 — 틀린 숫자를 지어내느니 빈 칸이 정직하다 */
export function Num({ of, digits, unit, className }: {
  of: unknown; digits?: number; unit?: string; className?: string;
}) {
  const text = num(of, digits);
  return <span className={`ds-text--num${className ? ` ${className}` : ''}`}>{unit ? `${text}${unit}` : text}</span>;
}

/** 글자 칸. 공백뿐이어도 대시로 접힌다 */
export function Word({ of, className }: { of: unknown; className?: string }) {
  return <span className={className}>{word(of)}</span>;
}

/**
 * 보조줄 묶음. **빈 줄은 대시로 때우지 않고 아예 걷어낸다** —
 * 기술 칸이 없는 탱커 줄에 `— 타입` 을 세우면 없는 정보를 있는 척하게 된다 (v4.2.4).
 * 남는 줄이 하나도 없으면 묶음 자체를 안 만든다.
 */
export function Lines({ of, size = 'sub', gap = 'xs' }: {
  of: readonly unknown[]; size?: ReadSize; gap?: SpaceStep;
}) {
  const kept = keep(...of);
  if (!kept.length) return null;
  return (
    <Stack gap={gap}>
      {kept.map((line) => <Text key={line} size={size} tone="muted" leading="body">{line}</Text>)}
    </Stack>
  );
}
