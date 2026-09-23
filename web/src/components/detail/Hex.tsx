// ─────────────────────────────────────────────────────────────────────────────
// components/detail/Hex.tsx — 능력치 육각형 (v3 detail.js hexNode)
//
// 6축은 시계방향으로 공격 → 방어 → 레이드 → 체력 → CP → PvP.
// 종족값은 320, CP 는 5,500 을 만점으로 본다.
//
// **레이드·PvP 축은 순위가 아니라 점수(0~100)로 그린다** (v3.24.0).
// 순위 기준은 "어느 순위표 30위 안에 드는가" 라, 대짱이처럼 메가·섀도우만 등재된 원종은
// 레이드 축이 미등재로 누웠다 — 실제로는 땅·물 보스에서 A 티어인데.
// 점수는 전 종에 있어 어디서나 같은 자로 잰다.
// ─────────────────────────────────────────────────────────────────────────────
import { useDex, useUsage } from '../../lib/data';
import { cpOf } from '../../lib/cp';
import { usageMeterOf, usagePlacesFor } from '../../lib/usage';
import type { DexForm } from '../../types/data';

const CENTER_X = 150, CENTER_Y = 118, RADIUS = 76;

// 12시 방향(-90°)에서 시작해 축마다 60°씩 시계방향으로 돈다
function pointAt(index: number, ratio: number): [number, number] {
  const angle = -Math.PI / 2 + index * Math.PI / 3;
  return [CENTER_X + Math.cos(angle) * RADIUS * ratio, CENTER_Y + Math.sin(angle) * RADIUS * ratio];
}

const poly = (ratio: number, count: number) =>
  Array.from({ length: count }, (_, index) => pointAt(index, ratio).map((n) => n.toFixed(1)).join(',')).join(' ');

export default function Hex({ form, name, types }: { form: DexForm; name: string; types: readonly string[] }) {
  const { data: dex } = useDex();
  const { data: usage } = useUsage();

  const places = usagePlacesFor(usage.USAGE_PLACES, name);
  // 'pvp' / 'pve' / 'max' 로 시작하는 등재 항목 중 가장 높은(숫자가 작은) 순위
  const bestRank = (prefix: string) => {
    const ranks = places.filter((one) => one.place.startsWith(prefix)).map((one) => one.rank);
    return ranks.length ? Math.min(...ranks) : null;
  };
  const rankScore = (rank: number | null) => (rank == null ? 0.08 : Math.max(0.15, 1 - (rank - 1) / 32));
  // 레이드 축은 레이드(pve)와 맥스(max) 중 더 높은 순위를 쓴다
  const raidRank = bestRank('pve') != null || bestRank('max') != null
    ? Math.min(bestRank('pve') ?? 99, bestRank('max') ?? 99) : null;
  const pvpRank = bestRank('pvp');
  const cpm = dex.DEX_DATA.cpm['l50'];
  const cp = cpm ? cpOf(form, cpm) : null;

  const meter = usageMeterOf(usage.METER, name);
  const meterScore = (value: number) => (value ? Math.max(0.08, value / 100) : 0.08);
  const raidAxis: [string, number] = meter
    ? [meter.pve ? `${meter.pve}점` : '-', meterScore(meter.pve)]
    : [raidRank ? `${raidRank}위` : '-', rankScore(raidRank)];
  const pvpAxis: [string, number] = meter
    ? [meter.pvp ? `${meter.pvp}점` : '-', meterScore(meter.pvp)]
    : [pvpRank ? `${pvpRank}위` : '-', rankScore(pvpRank)];

  const axes: [string, string, number][] = [
    ['공격', String(form.atk), Math.min(1, form.atk / 320)],
    ['방어', String(form.def), Math.min(1, form.def / 320)],
    ['레이드', ...raidAxis],
    ['체력', String(form.hp), Math.min(1, form.hp / 320)],
    ['CP', cp ? cp.toLocaleString() : '-', cp ? Math.min(1, cp / 5500) : 0.08],
    ['PvP', ...pvpAxis],
  ];
  const color = `var(--t-${types[0] ?? 'normal'})`;

  return (
    <div className="hex">
      <svg viewBox="0 0 300 236" className="hex__svg" role="img" aria-label="능력치 육각형">
        <title>
          {meter
            ? '종족값 320 · CP 5,500 기준 비율. 레이드/PvP 는 가성비와 같은 0~100 점수 (레이드 = 가장 잘 통하는 보스 3종 평균, PvP = 리그 상위 2개 평균)'
            : '종족값 320 · CP 5,500 기준 비율. 레이드/PvP는 도감 순위표 최고 순위'}
        </title>
        {[1 / 3, 2 / 3, 1].map((ratio) => (
          <polygon key={ratio} points={poly(ratio, axes.length)} fill="none" stroke="var(--line)"
            strokeWidth={ratio === 1 ? 1.2 : 0.7} />
        ))}
        {axes.map((_, index) => {
          const [x, y] = pointAt(index, 1);
          return <line key={index} x1={CENTER_X} y1={CENTER_Y} x2={x} y2={y} stroke="var(--line)" strokeWidth={0.7} />;
        })}
        <polygon points={axes.map((axis, index) => pointAt(index, axis[2]).map((n) => n.toFixed(1)).join(',')).join(' ')}
          fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {axes.map((axis, index) => {
          const [x, y] = pointAt(index, axis[2]);
          return <circle key={index} cx={x} cy={y} r={3} fill={color} />;
        })}
        {/* 축 라벨은 반지름 1.24 위치 — 좌우에 따라 정렬 기준을 바꿔 글자가 잘리지 않게 한다 */}
        {axes.map((axis, index) => {
          const [x, y] = pointAt(index, 1.24);
          const anchor = Math.abs(x - CENTER_X) < 8 ? 'middle' : x > CENTER_X ? 'start' : 'end';
          return (
            <text key={index} x={x} y={y - 2} textAnchor={anchor} className="hex__label">
              <tspan className="hex__name">{axis[0]}</tspan>
              <tspan x={x} dy={13} className="hex__val">{axis[1]}</tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}
