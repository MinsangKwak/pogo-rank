// ─────────────────────────────────────────────────────────────────────────────
// components/BossAcc.tsx — D-MAX 화면의 '이번 주 보스' 접이식 (v3 views/max.js renderBossAcc)
//
// 이 상자가 D-MAX 화면의 첫 물음에 답한다 — **"이번 주에 뭘 데려가?"**.
// 아래 티어표는 "누가 세냐" 를 말하지, "지금 무엇을 준비하냐" 는 말하지 않는다.
//
// 보스를 고르는 순서 (v3 와 같다)
//   1) 오늘이 걸쳐 있는 dmax 일정 = 이번 주 보스
//   2) 없으면(맥스 먼데이 휴식 주) 앞으로 올 dmax 일정 중 가장 빠른 것을 '다음 보스' 로
//   3) 그것도 없으면 상자 자체를 안 그린다 — 빈 상자를 남기지 않는다
//
// 일정표가 다루는 달이 이번 달이 아니면(다음 달 데이터 미등재로 지난 달에 머문 상태)
// 지난 달 보스를 '이번 주' 로 내밀지 않는다 (v2.13.0 QA-20).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDex, useMax, useSchedule } from '../lib/data';
import { pickMonth } from '../lib/schedule';
import type { OpenMon } from '../lib/mon';
import { Sprite } from './Bits';
import { NameNode } from './Row';
import type { DmaxRow } from '../types/data';

const BOSS_STEP = 5;   // [더보기] 한 번에 다섯 (v3 state.bossShow)

const released = (rows: DmaxRow[] | undefined) => (rows ?? []).filter((row) => !row.unrel);

export default function BossAcc({ onOpen, onGoBoss }: {
  onOpen: OpenMon;
  onGoBoss: (type: string) => void;
}) {
  const { data: schedule } = useSchedule();
  const { data: max } = useMax();
  const { data: dex } = useDex();
  const [show, setShow] = useState(BOSS_STEP);

  const today = new Date();
  const month = pickMonth(schedule.SCHEDULE_MONTHS, today);
  if (!month) return null;
  if (today.getFullYear() !== month.ym.y || today.getMonth() + 1 !== month.ym.m) return null;

  const day = today.getDate();
  const dmax = month.items.filter((item) => item.cat === 'dmax' && item.t);
  let boss = dmax.find((item) => day >= item.s && day <= item.e);
  let prefix = '⚔️ 이번 주 보스 · ';
  if (!boss) {
    boss = dmax.filter((item) => item.s > day).sort((a, b) => a.s - b.s)[0];
    prefix = '⚔️ 이번 주 맥스 먼데이 휴식 · 다음 보스 ';
  }
  if (!boss?.t) return null;

  const type = boss.t;
  // 일정 label 에서 보스 이름만 뽑는다 — 괄호 설명을 떼고 'D-MAX ' 접두어도 지운다
  const bossName = boss.label.split(' (')[0]?.replace('D-MAX ', '') ?? '';
  const pool = released(max.DMAX_DATA[type]);
  const total = pool.length;
  const dealers = pool.slice(0, 2);
  const names = new Set(dealers.map((row) => row.name));
  const tank = released(max.DMAX_TANK[type]).find((row) => !names.has(row.name));
  const typeName = dex.TYPE_KO[type] ?? type;

  const rec = (row: DmaxRow, lead: string, sub?: string) => (
    <button key={`${row.sprite}-${lead}`} className="boss__rec"
      onClick={(event) => { event.stopPropagation(); onOpen(row); }}>
      <Sprite id={row.sprite} />
      <span>{lead}<NameNode name={row.name} labels={dex.FORM_LABELS} /></span>
      {sub ? <small className="row__sub">{sub}</small> : null}
    </button>
  );

  // 처음에는 접혀 있다 — 펼쳐 두면 티어표가 한 화면 아래로 밀린다 (v3 와 같다)
  return (
    <details className="schedule boss__acc is-on" id="boss-acc">
      <summary id="boss-acc-title">
        {prefix}{bossName} ({typeName}) · {month.ym.m}/{boss.s}–{boss.e}
      </summary>
      <div className="schedule__body" id="boss-acc-body">
        {/* 친구들 질문("뭘 데려가?")에 가장 가까운 답 — 딜러 둘 + 탱커 하나.
            탱커는 딜러와 같은 종이 겹치지 않게 고른다 */}
        {dealers.length && tank ? (
          <div className="party-card">
            <p className="schedule__sec">🧩 추천 파티 — 딜러 2 + 탱커 1</p>
            <div className="boss__recs recs-wrap">
              {dealers.map((row) => rec(row, '', `딜러 · 맥스 피해 ${row.dmg}`))}
              {rec(tank, '', `탱커 · EHP ${tank.ehp}${type === 'overall' ? '' : ` · 받는 배율 ×${tank.mult}`}`)}
            </div>
            <p className="detail__foot">
              딜러는 맥스 피해 × √내구 순위, 탱커는 체력 × 방어 ÷ 받는 배율(EHP) 순위의 1위. 탱커 전체 순위는 [탱커] 세그먼트에서
            </p>
          </div>
        ) : null}

        <p className="schedule__sec">{typeName} 보스 추천 딜러 (딜량순)</p>
        <div className="boss__recs recs-wrap">
          {pool.slice(0, show).map((row, index) => rec(row, `${index + 1} `))}
        </div>
        <div className="boss__foot">
          {show < total
            ? (
              <button className="boss__more"
                onClick={(event) => { event.preventDefault(); setShow(show + BOSS_STEP); }}>
                더보기 +{BOSS_STEP} ({Math.min(show, total)}/{total})
              </button>
            )
            : <span className="meta">{`전체 ${total}종 표시됨`}</span>}
          <button className="boss__more" onClick={(event) => { event.preventDefault(); onGoBoss(type); }}>
            {typeName} 보스 딜러 순위 ▸
          </button>
        </div>
      </div>
    </details>
  );
}
