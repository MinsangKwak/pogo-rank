// ─────────────────────────────────────────────────────────────────────────────
// ds/TypeTag.tsx — 포켓몬 타입을 색으로 말하는 두 모양
//
//   TypeDots 이름 옆 작은 색 점들 (순위표 줄) — 자리가 없다
//   TypePill 색 점 + 한글 이름 (도감 줄) — 자리가 있다
//
// 한글 이름은 **실데이터**(`TYPE_KO`)가 준다. 지어내지 않는다 (CLAUDE.md §3).
// 그래서 이름표는 사전을 받아야 그린다 — 못 받았으면 영문 키를 그대로 둔다.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from 'react';

export interface TypeTagProps {
  types: readonly string[];
  /** 영문 키 → 한글 이름. 빌드 데이터의 `TYPE_KO` 를 그대로 넘긴다 */
  names?: Readonly<Record<string, string>>;
}

function ko(type: string, names?: Readonly<Record<string, string>>) {
  return names?.[type] ?? type;
}

/** 이름 옆 색 점 — 알약이 아니라 <i> 점이다 (v3 typeDots 와 같은 마크업) */
export function TypeDots({ types, names }: TypeTagProps) {
  return (
    <span className="row__types">
      {types.map((type) => (
        <i key={type} style={{ ['--c']: `var(--t-${type})` } as CSSProperties} title={ko(type, names)} />
      ))}
    </span>
  );
}

/**
 * 타입 알약 — 색 점 + 이름. 한 타입에 하나씩 세운다.
 *
 * **v3 의 `.dex__type` 을 쓰지 않는다.** 그쪽은 `pages.css` 가 이름을 꺼 두고 도감 격자와
 * 넓은 화면에서만 다시 켜서, 그 밖에서 쓰면 색 점만 남는다. 조각은 놓인 자리를 안 타야 한다.
 * 모양은 도감 격자판 그대로다 (styles/ds.css `.ds-typepill`).
 */
export function TypePill({ types, names }: TypeTagProps) {
  return (
    <>
      {types.map((type) => (
        <span key={type} className="ds-typepill" style={{ ['--c']: `var(--t-${type})` } as CSSProperties}>
          <i aria-hidden="true" />
          <b>{ko(type, names)}</b>
        </span>
      ))}
    </>
  );
}
