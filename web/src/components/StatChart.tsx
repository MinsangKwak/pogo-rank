// ─────────────────────────────────────────────────────────────────────────────
// components/StatChart.tsx — 운영 통계의 그래프 둘: 날짜별 기둥 · 순위 표 (2026-09-24)
//
// **한 그래프에 한 숫자.** 방문자와 페이지뷰처럼 크기가 다른 둘을 한 축에 겹치지 않는다 — 두 그래프로 가른다.
// 한 계열이라 범례 상자가 없다 — 제목이 무엇을 그렸는지 말한다.
//
// 기둥은 24px 을 안 넘고 끝만 4px 둥글다(바닥은 각). 기둥 사이는 판 색 2px 틈. 격자는 머리카락 선 하나.
// 값 글자는 기둥 색을 안 입는다 — 글자는 글자 토큰(--fg · --muted), 색은 기둥이 진다.
// 올리거나(포인터) 화살표로 옮기면(키보드) 위 한 줄이 그날 값을 읽어 준다. 표로 보기가 늘 따라온다 —
// 떠 있는 값만으로 숫자를 보게 하지 않는다.
//
// 숫자 → 글자는 lib/cell.ts 를 지난다 (CLAUDE.md §1).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { count, DASH } from '../lib/cell';

export interface DayValue { day: string; value: number }

const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** '2026-09-23' → '9.23 (수)' */
export function dayLabel(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return DASH;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return `${Number(match[2])}.${Number(match[3])} (${WEEK_KO[date.getUTCDay()]})`;
}

/** 축 끝을 깔끔한 수로 — 1 · 2 · 5 × 10ⁿ */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (value <= step * power) return step * power;
  return 10 * power;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  return [ref, width];
}

// 끝 4px 둥글고 바닥은 각진 기둥 — 짧으면 높이만큼만 둥글린다
function columnPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

const HEIGHT = 160;
const PAD = { top: 8, right: 4, bottom: 24, left: 40 };

export function DayColumns({ title, unit, rows, note, summable = true }: {
  title: string;
  /** 읽어 주는 줄의 꼬리 — '명' · '회' */
  unit: string;
  rows: readonly DayValue[];
  note?: string;
  /**
   * 날마다 더해도 뜻이 있는 수인가. 방문자처럼 **날마다 따로 센 사람 수**는 더하면 같은 사람이 여러 번 세어져
   * 기간의 사람 수가 아니다 — 그런 그래프는 합계를 안 적는다 (기간의 사람 수는 위 숫자 칸이 말한다)
   */
  summable?: boolean;
}) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [pick, setPick] = useState<number | null>(null);
  const last = rows.length - 1;
  const at = pick ?? last;
  const top = niceMax(Math.max(0, ...rows.map((row) => row.value)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = rows.length ? plotW / rows.length : 0;
  const barW = Math.max(1, Math.min(24, slot - 2));
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const total = rows.reduce((sum, row) => sum + (Number.isFinite(row.value) ? row.value : 0), 0);

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!slot) return;
    const left = event.currentTarget.getBoundingClientRect().left;
    const index = Math.floor((event.clientX - left - PAD.left) / slot);
    setPick(Math.max(0, Math.min(last, index)));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setPick((now) => Math.max(0, Math.min(last, (now ?? last) + (event.key === 'ArrowLeft' ? -1 : 1))));
  };

  const current = rows[at];
  return (
    <figure className="stat-chart">
      <figcaption className="stat-chart__head">
        <b>{title}</b>
        {summable ? <span className="stat-chart__total">합계 {count(total)}{unit}</span> : null}
      </figcaption>
      {/* 읽어 주는 줄 — 올린 날, 없으면 마지막 날 */}
      <p className="stat-chart__readout" aria-live="polite">
        {current ? <><span>{dayLabel(current.day)}</span> <b>{count(current.value)}{unit}</b></> : DASH}
      </p>
      <div ref={box} className="stat-chart__plot" tabIndex={0} onKeyDown={onKey}
        aria-label={`${title} — 화살표로 날짜를 옮기면 값을 읽어 줍니다`}>
        {width > 0 ? (
          <svg width={width} height={HEIGHT} role="img" aria-hidden="true"
            onPointerMove={onMove} onPointerLeave={() => setPick(null)}>
            {/* 격자 — 0 · 절반 · 끝 */}
            {[0, top / 2, top].map((tick) => (
              <g key={tick}>
                <line className="stat-chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
                <text className="stat-chart__axis" x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end">{count(tick)}</text>
              </g>
            ))}
            {/* 올린 날 — 세로 머리카락 선 */}
            {pick !== null ? (
              <line className="stat-chart__cross" x1={PAD.left + slot * (at + 0.5)} x2={PAD.left + slot * (at + 0.5)}
                y1={PAD.top} y2={PAD.top + plotH} />
            ) : null}
            {rows.map((row, index) => {
              const h = Math.max(0, PAD.top + plotH - y(row.value));
              const x = PAD.left + slot * index + (slot - barW) / 2;
              return (
                <path key={row.day} className={`stat-chart__bar${pick === index ? ' is-on' : ''}`}
                  d={columnPath(x, PAD.top + plotH - h, barW, h)} />
              );
            })}
            {/* 날짜 — 처음과 끝만 (기간이 길면 가운데 글자가 겹친다) */}
            {rows.length ? (
              <>
                <text className="stat-chart__axis" x={PAD.left} y={HEIGHT - 6} textAnchor="start">{dayLabel(rows[0]!.day)}</text>
                <text className="stat-chart__axis" x={width - PAD.right} y={HEIGHT - 6} textAnchor="end">{dayLabel(rows[last]!.day)}</text>
              </>
            ) : null}
          </svg>
        ) : null}
      </div>
      {note ? <p className="stat-chart__note">{note}</p> : null}
      <details className="stat-chart__table">
        <summary>표로 보기</summary>
        <table>
          <thead><tr><th scope="col">날짜</th><th scope="col">{title}</th></tr></thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.day}><td>{dayLabel(row.day)}</td><td>{count(row.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export interface RankRow { key: string; label: string; value: number; sub?: number }

/** 순위 표 — 이름 · 막대 · 횟수 · 사람. 막대는 1위를 끝으로 잰다 */
export function RankTable({ title, rows, valueHead, subHead, empty }: {
  title: string;
  rows: readonly RankRow[];
  valueHead: string;
  subHead?: string;
  empty: string;
}) {
  const top = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="stat-rank">
      <h3 className="stat-rank__title">{title}</h3>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col" className="stat-rank__num">{valueHead}</th>
              {subHead ? <th scope="col" className="stat-rank__num">{subHead}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <span className="stat-rank__name">{row.label}</span>
                  <span className="stat-rank__bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, (row.value / top) * 100)}%` }} />
                  </span>
                </th>
                <td className="stat-rank__num">{count(row.value)}</td>
                {subHead ? <td className="stat-rank__num">{count(row.sub)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="stat-rank__empty">{empty}</p>}
    </section>
  );
}
