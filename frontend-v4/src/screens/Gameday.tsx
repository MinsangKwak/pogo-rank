// ─────────────────────────────────────────────────────────────────────────────
// screens/Gameday.tsx — 레이드 보스 · 알 부화 · 이벤트 일정
//
// 세 화면 다 gameday.json 한 묶음을 본다. **한 번 받으면 셋이 같이 열린다** —
// v3 는 이 표가 data-lazy.js 에 있어 화면마다 지연 번들 도착을 기다렸다.
// react-query 캐시가 그 기다림을 한 번으로 줄인다.
//
// **레이드·알 줄은 순위표 줄이 아니다.** 처음에 <Row> 를 억지로 썼더니 v3 와 다른 모양이 나왔다.
// v3 gameday.js 는 도감 카드(.dex__row)를 쓴다 — 순위가 없고 그림이 주인공인 목록이라서다:
//
//   <section class="gameday__sec">
//     <h2 class="page__sec">5성 레이드<span class="meta"> 2종</span></h2>
//     <div class="dex__list is-grid">
//       <button class="dex__row gameday__row">
//         <img class="sprite">
//         <div class="gameday__main">
//           <b><span class="form-tag">마이티폼</span><b>자시안</b></b>
//           <span class="meta gameday__note">페어리 · CP 2100–2188 · 흐림 부스트 · ✨</span>
//         </div>
//       </button>
//
// 보조줄은 **한 문자열**이다 (타입 · CP · 날씨 · ✨ 를 가운뎃점으로 이어 붙인다).
// ─────────────────────────────────────────────────────────────────────────────
import { useGameday, useDex } from '../lib/data';
import { Sprite } from '../components/Bits';
import { NameNode } from '../components/Row';
import type { GamedayMon } from '../types/data';

function MonCard({ mon, onOpen }: { mon: GamedayMon; onOpen: (sprite: number) => void }) {
  const { data } = useDex();
  // v3 와 같은 순서·같은 구분자 — 없는 조각은 넣지 않는다
  const note = [
    mon.types?.map((type) => data.TYPE_KO[type] ?? type).join('·'),
    `CP ${mon.cp.min}–${mon.cp.max}`,
    mon.weather?.length ? `${mon.weather.join('·')} 부스트` : '',
    mon.shiny ? '✨' : '',
  ].filter(Boolean).join(' · ');
  return (
    <button className="dex__row gameday__row" onClick={() => onOpen(mon.sprite)}>
      <Sprite id={mon.sprite} />
      <div className="gameday__main">
        <b><NameNode name={mon.name} labels={data.FORM_LABELS} /></b>
        <span className="meta gameday__note">{note}</span>
      </div>
    </button>
  );
}

function Grouped({ groups, suffix, onOpen }: {
  groups: Record<string, GamedayMon[]>; suffix: string; onOpen: (sprite: number) => void;
}) {
  return (
    <>
      {Object.entries(groups).map(([label, mons]) => (
        <section key={label} className="gameday__sec">
          <h2 className="page__sec">{label}{suffix}<span className="meta"> {mons.length}종</span></h2>
          <div className="dex__list is-grid">
            {mons.map((mon, index) => <MonCard key={`${mon.sprite}-${index}`} mon={mon} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
    </>
  );
}

export function Raids({ onOpen }: { onOpen: (sprite: number) => void }) {
  const { data } = useGameday();
  return (
    <div id="page-raids" className="page__body">
      <Grouped groups={data.GAMEDAY.raids} suffix=" 레이드" onOpen={onOpen} />
      <p className="detail__foot">데이터 기준 {data.GAMEDAY.fetched.slice(0, 10)} · 출처 LeekDuck</p>
    </div>
  );
}

export function Eggs({ onOpen }: { onOpen: (sprite: number) => void }) {
  const { data } = useGameday();
  return (
    <div id="page-eggs" className="page__body">
      <Grouped groups={data.GAMEDAY.eggs} suffix="" onOpen={onOpen} />
      <p className="detail__foot">데이터 기준 {data.GAMEDAY.fetched.slice(0, 10)} · 출처 LeekDuck</p>
    </div>
  );
}

const fmt = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

export function Schedule() {
  const { data } = useGameday();
  const now = Date.now();
  // 끝난 것은 뺀다 — 지난 일정을 목록에 남기면 "지금 뭐 하지" 에 답이 안 된다
  const events = data.GAMEDAY.events
    .filter((event) => Date.parse(event.end || event.start) >= now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return (
    <div className="page__body">
      <ul className="row-list is-list">
        {events.map((event) => {
          const live = Date.parse(event.start) <= now;
          return (
            <li key={event.id} className="row sched-row">
              <span className="row__rank">{live ? '지금' : fmt(event.start)}</span>
              <div className="row__main">
                <div className="row__name"><b>{event.title}</b></div>
                <div className="row__moves"><span>{event.heading ?? event.type}</span></div>
              </div>
              <div className="row__stats">
                <span className="row__score">{fmt(event.start)}</span>
                <span className="row__sub">~ {fmt(event.end)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="detail__foot">{events.length}건 · 데이터 기준 {data.GAMEDAY.fetched.slice(0, 10)}</p>
    </div>
  );
}
