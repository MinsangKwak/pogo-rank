// ─────────────────────────────────────────────────────────────────────────────
// components/BossAcc.tsx — D-MAX 화면의 '이번 주 보스' 판 (v3 views/max.js renderBossAcc → v6 피그마 08 안내 판)
//
// 이 판이 D-MAX 화면의 첫 물음에 답한다 — **"이번 주에 뭘 데려가?"**.
// 아래 티어표는 "누가 세냐" 를 말하지, "지금 무엇을 준비하냐" 는 말하지 않는다.
//
// 보스를 고르는 순서 (v3 와 같다)
//   1) 오늘이 걸쳐 있는 dmax 일정 = 이번 주 보스
//   2) 없으면(맥스 먼데이 휴식 주) 앞으로 올 dmax 일정 중 가장 빠른 것을 '다음 보스' 로
//   3) 그것도 없으면 판 자체를 안 그린다 — 빈 판을 남기지 않는다
//
// 일정표가 다루는 달이 이번 달이 아니면(다음 달 데이터 미등재로 지난 달에 머문 상태)
// 지난 달 보스를 '이번 주' 로 내밀지 않는다 (v2.13.0 QA-20).
//
// v6 — 머리 한 줄('이번 주 · 파라꼬 / 10.12–10.18')과 한 마디('보스 타입을 기준으로 후보를 좁혀보세요. 다음 주는 …')는
// 늘 보이고, 추천 파티 · 딜러 목록은 접이식으로 남긴다 — 펼쳐 두면 티어표가 한 화면 아래로 밀린다 (v3 와 같다).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useDex, useMax, useSchedule } from '../lib/data';
import { pickMonth } from '../lib/schedule';
import type { OpenMon } from '../lib/mon';
import { Sprite } from './Bits';
import { NameNode } from './Row';
import type { DmaxRow } from '../types/data';
import { maxVisible } from '../lib/maxVisible';
import { useRankStore } from '../stores/rank';
import { num } from '../lib/cell';

const BOSS_STEP = 5;   // [더보기] 한 번에 다섯 (v3 state.bossShow)

// 미구현 · 출시 예정(now)은 늘 빼고 — 보스별 추천 파티는 지금 데려갈 수 있는 것만 —, '맥스 참가' 는 D-MAX 화면의 체크를 따른다 (lib/maxVisible.ts · Codex, PR #341)
const released = (rows: DmaxRow[] | undefined, join: boolean) => maxVisible(rows, { join, now: true });

// 일정 label 에서 보스 이름만 뽑는다 — 괄호 설명을 떼고 'D-MAX ' 접두어도 지운다
const bossNameOf = (label: string) => label.split(' (')[0]?.replace('D-MAX ', '') ?? '';

export default function BossAcc({ onOpen, onGoBoss }: {
  onOpen: OpenMon;
  onGoBoss: (type: string) => void;
}) {
  const { data: schedule } = useSchedule();
  const { data: max } = useMax();
  const { data: dex } = useDex();
  // D-MAX 화면의 [맥스 참가 가능 다른 유닛] 체크와 같은 값
  const showJoin = useRankStore((s) => s.maxShowJoin);
  const [show, setShow] = useState(BOSS_STEP);

  const today = new Date();
  const month = pickMonth(schedule.SCHEDULE_MONTHS, today);
  if (!month) return null;
  if (today.getFullYear() !== month.ym.y || today.getMonth() + 1 !== month.ym.m) return null;

  const day = today.getDate();
  const dmax = month.items.filter((item) => item.cat === 'dmax' && item.t);
  let boss = dmax.find((item) => day >= item.s && day <= item.e);
  let lead = '이번 주';
  if (!boss) {
    boss = dmax.filter((item) => item.s > day).sort((a, b) => a.s - b.s)[0];
    lead = '이번 주 맥스 먼데이 휴식 · 다음 보스';
  }
  if (!boss?.t) return null;

  const type = boss.t;
  const bossName = bossNameOf(boss.label);
  // 다음 주 보스 — 이 보스 뒤에 오는 가장 빠른 일정. 같은 달 안에서만 안다 (다음 달 표는 아직 없을 수 있다)
  const after = boss;
  const next = dmax.filter((item) => item.s > after.e).sort((a, b) => a.s - b.s)[0];
  const pool = released(max.DMAX_DATA[type], showJoin);
  const total = pool.length;
  const dealers = pool.slice(0, 2);
  const names = new Set(dealers.map((row) => row.name));
  const tank = released(max.DMAX_TANK[type], showJoin).find((row) => !names.has(row.name));
  const typeName = dex.TYPE_KO[type] ?? type;
  const mm = String(month.ym.m).padStart(2, '0');
  const dd = (value: number) => String(value).padStart(2, '0');

  const rec = (row: DmaxRow, rank: string, sub?: string) => (
    <li key={`${row.sprite}-${rank}`}>
      <button type="button" className="rk-rec px-skin" onClick={() => onOpen(row)}>
        {rank ? <span className="px-badge px-skin rk-rec__rank">{rank}</span> : null}
        <span className="px-ball px-ball--sm"><Sprite id={row.sprite} /></span>
        <span className="rk-rec__main">
          <span className="rk-rec__name"><NameNode name={row.name} labels={dex.FORM_LABELS} /></span>
          {sub ? <span className="rk-rec__sub">{sub}</span> : null}
        </span>
      </button>
    </li>
  );

  return (
    <section className="px-note px-skin px-drop rk-boss" id="boss-acc" aria-labelledby="boss-acc-title">
      <p className="px-note__title" id="boss-acc-title">
        <span className="rk-boss__lead">{`${lead} · `}</span>{`${bossName} (${typeName})`}
        <span className="px-mono rk-boss__date">{` / ${mm}.${dd(boss.s)}–${mm}.${dd(boss.e)}`}</span>
      </p>
      <p className="px-note__body">
        보스 타입을 기준으로 후보를 좁혀보세요.
        {next?.t ? ` 다음 주는 ${bossNameOf(next.label)}(${dex.TYPE_KO[next.t] ?? next.t})가 등장합니다.` : ''}
      </p>
      {/* 처음에는 접혀 있다 — 펼쳐 두면 티어표가 한 화면 아래로 밀린다 (v3 와 같다) */}
      <details className="rk-boss__acc">
        <summary className="px-btn px-btn--sm px-skin">추천 파티 · 딜러 목록 보기</summary>
        <div className="rk-boss__body" id="boss-acc-body">
          {/* 친구들 질문("뭘 데려가?")에 가장 가까운 답 — 딜러 둘 + 탱커 하나. 탱커는 딜러와 같은 종이 겹치지 않게 고른다 */}
          {dealers.length && tank ? (
            <>
              <p className="px-sub">추천 파티 — 딜러 2 + 탱커 1</p>
              <ul className="rk-recs">
                {dealers.map((row) => rec(row, '', `딜러 · 맥스 피해 ${num(row.dmg)}`))}
                {rec(tank, '', `탱커 · EHP ${num(tank.ehp)}${type === 'overall' ? '' : ` · 받는 배율 ×${num(tank.mult)}`}`)}
              </ul>
              <p className="px-caption">
                딜러는 맥스 피해 × √내구, 탱커는 체력 × 방어 ÷ 받는 배율(EHP)을 기준으로 추천해요. 전체 탱커 순위는 [탱커] 탭에서 확인할 수 있어요
              </p>
            </>
          ) : null}
          <p className="px-sub">{`${typeName} 보스 추천 딜러 (딜량순)`}</p>
          <ul className="rk-recs">
            {pool.slice(0, show).map((row, index) => rec(row, String(index + 1).padStart(2, '0')))}
          </ul>
          <div className="px-note__actions">
            {show < total
              ? (
                <button type="button" className="px-btn px-btn--sm px-skin" onClick={() => setShow(show + BOSS_STEP)}>
                  {`더보기 +${BOSS_STEP} (${Math.min(show, total)}/${total})`}
                </button>
              )
              : <span className="px-caption">{`전체 ${total}종 표시됨`}</span>}
            <button type="button" className="px-btn px-btn--sm px-btn--primary px-skin" onClick={() => onGoBoss(type)}>
              {`${typeName} 보스 딜러 순위 →`}
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
