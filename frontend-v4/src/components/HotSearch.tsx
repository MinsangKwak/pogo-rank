// ─────────────────────────────────────────────────────────────────────────────
// HotSearch.tsx — 어제 많이 검색된 포켓몬 (v4.5.5)
//
// 세는 말은 **완성어**다. '뮤' 를 치다 뮤츠를 고르면 뮤츠가 한 번 오른다 —
// 토막말은 애초에 보내지 않는다 (lib/track.ts trackSearchPick).
//
// 수는 GA4 에서 하루 두 번(12:00 · 24:00 KST) 걷어 파일로 구워 온다
// (backend/hotsearch_build.py). 그래서 **실시간이 아니고**, 화면도 그렇게 적는다.
//
// 줄이 없으면 구역 자체를 그리지 않는다. 집계 전이거나 GA 가 조용할 수 있고,
// 그때 '0회' 를 세우면 서비스가 비어 보인다 (CLAUDE.md §1 의 '빈 값은 줄을 세우지 않는다').
//
// **모양이 둘이다** (v4.5.11).
//   list    표 전체를 세운다 — 넓은 화면의 홈, 그리고 전체 보기 화면(#/hot)
//   ticker  한 줄이 끝없이 흐른다 — 좁은 화면의 홈. 열 줄을 세우면 홈의 절반을 먹는다
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Sprite } from './Bits';
import { useHotSearchSoft } from '../lib/data';
import { num } from '../lib/cell';
import { readLocalPicks } from '../lib/track';
import { routeHash } from '../routes';
import type { OpenMon } from '../lib/mon';
import type { HotSearchRow } from '../types/data';

// 'YYYY-MM-DDTHH:MM:SS+09:00' → '9월 20일 12시'.
// Date 로 파싱하지 않는 이유 — 값에 +09:00 이 박혀 있어 보는 사람의 시간대로 옮기면
// 집계 시각(한국 기준 12시·24시)이 11시나 13시로 어긋난다. 글자를 그대로 읽는다
export function asOfLabel(iso: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})/.exec(iso);
  if (!parts) return '';
  const [, , month, day, hour] = parts;
  const hourNum = Number(hour);
  // 자정 집계는 '0시' 가 아니라 그 전날의 마감이다 — 읽는 사람에게는 '24시' 가 자연스럽다
  return `${Number(month)}월 ${Number(day)}일 ${hourNum === 0 ? 24 : hourNum}시`;
}

/**
 * 1위를 100% 로 두고 견준 막대 너비(%). 횟수만 적으면 2위가 1위에 얼마나 붙었는지 안 보인다.
 * 꼴찌가 1회여도 6% 는 남긴다 — 막대가 아예 사라지면 줄이 비어 보인다.
 */
export function barWidth(count: number, top: number): number {
  if (!Number.isFinite(count) || !Number.isFinite(top) || top <= 0 || count <= 0) return 0;
  return Math.min(100, Math.max(6, Math.round((count / top) * 100)));
}

/** 표가 어디서 왔는지 — 화면이 딱지·설명·꼬리말을 이 값으로 고른다 */
type Source = 'ga' | 'sample' | 'mine';

/** 표와 출처를 한 번에 — 홈과 전체 보기 화면이 같은 규칙으로 읽게 (v4.5.11) */
export function useHotRows(): { rows: HotSearchRow[]; source: Source; label: string } {
  const hot = useHotSearchSoft();
  // 미리보기에서 이 브라우저에 센 것. 저장소는 렌더 중에 읽으면 어긋나므로 붙은 뒤에 읽는다
  const [mine, setMine] = useState<HotSearchRow[]>([]);
  useEffect(() => { if (hot?.preview) setMine(readLocalPicks()); }, [hot?.preview]);

  // 내가 검색한 것이 있으면 그것을 세운다 — 샘플보다 내 손으로 만든 표가 먼저다
  if (hot?.preview && mine.length) return { rows: mine, source: 'mine', label: '' };
  return {
    rows: hot?.rows ?? [],
    source: hot?.sample ? 'sample' : 'ga',
    label: hot?.asOf ? asOfLabel(hot.asOf) : '',
  };
}

const FLAG: Partial<Record<Source, string>> = { mine: '내 검색 · 이 브라우저', sample: '미리보기 샘플' };
const NOTE: Record<Source, string> = {
  mine: '이 브라우저에서 검색해 연 횟수예요. 밖으로 나가지 않아요',
  sample: '모양을 보려고 채운 표예요. 실제 검색 수가 아니에요',
  ga: '검색해서 열어 본 횟수예요',
};
const FOOT: Record<Source, string> = {
  mine: '미리보기라 이 기기에만 세요. 운영에서는 모두의 검색을 하루 두 번 세요',
  sample: '운영에 올라가면 실제 검색으로 채워져요',
  ga: '하루 두 번(낮 12시 · 자정) 새로 세요',
};

/** 머리줄 — 홈과 전체 보기가 같은 말을 쓴다 */
export function HotHead({ source, label }: { source: Source; label: string }) {
  return (
    <div className="home__section">
      <h3>
        어제 많이 검색된 포켓몬
        {/* 이 수가 어디서 왔는지 화면에서 바로 알 수 있어야 한다 — 진짜 집계로 읽으면 안 된다 */}
        {FLAG[source] ? <span className="hot__flag">{FLAG[source]}</span> : null}
      </h3>
      <span>
        {NOTE[source]}
        {label && source === 'ga' ? <span className="home__date"> · {label} 기준</span> : null}
      </span>
    </div>
  );
}

/** 줄 하나 — 표와 롤링이 같은 조각을 쓴다 */
function HotRow({ row, rank, top, onOpen, bar }:
  { row: HotSearchRow; rank: number; top: number; onOpen: OpenMon; bar: boolean }) {
  return (
    <button className="hot__btn"
      onClick={() => onOpen({ sprite: row.sprite ?? 0, name: row.name, types: [] })}
      disabled={!row.sprite}>
      <span className="hot__rank">{rank}</span>
      {row.sprite ? <span className="hot__portrait"><Sprite id={row.sprite} /></span> : null}
      <span className="hot__name">{row.name}</span>
      {/* 막대는 장식이라 읽는 기계에서 감춘다 — 옆의 횟수가 같은 말을 이미 한다 */}
      {bar ? <span className="hot__bar" aria-hidden="true"><i style={{ width: `${barWidth(row.count, top)}%` }} /></span> : null}
      <span className="hot__count">{num(row.count)}회</span>
    </button>
  );
}

/** 표 — 줄을 다 세운다 */
export function HotList({ rows, onOpen }: { rows: HotSearchRow[]; onOpen: OpenMon }) {
  const top = rows[0]?.count ?? 0;
  return (
    <ol className="hot__list">
      {rows.map((row, index) => (
        <li key={row.name} className="hot__row">
          <HotRow row={row} rank={index + 1} top={top} onOpen={onOpen} bar />
        </li>
      ))}
    </ol>
  );
}

export default function HotSearch({ onOpen }: { onOpen: OpenMon }) {
  const { rows, source, label } = useHotRows();
  if (!rows.length) return null;

  const top = rows[0]?.count ?? 0;
  // 줄을 **두 벌** 깐다 — 한 벌이 다 흐르면 이어붙인 벌이 이미 그 자리에 있어 이음매가 없다.
  // 흐르는 폭이 내용에 달려 있어 줄 수로 시간을 정한다 (한 줄에 3초)
  const loop = [...rows, ...rows];

  return (
    <section className="home__hot" aria-label="어제 많이 검색된 포켓몬">
      <HotHead source={source} label={label} />

      {/* 넓은 화면 — 표 그대로 */}
      <div className="hot__full">
        <HotList rows={rows} onOpen={onOpen} />
        <span className="hot__foot">{FOOT[source]}</span>
      </div>

      {/* 좁은 화면 — 한 줄이 끝없이 흐른다.
          aria-hidden 을 두 번째 벌에만 달아 읽는 기계가 같은 말을 두 번 읽지 않게 한다 */}
      <div className="hot__ticker">
        <div className="hot__track" style={{ animationDuration: `${rows.length * 3}s` }}>
          {loop.map((row, index) => (
            <span key={`${row.name}-${index}`} className="hot__cell"
              aria-hidden={index >= rows.length ? true : undefined}>
              <HotRow row={row} rank={(index % rows.length) + 1} top={top} onOpen={onOpen} bar={false} />
            </span>
          ))}
        </div>
      </div>

      <a className="hot__more" href={routeHash('hot')}>전체 보기 →</a>
    </section>
  );
}
