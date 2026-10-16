// '모든 폼 활용 순위' — 한 종의 일반 · 다이맥스 · 거다이맥스 · 메가 폼이 어느 순위표 몇 위인지 한 목록에 (v6 D02)
import { useState } from 'react';
import { useUsage, useDex } from '../../lib/data';
import { placeParts, usagePlacesFor } from '../../lib/usage';
import { Foot, RankList } from './Pieces';
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
  if (!rows.length) return <p className="px-body px-muted">현재 순위표에서 상위 30위에 해당하는 활용처가 없어요.</p>;

  const SHOWN = compact ? 2 : 3;
  // 상위 3위는 진한 글자 — 글자 👑 는 기기마다 다르게 그려진다
  const items = rows.map((row, index) => ({
    key: String(index), rank: row.rank, top: row.rank <= 3,
    where: <>{row.group}{' · '}{row.where}{row.tag ? <span className="px-badge px-skin px-badge--ko px-badge--purple">{row.tag}</span> : null}</>,
  }));
  return (
    <div className="pxd-ranks">
      <RankList items={open ? items : items.slice(0, SHOWN)} />
      {!compact && rows.length > SHOWN ? (
        <button type="button" className="px-btn px-btn--sm px-skin" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '접기' : `모든 폼 펼치기 (${rows.length})`}
        </button>
      ) : null}
      {!compact ? <Foot>각 순위표 상위 30위 기준 · 상위 3위는 진한 글자</Foot> : null}
    </div>
  );
}
