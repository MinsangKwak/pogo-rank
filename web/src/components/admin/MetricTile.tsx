// ─────────────────────────────────────────────────────────────────────────────
// components/admin/MetricTile.tsx — 지표 타일 (v6 피그마 A01 · A02). px-metric 판 하나에 이름 · 값 · 원본 주석
//
// `rows` 를 주면 최근 14일 작은 선과 '최근 7일 · 앞 7일 대비' 한 줄이 선다.
// 방문자처럼 날마다 따로 센 사람 수도 7일 합은 뜻이 있다 — "지난주보다 늘었나" 는 그 합의 방향이다.
// 값은 부르는 쪽이 lib/cell.ts 로 글자로 바꿔 준다 — 받기 전 · 실패 · 옛 서버 필드 없음은 0 이 아니라 대시다
// ─────────────────────────────────────────────────────────────────────────────
import { count } from '../../lib/cell';
import { Spark, weekTrend, trendLabel, type DayValue } from '../StatChart';

export default function MetricTile({ label, value, sub, rows, tone }: {
  label: string; value: string; sub?: string; rows?: readonly DayValue[];
  /** 값의 색 — 좋은 수(민트) · 주의(주황) · 빨강. 안 주면 글자색 */
  tone?: 'mint' | 'orange' | 'brand';
}) {
  // 일주일이 안 되는 기간(오늘 하루 등)은 '최근 7일' 이 기간보다 길어 거짓말이 된다 — 추세를 세우지 않는다
  const trend = rows && rows.length >= 7 ? weekTrend(rows) : null;
  const delta = trend ? trendLabel(trend) : null;
  return (
    <div className={`px-metric px-skin px-drop stat-tile${tone ? ` adm-metric--${tone}` : ''}`}>
      <p className="px-metric__label">{label}</p>
      <p className="px-metric__value">{value}</p>
      {sub ? <p className="px-metric__note">{sub}</p> : null}
      {trend && delta ? (
        <span className="stat-tile__trend">
          <Spark rows={rows!} />
          <span className="stat-tile__week px-caption">
            {`최근 7일 ${count(trend.recent)}`}
            {delta.tone !== 'none' ? <em className={`stat-tile__delta is-${delta.tone}`}>{delta.text}</em> : null}
          </span>
        </span>
      ) : null}
    </div>
  );
}
