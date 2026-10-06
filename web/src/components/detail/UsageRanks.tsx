import { useState } from 'react';
import { useUsage, useDex } from '../../lib/data';
import { placeParts, usagePlacesFor } from '../../lib/usage';
/**
 * name 의 일반 · 다이맥스 · 거다이맥스 활용처 + megas 로 넘긴 메가 라벨들('메가X' …)의 활용처.
 * 메가는 이름에 접두어가 붙는 별도 줄이라 usagePlacesFor 가 모른다 — 목록 배지(usageCountFor)는 그대로 두고 여기서만 더한다 (Codex, PR #267)
 */
export default function UsageRanks({ name, megas = [], compact = false }: { name: string; megas?: readonly string[]; compact?: boolean }) {
  const { data: usage } = useUsage();
  const { data: dex } = useDex();
  const [open, setOpen] = useState(false);
  const maxTag = { '': '', D: '다이맥스', G: '거다이맥스', M: '맥스 참가' } as const;
  const rows = [
    ...usagePlacesFor(usage.USAGE_PLACES, name).map(({ place, rank, mark }) => ({ ...placeParts(place, dex.TYPE_KO), rank, tag: maxTag[mark] })),
    ...megas.flatMap((label) => (usage.USAGE_PLACES[`${label} ${name}`] ?? [])
      .map(([place, rank]) => ({ ...placeParts(place, dex.TYPE_KO), rank, tag: label }))),
  ].sort((a, b) => a.rank - b.rank);
  if (!rows.length) return <p className="detail__none-text">현재 순위표에서 상위 30위에 해당하는 활용처가 없어요.</p>;

  const SHOWN = compact ? 2 : 3;
  const rowNode = (row: typeof rows[number], index: number) => (
    <div key={index} className={`detail__rank-row${row.rank <= 3 ? ' is-top' : ''}`}>
      <span className="detail__rank-crown" aria-hidden="true">{row.rank <= 3 ? '👑' : ''}</span>
      <span className="detail__rank-where">
        {row.group}{' · '}{row.where}
        {row.tag ? <span className="tag">{row.tag}</span> : null}
      </span>
      <b className="detail__rank-no">{`${row.rank}위`}</b>
    </div>
  );
  return (
    <div className="detail__ranks">
      {rows.slice(0, SHOWN).map(rowNode)}
      <div className="detail__rank-rest" hidden={!open}>{rows.slice(SHOWN).map(rowNode)}</div>
      {!compact && rows.length > SHOWN ? (
        <button className="detail__rank-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '접기' : `전체 순위 펼치기 (${rows.length})`}
        </button>
      ) : null}
      {!compact ? <p className="detail__foot">각 순위표 상위 30위 기준 · 상위 3위는 👑 표시</p> : null}
    </div>
  );
}

