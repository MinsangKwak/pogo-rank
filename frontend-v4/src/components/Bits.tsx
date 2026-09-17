// ─────────────────────────────────────────────────────────────────────────────
// components/Bits.tsx — 여러 화면이 함께 쓰는 작은 조각
//
// v3 에서는 sprite.js · type-dots.js · chips.js · seg.js 로 흩어져 있었고
// 전부 전역 함수였다. 여기서는 props 로 받는 컴포넌트다 — 무엇이 필요한지가 서명에 적힌다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDex } from '../lib/data';
import { spriteSrc } from '../lib/sprite';

/** 포켓몬 그림. 없으면 몬스터볼 자리표시 (v3 spritePlaceholder 와 같은 자리) */
export function Sprite({ id, className }: { id: number; className?: string }) {
  const { data } = useDex();
  const [failed, setFailed] = useState(false);
  const src = spriteSrc(id, new Set(data.SPRITE_IDS));
  if (!src || failed) {
    return <span className={`sprite empty${className ? ` ${className}` : ''}`} aria-hidden="true">◓</span>;
  }
  return (
    <img
      className={`sprite${className ? ` ${className}` : ''}`}
      src={src}
      alt=""
      width={64}
      height={64}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** 타입 배지 — 색은 CSS 변수 --t-<타입> 에서 온다 (v3 와 같은 규칙) */
export function TypeDot({ type }: { type: string }) {
  const { data } = useDex();
  return (
    <span className="dex__type" style={{ ['--c' as string]: `var(--t-${type})` }}>
      <i className="dot" aria-hidden="true" />
      <b>{data.TYPE_KO[type] ?? type}</b>
    </span>
  );
}

export interface ChipDef { id: string; label: string }

/** 칩 줄 — 하나만 고른다 */
export function Chips({ items, value, onPick, className = '' }: {
  items: ChipDef[];
  value: string;
  onPick: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`chips ${className}`.trim()}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`chips__item${item.id === value ? ' is-on' : ''}`}
          aria-pressed={item.id === value}
          onClick={() => onPick(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 세그먼트 — 둘·셋 중 하나 */
export function Seg({ items, value, onPick }: { items: ChipDef[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="seg" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className={item.id === value ? 'is-on' : ''}
          onClick={() => onPick(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 화면 아래 각주 */
export function FootNote({ children }: { children: React.ReactNode }) {
  return <p className="detail__foot">{children}</p>;
}
