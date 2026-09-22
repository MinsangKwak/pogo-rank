// ─────────────────────────────────────────────────────────────────────────────
// ds/Badge.tsx — 작은 표식 세 갈래
//
//   Badge     줄 위의 한 마디 (.tag) — 'G-MAX' · '활용 5곳' · '미구현'
//   FormBadge 이름 앞의 폼 라벨 (.form-tag) — 메가 · 다이맥스 · 섀도우
//   Delta     순위 변동 (.delta) — ▲3 · ▼1
//
// **폼 라벨을 Badge 로 만들지 않는다.** 둘은 색 규칙이 다르다 — 폼은 게임 아이콘 색의
// 채움 뱃지고(메가 보라 · 맥스 자홍), Badge 는 테두리만 있는 중립 표식이다.
// 한 컴포넌트로 합치면 `tone="mega"` 같은 칸이 생겨 그 구분이 흐려진다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';

/** 표식의 뜻. 색이 아니라 **뜻**을 고른다 — 색은 토큰이 정한다 */
export type BadgeTone = 'plain' | 'strong' | 'good' | 'warn' | 'many';

const BADGE_CLASS: Record<BadgeTone, string> = {
  plain: '',
  strong: 'tag--gmax',
  good: 'tag--chg is-up',
  warn: 'tag--hypo',
  many: 'tag--use tag--many',
};

/** 줄 위의 한 마디. 점선 테두리(`dashed`)는 "아직 아닌 것" 을 뜻한다 */
export function Badge({ tone = 'plain', dashed, title, children }: {
  tone?: BadgeTone; dashed?: boolean; title?: string; children: ReactNode;
}) {
  const names = ['tag', BADGE_CLASS[tone], dashed ? 'tag--now' : ''].filter(Boolean).join(' ');
  return <span className={names} title={title}>{children}</span>;
}

/** 폼 갈래 — 게임 아이콘 색을 그대로 쓴다. 여기 없는 폼(리전 등)은 중립 테두리다 */
export type FormKind = 'mega' | 'max' | 'shadow' | 'plain';

export function FormBadge({ kind = 'plain', children }: { kind?: FormKind; children: ReactNode }) {
  return (
    <span className={`form-tag${kind === 'plain' ? '' : ` form-tag--${kind}`}`}>{children}</span>
  );
}

/**
 * 순위 변동. **0 과 빈 값은 아무것도 그리지 않는다** —
 * '▲0' 은 움직였다는 뜻으로 읽히고, 대시는 순위가 없다는 뜻으로 읽힌다. 둘 다 거짓이다.
 */
export function Delta({ value, title }: { value?: number | null; title?: string }) {
  if (!value || !Number.isFinite(value)) return null;
  const up = value > 0;
  return (
    <span className={`delta ${up ? 'is-up' : 'is-down'}`} title={title}>
      {up ? '▲' : '▼'}{Math.abs(value)}
    </span>
  );
}
