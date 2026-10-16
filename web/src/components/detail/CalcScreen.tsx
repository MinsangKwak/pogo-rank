// ─────────────────────────────────────────────────────────────────────────────
// components/detail/CalcScreen.tsx — CP 계산기 (v3 detail.js detailCpCalc · v6 D03)
//
// 내 개체의 레벨·개체값을 맞추면 지금 CP 와 만렙까지의 여지가 보인다.
// 입력값은 팝업이 들고 있다 — 진화 계열을 눌러 다른 포켓몬으로 갔다 ← 로 돌아와도 그대로여야 한다.
// 판 둘(현재 예상 CP · Lv.50 예상 CP) → 레벨 스테퍼 + 빠른 칩 → 개체값 스테퍼 셋 → 안내. 바닥 단추(초기화 · 상세로)는 팝업의 바닥이 든다.
// 조각(지표 · 스테퍼 · 판 · 안내)은 Pieces.tsx 의 것이다
// ─────────────────────────────────────────────────────────────────────────────
import { useDex } from '../../lib/data';
import { calcCp } from '../../lib/cp';
import { count, num, percent } from '../../lib/cell';
import { Metric, NoteBox, Sec, Stepper } from './Pieces';
import type { DexForm } from '../../types/data';

const LEVEL_PRESETS = [20, 25, 30, 40, 50];

export interface CalcInputs { level: number; attackIv: number; defenseIv: number; hpIv: number }
export const CALC_DEFAULT: CalcInputs = { level: 30, attackIv: 15, defenseIv: 15, hpIv: 15 };

export default function CalcScreen({ form, inputs, onChange }: {
  form: DexForm; inputs: CalcInputs; onChange: (next: CalcInputs) => void;
}) {
  const { data } = useDex();
  const cpms = data.DEX_DATA.cpms;
  const set = (patch: Partial<CalcInputs>) => onChange({ ...inputs, ...patch });

  const cp = calcCp(form, cpms, inputs.level, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
  // 같은 개체값으로 Lv50 까지 올렸을 때의 CP — 지금 CP 가 그 몇 %인지 보여 준다
  const maxCp = calcCp(form, cpms, 50, inputs.attackIv, inputs.defenseIv, inputs.hpIv);
  const ivPct = percent(inputs.attackIv + inputs.defenseIv + inputs.hpIv, 45);
  const ivLine = `${num(inputs.attackIv)}/${num(inputs.defenseIv)}/${num(inputs.hpIv)}`;

  return (
    <div className="pxd-calc">
      <div className="px-grid px-grid--2 pxd-calc__metrics">
        <Metric  label="현재 예상 CP" value={count(cp)} color="var(--brand-text)"
          note={<span className="px-mono">{`Lv.${num(inputs.level)} · ${ivLine} · ${ivPct}`}</span>} />
        <Metric label="Lv.50 예상 CP" value={count(maxCp)} note={`현재 최대 대비 ${percent(cp, maxCp)}`} />
      </div>

      <Sec title={<>포켓몬 레벨 <span className="px-caption">Lv.1–50 · 0.5 단위</span></>}>
        <Stepper value={inputs.level} min={1} max={50} step={0.5} label="레벨" onChange={(level) => set({ level })} />
        <input type="range" className="pxd-calc__range" min={1} max={50} step={0.5} aria-label="레벨 슬라이더"
          value={inputs.level} onChange={(event) => set({ level: parseFloat(event.target.value) })} />
        <div className="px-chips" role="group" aria-label="자주 쓰는 레벨">
          {LEVEL_PRESETS.map((preset) => (
            <button key={preset} type="button" className="px-chip px-skin" data-level={preset}
              aria-pressed={inputs.level === preset} onClick={() => set({ level: preset })}>{`Lv.${num(preset)}`}</button>
          ))}
        </div>
      </Sec>

      <Sec title={<>개체값 (IV) <span className="px-caption">각 0 – 15</span></>}>
        {([['공격', 'attackIv'], ['방어', 'defenseIv'], ['체력', 'hpIv']] as const).map(([label, key]) => (
          <div key={key} className="pxd-calc__row">
            <span className="px-body pxd-calc__label">{label}</span>
            <Stepper value={inputs[key]} min={0} max={15} step={1} label={`${label} 개체값`}
              onChange={(next) => set({ [key]: next } as Partial<CalcInputs>)} />
          </div>
        ))}
        <p className="px-caption"><b className="px-mono">{`개체값 ${ivPct}`}</b>{` · ${ivLine}`}</p>
      </Sec>

      <NoteBox>입력 값은 돌아와도 유지돼요 — 진화 계열이나 추천 포켓몬으로 옮겨 갔다 ← 로 돌아와도 레벨과 개체값이 그대로예요. 레벨 50의 예상 CP 와 견줘 지금 개체가 얼마나 올라왔는지 볼 수 있어요.</NoteBox>
    </div>
  );
}
