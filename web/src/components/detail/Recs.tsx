// ─────────────────────────────────────────────────────────────────────────────
// components/detail/Recs.tsx — 추천 후보 줄 (상세 팝업 공통)
//
// '보스로 만났을 때' 가 품고 있던 줄을 꺼냈다 — 맨 위 '상대할 때' 카드(VsCard.tsx)도 같은 줄을 쓴다.
// 누르면 같은 창에서 그 포켓몬으로 바뀐다 (MonDetail switchTo)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
import { useDex } from '../../lib/data';
import { Sprite } from '../Bits';
import { NameNode } from '../Row';
import type { MonRef } from '../../lib/mon';

export default function Recs({ rows, onSwitch }: { rows: readonly MonRef[]; onSwitch: (mon: MonRef) => void }) {
  const { data } = useDex();
  return (
    <div className="detail__recs">
      {rows.map((row, index) => (
        <button key={`${row.sprite}-${index}`} type="button" className="detail__rec" onClick={() => onSwitch(row)}>
          <Sprite id={row.sprite} />
          <span className="detail__rec-name"><NameNode name={row.name} labels={data.FORM_LABELS} /></span>
          <span className="detail__rec-go" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}
