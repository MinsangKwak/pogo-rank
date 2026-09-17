// ─────────────────────────────────────────────────────────────────────────────
// screens/Changes.tsx — ⚔️ 기술 변경 (v3 components/changes.js renderMoveChangesPage)
//
// 이 화면은 **예고**만 다룬다. 계산으로 알 수 없어 사람이 적은 목록을 그대로 보여 준다.
// 적용된 뒤의 결과(순위가 몇 계단 움직였는가)는 순위표 줄의 ▲▼ 가 말한다 —
// 그래서 '상향 예정' 같은 예측 표시는 만들지 않는다: 적용 전에는 사실(위력 변경)만,
// 적용 후에는 실제 변동만.
//
// **위력은 트레이너 배틀 기준이다.** 같은 기술이라도 레이드·체육관용 위력은 따로 관리되고
// 시즌 조정은 대부분 PvP 만 바꾼다 — 이걸 안 적으면 "위력이 올랐는데 왜 레이드 순위가 그대로냐" 가 된다.
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import { useDex, useGameday } from '../lib/data';
import { Sprite } from '../components/Bits';
import { moveChangeDaysLeft } from '../lib/changes';
import type { MoveChange } from '../types/data';
import type { OpenMon } from '../lib/mon';

/** 변경 기술 한 줄 — "아이언헤드  위력 70 → 85" */
function Row({ move }: { move: MoveChange }) {
  const arrow = move.kind === 'up' ? '▲' : move.kind === 'down' ? '▼' : '·';
  const amount = move.kind === 'energy' ? '에너지만 변경' : `위력 ${move.from} → ${move.to}`;
  // 방향만 클래스로 — 'energy' 는 색을 쓰지 않으므로 수식자를 붙이지 않는다
  const dir = move.kind === 'up' ? 'is-up' : move.kind === 'down' ? 'is-down' : '';
  return (
    <li className={`changes__row ${dir}`.trim()}>
      <span className="changes__mark">{arrow}</span>
      <div>
        <b>{move.ko}</b>
        <div className="changes__sub">{amount}{move.note ? <em> · {move.note}</em> : ''}</div>
      </div>
    </li>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="changes__sec">
      <h3>{title}</h3>
      {note ? <p className="detail__foot">{note}</p> : ''}
      {children}
    </section>
  );
}

export default function Changes({ onOpen }: { onOpen: OpenMon }) {
  const { data: gameday } = useGameday();
  const { data: dex } = useDex();
  const data = gameday.MOVE_CHANGES?.date ? gameday.MOVE_CHANGES : null;
  if (!data) return <p className="page__body" id="page-changes" data-route="changes">지금은 예정된 기술 변경이 없어요.</p>;

  const daysLeft = moveChangeDaysLeft(data.date) ?? 0;
  const up = data.moves.filter((move) => move.kind === 'up');
  const down = data.moves.filter((move) => move.kind === 'down');
  const energy = data.moves.filter((move) => move.kind === 'energy');

  return (
    <div className="page__body" id="page-changes" data-route="changes">
      <div className={`changes__head ${daysLeft > 0 ? 'is-soon' : 'is-done'}`}>
        <b>{data.season}</b>
        <span>{daysLeft > 0 ? `${data.date} 적용 · D-${daysLeft}` : `${data.date} 적용됨`}</span>
      </div>
      <p className="changes__scope">
        아래 위력 수치는 <b>트레이너 배틀(PvP) 기준</b>이에요. 같은 기술이라도 레이드·체육관용 위력은 따로 관리되고, 이번 조정은 대부분 PvP에만 적용돼요.
      </p>
      <p className="detail__foot">
        {daysLeft > 0
          ? '적용 전이라 순위표에는 아직 반영돼 있지 않아요. 적용 다음 날 자동 갱신되면 순위가 움직인 포켓몬에 ▲▼ 표시가 붙어요. 레이드 티어표를 움직이는 것은 사이코부스트(체육관·레이드 70 → 130)와 새로 배우는 기술 쪽이에요.'
          : '순위표는 이미 이 값으로 계산돼 있어요. 최근 움직인 포켓몬에는 ▲▼ 표시가 붙어요.'}
      </p>
      {up.length ? <Section title="위력이 오른 기술"><ul className="changes__list">{up.map((move) => <Row key={move.id} move={move} />)}</ul></Section> : ''}
      {down.length ? <Section title="위력이 내린 기술"><ul className="changes__list">{down.map((move) => <Row key={move.id} move={move} />)}</ul></Section> : ''}
      {energy.length ? (
        <Section title="에너지만 바뀐 기술" note="위력은 그대로라 레이드 DPS는 거의 그대로지만, PvP에서는 기술을 쓰는 빈도가 달라져요.">
          <ul className="changes__list">{energy.map((move) => <Row key={move.id} move={move} />)}</ul>
        </Section>
      ) : ''}
      {data.newMoves.length ? (
        <Section title={`새로 배우는 기술 · ${data.newMoves.length}건`} note="누르면 그 포켓몬의 상세 정보가 열려요.">
          <ul className="changes__new">
            {data.newMoves.map((item, index) => (
              <li key={`${item.sprite}-${index}`}
                onClick={() => onOpen({ sprite: item.sprite, name: item.name, types: dex.DEX_DATA.forms[String(item.sprite)]?.types ?? [] })}>
                <Sprite id={item.sprite} />
                <div><b>{item.name}</b><div className="changes__sub">{item.move}</div></div>
              </li>
            ))}
          </ul>
        </Section>
      ) : ''}
      <p className="detail__foot">출처: 포켓몬 GO 공식 GO 배틀리그 시즌 공지. 위력·에너지 값은 공지 표기를 그대로 옮겼고, 한글 기술명은 게임 내 표기로 자동 변환했어요.</p>
    </div>
  );
}
