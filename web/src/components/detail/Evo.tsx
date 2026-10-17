// ─────────────────────────────────────────────────────────────────────────────
// components/detail/Evo.tsx — 진화 계열 · 메가 비교 (v3 detail.js evoNode · megaCompareNode · v6 D01)
//
// [1단계] → [2단계] → [3단계] (분기 진화는 한 단계에 여러 마리) → ⚡[메가 폼들].
// 누르면 **같은 창에서** 그 포켓몬으로 바뀐다 — 새 팝업을 열지 않는다 (← 로 돌아올 수 있다).
// 시안의 '사탕 25개' 는 데이터(DEX_DATA.evo)에 사탕 수가 없어 적지 않는다 — 없는 값을 지어내지 않는다 (CLAUDE.md §5)
// ─────────────────────────────────────────────────────────────────────────────
import { useDex } from '../../lib/data';
import { Sprite } from '../Bits';
import { cpOf } from '../../lib/cp';
import { count, num } from '../../lib/cell';
import { Foot } from './Pieces';
import { PokemonNumberRibbon } from '../MonCard';
import { dexNoOf, type MonRef } from '../../lib/mon';

export function Evo({ dex, sprite, onSwitch }: {
  dex: number; sprite: number; onSwitch: (mon: MonRef) => void;
}) {
  const { data } = useDex();
  const family = data.DEX_DATA.evo[String(dex)];
  const megas = data.DEX_DATA.megas[String(dex)] ?? [];
  const hasFamily = !!family && family.length >= 2;
  if (!hasFamily && !megas.length) return <p className="px-body px-muted">진화가 없는 포켓몬이에요.</p>;

  const monOf = (id: number, name: string) => ({ sprite: id, name, en: '', types: data.DEX_DATA.forms[String(id)]?.types ?? [] });

  // 안내 문구는 실제로 있는 것만 ' · ' 로 이어 붙인다.
  // 원시회귀(그란돈·가이오가)를 '메가 진화' 라고 적지 않는다 — 게임에서 다른 것이다 (v3.31.0)
  const labels = megas.filter((one) => one.rel !== false).map((one) => one.label);
  const megaFoot = !labels.length ? '' : labels.every((label) => label === '원시')
    ? '원시회귀 가능 — 누르면 원시회귀 스탯을 볼 수 있어요'
    : labels.includes('원시') ? '메가진화 · 원시회귀 가능 — 누르면 그 폼의 스탯을 볼 수 있어요'
      : '메가진화 가능 — 누르면 메가진화 스탯을 볼 수 있어요';
  const foot = [hasFamily ? '진화형을 선택하면 같은 창에서 해당 포켓몬의 정보를 확인할 수 있어요' : '', megaFoot].filter(Boolean);
  const last = family ? family.length - 1 : 0;
  // 단계 아래 한 줄 — 사탕 수 대신 단계를 적는다
  const stageNote = (index: number) => (index === 0 ? '1단계' : index === last ? '최종 진화' : `${num(index + 1)}단계`);

  return (
    <div className="pxd-evo">
      {hasFamily ? family.map((stage, index) => (
        <div key={index} className="pxd-evo__stage">
          {stage.map((id) => (
            <div key={id} className="pxd-evo__card">
              <PokemonNumberRibbon dex={dexNoOf(id, data.DEX_DATA.dex) ?? undefined} />
              <button type="button" className={`px-skin pxd-evo__mon${id === dex && id === sprite ? ' is-now' : ''}`}
                aria-current={id === dex && id === sprite ? 'true' : undefined}
                aria-label={`${data.DEX_DATA.names[String(id)] ?? id} 상세 보기`}
                onClick={() => onSwitch(monOf(id, data.DEX_DATA.names[String(id)] ?? String(id)))}>
                <span className="px-ball px-ball--sm"><Sprite id={id} /></span>
                <span className="pxd-evo__name">{data.DEX_DATA.names[String(id)] ?? id}</span>
                <span className="px-caption pxd-evo__note">{stageNote(index)}{index < last ? ' →' : ''}</span>
              </button>
            </div>
          ))}
        </div>
      )) : null}
      {megas.length ? (
        <div className="pxd-evo__stage pxd-evo__stage--mega">
          {megas.map((one) => {
            // 미출시 폼은 '미구현' 을 달아 밝힌다 — 지우지는 않는다 (게임마스터에 종족값이 있어 볼 수는 있다)
            const unrel = one.rel === false;
            const name = `${one.label} ${data.DEX_DATA.names[String(dex)] ?? dex}`;
            return (
              <div key={one.sprite} className="pxd-evo__card">
                <PokemonNumberRibbon dex={dex} />
                <button type="button"
                  className={`px-skin pxd-evo__mon${one.sprite === sprite ? ' is-now' : ''}${unrel ? ' is-unreleased' : ''}`}
                  aria-current={one.sprite === sprite ? 'true' : undefined}
                  aria-label={`${name} 상세 보기`}
                  onClick={() => onSwitch(monOf(one.sprite, name))}>
                  <span className="px-ball px-ball--sm"><Sprite id={one.sprite} /></span>
                  <span className="pxd-evo__name">{one.label}</span>
                  <span className="px-caption pxd-evo__note">{unrel ? '미구현' : one.label === '원시' ? '원시회귀' : '메가진화'}</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {foot.length ? <Foot>{foot.join(' · ')}</Foot> : null}
    </div>
  );
}

/**
 * 메가X·메가Y 가 둘 다 있는 종(뮤츠·리자몽 등)만 — 좌우 비교 + 차이 자동 요약.
 * 왼쪽이 메가X, 오른쪽이 메가Y. 각 줄에서 더 높은 쪽이 진하다.
 */
export function MegaCompare({ dex }: { dex: number }) {
  const { data } = useDex();
  const megas = data.DEX_DATA.megas[String(dex)] ?? [];
  const x = megas.find((one) => one.label === '메가X');
  const y = megas.find((one) => one.label === '메가Y');
  const formX = x ? data.DEX_DATA.forms[String(x.sprite)] : undefined;
  const formY = y ? data.DEX_DATA.forms[String(y.sprite)] : undefined;
  if (!formX || !formY) return null;
  const cpm = data.DEX_DATA.cpm['l50'];

  const row = (label: string, a: number, b: number, format: (n: number) => string = num) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      <td className={`is-num${a > b ? ' is-high' : ''}`}>{format(a)}</td>
      <td className={`is-num${b > a ? ' is-high' : ''}`}>{format(b)}</td>
    </tr>
  );
  const typeLine = (types: readonly string[]) => types.map((type) => data.TYPE_KO[type] ?? type).join(' · ');

  const diffs: string[] = [];
  const onlyX = formX.types.filter((type) => !formY.types.includes(type));
  const onlyY = formY.types.filter((type) => !formX.types.includes(type));
  if (onlyX.length || onlyY.length) {
    diffs.push(`타입: 메가X ${formX.types.map((t) => data.TYPE_KO[t]).join('/')} ↔ 메가Y ${formY.types.map((t) => data.TYPE_KO[t]).join('/')}`);
  }
  for (const [label, key] of [['공격', 'atk'], ['방어', 'def'], ['체력', 'hp']] as const) {
    if (formX[key] !== formY[key]) {
      diffs.push(`${label} 종족값 ${formX[key] > formY[key] ? '메가X' : '메가Y'}가 ${num(Math.abs(formX[key] - formY[key]))} 더 높음`);
    }
  }

  return (
    <div className="pxd-cmp">
      <table className="px-table">
        <thead><tr><th scope="col">항목</th><th scope="col" className="is-num">메가X</th><th scope="col" className="is-num">메가Y</th></tr></thead>
        <tbody>
          <tr><th scope="row">타입</th><td className="is-num">{typeLine(formX.types)}</td><td className="is-num">{typeLine(formY.types)}</td></tr>
          {row('공격', formX.atk, formY.atk)}
          {row('방어', formX.def, formY.def)}
          {row('체력', formX.hp, formY.hp)}
          {cpm ? row('CP 만렙', cpOf(formX, cpm), cpOf(formY, cpm), count) : null}
        </tbody>
      </table>
      {diffs.length ? <Foot>{diffs.join(' · ')}</Foot> : null}
    </div>
  );
}
