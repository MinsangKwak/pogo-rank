// ─────────────────────────────────────────────────────────────────────────────
// components/detail/CalcScreen.tsx — CP 계산기 (v3 detail.js detailCpCalc)
//
// 내 개체의 레벨·개체값을 맞추면 지금 CP 와 만렙까지의 여지가 보인다.
// 입력값은 팝업이 들고 있다 — 진화 계열을 눌러 다른 포켓몬으로 갔다 ← 로 돌아와도 그대로여야 한다.
// ─────────────────────────────────────────────────────────────────────────────
import { useDex } from '../../lib/data';
import { calcCp } from '../../lib/cp';
import type { DexForm } from '../../types/data';

const LEVEL_PRESETS = [20, 25, 30, 40, 50];

export interface CalcInputs { level: number; attackIv: number; defenseIv: number; hpIv: number }
export const CALC_DEFAULT: CalcInputs = { level: 30, attackIv: 15, defenseIv: 15, hpIv: 15 };

// 범위를 벗어나면 가장 가까운 눈금으로 되돌린다 (v3 clamp)
const clamp = (value: number, min: number, max: number, step: number) =>
  Math.min(max, Math.max(min, Math.round(value / step) * step));

/** − [숫자] + 한 벌. 숫자 칸에 바로 적어도 된다 */
function Stepper({ value, min, max, step, label, onChange }: {
  value: number; min: number; max: number; step: number; label: string; onChange: (next: number) => void;
}) {
  const set = (next: number) => onChange(clamp(Number.isFinite(next) ? next : value, min, max, step));
  return (
    <div className="detail__calc-stepper">
      <button className="detail__calc-step" aria-label="−" disabled={value <= min} onClick={() => set(value - step)}>−</button>
      <input type="number" className="detail__calc-num" inputMode="decimal" aria-label={label}
        min={min} max={max} step={step} value={value}
        onChange={(event) => set(parseFloat(event.target.value))}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
      <button className="detail__calc-step" aria-label="+" disabled={value >= max} onClick={() => set(value + step)}>+</button>
    </div>
  );
}

export default function CalcScreen({ form, inputs, onChange }: {
  form: DexForm; inputs: CalcInputs; onChange: (next: CalcInputs) => void;
}) {
  const { data } = useDex();
  const cpms = data.DEX_DATA.cpms;
  const set = (patch: Partial<CalcInputs>) => onChange({ ...inputs, ...patch });

  const cp = calcCp(form, cpms, inputs.level, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
  // 같은 개체값으로 Lv50 까지 올렸을 때의 CP — 지금 CP 가 그 몇 %인지 보여 준다
  const maxCp = calcCp(form, cpms, 50, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
  const ivPct = Math.round((inputs.attackIv + inputs.defenseIv + inputs.hpIv) / 45 * 100);

  return (
    <div className="detail__calc-body">
      <div className="detail__card detail__calc-result">
        <h3>예상 CP</h3>
        <div className="detail__calc-big">
          <span className="detail__calc-cp-label">CP</span>
          <b className="detail__calc-cp">{cp.toLocaleString()}</b>
          <span className="meta">입력값 기준 · Lv.{inputs.level}</span>
        </div>
        <div className="detail__calc-row detail__calc-row--max">
          <em>Lv.50 예상 CP</em>
          <b>{maxCp.toLocaleString()} ({Math.round(cp / maxCp * 100)}%)</b>
        </div>
      </div>

      <div className="detail__card">
        <div className="detail__calc-row">
          <h3>포켓몬 레벨</h3>
          <Stepper value={inputs.level} min={1} max={50} step={0.5} label="level"
            onChange={(level) => set({ level })} />
        </div>
        <input type="range" className="detail__calc-range" min={1} max={50} step={0.5} aria-label="레벨"
          value={inputs.level} onChange={(event) => set({ level: parseFloat(event.target.value) })} />
        <div className="detail__calc-presets">
          {LEVEL_PRESETS.map((preset) => (
            <button key={preset} className="detail__calc-preset" data-level={preset}
              aria-pressed={inputs.level === preset} onClick={() => set({ level: preset })}>{preset}</button>
          ))}
        </div>
      </div>

      <div className="detail__card">
        <div className="detail__card-head"><h3>개체값 (IV)</h3><span className="meta">각 0 – 15</span></div>
        {([['공격 IV', 'attackIv'], ['방어 IV', 'defenseIv'], ['체력 IV', 'hpIv']] as const).map(([label, key]) => (
          <div key={key} className="detail__calc-row">
            <em>{label}</em>
            <Stepper value={inputs[key]} min={0} max={15} step={1} label={key}
              onChange={(next) => set({ [key]: next } as Partial<CalcInputs>)} />
          </div>
        ))}
        <p className="detail__calc-iv-sum">
          <b>개체값 {ivPct}%</b> · {inputs.attackIv} / {inputs.defenseIv} / {inputs.hpIv}
        </p>
      </div>

      <p className="detail__foot">내 개체의 레벨·개체값을 맞추면 지금 CP와 만렙까지의 여지가 보여요</p>
    </div>
  );
}
