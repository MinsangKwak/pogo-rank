// ─────────────────────────────────────────────────────────────────────────────
// components/Row.tsx — 순위표 한 줄 (v3 components/row.js 이식)
//
// **처음에 클래스명을 지어냈다가 스타일이 통째로 안 먹었다.** (제보 스크린샷: D-MAX 줄이
// 세로로 쪼개져 "티어 / S점 / 수 / 248,180" 처럼 흘렀다.)
// `.list > .row > .row__main` 같은 이름을 짐작으로 썼는데, v3 의 실제 계약은 이렇다 —
//
//   <ul class="row-list is-list">
//     <li class="row">
//       <span class="row__rank">1</span>
//       <img class="sprite">
//       <div class="row__main">                ← **div** 이어야 한다 (span 이면 flex 자식이 안 선다)
//         <div class="row__badges">…</div>      ← 없으면 줄 자체를 만들지 않는다
//         <div class="row__name"><b>이름</b><span class="row__types"><i/></span></div>
//         <div class="row__moves"><span>스피드</span><span>차지</span></div>
//       </div>
//       <div class="row__stats"><span class="row__score">100%</span><span class="row__sub">…</span></div>
//     </li>
//   </ul>
//
// 배운 것 — **클래스명만 맞추는 것으로는 부족하고 태그와 중첩까지 같아야 한다.**
// CSS 가 `.row__main > .row__name` 처럼 자식 선택자와 flex 레이아웃에 기대고 있어서다.
// 그래서 이 파일은 짐작하지 않는다: v3 의 실제 DOM 을 브라우저에서 떠서 그대로 옮겼다.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactNode } from 'react';
import { useDex, useUsage, useMeta } from '../lib/data';
import { Sprite } from './Bits';
import { usageCountFor } from '../lib/usage';

/** v3 name.js FORM_LABELS — 이름 앞에 붙는 폼 라벨을 작은 배지로 뗀다 */
const FORM_KIND: Record<string, string> = {
  메가: 'mega', 메가X: 'mega', 메가Y: 'mega', 원시: 'mega',
  다이맥스: 'max', 거다이맥스: 'max', 섀도우: 'shadow',
};

/** 이름을 [라벨 배지…] + <b>종 이름</b> 으로 가른다 (v3 nameNode 와 같은 규칙) */
export function NameNode({ name, en, labels }: { name: string; en?: string; labels: readonly string[] }) {
  const found: string[] = [];
  let base = name;
  // 긴 라벨부터 맞춰 본다 — '거다이맥스' 가 '다이맥스' 보다 먼저 와야 한다 (빌드가 그 순서로 준다)
  let matched = true;
  while (matched) {
    matched = false;
    for (const label of labels) {
      if (base.startsWith(`${label} `)) {
        found.push(label);
        base = base.slice(label.length + 1);
        matched = true;
        break;
      }
    }
  }
  return (
    <>
      {found.map((label) => (
        <span key={label} className={`form-tag${FORM_KIND[label] ? ` form-tag--${FORM_KIND[label]}` : ''}`}>{label}</span>
      ))}
      <b title={en}>{base}</b>
    </>
  );
}

/** 이름 옆 작은 색 점 — v3 typeDots 와 같은 마크업 (알약이 아니라 <i> 점이다) */
export function TypeDots({ types }: { types: readonly string[] }) {
  const { data } = useDex();
  return (
    <span className="row__types">
      {types.map((type) => (
        <i key={type} style={{ ['--c' as string]: `var(--t-${type})` }} title={data.TYPE_KO[type] ?? type} />
      ))}
    </span>
  );
}

export interface RowProps {
  sprite: number;
  name: string;
  en?: string;
  types: readonly string[];
  rank: string;
  score: ReactNode;
  sub?: ReactNode;
  /** 이름 아래 보조줄. 비면 줄을 만들지 않는다 */
  lines?: (string | null | undefined)[];
  /** 보조줄에 덧붙일 클래스 — 덱 짜기의 카운터 이유 줄이 `.row__counter` 로 넓게 선다 (v3 와 같다) */
  linesClass?: string;
  /** 아직 게임에 안 나온 줄 — 지우지 않고 흐리게 남긴다 (v3.36.0 의 판단) */
  unrel?: boolean;
  /** 가상 순위에서 밀린 줄의 [지금 N위] — 실제 순위(미구현을 뺀 값) (v3 maxRank 의 tag) */
  nowRank?: number;
  /** 지난 갱신 대비 순위 변동 (양수 상승 · 음수 하락) */
  delta?: number;
  onOpen?: () => void;
}

/**
 * 순위 변동 ▲▼ — 갱신일로부터 RANK_FRESH_DAYS 안에서만 보인다 (v3 rankDeltaBadge).
 * 기한을 두는 이유 — 2주 전 변동을 계속 달아 두면 "지금 움직였다" 로 읽힌다.
 */
function DeltaBadge({ delta }: { delta?: number }) {
  const { data: meta } = useMeta();
  if (!delta || !meta.RANK_DELTA_DATE) return null;
  const since = Math.floor((Date.now() - Date.parse(meta.RANK_DELTA_DATE)) / 86400000);
  if (since < 0 || since > (meta.RANK_FRESH_DAYS ?? 14)) return null;
  const up = delta > 0;
  return (
    <span className={`delta ${up ? 'is-up' : 'is-down'}`}
      title={`${meta.RANK_DELTA_DATE} 갱신에서 ${Math.abs(delta)}계단 ${up ? '상승' : '하락'}`}>
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
}

export function Row({ sprite, name, en, types, rank, score, sub, lines, linesClass, unrel, nowRank, delta, onOpen }: RowProps) {
  const { data } = useDex();
  // 2026-09-17 '활용 N곳' — 이 종이 상위 30위에 드는 순위표 수 (v3 usageBadge).
  //   어느 탭에서 보든 같은 칩이라 "여기서만 좋은가, 다재다능인가" 가 바로 보인다.
  //   1곳뿐이면 안 붙인다 — 모든 줄에 붙으면 뜻이 없다
  const count = useUsageCount(name);
  const parts = (lines ?? []).filter(Boolean) as string[];
  const badges = unrel || nowRank != null || count >= 2;
  return (
    <li
      className={`row${unrel ? ' is-unreleased' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`${name} 상세 보기`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen?.();
      }}
    >
      <span className="row__rank">{rank}<DeltaBadge delta={delta} /></span>
      <span className="row__portrait"><Sprite id={sprite} /></span>
      <div className="row__main">
        {badges ? (
          <div className="row__badges">
            {unrel ? <span className="tag dex__unrel">미구현</span> : null}
            {/* 가정으로 매긴 번호 옆에 **오늘의 자리**를 같이 둔다 — 무엇이 바뀌었는지가 줄에서 바로 읽힌다 */}
            {nowRank != null ? (
              <span className="tag tag--now"
                title={`미구현이 없으면 ${nowRank}위 — 이 표는 미구현이 나왔다고 가정한 순위예요`}>{`지금 ${nowRank}위`}</span>
            ) : null}
            {count >= 2 ? (
              <span className={`tag tag--use${count >= 5 ? ' tag--many' : ''}`}
                title="이 포켓몬이 상위 30위에 드는 순위표 수 (PvE 19표 · PvP 4리그 · D-MAX 19표)">{`활용 ${count}곳`}</span>
            ) : null}
          </div>
        ) : null}
        <div className="row__name">
          <NameNode name={name} en={en} labels={data.FORM_LABELS} />
          <TypeDots types={types} />
        </div>
        {parts.length ? <div className={`row__moves${linesClass ? ` ${linesClass}` : ''}`}>{parts.map((text, i) => <span key={i}>{text}</span>)}</div> : null}
      </div>
      <div className="row__stats">
        <span className="row__score">{score}</span>
        {sub ? <span className="row__sub">{sub}</span> : null}
      </div>
    </li>
  );
}

/** 이름 → 활용처 수. 세는 규칙은 상세 팝업의 활용 순위와 한 곳에 모아 뒀다 (lib/usage.ts) */
function useUsageCount(name: string): number {
  const { data } = useUsage();
  return usageCountFor(data.USAGE_PLACES, name);
}

/** 목록 상자 — v3 는 <ul class="row-list is-list"> 다 (is-grid 면 카드) */
/**
 * 순위 목록. **두 클래스 중 하나가 반드시 붙는다** (v3.9.1 의 규칙) —
 * 전에는 is-list 만 켜고 껐더니 "그리드" 가 클래스 없는 상태라, CSS 가 그것을 "기본" 과 구별하지 못했다.
 */
export function RowList({ view = 'list', children }: { view?: 'grid' | 'list'; children: ReactNode }) {
  return <ul className={`row-list is-${view}`}>{children}</ul>;
}

/** 한 번에 보이는 줄 수 — v3 data.js SHOW */
export const ROW_SHOW = 10;

/**
 * 펼침 상태. v3 는 `expanded` 라는 전역 Set 에 `pvp-great-all` 같은 키를 담았다 —
 * 리그나 속성을 바꾸면 키가 달라져 저절로 접힌다. 그 규칙을 그대로 쓴다.
 */
export function useExpanded() {
  const [open, setOpen] = useState<string | null>(null);
  return { isOpen: (key: string) => open === key, toggle: (key: string) => setOpen((now) => (now === key ? null : key)) };
}

/** 목록 꼬리의 [더보기 · N개] — **ul 안**에 선다 (v3 list.js). 밖에 두면 목록 테두리가 끊긴다 */
export function RowMore({ total, expanded, onToggle }: { total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= ROW_SHOW) return null;
  return (
    <button className="row__more" onClick={onToggle}>
      {expanded ? '접기' : `더보기 · ${total - ROW_SHOW}개`}
    </button>
  );
}

// v3 views/tier.js 의 티어 묶음 머리. 등급 글자 하나만으로는 "S 가 위인지 아래인지" 를
// 처음 보는 사람이 모른다 — 이름과 한 줄 설명을 같이 단다 (v2.43.0 의 판단)
export const TIER_ORDER = ['S', 'A', 'B', 'C'] as const;
const TIER_DESC: Record<string, string> = {
  S: '현재 평가 기준에서 가장 높은 등급의 포켓몬이에요.',
  A: '뛰어난 성능을 가진 상위권 포켓몬이에요.',
  B: '배틀 조건과 역할에 따라 활용할 수 있는 포켓몬이에요.',
  C: '현재 평가 기준에서는 다른 후보를 먼저 비교해 보세요.',
};

export function TierHead({ tier, count }: { tier: string; count: number }) {
  return (
    <div className="tier__head">
      <b className={`tier__badge tier__badge--${tier.toLowerCase()}`}>{tier}</b>
      {/* **한 줄은 한 노드로 둔다.** `{tier} 티어` 라고 적으면 React 가 텍스트 노드를 둘로 쪼개고,
          사전은 줄 단위로 찾으므로 ' 티어' 만 남아 못 옮긴다 (v3 는 한 문자열이었다) */}
      <span className="tier__name">{`${tier} 티어`}</span>
      <span className="meta">{`${count}종`}</span>
      <span className="tier__desc">{TIER_DESC[tier] ?? ''}</span>
    </div>
  );
}

/**
 * 목록 머리 — 제목 + 오른쪽 메타 한 줄.
 * **ⓘ 가 있을 때만 제목을 감싼다** — v3 는 감쌀 것이 없으면 `<h2>` 를 맨 앞에 그냥 둔다.
 * 늘 감쌌더니 ⓘ 없는 화면(PvE·PvP)의 머리 높이가 v3 보다 5px 컸다.
 */
export function RowHead({ title, meta, info, hypo }: { title: string; meta: string; info?: string; hypo?: boolean }) {
  // 이 표 전체가 가정이라는 것을 한 눈에 (v3 maxHypoBadge). 켜져 있을 때만 붙는다
  const badge = hypo
    ? <span className="tag tag--hypo" title="미출시 포켓몬을 포함한 가상 순위예요. [미구현]을 끄면 출시된 포켓몬 기준으로 볼 수 있어요">가상 순위</span>
    : null;
  return (
    <div className="row-head">
      {info
        ? (
          <div className="row-head__title">
            <h2>{title}{badge}</h2>
            <span className="info-dot" tabIndex={0} role="button" aria-expanded={false} title={info}>ⓘ</span>
          </div>
        )
        : <h2>{title}{badge}</h2>}
      <span className="meta">{meta}</span>
    </div>
  );
}
