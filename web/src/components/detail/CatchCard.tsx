// ─────────────────────────────────────────────────────────────────────────────
// components/detail/CatchCard.tsx — '포획 CP 확인' (v6 D01)
//
// 맥스 배틀 · 레이드 · 야생 경로마다 잡았을 때의 CP 범위 — 개체값 하한이 있는 경로(레이드 · 맥스 10/10/10)는 최저~100%,
// 야생은 하한이 없어 100% 값 하나만. 경로 탭은 팝업이 들고 있다(seg) — 다른 포켓몬으로 갔다 돌아와도 보던 탭이다
// ─────────────────────────────────────────────────────────────────────────────
import { useDex, useMax } from '../../lib/data';
import { cpOf } from '../../lib/cp';
import { count } from '../../lib/cell';
import { PxTabs } from '../Bits';
import { Sec } from './Pieces';
import type { DexForm } from '../../types/data';

export default function CatchCard({ form, sprite, seg, onSeg }: {
  form: DexForm; sprite: number; seg: string; onSeg: (id: string) => void;
}) {
  const { data } = useDex();
  const { data: max } = useMax();
  const cpm = data.DEX_DATA.cpm;
  // 'M'(다이맥스 없이 참가 — 검왕 자시안 등)은 레이드에서 잡는 종이라 맥스 배틀 포획 경로를 세우지 않는다 (2026-10-06)
  const pool = max.MAX_POOL[String(sprite)] ?? null;
  const maxKind = pool === 'G' || pool === 'D' ? pool : null;
  const segs: [string, string][] = [...(maxKind ? [['max', '맥스 배틀'] as [string, string]] : []), ['raid', '레이드'], ['wild', '야생']];
  const now = segs.some(([id]) => id === seg) ? seg : segs[0]![0];
  const maxLabel = maxKind === 'G' ? '거다이맥스·다이맥스' : '다이맥스';

  // 한 줄 = 조건(레벨 · 부스트) + CP 범위 (개체값 하한이 있는 경로는 최저 – 100%, 없으면 100% 하나)
  const row = (label: string, sub: string, cpmKey: string, floorIv: number | null, boost: boolean) => {
    const m = cpm[cpmKey];
    if (!m) return null;
    const top = cpOf(form, m);
    const floor = floorIv != null
      ? Math.max(10, Math.floor((form.atk + floorIv) * Math.sqrt(form.def + floorIv) * Math.sqrt(form.hp + floorIv) * m * m / 10))
      : null;
    return (
      <div key={label} className="pxd-catch__row">
        <span className={`px-mono pxd-catch__lv${boost ? ' is-boost' : ''}`}>{boost ? '☀ ' : ''}{label}</span>
        <b className="px-mono pxd-catch__cp">{floor != null ? `${count(floor)} – ${count(top)}` : count(top)}</b>
        <span className="px-caption">{sub}</span>
      </div>
    );
  };
  const panes: Record<string, () => (React.ReactNode | null)[]> = {
    max: () => [row('Lv.20', `날씨 부스트 없음 · ${maxLabel} · 개체값 10 이상`, 'l20', 10, false)],
    raid: () => [row('Lv.20', '평시 · 개체값 10 이상', 'l20', 10, false), row('Lv.25', '날씨 부스트 · 개체값 10 이상', 'l25', 10, true)],
    wild: () => [row('Lv.30', '평시 · 100% 기준', 'l30', null, false), row('Lv.35', '날씨 부스트 · 100% 기준', 'l35', null, true)],
  };

  return (
    <Sec  title="포획 CP 확인">
      <PxTabs label="포획 경로" items={segs.map(([id, label]) => ({ id, label }))} value={now} onPick={onSeg} />
      <div className="pxd-catch">{panes[now]?.()}</div>
      <p className="px-caption">{now === 'wild' ? '100%(15/15/15) 기준 · 날씨 부스트 시 Lv.35' : '개체값 10/10/10 – 15/15/15 기준' + (now === 'raid' ? ' · 날씨 부스트 시 Lv.25' : '')}</p>
      <details className="pxd-more">
        <summary className="px-caption">조건과 계산 기준 보기</summary>
        <div className="pxd-more__body">
          <p className="px-caption">굵은 숫자는 표시된 레벨에서 개체값이 100%(15/15/15)일 때의 CP예요. 특히 야생 포켓몬은 레벨이 다를 수 있으므로 CP만으로 개체값을 확정할 수 없어요.</p>
          <p className="px-caption">레이드 보상의 공격·방어·체력 개체값은 각각 10 이상이므로 최저 CP를 함께 표시해요. 야생 포켓몬은 최저 CP를 표시하지 않아요.</p>
          {maxKind ? <p className="px-caption">맥스 배틀 포획은 날씨 부스트 없이 레벨 20을 기준으로 하므로 일반 레이드 보상과 CP가 같아요.</p> : null}
        </div>
      </details>
    </Sec>
  );
}
