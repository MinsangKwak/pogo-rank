// ─────────────────────────────────────────────────────────────────────────────
// screens/Gameday.tsx — 레이드 보스 · 알 부화 · 이벤트 일정
//
// 세 화면 다 gameday.json 한 묶음을 본다. **한 번 받으면 셋이 같이 열린다** —
// v3 는 이 표가 data-lazy.js 에 있어 화면마다 지연 번들 도착을 기다렸다.
// react-query 캐시가 그 기다림을 한 번으로 줄인다.
// ─────────────────────────────────────────────────────────────────────────────
import { useGameday } from '../lib/data';
import { Sprite, TypeDot } from '../components/Bits';
import type { GamedayMon } from '../types/data';

function MonRow({ mon }: { mon: GamedayMon }) {
  return (
    <div className="row">
      <Sprite id={mon.sprite} />
      <span className="row__main">
        <span className="row__name">
          <b>{mon.name}</b>
          {mon.shiny ? <span className="tag">✨</span> : null}
        </span>
        <span className="row__moves">CP {mon.cp.min.toLocaleString()} ~ {mon.cp.max.toLocaleString()}
          {mon.cpBoost ? ` · 부스트 ${mon.cpBoost.min.toLocaleString()} ~ ${mon.cpBoost.max.toLocaleString()}` : ''}</span>
      </span>
      {mon.types?.length ? (
        <span className="row__types">{mon.types.map((type) => <TypeDot key={type} type={type} />)}</span>
      ) : null}
      {mon.weather?.length ? <span className="row__metrics"><span className="row__metric"><em>날씨</em><b>{mon.weather.join('·')}</b></span></span> : null}
    </div>
  );
}

function Grouped({ groups }: { groups: Record<string, GamedayMon[]> }) {
  return (
    <>
      {Object.entries(groups).map(([label, mons]) => (
        <section key={label} className="page__sec-wrap">
          <h3 className="page__sec">{label}</h3>
          <div className="list">{mons.map((mon, index) => <MonRow key={`${mon.sprite}-${index}`} mon={mon} />)}</div>
        </section>
      ))}
    </>
  );
}

export function Raids() {
  const { data } = useGameday();
  return (
    <div className="page__body">
      <Grouped groups={data.GAMEDAY.raids} />
      <p className="detail__foot">데이터 기준 {data.GAMEDAY.fetched.slice(0, 10)} · 출처 LeekDuck</p>
    </div>
  );
}

export function Eggs() {
  const { data } = useGameday();
  return (
    <div className="page__body">
      <Grouped groups={data.GAMEDAY.eggs} />
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
      <div className="list">
        {events.map((event) => {
          const live = Date.parse(event.start) <= now;
          return (
            <div key={event.id} className={`row${live ? ' is-now' : ''}`}>
              <span className="row__main">
                <span className="row__name"><b>{event.title}</b></span>
                <span className="row__moves">{event.heading ?? event.type}</span>
              </span>
              <span className="row__metrics">
                <span className="row__metric"><em>{live ? '진행 중' : '시작'}</em><b>{fmt(event.start)}</b></span>
                <span className="row__metric"><em>끝</em><b>{fmt(event.end)}</b></span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="detail__foot">{events.length}건 · 데이터 기준 {data.GAMEDAY.fetched.slice(0, 10)}</p>
    </div>
  );
}
