// ─────────────────────────────────────────────────────────────────────────────
// components/detail/Recs.tsx — 추천 후보 줄 (상세 팝업 공통)
//
// '보스로 만났을 때' 가 품고 있던 줄을 꺼냈다 — 맨 위 '상대할 때' 카드(VsCard.tsx)도 같은 줄을 쓴다.
// 누르면 같은 창에서 그 포켓몬으로 바뀐다 (MonDetail switchTo). v6 는 가라앉은 판 한 줄 — 몬스터볼 틀 · 이름 · 화살표
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useDex } from '../../lib/data';
import { Sprite } from '../Bits';
import { NameNode } from '../Row';
import { PixelIcon } from '../PixelIcon';
import { PokemonNumberRibbon } from '../MonCard';
import { dexNoOf, type MonRef } from '../../lib/mon';

export default function Recs({ rows, onSwitch }: { rows: readonly MonRef[]; onSwitch: (mon: MonRef) => void }) {
  const { data } = useDex();
  return (
    <ul className="pxd-recs">
      {rows.map((row, index) => (
        <li key={`${row.sprite}-${index}`} className="pxd-rec__wrap">
          <PokemonNumberRibbon dex={dexNoOf(row.sprite, data.DEX_DATA.dex) ?? undefined} />
          <button type="button" className="px-card px-card--tap px-skin px-skin--sunk pxd-rec" onClick={() => onSwitch(row)} aria-label={`${row.name} 상세 보기`}>
            <span className="px-ball px-ball--sm pxd-rec__art"><Sprite id={row.sprite} /></span>
            <span className="pxd-rec__name"><NameNode name={row.name} labels={data.FORM_LABELS} /></span>
            <PixelIcon name="arrow" className="pxd-rec__go" />
          </button>
        </li>
      ))}
    </ul>
  );
}
