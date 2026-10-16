// ─────────────────────────────────────────────────────────────────────────────
// screens/Changes.tsx — ⚔️ 기술 변경 (v3 components/changes.js renderMoveChangesPage · 2026-10-16 v6 픽셀 시안 03)
//
// 이 화면은 **예고**만 다룬다. 계산으로 알 수 없어 사람이 적은 목록을 그대로 보여 준다.
// 적용된 뒤의 결과(순위가 몇 계단 움직였는가)는 순위표 줄의 ▲▼ 가 말한다 —
// 그래서 '상향 예정' 같은 예측 표시는 만들지 않는다: 적용 전에는 사실(위력 변경)만,
// 적용 후에는 실제 변동만.
//
// **위력은 트레이너 배틀 기준이다.** 같은 기술이라도 레이드·체육관용 위력은 따로 관리되고
// 시즌 조정은 대부분 PvP 만 바꾼다 — 이걸 안 적으면 "위력이 올랐는데 왜 레이드 순위가 그대로냐" 가 된다.
//
// v6 배치: 시즌 · D-day 머리 → 안내 판("발표일과 적용일을 구분해 확인하세요") → 필터 칩(전체 · 상향 · 하향 · 에너지 조정 · 신규 기술)
// → 그룹 판(↑ 상향 / ↓ 하향 / · 에너지 조정 / + 신규 기술) 안에 줄(배지 · 기술명 · "위력 70 → 85" · 관련 포켓몬 보기).
// '관련 포켓몬 보기' 는 MOVE_CHANGES.affected 에 그 기술이 걸린 종이 있을 때만 선다 — 없는 연결을 단추로 만들지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState, type ReactNode } from 'react';
import { useDex, useGameday } from '../lib/data';
import { PxChips, Sprite } from '../components/Bits';
import { NwBadge, NwEmpty, NwFoot, NwMetric, NwNote, NwNoteBody, NwSecHead, type BadgeTone } from '../components/NewsBits';
import { moveChangeDaysLeft } from '../lib/changes';
import { num } from '../lib/cell';
import type { MoveChange } from '../types/data';
import type { OpenMon } from '../lib/mon';

type Filter = 'all' | 'up' | 'down' | 'energy' | 'new';
// 관련 포켓몬 칩은 한 번에 이만큼만 — 할퀴기는 수백 종이 배운다
const REL_MAX = 24;
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: '전체' }, { id: 'up', label: '상향' }, { id: 'down', label: '하향' }, { id: 'energy', label: '에너지 조정' }, { id: 'new', label: '신규 기술' }];

/** 종류별 그룹 머리 — 기호 · 제목 · 한 마디. 배지 색은 상향 민트 · 하향 주황 · 에너지 흐림 · 신규 파랑 */
const GROUP: Record<MoveChange['kind'] | 'new', { mark: string; title: string; note: string; tone: BadgeTone; badge: string }> = {
  up: { mark: '↑', title: '상향', note: '변경 전후 비교', tone: 'mint', badge: '상향' },
  down: { mark: '↓', title: '하향', note: '변경 전후 비교', tone: 'orange', badge: '하향' },
  energy: { mark: '·', title: '에너지 조정', note: '위력은 그대로라 레이드 DPS는 거의 그대로지만, PvP에서는 기술을 쓰는 빈도가 달라져요.', tone: 'muted', badge: '에너지' },
  new: { mark: '+', title: '신규 기술', note: '누르면 그 포켓몬의 상세 정보가 열려요.', tone: 'blue', badge: '신규' },
};

/** 관련 포켓몬 한 마리 — 그림 · 이름. 누르면 요약 팝업 */
function Related({ sprite, onOpen }: { sprite: number; onOpen: OpenMon }) {
  const { data: dex } = useDex();
  const no = dex.DEX_DATA.dex[String(sprite)];
  const name = (no !== undefined ? dex.DEX_DATA.names[String(no)] : undefined) ?? '';
  if (!name) return null;
  return (
    <button type="button" className="px-chip px-skin nw-rel" onClick={() => onOpen({ sprite, name, types: dex.DEX_DATA.forms[String(sprite)]?.types ?? [] })}>
      <Sprite id={sprite} /><span>{name}</span>
    </button>
  );
}

/** 변경 기술 한 줄 — 배지 · "아이언헤드" · "위력 70 → 85" · 메모 · 관련 포켓몬 보기 */
function Row({ move, related, onOpen }: { move: MoveChange; related: number[]; onOpen: OpenMon }) {
  const [openRel, setOpenRel] = useState(false);
  const group = GROUP[move.kind];
  const amount = move.kind === 'energy' ? null : { from: num(move.from), to: num(move.to) };
  return (
    <li className={`nw-move is-${move.kind}`}>
      <div className="nw-move__line">
        <NwBadge text={group.badge} tone={group.tone} />
        <b className="px-sub nw-move__name">{move.ko}</b>
        {amount ? (
          <span className="nw-move__amount" aria-label={`위력 ${amount.from}에서 ${amount.to}로 변경`}>
            <span className="nw-move__amount-label">위력</span>
            <span className="px-mono nw-move__from">{amount.from}</span>
            <span className="nw-move__arrow" aria-hidden="true">→</span>
            <span className="px-mono nw-move__to">{amount.to}</span>
          </span>
        ) : <span className="nw-move__amount nw-move__amount--energy">에너지 조정</span>}
        {move.note ? <em className="px-caption nw-move__note">{move.note}</em> : null}
        {related.length ? (
          <button type="button" className="px-btn px-skin px-btn--sm nw-move__rel" aria-expanded={openRel} onClick={() => setOpenRel((on) => !on)}>
            {`관련 포켓몬 보기 (${related.length})`}
          </button>
        ) : null}
      </div>
      {/* 할퀴기처럼 수백 종이 배우는 기술은 다 펼치지 않는다 — 앞 REL_MAX 마리만 칩으로, 나머지는 수로 */}
      {openRel && related.length ? (
        <div className="px-chips nw-move__rels">
          {related.slice(0, REL_MAX).map((sprite) => <Related key={sprite} sprite={sprite} onOpen={onOpen} />)}
          {related.length > REL_MAX ? <span className="px-caption nw-move__relmore">{`외 ${related.length - REL_MAX}종`}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

/** 그룹 판 — "↑ 상향  변경 전후 비교" 머리 + 줄 목록 */
function Group({ kind, count, children }: { kind: MoveChange['kind'] | 'new'; count: number; children: ReactNode }) {
  const group = GROUP[kind];
  return (
    <section className="nw-group px-skin px-drop px-panel" aria-label={group.title}>
      <NwSecHead as="h3" className="nw-group__head" title={group.title} note={group.note} right={`${count}건`}
        lead={<span className={`nw-group__mark nw-group__mark--${group.tone}`} aria-hidden="true">{group.mark}</span>} />
      {children}
    </section>
  );
}

export default function Changes({ onOpen }: { onOpen: OpenMon }) {
  const { data: gameday } = useGameday();
  const { data: dex } = useDex();
  const data = gameday.MOVE_CHANGES?.date ? gameday.MOVE_CHANGES : null;
  const [filter, setFilter] = useState<Filter>('all');

  // 기술 이름 → 그 기술이 걸린 스프라이트들 (affected 는 종 → 기술 방향이고 값이 한글 기술명이라 뒤집어 둔다). 없으면 빈 배열
  const relatedOf = useMemo(() => {
    const table = new Map<string, number[]>();
    for (const [sprite, hit] of Object.entries(data?.affected ?? {})) {
      for (const list of [hit.up, hit.down, hit.energy]) {
        for (const name of list ?? []) {
          const found = table.get(name) ?? [];
          found.push(Number(sprite));
          table.set(name, found);
        }
      }
    }
    return (move: MoveChange) => table.get(move.ko) ?? table.get(move.id) ?? [];
  }, [data]);

  if (!data) {
    return (
      <div className="page__body nw-changes" id="page-changes" data-route="changes">
        <NwEmpty>지금은 예정된 기술 변경이 없어요.</NwEmpty>
      </div>
    );
  }

  const daysLeft = moveChangeDaysLeft(data.date) ?? 0;
  const up = data.moves.filter((move) => move.kind === 'up');
  const down = data.moves.filter((move) => move.kind === 'down');
  const energy = data.moves.filter((move) => move.kind === 'energy');
  const show = (kind: Filter) => filter === 'all' || filter === kind;

  return (
    <div className="page__body nw-changes" id="page-changes" data-route="changes">
      {/* 시즌 · 적용일 머리 — 적용 전이면 빨강 판에 D-day, 적용 뒤면 가라앉은 판 */}
      <section className={`nw-season px-skin px-drop px-panel${daysLeft > 0 ? ' px-skin--brand' : ' px-skin--sunk'}`} aria-label="시즌 변경 일정">
        <div className="nw-season__copy">
          <p className="px-eyebrow nw-season__eyebrow">GO BATTLE LEAGUE · SEASON UPDATE</p>
          <h2 className="px-title nw-season__name">{data.season}</h2>
          <p className="nw-season__summary">이번 시즌 기술 밸런스 변경을 종류별로 확인하세요.</p>
        </div>
        <div className="nw-season__datebox">
          <span className="px-caption">적용일</span>
          <strong className="px-mono nw-season__date">{data.date}</strong>
          <NwBadge text={daysLeft > 0 ? `적용까지 D-${daysLeft}` : '적용 완료'} tone={daysLeft > 0 ? 'yellow' : 'mint'} />
        </div>
      </section>

      <div className="nw-change-stats" aria-label="변경 종류별 건수">
        {([
          ['up', '상향', up.length],
          ['down', '하향', down.length],
          ['energy', '에너지 조정', energy.length],
          ['new', '신규 기술', data.newMoves.length],
        ] as const).map(([kind, label, value]) => (
          <NwMetric key={kind} label={label} value={`${value}건`} sunk={filter !== kind} pressed={filter === kind}
            className={`nw-change-stat nw-change-stat--${kind}`} onClick={() => setFilter(filter === kind ? 'all' : kind)} />
        ))}
      </div>

      <NwNote title="변경값 읽는 법" className="nw-change-note">
        <NwNoteBody>
          위력은 <b>트레이너 배틀(PvP) 기준</b>입니다. 같은 기술도 레이드·체육관 위력은 별도로 관리됩니다.
        </NwNoteBody>
        <NwNoteBody>
          {daysLeft > 0
            ? '적용 전 변경안입니다. 적용 후 순위가 달라진 포켓몬은 순위표에 ▲▼로 표시됩니다.'
            : '변경 내용이 반영됐습니다. 순위표에서 최근 순위 변화도 함께 확인할 수 있습니다.'}
        </NwNoteBody>
      </NwNote>

      <PxChips label="변경 종류" items={FILTERS} value={filter} onPick={(id) => setFilter(id as Filter)} />

      {show('up') && up.length ? <Group kind="up" count={up.length}><ul className="nw-moves">{up.map((move) => <Row key={move.id} move={move} related={relatedOf(move)} onOpen={onOpen} />)}</ul></Group> : null}
      {show('down') && down.length ? <Group kind="down" count={down.length}><ul className="nw-moves">{down.map((move) => <Row key={move.id} move={move} related={relatedOf(move)} onOpen={onOpen} />)}</ul></Group> : null}
      {show('energy') && energy.length ? <Group kind="energy" count={energy.length}><ul className="nw-moves">{energy.map((move) => <Row key={move.id} move={move} related={relatedOf(move)} onOpen={onOpen} />)}</ul></Group> : null}
      {show('new') && data.newMoves.length ? (
        <Group kind="new" count={data.newMoves.length}>
          <ul className="nw-moves nw-moves--new">
            {data.newMoves.map((item, index) => (
              <li key={`${item.sprite}-${index}`} className="nw-move">
                <button type="button" className="nw-move__line nw-move__tap"
                  onClick={() => onOpen({ sprite: item.sprite, name: item.name, types: dex.DEX_DATA.forms[String(item.sprite)]?.types ?? [] })}>
                  <NwBadge text="신규" tone="blue" />
                  <span className="px-ball px-ball--sm nw-move__art"><Sprite id={item.sprite} /></span>
                  <b className="px-sub nw-move__name">{item.name}</b>
                  <span className="nw-move__amount">{item.move}</span>
                </button>
              </li>
            ))}
          </ul>
        </Group>
      ) : null}
      <NwFoot>출처: 포켓몬 GO 공식 GO 배틀리그 시즌 공지. 위력·에너지 값은 공지 표기를 그대로 옮겼고, 한글 기술명은 게임 내 표기로 자동 변환했어요.</NwFoot>
    </div>
  );
}
