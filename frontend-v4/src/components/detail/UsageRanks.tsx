import { useState } from 'react';
import { useUsage, useDex } from '../../lib/data';
import { usagePlacesFor } from '../../lib/usage';
const LEAGUE_KO: Record<string, string> = { little: '리틀', great: '슈퍼', ultra: '하이퍼', master: '마스터' };
const GROUP_KO: Record<string, string> = { pvp: 'PvP', pve: '레이드', max: '맥스' };
export default function UsageRanks({ name, compact = false }: { name: string; compact?: boolean }) {
  const { data: usage } = useUsage();
  const { data: dex } = useDex();
  const [open, setOpen] = useState(false);
  const rows = usagePlacesFor(usage.USAGE_PLACES, name).map(({ place, rank, mark }) => {
    const [group, key] = place.split(':');
    const where = group === 'pvp' ? `${LEAGUE_KO[key ?? ''] ?? key}리그`
      : key === 'overall' ? '전체' : (dex.TYPE_KO[key ?? ''] ?? key);
    return { group: group ?? '', where: where ?? '', rank, mark };
  }).sort((a, b) => a.rank - b.rank);
  if (!rows.length) return <p className="detail__none-text">현재 순위표에서 상위 30위에 해당하는 활용처가 없어요.</p>;

  const SHOWN = compact ? 2 : 3;
  const rowNode = (row: typeof rows[number], index: number) => (
    <div key={index} className={`detail__rank-row${row.rank <= 3 ? ' is-top' : ''}`}>
      <span className="detail__rank-crown" aria-hidden="true">{row.rank <= 3 ? '👑' : ''}</span>
      <span className="detail__rank-where">
        {GROUP_KO[row.group] ?? row.group}{' · '}{row.where}
        {row.mark ? <span className="tag">{row.mark === 'G' ? '거다이맥스' : '다이맥스'}</span> : null}
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

