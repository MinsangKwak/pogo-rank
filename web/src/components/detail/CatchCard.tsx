import { Seg } from '../Bits';
import { useDex, useMax } from '../../lib/data';
import { cpOf } from '../../lib/cp';
import type { DexForm } from '../../types/data';
export default function CatchCard({ form, sprite, seg, onSeg }: {
  form: DexForm; sprite: number; seg: string; onSeg: (id: string) => void;
}) {
  const { data } = useDex();
  const { data: max } = useMax();
  const cpm = data.DEX_DATA.cpm;
  const maxKind = max.MAX_POOL[String(sprite)] ?? null;
  const segs: [string, string][] = [...(maxKind ? [['max', '맥스 배틀'] as [string, string]] : []), ['raid', '레이드'], ['wild', '야생']];
  const now = segs.some(([id]) => id === seg) ? seg : segs[0]![0];
  const maxLabel = maxKind === 'G' ? '거다이맥스·다이맥스' : '다이맥스';

  // 한 줄 = 조건(레벨·부스트) + 100% CP + 최저 CP(개체값 하한이 있는 경로만)
  const row = (label: string, sub: string, cpmKey: string, floorIv: number | null) => {
    const m = cpm[cpmKey];
    if (!m) return null;
    return (
      <div key={label} className="detail__catch-row">
        <div className="detail__catch-cond"><em>{label}</em>{sub ? <span className="meta">{sub}</span> : null}</div>
        <div className="detail__catch-val">
          <span className="meta">100% 기준</span>
          <b>{cpOf(form, m).toLocaleString()}</b>
          {floorIv != null
            ? <span className="detail__catch-floor">최저 {Math.max(10, Math.floor((form.atk + floorIv) * Math.sqrt(form.def + floorIv) * Math.sqrt(form.hp + floorIv) * m * m / 10)).toLocaleString()}</span>
            : <span className="meta">개체값 하한 없음</span>}
        </div>
      </div>
    );
  };
  const panes: Record<string, () => (React.ReactNode | null)[]> = {
    max: () => [row('Lv.20', `날씨 부스트 없음 · ${maxLabel}`, 'l20', 10)],
    raid: () => [row('평시 Lv.20', '개체값 10 이상', 'l20', 10), row('날씨 부스트 Lv.25', '개체값 10 이상', 'l25', 10)],
    wild: () => [row('평시 Lv.30', '', 'l30', null), row('날씨 부스트 Lv.35', '', 'l35', null)],
  };

  return (
    <details className="detail__card detail__catch">
      <summary>포획 CP 확인</summary>
      <Seg className="detail__catch-seg" label="포획 경로" value={now} onPick={onSeg}
        items={segs.map(([id, label]) => ({ id, label }))} />
      <div className="detail__catch-body">{panes[now]?.()}</div>
      <details className="detail__acc detail__acc--catch">
        <summary>조건과 계산 기준 보기</summary>
        <div className="detail__acc-body">
          <p className="detail__foot">굵은 숫자는 표시된 레벨에서 개체값이 100%(15/15/15)일 때의 CP예요. 특히 야생 포켓몬은 레벨이 다를 수 있으므로 CP만으로 개체값을 확정할 수 없어요.</p>
          <p className="detail__foot">레이드 보상의 공격·방어·체력 개체값은 각각 10 이상이므로 최저 CP를 함께 표시해요. 야생 포켓몬은 최저 CP를 표시하지 않아요.</p>
          {maxKind ? <p className="detail__foot">맥스 배틀 포획은 날씨 부스트 없이 레벨 20을 기준으로 하므로 일반 레이드 보상과 CP가 같아요.</p> : null}
        </div>
      </details>
    </details>
  );
}

