// ─────────────────────────────────────────────────────────────────────────────
// components/Bits.tsx — 여러 화면이 함께 쓰는 작은 조각
//
// **상태는 클래스가 아니라 `aria-pressed` 로 말한다.** 처음에 `.is-on` 을 붙였는데
// v3 CSS 는 `.chips__item[aria-pressed="true"]` · `.seg button[aria-pressed="true"]` 를 본다 —
// 그래서 고른 칩과 세그먼트가 전혀 눌린 티가 안 났다.
// 접근성 속성이 곧 스타일 훅이라, 하나만 적으면 둘 다 맞는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDex } from '../lib/data';
import { spriteSrc, spriteAnimSrc } from '../lib/sprite';
import { PxIcon, PxLabel } from './PxIcon';

// 움직이는 그림은 원본 크기가 제각각이라 상자에 맞춰 키운다. 2배까지만 — 더 키우면 도트가 뭉갠다
const SPRITE_MAX_ZOOM = 2;

/**
 * 정지본 자리에 움직이는 그림을 **갈아 끼운다**.
 * GIF 를 바로 src 에 넣지 않는 이유 — 받는 동안(54KB) 자리가 비어 화면이 빈 칸으로 열린다.
 * 받기에 실패하면 정지본 그대로 둔다. 움직임을 줄여 달라고 한 사람에게는 아예 갈지 않는다
 * (GIF 는 재생을 멈출 방법이 없다).
 */
function animate(image: HTMLImageElement, url: string) {
  const loader = new Image();
  loader.onload = () => {
    image.src = url;
    image.classList.add('sprite--anim');
    fitZoom(image, Math.max(loader.naturalWidth, loader.naturalHeight));
  };
  loader.src = url;
}

/**
 * 상자 안에서 그림을 키운다 (v3 fitAnimZoom).
 * **잴 때는 우리가 넣은 padding 을 먼저 뺀다** — 크기가 자동인 자리에서는 padding 이 상자를 키워
 * 그림이 끝없이 자라는 되먹임이 된다 (v3.35.1 에 리틀리그 덱에서 겪었다).
 */
function fitZoom(image: HTMLImageElement, natural: number) {
  if (!natural) return;
  const applied = image.style.padding;
  if (applied) image.style.padding = '0px';
  const base = parseFloat(getComputedStyle(image).paddingTop) || 0;
  const box = Math.min(image.clientWidth, image.clientHeight);
  if (!box) { if (applied) image.style.padding = applied; return; }
  const room = Math.max(0, box - base * 2);
  const want = Math.min(natural * SPRITE_MAX_ZOOM, room);
  image.style.padding = `${Math.max(base, Math.round((box - want) / 2))}px`;
  // 줄일 때는 부드럽게, 키울 때는 도트 그대로 — 도트를 줄이면 계단이 진다
  image.style.imageRendering = natural > room ? 'auto' : '';
}

/** 포켓몬 그림. 없으면 몬스터볼 자리표시 (v3 spritePlaceholder 와 같은 자리) */
export function Sprite({ id, className }: { id: number; className?: string }) {
  const { data } = useDex();
  const [failed, setFailed] = useState(false);
  const node = useRef<HTMLImageElement>(null);
  const src = spriteSrc(id, new Set(data.SPRITE_IDS));
  const anim = spriteAnimSrc(id, new Set(data.SPRITE_ANIM_IDS));

  useEffect(() => {
    const image = node.current;
    if (!image || !anim) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    animate(image, anim);
  }, [anim]);

  if (!src || failed) {
    return <span className={`sprite empty${className ? ` ${className}` : ''}`} aria-hidden="true">◓</span>;
  }
  return (
    <img
      ref={node}
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

/** 타입 알약 (도감 줄) — 색 점 + 한글 이름 */
export function TypeDot({ type }: { type: string }) {
  const { data } = useDex();
  return (
    <span className="dex__type" style={{ ['--c' as string]: `var(--t-${type})` }}>
      <i className="dot" aria-hidden="true" />
      <b>{data.TYPE_KO[type] ?? type}</b>
    </span>
  );
}

export interface ChipDef { id: string; label: string; type?: string }

/**
 * 칩 줄 — 하나만 고른다. v3 는 타입 칩 앞에 색 점을 단다
 * (`<span class="dot" style="--c: var(--t-fire)">`). '전체' 칩에는 점이 없다.
 */
export function Chips({ items, value, onPick }: {
  items: ChipDef[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="chips">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="chips__item"
          aria-pressed={item.id === value}
          onClick={() => onPick(item.id)}
        >
          {item.type ? <span className="dot" style={{ ['--c' as string]: `var(--t-${item.type})` }} /> : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 화면 위 세그먼트 — v3 는 #screen-tabs 안의 `.seg.js-screen-tab` 하나다 */
export function ScreenTabs({ items, value, onPick }: { items: ChipDef[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="seg js-screen-tab">
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.id === value} onClick={() => onPick(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 타입 필터 접이식 — #controls 안에 이것 하나가 들어간다 (v3 compactScreenFilters) */
export function FilterBox({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <details className="filter-box" open>
      <summary>타입 필터 · 선택하기</summary>
      {label ? (
        <div className="submenu">
          <span className="submenu__label">{label}</span>
          {children}
        </div>
      ) : children}
    </details>
  );
}

/** 화면 머리 오른쪽의 체크 — v3 label.check-toggle */
export function CheckToggle({ text, checked, onChange, title }: {
  text: string; checked: boolean; onChange: (next: boolean) => void; title?: string;
}) {
  return (
    <label className="check-toggle" title={title}>
      <input type="checkbox" className="check-toggle__box" checked={checked}
        onChange={(event) => onChange(event.target.checked)} />
      <span className="check-toggle__text">{text}</span>
    </label>
  );
}

/**
 * 화면 머리 오른쪽의 도구 버튼 (덱 짜기 · 솔플 계산기 · 개체값 순위).
 * v3 는 <a> 가 아니라 `aria-pressed` 를 든 <button> 이다 — 켠 도구가 그 줄의 제목 노릇을 해서다.
 * 라벨 앞의 이모지는 도트 아이콘으로 갈린다 (PxLabel).
 */
export function ToolBtn({ label, on = false, onClick }: {
  label: string; on?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" className="tool-btn js-head-action" aria-pressed={on} onClick={onClick}>
      <PxLabel label={label} />
    </button>
  );
}

/** 보기 방식 전환 — 지금 무엇인지와 누르면 무엇이 되는지를 둘 다 말한다 (v3 와 같은 문구) */
export function ViewToggle({ view, onToggle, extraClass = 'js-head-action' }: {
  view: 'grid' | 'list'; onToggle: () => void; extraClass?: string;
}) {
  const now = view === 'grid' ? '그리드' : '리스트';
  const next = view === 'grid' ? '리스트' : '그리드';
  return (
    <button className={`icon-btn view-toggle${extraClass ? ` ${extraClass}` : ''}`} aria-live="polite" data-view={view}
      aria-label={`보기 방식: ${now} · 누르면 ${next}`} title={`보기 방식: ${now} · 누르면 ${next}`}
      onClick={onToggle}>
      {/* 아이콘은 **지금 보기**, 글자는 **누르면 될 보기** — v3 layoutToggle 과 같은 짝이다 */}
      <PxIcon emoji={view === 'grid' ? '⊞' : '▤'} />
      <span className="view-toggle__text">{next}로 보기</span>
    </button>
  );
}
