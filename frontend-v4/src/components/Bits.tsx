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

// ── 움직이는 그림 (v3 components/sprite.js spriteAnimate · fitAnimZoom 이식) ──────
//
// GIF 는 출처가 둘이라 원본 크기가 제각각이다 — 23×19 부터 201×166 까지.
// 상자에 맞추기만 하면 작은 종이 3배 넘게 늘어나 뭉개지므로 **정수배 2배**를 한도로 두고,
// 남는 자리는 padding 으로 비운다 (img 를 직접 줄이면 목록 줄 높이가 그림마다 달라진다).
//
// **한 번 재고 끝내지 않는다.** 상자 크기는 화면마다 다르고(줄 42px · 카드 180px · 상세 72px)
// 보기 전환·글꼴 도착·화면 회전으로 바뀐다. v3 는 ResizeObserver 로 그때마다 다시 맞추는데
// v4 는 GIF 를 갈아 끼울 때 한 번만 재고 있었다 — 그래서 첫 목록에서 한 번 크게 잡히면
// 그 화면을 떠났다 돌아오기 전까지 그대로 컸다 (제보: '맨 처음 리스트 때 이미지가 너무 커').
const SPRITE_MAX_ZOOM = 2;
export const SPRITE_ANIM_KEY = 'pogo_sprite_anim';   // 'off' 면 정지본만 (v3 와 같은 키)

const zoomWatch = typeof ResizeObserver === 'function'
  ? new ResizeObserver((entries) => { for (const entry of entries) fitZoom(entry.target as HTMLImageElement); })
  : null;

/** 움직이는 그림을 쓰는가 — 설정 화면이 정한다. 기본 켬 */
export function spriteAnimEnabled(): boolean {
  try { return localStorage.getItem(SPRITE_ANIM_KEY) !== 'off'; } catch { return true; }
}

// 설정을 body 클래스로도 알린다 — CSS 가 읽는 상태 표식이다 (v3 syncSpriteAnimClass)
document.body?.classList.toggle('sprite-anim-off', !spriteAnimEnabled());

/**
 * 상자 안에서 그림을 키운다.
 * **잴 때는 우리가 넣은 padding 을 먼저 뺀다** — 크기가 자동인 자리에서는 padding 이 상자를 키워
 * 그림이 끝없이 자라는 되먹임이 된다 (v3.35.1 에 리틀리그 덱에서 겪었다).
 */
function fitZoom(image: HTMLImageElement) {
  const natural = Math.max(Number(image.dataset['animW']) || 0, Number(image.dataset['animH']) || 0);
  if (!natural) return;
  // 화면이 원래 주던 여백은 지키고 그 위에 한도를 얹는다 — 인라인 padding 을 한 번 비워 CSS 값을 읽어 둔다
  if (image.dataset['animPad'] === undefined) {
    image.style.padding = '';
    image.dataset['animPad'] = String(parseFloat(getComputedStyle(image).paddingTop) || 0);
  }
  const base = Number(image.dataset['animPad']);
  const applied = image.style.padding;
  if (applied) image.style.padding = '0px';
  const box = Math.min(image.clientWidth, image.clientHeight);
  if (!box) { if (applied) image.style.padding = applied; return; }
  const room = Math.max(0, box - base * 2);
  const want = Math.min(natural * SPRITE_MAX_ZOOM, room);
  const pad = Math.max(base, Math.round((box - want) / 2));
  // Portrait stages share a ground line: put spare vertical room above the sprite.
  // Compact list rows and detail images retain their centered fitting.
  const grounded = image.closest('.dex__portrait') ||
    (image.closest('.row__portrait') && image.closest('.row-list.is-grid'));
  const next = grounded ? `${pad * 2}px ${pad}px 0px` : `${pad}px`;
  // 값이 그대로면 쓰지 않는다 — 쓰면 관찰자가 또 불려 헛돈다
  if (next !== applied) image.style.padding = next;
  else if (applied) image.style.padding = applied;
  // 줄일 때는 부드럽게, 키울 때는 도트 그대로 — 도트를 줄이면 계단이 진다
  image.style.imageRendering = natural > room ? 'auto' : '';
}

/**
 * 정지본 자리에 움직이는 그림을 **갈아 끼운다**.
 * GIF 를 바로 src 에 넣지 않는 이유 — 받는 동안(54KB) 자리가 비어 화면이 빈 칸으로 열린다.
 * 받기에 실패하면 정지본 그대로 둔다. 움직임을 줄여 달라고 한 사람에게는 아예 갈지 않는다
 * (GIF 는 재생을 멈출 방법이 없다).
 */
function animate(image: HTMLImageElement, url: string): () => void {
  const loader = new Image();
  loader.onload = () => {
    image.src = url;
    image.classList.add('sprite--anim');
    image.dataset['animW'] = String(loader.naturalWidth);
    image.dataset['animH'] = String(loader.naturalHeight);
    fitZoom(image);
    zoomWatch?.observe(image, { box: 'border-box' });
  };
  loader.src = url;
  return () => { loader.onload = null; zoomWatch?.unobserve(image); };
}

/**
 * 있는 그림 번호를 **묶음마다 한 번만** Set 으로 만든다.
 * 그림 하나를 그릴 때마다 `new Set(2000개)` 를 짓고 있었다 — 도감 한 화면이 1,000줄이라
 * 200만 번을 헛으로 넣었다. 묶음은 staleTime: Infinity 라 자리(identity)가 안 바뀐다
 */
const idSets = new WeakMap<object, { still: Set<number>; anim: Set<number> }>();
function spriteIdSets(dex: { SPRITE_IDS: readonly number[]; SPRITE_ANIM_IDS: readonly number[] }) {
  let found = idSets.get(dex);
  if (!found) {
    found = { still: new Set(dex.SPRITE_IDS.map(Number)), anim: new Set(dex.SPRITE_ANIM_IDS.map(Number)) };
    idSets.set(dex, found);
  }
  return found;
}

/** 자리표시용 몬스터볼 — currentColor 로 그려 두면 테마 색을 그대로 따라간다 (v3 spritePlaceholder) */
function Ball({ className }: { className?: string }) {
  return (
    <span className={`sprite empty${className ? ` ${className}` : ''}`}>
      <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
        <circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M6 20h9.5M24.5 20H34" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </span>
  );
}

// 받기에 실패했을 때 몇 번까지 다시 받아 보는가 (v3 문서 캡처 리스너와 같은 수·같은 간격).
// 한 번 놓쳤다고 몬스터볼로 바꿔 버리면 잠깐 끊긴 회선이 "이 포켓몬은 그림이 없다" 로 읽힌다
const SPRITE_RETRY = 2;

// Cache the transparent bottom margin of static sprites; leave source assets untouched.
const groundOffsets = new Map<string, number>();
function fitGround(image: HTMLImageElement) {
  if (image.classList.contains('sprite--anim')) {
    image.style.removeProperty('--sprite-ground-offset');
    return;
  }
  const key = image.currentSrc || image.src;
  let offset = groundOffsets.get(key);
  if (offset === undefined) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || !canvas.width || !canvas.height) return;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let bottom = canvas.height;
      outer: for (let y = canvas.height - 1; y >= 0; y--) {
        for (let x = 0; x < canvas.width; x++) {
          if (pixels[(y * canvas.width + x) * 4 + 3]! > 16) { bottom = y + 1; break outer; }
        }
      }
      offset = (canvas.height - bottom) / Math.max(canvas.width, canvas.height) * 100;
      groundOffsets.set(key, offset);
    } catch { return; }
  }
  image.style.setProperty('--sprite-ground-offset', `${offset}%`);
}

/** 포켓몬 그림. 없으면 몬스터볼 자리표시 (v3 sprite() · spritePlaceholder 와 같은 자리) */
export function Sprite({ id, className }: { id: number; className?: string }) {
  const { data } = useDex();
  // 재시도 횟수가 곧 주소다 — 0 이면 원본, 1·2 면 캐시를 비켜 가는 ?r=n
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const node = useRef<HTMLImageElement>(null);
  const sets = spriteIdSets(data);
  const src = spriteSrc(id, sets.still);
  const anim = spriteAnimSrc(id, sets.anim);

  useEffect(() => {
    const image = node.current;
    if (!image || !anim) return;
    if (!spriteAnimEnabled()) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    return animate(image, anim);
  }, [anim]);

  // 번호가 바뀌면 처음부터 — 앞 포켓몬이 실패했다고 다음 포켓몬까지 몬스터볼로 열리면 안 된다
  useEffect(() => { setRetry(0); setFailed(false); setLoading(true); }, [id]);

  if (!src || failed) return <Ball className={className} />;
  // 저장소 배정 번호(90000번대)는 픽셀 스프라이트가 아니라 게임 내 3D 렌더 아이콘이라
  // pixelated 로 축소하면 계단이 진다 — sprite--hd 로 부드럽게 그린다 (v3 v2.7.2)
  const hd = Number(id) >= 90000 ? ' sprite--hd' : '';
  return (
    <img
      ref={node}
      className={`sprite${hd}${loading ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
      src={retry ? `${src}?r=${retry}` : src}
      alt=""
      width={64}
      height={64}
      loading="lazy"
      decoding="async"
      // 다 받으면 뼈대(.is-loading)를 벗긴다 — v3 는 이걸 문서 캡처 리스너로 했다.
      // cloneNode 로 복제한 행에서 리스너가 사라지는 문제 때문이었는데, 여기서는 복제가 없다
      onLoad={(event) => { setLoading(false); fitGround(event.currentTarget); }}
      onError={() => {
        if (retry >= SPRITE_RETRY) { setFailed(true); return; }
        const next = retry + 1;
        setTimeout(() => setRetry(next), 300 * next);
      }}
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

/**
 * 세그먼트 컨트롤 — 붙어 있는 버튼 몇 개로 하나를 고른다 (v3 components/seg.js)
 * `label` 을 주면 묶음으로 읽힌다 — 화면에 제목이 없는 자리(팝업 안)에서 필요하다
 */
export function Seg({ items, value, onPick, className, label }: {
  items: ChipDef[]; value: string; onPick: (id: string) => void; className?: string; label?: string;
}) {
  return (
    <div className={`seg${className ? ` ${className}` : ''}`}
      {...(label ? { role: 'group', 'aria-label': label } : {})}>
      {items.map((item) => (
        <button key={item.id} type="button" aria-pressed={item.id === value} onClick={() => onPick(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 화면 위 세그먼트 — v3 는 #screen-tabs 안의 `.seg.js-screen-tab` 하나다 */
export function ScreenTabs({ items, value, onPick }: { items: ChipDef[]; value: string; onPick: (id: string) => void }) {
  return <Seg items={items} value={value} onPick={onPick} className="js-screen-tab" />;
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
